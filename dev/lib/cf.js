// cf.js cloudflare使用api的便捷封装 - 兼容Global API Key和API Token
// 使用了每秒100次10ms间隔的高并发,不适合持续自行把控,cf限制1200次/5min
export { cf };
import { req } from "./http/req.js";
import { queue } from "./queue.js";

async function cf(obj) {
  const key = obj.key;
  const domain = obj.domain;
  const email = obj.email;
  // 根据是否提供email决定认证方式
  let auth,
    headers = {};
  if (email) {
    // Global API Key认证方式
    headers = {
      "X-Auth-Email": email,
      "X-Auth-Key": key,
    };
  } else {
    // API Token认证方式
    auth = "Bearer " + key;
  }
  // 调用时传入正确的参数
  const zid = await getZoneId.bind({ domain, auth, headers })();
  return {
    auth,
    headers,
    domain,
    zid,
    getZoneId,
    add,
    madd,
    set,
    mset,
    del,
    mdel,
    setSecurity, //开盾之类的操作
    setByContent,
    msetByContent,
    setByContentForce,
    msetByContentForce,
  };
}

// --- 配置常量 ---
const CONFIG = {
  MAX_RETRIES: 3, // 最大重试次数
  RETRY_DELAY: 1000, // 初始重试延迟（毫秒）
};

// --- 核心辅助函数 ---

/**
 * 重试机制 - 处理网络不稳定情况 (No changes needed)
 */
async function retryOperation(
  fn,
  maxRetries = CONFIG.MAX_RETRIES,
  delay = CONFIG.RETRY_DELAY,
  operation = "操作"
) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (
        error.message &&
        (error.message.includes("权限不足") ||
          error.message.includes("认证失败") ||
          error.message.includes("Invalid API key") ||
          error.message.includes("unauthorized"))
      ) {
        throw error;
      }
      if (i < maxRetries - 1) {
        const retryDelay = delay * Math.pow(2, i);
        console.log(
          `'${operation}' 第 ${i + 1} 次失败，${retryDelay}ms 后重试...`
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }
  console.error(`'${operation}' 在 ${maxRetries} 次尝试后失败`);
  throw lastError;
}

/**
 * [REFACTORED] 统一的批量处理器，使用您的queue函数
 * @param {Array} items - The items to process.
 * @param {Function} processor - The async function to process each item.
 * @param {Object} options - Configuration options.
 * @param {Function} [options.groupBy=null] - A function to group items by a key to process them serially.
 * @param {string} [options.operationName="批量操作"] - Name for the summary log.
 * @returns {Promise<Array>}
 */
async function batchProcess(items, processor, options = {}) {
  const { groupBy = null, operationName = "批量操作" } = options;
  let results = new Array(items.length);
  
  // 实例化您的队列
  const runInQueue = queue(100, { minInterval: 10 });

  if (groupBy) {
    // --- Grouped Operations ---
    // Safely process items for the same resource serially,
    // while processing different groups concurrently via the queue.
    const grouped = new Map();
    items.forEach((item, index) => {
      const key = groupBy(item);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push({ item, index });
    });
    const groupPromises = Array.from(grouped.values()).map(group =>
      runInQueue(async () => {
        for (const { item, index } of group) {
          try {
            results[index] = await processor(item);
          } catch (error) {
            results[index] = { success: false, error: error.message, changed: false };
          }
        }
      })
    );
    await Promise.all(groupPromises);
  } else {
    // --- Ungrouped Operations ---
    // Process all items concurrently through the queue.
    const promises = items.map((item, index) => 
      runInQueue(async () => {
        try {
          results[index] = await processor(item);
        } catch (error) {
          results[index] = { success: false, error: error.message, changed: false };
        }
      })
    );
    await Promise.all(promises);
  }

  // --- 统一的、精简的日志总结 ---
  const changedCount = results.filter((r) => r && r.changed).length;
  const successCount = results.filter((r) => r && r.success).length;
  const failCount = items.length - successCount;

  console.log(`\n📊 ${operationName} 执行完成:`);
  console.log(`✅ 变更: ${changedCount} 条`);
  if (failCount > 0) {
    console.log(`❌ 失败/跳过: ${failCount} 条`);
  }
  console.log(`📋 总计: ${items.length} 条`);
  return results;
}


// --- 批量方法 (m*) ---
async function mset(arr) {
  return batchProcess.call(this, arr, (item) => this.set(item), {
    groupBy: (item) => (Array.isArray(item) ? item[0] : item.split(" ")[0]),
    operationName: "mset",
  });
}

