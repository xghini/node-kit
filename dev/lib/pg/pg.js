import pg from "pg";

class PGClient {
  constructor(config = {}) {
    this.pool = new pg.Pool({
      host: "localhost",
      port: 5432,
      database: "postgres",
      user: "postgres",
      password: "postgres",
      max: 30,
      min: 5,
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 3000,
      maxUses: 7500,
      allowExitOnIdle: true,
      ...config,
    });
    
    // 存储表列信息的缓存
    this.columnTypeCache = {};
    
    this.pool.on('error', (err) => {
      console.error('PostgreSQL pool error:', err);
    });
  }

  // 获取表的列类型信息
  async getColumnTypes(tableName) {
    // 检查缓存
    if (this.columnTypeCache[tableName]) {
      return this.columnTypeCache[tableName];
    }
    
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1
      `;
      const result = await client.query(query, [tableName]);
      
      // 构建列类型映射
      const columnTypes = {};
      for (const row of result.rows) {
        columnTypes[row.column_name] = row.data_type;
      }
      
      // 缓存结果
      this.columnTypeCache[tableName] = columnTypes;
      return columnTypes;
    } finally {
      client.release();
    }
  }

  async query(tableName, options = {}) {
    const { _sort, _limit, _fields, _explain = false, _forceTypecast = {}, ...filters } = options;
    
    // 获取表列类型信息
    const columnTypes = await this.getColumnTypes(tableName);
    
    // 构建查询基础
    let query = `SELECT ${_fields ? _fields.join(", ") : "*"} FROM ${tableName}`;
    
    // 处理 WHERE 条件
    const whereConditions = [];
    const queryParams = [];
    let paramIndex = 1;
    
    for (const [key, value] of Object.entries(filters)) {
      // 确定列的数据类型
      const columnType = columnTypes[key];
      const forceType = _forceTypecast[key];
      
      if (Array.isArray(value)) {
        const isOperatorArray = 
          value[0] && [">", "<", ">=", "<=", "=", "!=", "<>"].includes(value[0]);
        
        if (isOperatorArray) {
          // 智能类型处理
          // 1. 对于主键或已知为数字类型的列，不进行类型转换以利用索引
          // 2. 对于字符串存储但需要数值比较的列，添加类型转换
          // 3. 为用户提供强制类型转换的选项

          if (forceType) {
            // 用户指定的强制类型转换
            whereConditions.push(`${key}::${forceType} ${value[0]} $${paramIndex++}`);
          } else if (key === 'id') {
            // 主键列通常不需要类型转换，以确保索引使用
            whereConditions.push(`${key} ${value[0]} $${paramIndex++}`);
          } else if (typeof value[1] === 'number' && 
                    (!columnType || 
                     !['integer', 'bigint', 'smallint', 'decimal', 'numeric', 'real', 'double precision'].includes(columnType.toLowerCase()))) {
            // 当值为数字但列不是数字类型时，添加转换
            whereConditions.push(`${key}::numeric ${value[0]} $${paramIndex++}`);
          } else {
            // 其他情况，不添加类型转换
            whereConditions.push(`${key} ${value[0]} $${paramIndex++}`);
          }
          queryParams.push(value[1]);
        } else {
          whereConditions.push(
            `${key} IN (${value.map(() => `$${paramIndex++}`).join(", ")})`
          );
          queryParams.push(...value);
        }
      } else {
        whereConditions.push(`${key} = $${paramIndex++}`);
        queryParams.push(value);
      }
    }
  
    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(" AND ")}`;
    }
  
    // 处理排序
    if (_sort) {
      let sortClause = "";
      if (typeof _sort === "string") {
        sortClause = _sort.trim();
      } else if (options._sortby) {
        sortClause = `${options._sortby} ${options._sort || "asc"}`.trim();
      }
  
      if (sortClause) {
        query += ` ORDER BY ${sortClause}`;
      }
    }
    
    // 处理限制
    if (_limit) {
      query += ` LIMIT $${paramIndex++}`;
      queryParams.push(_limit);
    }
    
    // 添加查询计时
    const startTime = Date.now();
    
    // 如果需要解释查询执行计划
    if (_explain) {
      query = `EXPLAIN ANALYZE ${query}`;
    }
    
    // 执行查询
    const client = await this.pool.connect();
    try {
      const result = await client.query(query, queryParams);
      const endTime = Date.now();
      
      // 当查询时间超过1秒时记录日志
      if (endTime - startTime > 1000) {
        console.warn(`Slow query (${endTime - startTime}ms): ${query}`, queryParams);
      }
      
      return result.rows;
    } finally {
      client.release();
    }
  }
  
  // 其他方法保持不变...
  async createIndex(tableName, columns, options = {}) {
    const indexName = options.name || `idx_${tableName}_${columns.join('_')}`;
    const unique = options.unique ? 'UNIQUE' : '';
    const method = options.method || 'btree';
    
    const query = `CREATE ${unique} INDEX IF NOT EXISTS ${indexName} 
                   ON ${tableName} USING ${method} (${columns.join(', ')})`;
    
    const client = await this.pool.connect();
    try {
      await client.query(query);
      return { success: true, indexName };
    } catch (error) {
      console.error(`Error creating index: ${error.message}`);
      return { success: false, error: error.message };
    } finally {
      client.release();
    }
  }
  
  async getTableStats(tableName) {
    const client = await this.pool.connect();
    try {
      const sizeQuery = `SELECT pg_size_pretty(pg_total_relation_size($1)) as total_size,
                          pg_size_pretty(pg_relation_size($1)) as table_size,
                          pg_size_pretty(pg_total_relation_size($1) - pg_relation_size($1)) as index_size`;
      const sizeResult = await client.query(sizeQuery, [tableName]);
      
      const countQuery = `SELECT reltuples::bigint AS row_estimate
                          FROM pg_class
                          WHERE relname = $1`;
      const countResult = await client.query(countQuery, [tableName]);
      
      const indexQuery = `SELECT indexname, indexdef
                          FROM pg_indexes
                          WHERE tablename = $1`;
      const indexResult = await client.query(indexQuery, [tableName]);
      
      return {
        size: sizeResult.rows[0],
        rowEstimate: countResult.rows[0]?.row_estimate || 0,
        indexes: indexResult.rows
      };
    } finally {
      client.release();
    }
  }
  
  async close() {
    await this.pool.end();
  }
}

/**
 * @param {*} config
 * @returns
 */
function xpg(config = {}) {
  return new PGClient(config);
}

export { xpg };