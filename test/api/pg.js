import kit from "@ghini/kit/dev";
kit.cs(666);
import pkg from "pg";
const { Pool } = pkg;
kit.env();
const pool = new Pool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  // max: 10, // 最大连接数
  // idleTimeoutMillis: 30000, // 空闲连接超时
  // connectionTimeoutMillis: 2000, // 连接超时
});
getUser();
getUserWithClient();
// 方法1: 使用 async/await
async function getUser() {
  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      "admin@xship.top",
    ]);
    console.log(result.rows[0]); // 第一个匹配的用户
  } catch (err) {
    console.error("Error executing query", err);
  }
}

// 方法2: 使用回调
pool.query(
  "SELECT * FROM users WHERE email = $1",
  ["admin@xship.top"],
  (err, result) => {
    if (err) {
      console.error("Error executing query", err);
      return;
    }
    console.log(result.rows[0]);
  }
);

// 方法3: 如果你想复用连接（性能更好）
async function getUserWithClient() {
  const client = await pool.connect();
  try {
    const result = await client.query("SELECT * FROM users WHERE email = $1", [
      "admin@xship.top",
    ]);
    console.log(result.rows[0]);
  } finally {
    client.release(); // 重要：记得释放连接
  }
}

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
});
// 优雅关闭
process.on("SIGINT", async () => {
  await pool.end();
  process.exit(0);
});
