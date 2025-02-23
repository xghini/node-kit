export { xpg };
import pg from "pg";

// 数据库配置
const dbConfig = {
  host: "localhost",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: "postgres",
  max: 20, // 连接池最大连接数
  idleTimeoutMillis: 30000  // 空闲连接超时时间
};

// 创建连接池
async function xpg(config) {
  const pool = new pg.Pool({ ...dbConfig, ...config });
  return pool;
  let client = {};
  // try {
    client = await pool.connect();
  // } catch (err) {
  //   console.log(err);
  // }
  return client;
}
