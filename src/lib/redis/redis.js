export { xredis, redis };
import Redis from "ioredis";
import lua from "./lua.js";
/**
 * 返回普通的ioredis实例,就不用再额外写ioredis的导入
 * @param  {...any} argv
 * @returns
 */
function redis(...argv) {
  const redis = new Redis(...argv);
  redis.on("error", (err) => console.error(err));
  return redis;
}
function xredis(...argv) {
  const host = argv[0]?.host || "127.0.0.1";
  const redis = new Redis(...argv);
  redis.on("error", (err) => console.error("Redis错误:", host, err));
  return Object.assign(redis, {
    host,
    scankey,
    scankeys,
    sync,
    avatar,
    hsql,
    hquery,
    sum,
    join,
    num,
  });
}
/**
 * 化身,全部做相同操作,包括自身(内部tmparr操作新数组避免了引用对外部rearr的影响)
 * @param {Redis[]} rearr
 * @param {*} fn 参数re进行操作
 * @returns {Promise<any[]>}
 */
async function avatar(rearr, fn) {
  const tmparr = [...rearr, this];
  const availableRedis = tmparr.filter((redis) => {
    return redis.status === "ready";
  });
  if (availableRedis.length < tmparr.length) {
    const filteredHosts = tmparr
      .filter((redis) => redis.status !== "ready")
      .map((redis) => redis.host);
    console.warn(
      `avatar 跳过(避免阻塞): ${filteredHosts.join(", ")}`
    );
  }
  return Promise.all(availableRedis.map(fn));
}
/**
 * 返回键数量
 * @param {*} pattern "user:*"
 * @returns {Promise<number>}
 */
async function num(pattern) {
  return this.eval(`return #redis.call('keys', ARGV[1])`, 0, pattern);
}
/**
 * 联表查询
 * 由query1+条件+query2构成
 * @param {*} aa 基本都是xx:*结构,其*部分作为关联字段值
 * @param {*} bb 标准query options
 * @param {*} cc 基本都是xx:*结构
 * @param {*} dd _fields,dd[0]作为联表字段
 * 更复杂的联表后面等有需求再改进补充
 * @returns
 * 
 * example:
 t3(
    "plan:*",
    {
      download: [">", 1000000],
      _sortby: "download",
      _sort: "desc",
      _limit: 10,
      _fields: ["download", "upload"],
    },
    "user:*",
    ["plans", "regdate", "pwd"]
  );
 * 此联表现阶段能很好的将plan和user连接起来.
 */
async function join(aa, bb, cc, dd) {
  let res = await this.hquery(aa, bb);
  let res1 = await this.hquery(cc, {
    [dd[0]]: res.map((v) => v[0].split(":")[1]),
    _fields: dd,
  });
  res.forEach((v, i) => {
    const tmp = res1.filter((v1) => v1[1] == v[0].split(":")[1])[0];
    res[i] = [...v, ...tmp];
  });
  return res;
}
/**
 * hsql因为要支持各种复杂条件,可以() && ||一起用，因此对宽松多变的通配符不好支持
 * hsql和hquery两个函数都过于复杂了,建议对期望结果进行校验
 * @param {string} pattern 键模式，如 'plan:*'
 * @param {string} expression 表达式条件，如 '(stop<>1&&remain=null)||remain>0'
 * @param {Object} options 可选参数
 * @param {number} options.limit 限制返回的结果数量
 * @param {string} options.sort 排序规格，如 'upload desc'
 * @param {string[]} options.fields 要返回的字段列表
 * @returns {Promise<Array>} 查询结果
 */
async function hsql(pattern, expression, options = {}) {
  if (!pattern || typeof pattern !== 'string') {
    throw new Error('Pattern must be a string');
  }
  if (!expression || typeof expression !== 'string') {
    throw new Error('Expression must be a string');
  }
  const { sort, limit, fields } = options;
  const params = [
    pattern,                         
    expression,                      
    sort || '',                      
    limit || 0,                      
    fields ? fields.join(',') : ''   
  ];
  const result = await this.eval(lua.hsql, 0, ...params);
  return JSON.parse(result);
}
/**
 * hquery则相反，处理相对没那么复杂，全是and或or，对字段和值的通配符都进行支持
 * hsql和hquery两个函数都过于复杂了,建议对期望结果进行校验
 * @param {*} pattern 
 * @param {*} options 对于不等于操作符<>，如果字段不存在（并且比较值不是NULL），这个条件会被视为满足;其它运算符都要求字段必须存在;feild:null则是专门找空或不存在的字段匹配.
 * { _sort, _limit, _fields }为预设查询字段,js只负责传参,在lua中实现功能;其它为匹配字段
 * _fields :["download","upload"] 指定返回字段 最终返回二维数组[[key,download,upload]];不指定则返回key的一维数组
 * _sort :"createDate desc" "createDate" "desc", 当_sort没设置时不排序;使用split(' ')得到的数组长1时,检测字符是否为desc或asc,是则对key排序;否则认为是指定的sortby默认asc排序;得到的数组长2时,第一个sortby(无效则对key排序) 第二个sort(desc|asc,其它无效字符为asc)
 * _limit 限制返回条数
 * @param {*} logic "and"|"or"
 * @returns 
 */