async function madd(arr) {
  return batchProcess.call(this, arr, (item) => this.add(item), {
    groupBy: (item) => item.name,
    operationName: "madd",
  });
}

async function mdel(arr) {
  return batchProcess.call(this, arr, (pre) => this.del(pre), {
    groupBy: (pre) => pre,
    operationName: "mdel",
  });
}

async function msetByContent(updates) {
  return batchProcess.call(this, updates, (update) => {
      const [pre, oldContent, newContent, type, ttl] = update;
      return this.setByContent(pre, oldContent, newContent, type, ttl);
    }, {
      groupBy: (update) => update[0],
      operationName: "msetByContent",
    }
  );
}

async function msetByContentForce(updates) {
  return batchProcess.call(this, updates, (update) => {
      const [pre, oldContent, newContent, type, ttl] = update;
      return this.setByContentForce(pre, oldContent, newContent, type, ttl);
    }, {
      groupBy: (update) => update[0],
      operationName: "msetByContentForce",
    }
  );
}


// --- 核心单操作方法 ---

/**
 * [REFINED] 获取Zone ID
 */
async function getZoneId() {
  try {
    const res = await retryOperation(
      async () => {
        const reqUrl = `https://api.cloudflare.com/client/v4/zones?name=${this.domain}`;
        return this.headers && Object.keys(this.headers).length > 0
          ? await req(reqUrl, {}, this.headers)
          : await req(reqUrl, { auth: this.auth });
      },
      CONFIG.MAX_RETRIES, CONFIG.RETRY_DELAY, `获取Zone ID for ${this.domain}`
    );
    if (res.data.success && res.data.result.length > 0) {
      return res.data.result[0].id;
    } else {
      throw new Error("记录未找到或权限不足");
    }
  } catch (error) {
    console.error("获取 Zone ID 失败:", error.message);
    return null;
  }
}

/**
 * [REFINED] 添加DNS记录
 */
async function add(json) {
  try {
    const res = await retryOperation(
      async () => {
        const reqUrl = `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records post`;
        return this.headers && Object.keys(this.headers).length > 0
          ? await req(reqUrl, { json }, this.headers)
          : await req(reqUrl, { auth: this.auth, json });
      },
      CONFIG.MAX_RETRIES, CONFIG.RETRY_DELAY, `添加记录 ${json.name}`
    );

    if (res.data.success) {
      console.log(`✅ 成功添加: ${json.name} ${json.content} ${json.type}`);
      return { ...res.data, changed: true };
    }
    return { ...res.data, changed: false };
  } catch (error) {
    console.error(`添加记录 ${json.name} 失败:`, error.message);
    throw error;
  }
}

/**
 * [REFINED] 删除指定前缀的所有A记录
 */
async function del(pre) {
  const host = pre + "." + this.domain;
  try {
    const res = await retryOperation(
      async () => {
        const reqUrl = `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records?name=${host}`;
        return this.headers && Object.keys(this.headers).length > 0
          ? await req(reqUrl, {}, this.headers)
          : await req(reqUrl, { auth: this.auth });
      },
      CONFIG.MAX_RETRIES, CONFIG.RETRY_DELAY, `查询记录 ${host}`
    );

    const recordsToDelete = res.data.result || [];
    if (recordsToDelete.length === 0) {
      return { success: true, message: `记录 ${host} 不存在`, changed: false };
    }

    const runInQueue = queue(10, { minInterval: 100 });
    const deletePromises = recordsToDelete.map(record => 
      runInQueue(async () => {
         await retryOperation(
          async () => {
            const reqUrl = `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records/${record.id} delete`;
            return this.headers && Object.keys(this.headers).length > 0
              ? await req(reqUrl, {}, this.headers)
              : await req(reqUrl, { auth: this.auth });
          },
          CONFIG.MAX_RETRIES, CONFIG.RETRY_DELAY, `删除记录 ${host} (${record.content})`
        );
      })
    );
    await Promise.all(deletePromises);

    console.log(`✅ 成功删除: ${host} (${recordsToDelete.length} 条)`);
    return { success: true, changed: true };

  } catch (error) {
    console.error(`删除记录 ${host} 失败:`, error.message);
    throw error;
  }
}

/**
 * [FINAL VERSION] 设置/更新DNS记录
 */
