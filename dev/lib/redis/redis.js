export { xredis };
import Redis from "ioredis";
import lua from "./lua.js";
// import { sync } from "./sync.js";



/*
使用lua，完成联表查询的redis封装
1.
找到pattern='plan:*'的hash中stop字段为1的key 
找到pattern='user:*'的hash中plans字段为mSIusSz2Ku3YUWxB85cQa1的key
2.
*/
function xredis(...argv) {
  const redis = new Redis(...argv);
  redis.on("error", (err) => console.error(err));
  return Object.assign(redis, {
    scankey,
    scankeys,
    sync,
    hquery,
    sum
  });
}
async function hquery(pattern, options = {}) {
  const {
    _sortby,
    _sort = 'asc',
    _limit,
    _fields,
    ...filters
  } = options;
  const filterArray = [];
  for (const [key, value] of Object.entries(filters)) {
    if (Array.isArray(value)) {
      filterArray.push(key, ...value);
    } else {
      filterArray.push(key, '=', value);
    }
  }
  const params = [
    pattern,
    _sortby || '',
    _sort || '',
    _limit || 0,
    _fields ? _fields.join(',') : '',
    filterArray.length,
    ...filterArray
  ];
  const result = await this.eval(lua.query, 0, ...params);
  return JSON.parse(result);
}

async function sum(pattern, fields) {
  try {
    if (!pattern || typeof pattern !== 'string') {
      throw new Error('Pattern must be a string');
    }
    if (!Array.isArray(fields)) {
      throw new Error('Fields must be an array');
    }
    const result = await this.eval(
      lua.sum,
      0,
      pattern,
      JSON.stringify(fields)
    );
    
    // 提取并打印调试信息
    const resultObj = {};
    for (const [key, value] of result) {
      if (key === 'debug') {
        console.log('Debug info:', JSON.parse(value));
      } else {
        resultObj[key] = value;
      }
    }
    return resultObj;
  } catch (error) {
    console.error('Sum error:', error);
    throw error;
  }
}

// 用scan找到首个匹配的key返回
async function scankey(pattern) {
  let cursor = "0";
  const batchSize = 5000;
  do {
    // 使用 SCAN 命令带 MATCH 和 COUNT 参数
    const [newCursor, keys] = await this.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      batchSize
    );
    // 如果找到匹配的 keys，返回第一个匹配的 key
    if (keys.length > 0) {
      return keys[0];
    }
    // 更新游标
    cursor = newCursor;
  } while (cursor !== "0");
  return null;
}

async function scankeys(pattern) {
  let cursor = "0";
  const batchSize = 5000;
  const allKeys = [];
  do {
    // 使用 SCAN 命令带 MATCH 和 COUNT 参数
    const [newCursor, keys] = await this.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      batchSize
    );
    // 合并找到的匹配 keys
    allKeys.push(...keys);
    // 更新游标
    cursor = newCursor;
  } while (cursor !== "0");
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
  `,
};

/**
 *
 * @param {*} targetRedisList [redis,...]
 * @param {*} pattern 精确匹配及通配符匹配,可以单条或多条的数组,支持混合使用 ['a','b','c',...] "plan:*|user:*"
 * @param {*} options {hash:['a','b],set:['some','field']}
 * 对于指定的比如hash set,就会挑选出对应的field,没指定的会返回所有(只要匹配到)
 *
 * @returns
 */
async function sync(targetRedisList, pattern, options = {}) {
  // this是redis
  const batch = options.batch || 2000;
  if (!Array.isArray(targetRedisList)) {
    if (targetRedisList instanceof Redis) {
      targetRedisList = [targetRedisList];
    } else {
      console.error("Need Redis clients");
      return;
    }
  } else if (targetRedisList.length === 0) {
    console.error("Need Redis clients");
    return;
  }
  // 预加载所有Lua脚本,使用返回的hash调用
  const scriptShas = {};
  for (const [type, script] of Object.entries(FILTER_SCRIPTS)) {
    scriptShas[type] = await this.script("LOAD", script);
  }
  const patterns = Array.isArray(pattern) ? pattern : [pattern];
  // 判断是否所有的pattern都是精确匹配（不包含通配符）
  const allExactMatch = patterns.every(
    (p) => !p.includes("*") && !p.includes("?")
  );
  // 用于存储所有匹配到的唯一键
  const uniqueKeys = new Set();
  if (allExactMatch) {
    // 对于精确匹配，直接使用EXISTS检查键是否存在
    for (const key of patterns) {
      const exists = await this.exists(key);
      if (exists) {
        uniqueKeys.add(key);
      }
    }
  } else {
    // 对于模式匹配，使用SCAN
    let cursor = "0";
    for (const currentPattern of patterns) {
      if (!currentPattern) continue;
      if (!currentPattern.includes("*") && !currentPattern.includes("?")) {
        // 对于混合情况中的精确匹配，直接检查存在性
        const exists = await this.exists(currentPattern);
        if (exists) {
          uniqueKeys.add(currentPattern);
        }
        continue;
      }
      do {
        const [newCursor, keys] = await this.scan(
          cursor,
          "MATCH",
          currentPattern,
          "COUNT",
          batch
        );
        cursor = newCursor;
        keys.forEach((key) => uniqueKeys.add(key));
      } while (cursor !== "0");
    }
  }
  const allKeys = Array.from(uniqueKeys);
  console.dev(
    `Sync start ${patterns.join(",")} to ${
      targetRedisList.length
    } target, total ${allKeys.length} keys`
  );
  for (let i = 0; i < allKeys.length; i += batch) {
    // 分批处理
    // 对每个key，根据类型使用对应的过滤脚本,除了string用pattern匹配,其它都是用field匹配
    const batchKeys = allKeys.slice(i, i + batch);
    const pipelines = targetRedisList.map((target) => {
      const p = target.pipeline();
      p.org = target;
      return p;
    });
    for (const key of batchKeys) {
      const type = await this.type(key);
      const ttlPromise = this.ttl(key);
      let data = null;
      if (type === "string") {
        const stringPattern = options.string || "";
        data = await this.evalsha(scriptShas.string, 1, key, stringPattern);
      } else if (type in FILTER_SCRIPTS) {
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
    await Promise.all(
      pipelines.map(async (pipeline) => {
        await pipeline.exec();
        if (pipeline.org.status === "ready") {
          // console.dev("Sync ok", pipeline.org.options.host);
        } else {
          console.error(
            "error",
            pipeline.org.options.host,
            pipeline.org.status
          );
        }
      })
    );
  }
  console.dev(`Sync OK`);
}
