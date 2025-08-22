// pg.js
import pg from "pg";
import { insert } from "./insert.js";
import { truncate } from "./del.js";

const { Pool } = pg;
const instanceCache = new Map();
// --- 配置与缓存 ---
const defaultConfig = {
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "postgres",
  host: process.env.PGHOST || "localhost",
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE || "postgres",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};
function createCacheKey(config) {
  const normalized = { ...defaultConfig, ...config };
  const keys = Object.keys(normalized).sort();
  return keys.map((key) => `${key}:${normalized[key]}`).join("|");
}
// --- 优雅关闭 ---
const gracefulShutdown = async (signal) => {
  // console.log(`收到${signal}结束信号，关闭所有连接池...`);
  await xpg.closeAll();
  process.exit(0);
};
["SIGINT", "SIGTERM"].forEach((signal) =>
  process.on(signal, () => gracefulShutdown(signal))
);
class PGClient {
  constructor(config = {}) {
    const finalConfig = { ...defaultConfig, ...config };
    this.config = finalConfig;
    this.pool = new Pool(finalConfig);
    // --- 事件监听 ---
    this.pool.on("error", (err) =>
      console.error("PG Pool Error:", {
        message: err.message,
        code: err.code,
        database: finalConfig.database,
        host: finalConfig.host,
      })
    );
    // [优化4] 只在非生产环境记录连接日志，避免生产环境噪音
    if (process.env.NODE_ENV !== "production") {
      this.pool.on("connect", (client) => {
        console.log(`数据库连接已建立 (PID: ${client.processID})`);
      });
    }
    // --- 方法绑定 ---
    /**
     * 高性能批量插入或更新(Upsert)数据。
     *
     * @param {object} pg - pg客户端实例。
     * @param {string} table - 表名。
     * @param {object|object[]} data - 要插入的数据。
     * @param {object} [options] - 选项。
     * @param {string|Array} [options.onconflict] - 冲突处理配置, 类型决定行为:
     * - **`string`**: 冲突时跳过 (DO NOTHING)。
     * `{ onconflict: 'id' }`
     * - **`Array`**: 冲突时更新 (DO UPDATE)。
     * `['target', ...updateColumns]`
     * - `target`: (string) 冲突列, 多个用逗号隔开, e.g., `'id'` 或 `'user_id,post_id'`。
     * - `...updateColumns`: (string[]) 要更新的列。若省略, 则更新所有非冲突列。
     *
     * @example
     * // 跳过冲突
     * await insert(pg, 't', data, { onconflict: 'cid' });
     *
     * // 冲突时更新所有非冲突列
     * await insert(pg, 't', data, { onconflict: ['cid'] });
     *
     * // 冲突时只更新指定列
     * await insert(pg, 't', data, { onconflict: ['cid', 'exp_date', 'cvv'] });
     *
     * // 复合键冲突
     * await insert(pg, 't', data, { onconflict: ['user_id,post_id', 'updated_at'] });
     *
     * @returns {Promise<[Error, null] | [null, import("pg").QueryResult<any>]>} 返回一个元组。
     */
    this.insert = (table, data, options = {}) =>
      insert(this, table, data, options);
    this.truncate = (table) => truncate(this, table);
  }
  // --- 核心方法 ---
  /**
   * 执行单条原生SQL。这是执行任何非事务性查询的首选。
   * @param {string} text - The SQL query text.
   * @param {any[]} [params] - The parameters for the query.
   * @returns {Promise<[Error, null] | [null, import("pg").QueryResult<any>]>}
   */
  async query(text, params = []) {
    const startTime = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - startTime;
      if (duration > 1000) {
        console.warn("慢查询检测:", {
          duration: `${duration}ms`,
          query: text.length > 200 ? text.substring(0, 200) + "..." : text,
          rowCount: result.rowCount,
        });
      }
      return [null, result];
    } catch (err) {
      const duration = Date.now() - startTime;
      // console.error("PG Query Error:", {
      //   message: err.message,
      //   code: err.code,
      //   severity: err.severity,
      //   detail: err.detail,
      //   hint: err.hint,
      //   query: text.length > 250 ? text.substring(0, 250) + "..." : text,
      //   params: params?.length > 0 ? params : undefined,
      //   duration: `${duration}ms`,
      // });
      return [err, null];
    }
  }

  /**
   * 获取一个专用的客户端，用于手动控制事务。
   * **重要**: 调用者必须在 finally 块中调用 client.release()。
   * @returns {Promise<[Error, null] | [null, import("pg").PoolClient]>}
   */
  async getClient() {
    try {
      return [null, await this.pool.connect()];
    } catch (err) {
      console.error("获取数据库客户端失败:", {
        message: err.message,
        code: err.code,
        poolStatus: this.getPoolStatus(),
      });
      return [err, null];
    }
  }

  // --- 辅助方法 ---

  /**
   * 以安全的方式执行事务，自动处理 BEGIN, COMMIT, ROLLBACK 和 client.release()。
   * @template T
   * @param {(client: import("pg").PoolClient) => Promise<T>} callback - 在事务中执行的异步函数
   * @param {{isolationLevel?: 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE'}} [options] - 事务选项
   * @returns {Promise<[Error, null] | [null, T]>} 返回一个元组，包含错误或回调函数的返回值
   */
  async transaction(callback, options = {}) {
    const [err, client] = await this.getClient();
    if (err) return [err, null];
    try {
      await client.query("BEGIN");
      // [优化3] 支持设置事务隔离级别
      if (options.isolationLevel) {
        await client.query(
          `SET TRANSACTION ISOLATION LEVEL ${options.isolationLevel}`
        );
      }
      const result = await callback(client);
      await client.query("COMMIT");
      return [null, result];
    } catch (error) {
      try {
        await client.query("ROLLBACK");
        console.log("事务已回滚");
      } catch (rollbackErr) {
        console.error("事务回滚失败:", rollbackErr);
      }
      return [error, null];
    } finally {
      client.release();
    }
  }
  /**
   * [优化1] 以原子方式批量执行多个查询（在单个事务中）。
   * @param {Array<{text: string, params?: any[]}>} mquery - 要执行的查询数组
   * @returns {Promise<[Error, null] | [null, import("pg").QueryResult<any>[]]>} 返回一个元组，包含错误或所有查询结果的数组
   */
  async mquery(mquery) {
    if (!Array.isArray(mquery) || mquery.length === 0) {
      return [null, []];
    }
    return this.transaction(async (client) => {
      const results = [];
      for (const query of mquery) {
        const result = await client.query(query.text, query.params || []);
        results.push(result);
      }
      return results;
    });
  }

  // --- 其他工具方法 ---

  /**
   * 获取连接池状态
   * @returns {Object} 连接池状态信息
   */
  getPoolStatus() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
      config: {
        max: this.config.max,
        database: this.config.database,
        host: this.config.host,
        port: this.config.port,
      },
    };
  }

  /**
   * 测试数据库连接
   * @returns {Promise<[Error, null] | [null, boolean]>} 返回连接测试结果
   */
  async testConnection() {
    const [err, result] = await this.query("SELECT 1 as test");
    if (err) return [err, null];
    return [null, result.rows[0]?.test === 1];
  }

  /**
   * 关闭连接池
   */
  async close() {
    if (this.pool.ended) {
      console.log("连接池已经关闭");
      return;
    }

    try {
      await this.pool.end();
      console.log("连接池已关闭");
    } catch (err) {
      console.error("关闭连接池失败:", err);
      throw err;
    }
  }
}

