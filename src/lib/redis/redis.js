export { newRedis, newRedisCluster };
import Redis from "ioredis";
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
