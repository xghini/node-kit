export { newRedis, newRedisCluster };
import Redis from "ioredis";

// function newRedis(config) {
//   const redis = new Redis(config);
//   // redis.on("error", (err) => console.error("Redis redis Error"));
//   // await redis.connect();
//   redis.add = add.bind(redis);
//   redis.update = update.bind(redis);
//   return redis;
// }
// async function add(key, value, option) {
//   // 只创建不覆盖
//   return this.set(key, value);
// }
// async function update(key, value, option) {
//   // 只覆盖不创建,返回旧值
//   this.set;
//   return this.set(key, value, { ...option, ...{ XX: true, GET: true } });
// }
function newRedis(a,b,c) {
  const cluster = new Redis(a,b,c);
  return cluster;
}

function newRedisCluster(
  config = [
    { port: 6380, host: "127.0.0.1" },
    { port: 6381, host: "127.0.0.1" },
    { port: 6382, host: "127.0.0.1" },
  ]
) {
  const cluster = new Redis.Cluster([
    { port: 6380, host: "127.0.0.1" },
    { port: 6381, host: "127.0.0.1" },
    { port: 6382, host: "127.0.0.1" },
  ]);
  return cluster;
}