async function set(str) {
  if (typeof str === "string") {
    str = str.trim().replace(/ +/g, " ").split(" ");
  }
  let [pre, content, type, priority, ttl] = str;
  const host = pre + "." + this.domain;
  content = content || "";
  type = type || "A";
  priority = parseInt(priority) || 10;
  ttl = parseInt(ttl) || 60;
  if (ttl > 1 && ttl < 60) ttl = 60;

  try {
    if (!this.zid) throw new Error(`无法获取Zone ID，请检查域名: ${this.domain}`);
    
    const desiredRecords = [];
    if ((type === "A" || type === "AAAA") && content.includes(",")) {
      const ipList = [ ...new Set( content.split(",").map((ip) => ip.trim()).filter((ip) => ip !== "") ), ];
      ipList.forEach((ip) => {
        desiredRecords.push({ type, name: host, content: ip, proxied: false, priority, ttl });
      });
    } else {
      desiredRecords.push({ type, name: host, content, proxied: false, priority, ttl });
    }

    const res = await retryOperation( async () => {
        const reqUrl = `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records?type=${type}&name=${host}`;
        return this.headers && Object.keys(this.headers).length > 0
          ? await req(reqUrl, {}, this.headers)
          : await req(reqUrl, { auth: this.auth });
      },
      CONFIG.MAX_RETRIES, CONFIG.RETRY_DELAY, `查询 ${host} 的现有记录`
    );
    const existingRecords = res.data.result || [];

    const existingContents = new Set(existingRecords.map(r => r.content));
    const desiredContents = new Set(desiredRecords.map(r => r.content));
    const recordsToActuallyAdd = desiredRecords.filter( r => !existingContents.has(r.content) );
    const recordsToActuallyDelete = existingRecords.filter( r => !desiredContents.has(r.content) );

    const isChanged = recordsToActuallyAdd.length > 0 || recordsToActuallyDelete.length > 0;

    if (!isChanged) {
      return { success: true, changed: false, message: "记录无变化" };
    }

    const runInQueue = queue(10, { minInterval: 100 });

    if (recordsToActuallyAdd.length > 0) {
      const addPromises = recordsToActuallyAdd.map(record => 
        runInQueue(() => 
          retryOperation( () => add.bind({ auth: this.auth, headers: this.headers, zid: this.zid, set: true })(record),
            CONFIG.MAX_RETRIES, CONFIG.RETRY_DELAY, `添加记录 ${record.content}`
          )
        )
      );
      await Promise.all(addPromises);
    }
    
    if (recordsToActuallyDelete.length > 0) {
      const deletePromises = recordsToActuallyDelete.map(record => 
        runInQueue(async () => {
          try {
            await retryOperation( async () => {
                const reqUrl = `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records/${record.id} delete`;
                return this.headers && Object.keys(this.headers).length > 0
                  ? await req(reqUrl, {}, this.headers)
                  : await req(reqUrl, { auth: this.auth });
              },
              CONFIG.MAX_RETRIES, CONFIG.RETRY_DELAY, `删除记录 ${record.id} (${record.content})`
            );
          } catch (error) {
            console.warn(`[!] 删除旧记录失败 (ID: ${record.id}):`, error.message);
          }
        })
      );
      await Promise.allSettled(deletePromises);
    }
    
    const message = `已将 ${host} 设置为 ${desiredContents.size} 条记录`;
    if (desiredRecords.length > 1) {
        const ips = desiredRecords.map((r) => r.content).join(", ");
        console.log(`✅ 成功设置: ${host} ${type} → [${ips}]`);
    } else {
        const oldContents = existingRecords.map((r) => r.content).join(", ");
        if (existingRecords.length > 0) {
            console.log(`✅ 成功更新: ${host} ${type} [${oldContents}] → ${content}`);
        } else {
            console.log(`✅ 成功添加: ${host} ${type} ${content}`);
        }
    }
    return { success: true, changed: true, message };

  } catch (error) {
    console.error(`[!] 操作 ${host} 时出错:`, error.message);
    return { success: false, changed: false, error: error.message };
  }
}

/**
 * [REFINED] 根据内容查找并更新记录
 */
