export { xredis };
import Redis from "ioredis";
// import { sync } from "./sync.js";

function xredis(...argv) {
  const redis = new Redis(...argv);
  return Object.assign(redis, {
    scankey,
    scankeys,    
    sync,
  });
}
// 用scan找到首个匹配的key返回
async function scankey(pattern) {
  let cursor = '0';
  const batchSize = 1000; // 一次扫描的数量
  do {
      // 使用 SCAN 命令带 MATCH 和 COUNT 参数
      const [newCursor, keys] = await this.scan(cursor, 'MATCH', pattern, 'COUNT', batchSize);
      // 如果找到匹配的 keys，返回第一个匹配的 key
      if (keys.length > 0) {
          return keys[0];
      }
      // 更新游标
      cursor = newCursor;
  } while (cursor !== '0'); // 如果游标回到 0，说明遍历完成
  return null; // 如果没有找到任何匹配的 key，返回 null
}

async function scankeys(pattern) {
  let cursor = '0';
  const batchSize = 1000; // 一次扫描的数量
  const allKeys = [];
  do {
      // 使用 SCAN 命令带 MATCH 和 COUNT 参数
      const [newCursor, keys] = await this.scan(cursor, 'MATCH', pattern, 'COUNT', batchSize);
      // 合并找到的匹配 keys
      allKeys.push(...keys);
      // 更新游标
      cursor = newCursor;
  } while (cursor !== '0'); // 如果游标回到 0，说明遍历完成
  return allKeys;
}
// 安全性高的操作,pattern还是不要默认*比较好
async function sync(targetRedisList, pattern) {
  if (!Array.isArray(targetRedisList)) {
    if (targetRedisList instanceof Redis) {
      targetRedisList = [targetRedisList];
    } else {
      xerr("Need Redis clients");
      return;
    }
  } else if (targetRedisList.length === 0) {
    xerr("Need Redis clients");
    return;
  }
  let totalKeys = 0;
  let cursor = "0";
  do {
    const [newCursor, keys] = await this.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      1000
    );
    cursor = newCursor;
    if (keys.length) {
      // 为每个目标Redis创建pipeline
      const pipelines = targetRedisList.map((target) => {
        const p = target.pipeline();
        p.org = target;
        return p;
      });
      // 对每个 key 进行处理
      for (const key of keys) {
        // 获取 key 的类型
        const type = await this.type(key);
        // 获取数据和TTL的Promise
        const dataPromise = (async () => {
          switch (type) {
            case "string":
              const value = await this.get(key);
              return { type, data: value };
            case "hash":
              const hash = await this.hgetall(key);
              return { type, data: hash };
            case "set":
              const members = await this.smembers(key);
              return { type, data: members };
            case "zset":
              const zrange = await this.zrange(key, 0, -1, "WITHSCORES");
              return { type, data: zrange };
            case "list":
              const list = await this.lrange(key, 0, -1);
              return { type, data: list };
            default:
              return { type: null, data: null };
          }
        })();
        const ttlPromise = this.ttl(key);
        const [{ type: keyType, data }, ttl] = await Promise.all([
          dataPromise,
          ttlPromise,
        ]);
        if (keyType && data) {
          pipelines.forEach((pipeline) => {
            switch (keyType) {
              case "string":
                pipeline.set(key, data);
                break;
              case "hash":
                pipeline.hmset(key, data);
                break;
              case "set":
                if (data.length) pipeline.sadd(key, data);
                break;
              case "zset":
                if (data.length) {
                  const args = [key];
                  for (let i = 0; i < data.length; i += 2) {
                    args.push(data[i + 1]); // score
                    args.push(data[i]); // member
                  }
                  pipeline.zadd(...args);
                }
                break;
              case "list":
                if (data.length) pipeline.rpush(key, data);
                break;
            }
            if (ttl > 0) {
              pipeline.expire(key, ttl);
            }
          });
        }
      }
      totalKeys += keys.length;
      console.log(
        `Sync ${pattern} to ${targetRedisList.length} target , total ${totalKeys} keys`
      );
      // 执行,可以不用等结果
      // pipelines.forEach(pipeline => pipeline.exec());
      await Promise.all(
        pipelines.map(async (pipeline) => {
          await pipeline.exec();
          if (pipeline.org.status === "ready") {
            console.log("Sync ok", pipeline.org.options.host);
          } else {
            xerr("error", pipeline.org.options.host, pipeline.org.status);
          }
        })
      );
    }
  } while (cursor !== "0");
}
