import pg from "pg";
import { insert } from "./insert.js";
import { truncate } from "./del.js";
const { Pool } = pg;
const instanceCache = new Map();
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
const gracefulShutdown = async (signal) => {
    await xpg.closeAll();
    process.exit(0);
};
["SIGINT", "SIGTERM"].forEach((signal) => process.on(signal, () => gracefulShutdown(signal)));
class PGClient {
    constructor(config = {}) {
        const finalConfig = { ...defaultConfig, ...config };
        this.config = finalConfig;
        this.pool = new Pool(finalConfig);
        this.pool.on("error", (err) => console.error("PG Pool Error:", {
            message: err.message,
            code: err.code,
            database: finalConfig.database,
            host: finalConfig.host,
        }));
        if (process.env.NODE_ENV !== "production") {
            this.pool.on("connect", (client) => {
                console.log(`数据库连接已建立 (PID: ${client.processID})`);
            });
        }
        this.insert = (table, data, options = {}) => insert(this, table, data, options);
        this.truncate = (table) => truncate(this, table);
    }
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
        }
        catch (err) {
            const duration = Date.now() - startTime;
            return [err, null];
        }
    }
    async getClient() {
        try {
            return [null, await this.pool.connect()];
        }
        catch (err) {
            console.error("获取数据库客户端失败:", {
                message: err.message,
                code: err.code,
                poolStatus: this.getPoolStatus(),
            });
            return [err, null];
        }
    }
    async transaction(callback, options = {}) {
        const [err, client] = await this.getClient();
        if (err)
            return [err, null];
        try {
            await client.query("BEGIN");
            if (options.isolationLevel) {
                await client.query(`SET TRANSACTION ISOLATION LEVEL ${options.isolationLevel}`);
            }
            const result = await callback(client);
            await client.query("COMMIT");
            return [null, result];
        }
        catch (error) {
            try {
                await client.query("ROLLBACK");
                console.log("事务已回滚");
            }
            catch (rollbackErr) {
                console.error("事务回滚失败:", rollbackErr);
            }
            return [error, null];
        }
        finally {
            client.release();
        }
    }
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
    async testConnection() {
        const [err, result] = await this.query("SELECT 1 as test");
        if (err)
            return [err, null];
        return [null, result.rows[0]?.test === 1];
    }
    async close() {
        if (this.pool.ended) {
            console.log("连接池已经关闭");
            return;
        }
        try {
            await this.pool.end();
            console.log("连接池已关闭");
        }
        catch (err) {
            console.error("关闭连接池失败:", err);
            throw err;
        }
    }
}
function xpg(config = {}) {
    const cacheKey = createCacheKey(config);
    if (!instanceCache.has(cacheKey)) {
        const client = new PGClient(config);
        instanceCache.set(cacheKey, client);
        console.log(`创建新的PG客户端实例: ${client.config.database}@${client.config.host}`);
    }
    return instanceCache.get(cacheKey);
}
xpg.transaction = async (callback, config = {}) => {
    const instance = xpg(config);
    return instance.transaction(callback);
};
xpg.getAllInstancesStatus = () => {
    return Array.from(instanceCache.entries()).map(([key, client]) => ({
        cacheKey: key,
        status: client.getPoolStatus(),
    }));
};
xpg.closeAll = async () => {
    const closePromises = Array.from(instanceCache.values()).map((client) => client.close());
    await Promise.allSettled(closePromises);
    instanceCache.clear();
};
export { xpg };
