export { xpg };
import pg from "pg";
const dbConfig = {
  host: "localhost",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: "postgres",
  max: 20, 
  idleTimeoutMillis: 30000  
};
async function xpg(config) {
  const pool = new pg.Pool({ ...dbConfig, ...config });
  return pool;
  let client = {};
    client = await pool.connect();
  return client;
}
