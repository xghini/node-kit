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

// Redis Lua 脚本定义
const FILTER_SCRIPTS = {
  // string 类型的过滤脚本
  string: `
    local key = KEYS[1]
    local pattern = ARGV[1]
    local value = redis.call('GET', key)
    if value == false then return nil end
    -- 如果 pattern 为空，返回所有；否则进行匹配
    if pattern == '' or string.match(value, pattern) then
      return value
    end
    return nil
  `,

  // hash 类型的过滤脚本
  hash: `
    local key = KEYS[1]
    local fields = cjson.decode(ARGV[1])
    -- 如果字段列表为空，返回所有字段
    if #fields == 0 then
      return redis.call('HGETALL', key)
    end
    -- 否则只返回指定字段
    local result = {}
    for _, field in ipairs(fields) do
      local value = redis.call('HGET', key, field)
      if value ~= false then
        table.insert(result, field)
        table.insert(result, value)
      end
    end
    return result
  `,

  // set 类型的过滤脚本
  set: `
    local key = KEYS[1]
    local members = cjson.decode(ARGV[1])
    -- 如果成员列表为空，返回所有成员
    if #members == 0 then
      return redis.call('SMEMBERS', key)
    end
    -- 否则只返回指定成员中存在的部分
    local result = {}
    for _, member in ipairs(members) do
      if redis.call('SISMEMBER', key, member) == 1 then
        table.insert(result, member)
      end
    end
    return result
  `,

  // zset 类型的过滤脚本
  zset: `
    local key = KEYS[1]
    local members = cjson.decode(ARGV[1])
    -- 如果成员列表为空，返回所有成员和分数
    if #members == 0 then
      return redis.call('ZRANGE', key, 0, -1, 'WITHSCORES')
    end
    -- 否则只返回指定成员及其分数
    local result = {}
    for _, member in ipairs(members) do
      local score = redis.call('ZSCORE', key, member)
      if score ~= false then
        table.insert(result, member)
        table.insert(result, score)
      end
    end
    return result
  `,

  // list 类型的过滤脚本
  list: `
    local key = KEYS[1]
    local values = cjson.decode(ARGV[1])
    -- 如果值列表为空，返回所有元素
    if #values == 0 then
      return redis.call('LRANGE', key, 0, -1)
    end
    -- 否则只返回匹配的元素（保持原顺序）
    local all = redis.call('LRANGE', key, 0, -1)
    local result = {}
    local valueSet = {}
    for _, v in ipairs(values) do
      valueSet[v] = true
    end
    for _, v in ipairs(all) do
      if valueSet[v] then
        table.insert(result, v)
      end
    end
    return result
  `
};

async function sync(targetRedisList, pattern, options = {}) {
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

  // 预加载所有 Lua 脚本
  const scriptShas = {};
  for (const [type, script] of Object.entries(FILTER_SCRIPTS)) {
    scriptShas[type] = await this.script('LOAD', script);
  }

  let totalKeys = 0;
  let cursor = "0";
  do {
    const [newCursor, keys] = await this.scan(cursor, "MATCH", pattern, "COUNT", 1000);
    cursor = newCursor;
    
    if (keys.length) {
      const pipelines = targetRedisList.map((target) => {
        const p = target.pipeline();
        p.org = target;
        return p;
      });

      for (const key of keys) {
        const type = await this.type(key);
        const ttlPromise = this.ttl(key);

        let data = null;
        if (type === 'string') {
          // 对于 string 类型，使用 pattern 匹配
          const stringPattern = options.string || '';
          data = await this.evalsha(scriptShas.string, 1, key, stringPattern);
        } else if (type in FILTER_SCRIPTS) {
          // 对于其他类型，使用对应的过滤脚本
          const fields = options[type] || [];
          data = await this.evalsha(
            scriptShas[type], 
            1, 
            key, 
            JSON.stringify(fields)
          );
        }

        const ttl = await ttlPromise;

        if (data) {
          pipelines.forEach((pipeline) => {
            switch (type) {
              case "string":
                pipeline.set(key, data);
                break;
              case "hash":
                if (data.length) {
                  const hash = {};
                  for (let i = 0; i < data.length; i += 2) {
                    hash[data[i]] = data[i + 1];
                  }
                  pipeline.hmset(key, hash);
                }
                break;
              case "set":
                if (data.length) {
                  pipeline.sadd(key, data);
                }
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
                if (data.length) {
                  pipeline.rpush(key, data);
                }
                break;
            }
            if (ttl > 0) {
              pipeline.expire(key, ttl);
            }
          });
        }
      }

      totalKeys += keys.length;
      console.dev(`Sync ${pattern} to ${targetRedisList.length} target , total ${totalKeys} keys`);

      await Promise.all(
        pipelines.map(async (pipeline) => {
          await pipeline.exec();
          if (pipeline.org.status === "ready") {
            console.dev("Sync ok", pipeline.org.options.host);
          } else {
            xerr("error", pipeline.org.options.host, pipeline.org.status);
          }
        })
      );
    }
  } while (cursor !== "0");
}