export { xredis };
import Redis from "ioredis";
function xredis(...argv) {
  const redis = new Redis(...argv);
  return Object.assign(redis, {
    scankey,
    scankeys,    
    sync,
  });
}
async function scankey(pattern) {
  let cursor = '0';
  const batchSize = 1000; 
  do {
      const [newCursor, keys] = await this.scan(cursor, 'MATCH', pattern, 'COUNT', batchSize);
      if (keys.length > 0) {
          return keys[0];
      }
      cursor = newCursor;
  } while (cursor !== '0'); 
  return null; 
}
async function scankeys(pattern) {
  let cursor = '0';
  const batchSize = 1000; 
  const allKeys = [];
  do {
      const [newCursor, keys] = await this.scan(cursor, 'MATCH', pattern, 'COUNT', batchSize);
      allKeys.push(...keys);
      cursor = newCursor;
  } while (cursor !== '0'); 
  return allKeys;
}
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
  const allExactMatch = patterns.every(p => !p.includes('*') && !p.includes('?'));
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
      if (!currentPattern.includes('*') && !currentPattern.includes('?')) {
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
        keys.forEach(key => uniqueKeys.add(key));
      } while (cursor !== "0");
    }
  }
  const allKeys = Array.from(uniqueKeys);
  console.dev(`Sync start ${patterns.join(',')} to ${targetRedisList.length} target, total ${allKeys.length} keys`);
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