// --- 工厂函数与静态方法 ---

/**
 * xpg 工厂函数 - 获取或创建PGClient实例
 * @param {Object} config - 数据库配置
 * @returns {PGClient} PGClient实例
 */
function xpg(config = {}) {
  const cacheKey = createCacheKey(config);
  if (!instanceCache.has(cacheKey)) {
    const client = new PGClient(config);
    instanceCache.set(cacheKey, client);
    console.log(
      `创建新的PG客户端实例: ${client.config.database}@${client.config.host}`
    );
  }
  return instanceCache.get(cacheKey);
}

/**
 * 以安全的方式执行事务的静态便捷方法。
 * @template T
 * @param {(client: import("pg").PoolClient) => Promise<T>} callback - 事务回调
 * @param {Object} [config] - 数据库配置
 * @returns {Promise<[Error, null] | [null, T]>} - [优化2] 返回值与库的其他部分保持一致
 */
xpg.transaction = async (callback, config = {}) => {
  const instance = xpg(config);
  return instance.transaction(callback);
};

/**
 * 获取所有活跃实例的状态
 * @returns {Array} 所有实例的状态信息
 */
xpg.getAllInstancesStatus = () => {
  return Array.from(instanceCache.entries()).map(([key, client]) => ({
    cacheKey: key,
    status: client.getPoolStatus(),
  }));
};

/**
 * 关闭所有实例
 */
xpg.closeAll = async () => {
  const closePromises = Array.from(instanceCache.values()).map((client) =>
    client.close()
  );
  await Promise.allSettled(closePromises);
  instanceCache.clear();
  // console.log("所有PG实例已关闭并清空缓存");
};

export { xpg };