async function setByContent(pre, oldContent, newContent, type = "A", ttl = 60) {
  const host = pre + "." + this.domain;
  try {
    if (!this.zid) throw new Error(`无法获取Zone ID`);

    const res = await retryOperation( async () => {
        const reqUrl = `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records?type=${type}&name=${host}`;
        return this.headers && Object.keys(this.headers).length > 0
          ? await req(reqUrl, {}, this.headers)
          : await req(reqUrl, { auth: this.auth });
      },
      CONFIG.MAX_RETRIES, CONFIG.RETRY_DELAY, `查询记录 ${host}`
    );
    if (!res.data.success) throw new Error(`查询记录失败`);

    const targetRecord = res.data.result.find(r => r.content === oldContent);

    if (!targetRecord) {
      return { success: false, message: `未找到内容为 ${oldContent} 的记录`, action: "not_found", changed: false };
    }

    const updateData = { type, name: host, content: newContent, proxied: targetRecord.proxied, ttl };
    const updateRes = await retryOperation( async () => {
        const reqUrl = `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records/${targetRecord.id} put`;
        return this.headers && Object.keys(this.headers).length > 0
          ? await req(reqUrl, { json: updateData }, this.headers)
          : await req(reqUrl, { auth: this.auth, json: updateData });
      },
      CONFIG.MAX_RETRIES, CONFIG.RETRY_DELAY, `更新记录 ${host}`
    );

    if (updateRes.data.success) {
      console.log(`✅ 成功更新: ${host} ${oldContent} → ${newContent}`);
      return { success: true, message: `已更新`, action: "updated", changed: true };
    } else {
      throw new Error(`更新记录失败`);
    }
  } catch (error) {
    console.error(`[!] 更新记录 ${host} 时出错:`, error.message);
    return { success: false, error: error.message, changed: false };
  }
}

/**
 * [REFINED] 根据内容强制设置记录
 */
async function setByContentForce( pre, oldContent, newContent, type = "A", ttl = 60 ) {
  const result = await this.setByContent( pre, oldContent, newContent, type, ttl );
  if (result.success) {
    return result;
  }
  
  // 如果未找到，则强制添加
  return this.add({
    type: type,
    name: pre + "." + this.domain,
    content: newContent,
    proxied: false,
    priority: 10,
    ttl: ttl,
  });
}

/**
 * [REFINED] 设置安全规则 (WAF)
 */
async function setSecurity(options = {}) {
  const { description = "安全规则", expression = "", action = "managed_challenge", priority = 999 } = options;
  try {
    const listResponse = await retryOperation( async () => {
        const reqUrl = `https://api.cloudflare.com/client/v4/zones/${this.zid}/firewall/rules`;
        return this.headers && Object.keys(this.headers).length > 0
          ? await req(reqUrl, {}, this.headers)
          : await req(reqUrl, { auth: this.auth });
      },
      CONFIG.MAX_RETRIES, CONFIG.RETRY_DELAY, "查询安全规则"
    );

    const existingRule = listResponse.data.result.find( rule => rule.description === description );

    if (existingRule) {
      // 更新
      const filterId = existingRule.filter.id;
      await retryOperation( async () => {
          const reqUrl = `https://api.cloudflare.com/client/v4/zones/${this.zid}/filters/${filterId} put`;
          const json = { expression, paused: false };
          return this.headers && Object.keys(this.headers).length > 0
            ? await req(reqUrl, { json }, this.headers)
            : await req(reqUrl, { auth: this.auth, json });
        },
        CONFIG.MAX_RETRIES, CONFIG.RETRY_DELAY, "更新过滤器"
      );

      const updateRes = await retryOperation( async () => {
          const reqUrl = `https://api.cloudflare.com/client/v4/zones/${this.zid}/firewall/rules/${existingRule.id} put`;
          const json = { action, priority, paused: false, description, filter: { id: filterId } };
          return this.headers && Object.keys(this.headers).length > 0
            ? await req(reqUrl, { json }, this.headers)
            : await req(reqUrl, { auth: this.auth, json });
        },
        CONFIG.MAX_RETRIES, CONFIG.RETRY_DELAY, "更新安全规则"
      );
      console.log(`✅ 安全规则 "${description}" 更新成功！`);
      return updateRes.data.result;

    } else {
      // 创建
      const requestBody = [{ filter: { expression }, action, priority, description }];
      const createRes = await retryOperation( async () => {
          const reqUrl = `https://api.cloudflare.com/client/v4/zones/${this.zid}/firewall/rules post`;
          return this.headers && Object.keys(this.headers).length > 0
            ? await req(reqUrl, { json: requestBody }, this.headers)
            : await req(reqUrl, { auth: this.auth, json: requestBody });
        },
        CONFIG.MAX_RETRIES, CONFIG.RETRY_DELAY, "创建安全规则"
      );
      console.log(`✅ 安全规则 "${description}" 创建成功！`);
      return createRes.data.result[0];
    }
  } catch (error) {
    console.error(`[!] 设置安全规则 "${description}" 时出错:`, error.message);
    throw error;
  }
}