async function hquery(pattern, options = {}, logic="and") {
  const { _sort, _limit, _fields, ...filters } = options;
  let sort = "";
  if (typeof _sort === "string") {
    sort = _sort.trim();
  } else if (options._sortby) {
    sort = `${options._sortby} ${options._sort || "asc"}`.trim();
  }
  const filterArray = [];
  for (const [key, value] of Object.entries(filters)) {
    if (Array.isArray(value)) {
      const isOperatorArray =
        value[0] && [">", "<", ">=", "<=", "=", "<>", "!="].includes(value[0]);
      if (isOperatorArray) {
        let finalValue = value[1];
        if (finalValue === null || finalValue === undefined) {
          finalValue = "NULL";
        } else {
          finalValue = finalValue.toString();
        }
        const operator = value[0] === "!=" ? "<>" : value[0];
        filterArray.push(key, operator, finalValue);
      } else {
        const safeValues = value.map((v) => 
          v === null || v === undefined ? "NULL" : v.toString()
        );
        filterArray.push(key, "IN", JSON.stringify(safeValues));
      }
    } else if (typeof value === "string") {
      if (value.startsWith("!=") || value.startsWith("<>")) {
        const operator = "<>"; 
        const val = value.substring(value.startsWith("!=") ? 2 : 2).trim();
        filterArray.push(key, operator, val || "");
      }
      else if (value.includes('>') || value.includes('<') || value.includes('=') || 
          value.includes('&&') || value.includes('||')) {
        filterArray.push(key, "EXPR", value);
      }
      else if (value.includes("*")) {
        filterArray.push(key, "LIKE", value);
      } 
      else {
        filterArray.push(key, "=", value);
      }
    } else if (value === null || value === undefined) {
      filterArray.push(key, "IS", "NULL");
    } else {
      const safeValue =
        typeof value === "number" && value > Number.MAX_SAFE_INTEGER
          ? value.toString()
          : value;
      filterArray.push(key, "=", safeValue);
    }
  }
  const params = [
    pattern,
    sort,                            
    _limit || 0,                     
    _fields ? _fields.join(",") : "", 
    filterArray.length,              
    logic,                           
    ...filterArray,                  
  ];
  const result = await this.eval(lua.hquery, 0, ...params);
  return JSON.parse(result);
}
/**
 *
 * @param {*} pattern
 * @param {*} fields
 * @returns
 */
async function sum(pattern, fields) {
  try {
    if (!pattern || typeof pattern !== "string") {
      throw new Error("Pattern must be a string");
    }
    if (!Array.isArray(fields)) {
      throw new Error("Fields must be an array");
    }
    const result = await this.eval(lua.sum, 0, pattern, JSON.stringify(fields));
    const resultObj = {};
    for (const [key, value] of result) {
      if (key === "debug") {
        console.log("Debug info:", JSON.parse(value));
      } else {
        resultObj[key] = value;
      }
    }
    return resultObj;
  } catch (error) {
    console.error("Sum error:", error);
    throw error;
  }
}
async function scankey(pattern) {
  let cursor = "0";
  const batchSize = 5000;
  do {
    const [newCursor, keys] = await this.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      batchSize
    );
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
    const [newCursor, keys] = await this.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      batchSize
    );
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
    -- 否则处理指定字段
    local result = {}
    local allFields = redis.call('HKEYS', key)
    for _, field in ipairs(fields) do
      -- 检查是否包含通配符
      local isPattern = string.find(field, '[%*%?]') ~= nil
      if isPattern then
        -- 对于包含通配符的情况，使用模式匹配
        for _, existingField in ipairs(allFields) do
          if string.match(existingField, field) then
            local value = redis.call('HGET', key, existingField)
            if value ~= false then
              table.insert(result, existingField)
              table.insert(result, value)
            end
          end
        end
      else
        -- 对于不包含通配符的情况，使用精确匹配
        local value = redis.call('HGET', key, field)
        if value ~= false then
          table.insert(result, field)
          table.insert(result, value)
        end
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
  const scriptShas = {};
  for (const [type, script] of Object.entries(FILTER_SCRIPTS)) {
    scriptShas[type] = await this.script("LOAD", script);
  }
  const patterns = Array.isArray(pattern) ? pattern : [pattern];
  const allExactMatch = patterns.every(
    (p) => !p.includes("*") && !p.includes("?")
  );
  const uniqueKeys = new Set();
  if (allExactMatch) {
    for (const key of patterns) {
      const exists = await this.exists(key);
      if (exists) {
        uniqueKeys.add(key);
      }
    }
  } else {
    let cursor = "0";
    for (const currentPattern of patterns) {
      if (!currentPattern) continue;
      if (!currentPattern.includes("*") && !currentPattern.includes("?")) {
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
    await Promise.all(
      pipelines.map(async (pipeline) => {
        await pipeline.exec();
        if (pipeline.org.status === "ready") {
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
