// 迁移数据
import kit from "@ghini/kit/dev";
import Redis from "ioredis";
// import * as auth from "./auth.js";
// import * as user from "./user.js";
import conf from "./conf.js";
import lua from "./lua.js";
kit.xconsole();
const sourceRedis = new Redis();
const targetRedis = new Redis(conf.redis[0]);
// console.log(await targetRedis.keys("*"));

// 使用 pipeline 批量处理以提高性能
async function migrateKeys(pattern = '*') {
  try {
    console.log(`开始迁移 pattern: ${pattern} 的数据...`);
    let totalKeys = 0;
    let cursor = '0';
    do {
      // 使用 SCAN 命令批量获取 keys
      const [newCursor, keys] = await sourceRedis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        1000
      );
      cursor = newCursor;
      if (keys.length) {
        // 不需要判断逻辑可以使用pipeLine
        const pipeline = targetRedis.pipeline();
        // 对每个 key 进行处理
        for (const key of keys) {
          // 获取 key 的类型
          const type = await sourceRedis.type(key);
          switch (type) {
            case 'string':
              const value = await sourceRedis.get(key);
              pipeline.set(key, value);
              break;
            case 'hash':
              const hash = await sourceRedis.hgetall(key);
              pipeline.hmset(key, hash);
              break;
            case 'set':
              const members = await sourceRedis.smembers(key);
              if (members.length) pipeline.sadd(key, members);
              break;
            case 'zset':
              const zrange = await sourceRedis.zrange(key, 0, -1, 'WITHSCORES');
              if (zrange.length) {
                const args = [key];
                for (let i = 0; i < zrange.length; i += 2) {
                  args.push(zrange[i + 1]); // score
                  args.push(zrange[i]);     // member
                }
                pipeline.zadd(...args);
              }
              break;
            case 'list':
              const list = await sourceRedis.lrange(key, 0, -1);
              if (list.length) pipeline.rpush(key, list);
              break;
          }
          // 同步 TTL
          const ttl = await sourceRedis.ttl(key);
          if (ttl > 0) {
            pipeline.expire(key, ttl);
          }
        }
        // 执行 pipeline
        await pipeline.exec();
        totalKeys += keys.length;
        console.log(`已迁移 ${totalKeys} 个 keys...`);
      }
    } while (cursor !== '0');
    console.log(`迁移完成！共迁移 ${totalKeys} 个 keys`);
  } catch (error) {
    console.error('迁移出错:', error);
  } finally {
    sourceRedis.disconnect();
    targetRedis.disconnect();
  }
}
migrateKeys();