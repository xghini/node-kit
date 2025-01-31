export { xredis };
import Redis from "ioredis";
function xredis(...argv) {
    const redis = new Redis(...argv);
    let x = 0, y = 10;
    redis.on('error', (err) => {
        if (x % y === 0)
            console.error(err, y === 100 ? y = 1000 : y = 100);
        x++;
    });
    return Object.assign(redis, {
        scankey,
        scankeys,
        sync,
    });
}
async function scankey(pattern) {
    let cursor = "0";
    const batchSize = 5000;
    do {
        const [newCursor, keys] = await this.scan(cursor, "MATCH", pattern, "COUNT", batchSize);
        if (keys.length > 0) {
            return keys[0];
        }
        cursor = newCursor;
    } while (cursor !== "0");
    return null;
}
async function scankeys(pattern) {
    let cursor = "0";
    const batchSize = 5000;
    const allKeys = [];
    do {
        const [newCursor, keys] = await this.scan(cursor, "MATCH", pattern, "COUNT", batchSize);
        allKeys.push(...keys);
        cursor = newCursor;
    } while (cursor !== "0");
    return allKeys;
}
const FILTER_SCRIPTS = {
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
async function sync(targetRedisList, pattern, options = {}) {
    if (!Array.isArray(targetRedisList)) {
        if (targetRedisList instanceof Redis) {
            targetRedisList = [targetRedisList];
        }
        else {
            console.error("Need Redis clients");
            return;
        }
    }
    else if (targetRedisList.length === 0) {
        console.error("Need Redis clients");
        return;
    }
    const scriptShas = {};
    for (const [type, script] of Object.entries(FILTER_SCRIPTS)) {
        scriptShas[type] = await this.script("LOAD", script);
    }
    let totalKeys = 0;
    let cursor = "0";
    do {
        const [newCursor, keys] = await this.scan(cursor, "MATCH", pattern, "COUNT", 5000);
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
                if (type === "string") {
                    const stringPattern = options.string || "";
                    data = await this.evalsha(scriptShas.string, 1, key, stringPattern);
                }
                else if (type in FILTER_SCRIPTS) {
                    const fields = options[type] || [];
                    data = await this.evalsha(scriptShas[type], 1, key, JSON.stringify(fields));
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
                                        args.push(data[i + 1]);
                                        args.push(data[i]);
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
        }
    } while (cursor !== "0");
    console.dev(`Sync ${pattern} to ${targetRedisList.length} target , total ${totalKeys} keys`);
    await Promise.all(pipelines.map(async (pipeline) => {
        await pipeline.exec();
        if (pipeline.org.status === "ready") {
            console.dev("Sync ok", pipeline.org.options.host);
        }
        else {
            console.error("error", pipeline.org.options.host, pipeline.org.status);
        }
    }));
}
