import {
  xconsole,
  newRedis,
  sleep,
  interval,
  timelog,
} from "@ghini/kit/dev";
xconsole();

import { createClient } from 'redis';
// const redisClient = createClient({
//   socket: {
//     host: '127.0.0.1',
//     port: 6379
//   },
//   // Redis 集群配置
//   clusters: [
//     { host: '127.0.0.1', port: 7000 },
//     { host: '127.0.0.1', port: 7001 },
//     { host: '127.0.0.1', port: 7002 }
//   ]
// });
const redisClient = createClient({
  url: 'redis://127.0.0.1:6379,127.0.0.1:6380,127.0.0.1:6381'
});
redisClient.on('error', err => console.log('Redis Client Error', err));
await redisClient.connect();
// 创建用户集合
await redisClient.sAdd('users', 'user1');
await redisClient.sAdd('users', ['user2', 'user3']);

// 读取用户集合
const members = await redisClient.sMembers('users');
const isMember = await redisClient.sIsMember('users', 'user1');

// 更新(添加新成员)
await redisClient.sAdd('users', 'user4');

// // 删除成员
// await redisClient.sRem('users', 'user1');
// await redisClient.sRem('users', ['user2', 'user3']);

// const redis = newRedis();
// // IORedis 客户端
// // 创建用户集合
// await redis.sadd('users', 'user1');
// await redis.sadd('users', 'user2', 'user3');

// // 读取用户集合
// const ioMembers = await redis.smembers('users');
// const ioIsMember = await redis.sismember('users', 'user1');

// // 更新(添加新成员)
// await redis.sadd('users', 'user4');



// timelog(c);
// timelog(r);
// timelog(u);
// timelog(d);
async function c() {
  // return await redis.set("pzn", "6666");
  // redis.add("user:admin@xship.top");
  // await redis.add("tmp:aaa:pzn", "555");
  // return await redis.add("tmp-aaa-pzn", "555");
  const arr = Array.from({ length: 20 }, (_, i) => i);
  return await Promise.all(
    arr.map(async (i) => {
      console.log(i);
      await redis.set(`key${i}`, `value${i}`);
    })
  );
}
async function r() {
  // console.log(await redis.get("pzn"));
  // await redis.dbsize();
  // return await redis.keys("*");
}
async function u() {
  // redis.set("pzn", "555");
  return await redis.update("pzn", "888");
}
async function d() {
  return await redis.del("key100");
  // return await redis.flushall();
}

async function fn0() {
  await redis.set(
    "user:1001",
    JSON.stringify({
      name: "Alice",
      age: 30,
      address: {
        city: "Shanghai",
        street: "Nanjing Road",
      },
    })
  );
  // 更新城市
  let user = JSON.parse(await redis.get("user:1001"));
  user.address.city = "Beijing";
  await redis.set("user:1001", JSON.stringify(user));
}
async function fn1() {
  // 使用 ReJSON 存储 JSON 对象
  await redis.call(
    "JSON.SET",
    "user:1001",
    ".",
    JSON.stringify({
      name: "Alice",
      age: 30,
      address: {
        city: "Shanghai",
        street: "Nanjing Road",
        zip: "200000",
        phone: "1234567890",
      },
    })
  );

  // 更新城市
  await redis.call("JSON.SET", "user:1001", ".address.city", '"Beijing"');
}
