// cf.js cloudflare使用api的便捷封装 - 兼容Global API Key和API Token
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
    // Global API Key认证方式 - 使用headers
    headers = {
      "X-Auth-Email": email,
      "X-Auth-Key": key,
    };
    console.dev("使用Global API Key认证");
  } else {
    // API Token认证方式 - 使用auth
    auth = "Bearer " + key;
    console.dev("使用API Token认证");
  }
  // 调用时传入正确的参数
  const zid = await getZoneId.bind({ domain, auth, headers })();
  return {
    auth,
    headers,
    domain,
    zid,
    getZoneId,
    add, //添加,冲突会失败
    madd,
    set, //设置,无则添加,冲突覆盖
    mset,
    del,
    mdel,
    // 以下内容待改动 - 主要涉及香港服务器
    setSecurity, //安全...不清楚
    setByContent, //当前:根据内容搜到目标set,没找到跳过
    msetByContent,
    setByContentForce, //当前:根据内容搜到目标set,没找到直接添加
    msetByContentForce,
  };
}
// 配置常量
const CONFIG = {
  MAX_RETRIES: 3, // 最大重试次数
  RETRY_DELAY: 1000, // 初始重试延迟（毫秒）
  RATE_LIMIT: 4, // API并发限制
  RATE_LIMIT_DELAY: 200, // 限流延迟（毫秒）
  BATCH_SIZE: 10, // 批量操作的批次大小
};

/**
 * 重试机制 - 处理网络不稳定情况
 * @param {Function} fn - 要执行的异步函数
 * @param {number} maxRetries - 最大重试次数
 * @param {number} delay - 初始延迟时间（毫秒）
 * @param {string} operation - 操作描述（用于日志）
 * @returns {Promise} - 函数执行结果
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
      // 检查是否是不应重试的错误（如认证失败、权限不足等）
      if (
        error.message &&
        (error.message.includes("权限不足") ||
          error.message.includes("认证失败") ||
          error.message.includes("Invalid API key") ||
          error.message.includes("unauthorized"))
      ) {
        throw error; // 直接抛出，不重试
      }
      if (i < maxRetries - 1) {
        const retryDelay = delay * Math.pow(2, i); // 指数退避
        console.log(
          `${operation} 第 ${i + 1} 次失败，${retryDelay}ms 后重试...`
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }
  console.error(`${operation} 在 ${maxRetries} 次尝试后失败`);
  throw lastError;
}

/**
 * API限流控制 - 避免触发Cloudflare速率限制
 * @param {Array} operations - 要执行的操作数组（函数数组）
 * @param {number} limit - 并发限制
 * @param {number} delay - 批次间延迟
 * @returns {Promise<Array>} - 所有操作的结果
 */
async function rateLimitedOperation(
  operations,
  limit = CONFIG.RATE_LIMIT,
  delay = CONFIG.RATE_LIMIT_DELAY
) {
  const results = [];
  for (let i = 0; i < operations.length; i += limit) {
    const batch = operations.slice(i, i + limit);
    const batchResults = await Promise.allSettled(batch.map((op) => op()));
    results.push(...batchResults);
    // 如果还有更多批次，添加延迟
    if (i + limit < operations.length) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    // 进度日志
    const completed = Math.min(i + limit, operations.length);
    console.log(`批量操作进度: ${completed}/${operations.length}`);
  }
  return results;
}

/**
 * 批量执行操作并处理结果
 * @param {Array} items - 要处理的项目
 * @param {Function} processor - 处理函数
 * @param {Object} options - 选项
 * @returns {Promise<Array>} - 处理结果
 */
async function batchProcess(items, processor, options = {}) {
  const {
    groupBy = null,
    rateLimit = CONFIG.RATE_LIMIT,
    rateLimitDelay = CONFIG.RATE_LIMIT_DELAY,
    operationName = "批量操作", // 新增操作名称参数
  } = options;
  let results;
  if (groupBy) {
    // 分组处理
    const grouped = {};
    items.forEach((item, index) => {
      const key = groupBy(item);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({ item, index });
    });

    results = new Array(items.length);
    // 并行处理不同组，串行处理同组
    await Promise.all(
      Object.values(grouped).map(async (group) => {
        for (const { item, index } of group) {
          try {
            results[index] = await processor(item);
          } catch (error) {
            results[index] = { success: false, error: error.message };
          }
        }
      })
    );
  } else if (items.length > CONFIG.BATCH_SIZE) {
    // 大批量操作使用限流
    const operations = items.map((item) => () => processor(item));
    const settledResults = await rateLimitedOperation(
      operations,
      rateLimit,
      rateLimitDelay
    );
    // 转换 Promise.allSettled 的结果格式
    results = settledResults.map((result) =>
      result.status === "fulfilled"
        ? result.value
        : { success: false, error: result.reason?.message || "未知错误" }
    );
  } else {
    // 小批量直接并行处理
    results = await Promise.all(
      items.map((item) =>
        processor(item).catch((error) => ({
          success: false,
          error: error.message,
        }))
      )
    );
  }
  // 输出执行汇总
  const successCount = results.filter((r) => r.success !== false).length;
  const failCount = results.length - successCount;
  console.log(`\n📊 ${operationName}执行完成:`);
  console.log(`   ✅ 变更: ${successCount} 条`);
  if (failCount > 0) {
    console.log(`   ❌ 跳过: ${failCount} 条`);
  }
  console.log(`   📋 总计: ${results.length} 条\n`);
  return results;
}

/**
 * 根据记录内容查找并设置特定记录，如果未找到则返回失败
 * @param {string} pre - 子域名前缀
 * @param {string} oldContent - 原记录内容（旧IP）
 * @param {string} newContent - 新记录内容（新IP）
 * @param {string} type - 记录类型，默认A
 * @param {number} ttl - TTL值，默认60
 * @returns {Promise<Object>} - 操作结果，包含action字段标识是'updated'还是'not_found'
 */
async function setByContent(pre, oldContent, newContent, type = "A", ttl = 60) {
  const host = pre + "." + this.domain;

  try {
    // 确保zid存在
    if (!this.zid) {
      throw new Error(`无法获取Zone ID，请检查域名: ${this.domain}`);
    }

    console.log(`查找记录: ${host} ${type} ${oldContent}`);

    // 1. 查询所有同名同类型的记录（带重试）
    let res = await retryOperation(
      async () => {
        if (this.headers && Object.keys(this.headers).length > 0) {
          return await req(
            `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records?type=${type}&name=${host}`,
            {},
            this.headers
          );
        } else {
          return await req(
            `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records?type=${type}&name=${host}`,
            { auth: this.auth }
          );
        }
      },
      CONFIG.MAX_RETRIES,
      CONFIG.RETRY_DELAY,
      `查询记录 ${host}`
    );

    if (!res.data.success) {
      throw new Error(`查询记录失败: ${JSON.stringify(res.data.errors)}`);
    }

    // 2. 查找内容匹配的记录
    const targetRecord = res.data.result.find(
      (record) => record.content === oldContent
    );

    if (!targetRecord) {
      console.log(`未找到内容为 ${oldContent} 的记录`);
      return {
        success: false,
        message: `未找到内容为 ${oldContent} 的记录`,
        action: "not_found",
      };
    }

    console.log(`找到目标记录ID: ${targetRecord.id}`);

    // 3. 更新记录（带重试）
    const updateData = {
      type: type,
      name: host,
      content: newContent,
      proxied: targetRecord.proxied || false,
      priority: targetRecord.priority || 10,
      ttl: ttl,
    };

    let updateRes = await retryOperation(
      async () => {
        if (this.headers && Object.keys(this.headers).length > 0) {
          return await req(
            `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records/${targetRecord.id} put`,
            { json: updateData },
            this.headers
          );
        } else {
          return await req(
            `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records/${targetRecord.id} put`,
            { auth: this.auth, json: updateData }
          );
        }
      },
      CONFIG.MAX_RETRIES,
      CONFIG.RETRY_DELAY,
      `更新记录 ${host}`
    );

    if (updateRes.data.success) {
      console.log(`✅ 成功更新: ${host} ${oldContent} → ${newContent}`);
      return {
        success: true,
        message: `已将 ${host} 从 ${oldContent} 更新为 ${newContent}`,
        record: updateRes.data.result,
        action: "updated",
      };
    } else {
      throw new Error(`更新记录失败: ${JSON.stringify(updateRes.data.errors)}`);
    }
  } catch (error) {
    console.error(`更新记录时出错:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

// 批量根据内容设置记录（未找到则返回失败）- 按子域名分组处理
async function msetByContent(updates) {
  return batchProcess(
    updates,
    async (update) => {
      const [pre, oldContent, newContent, type, ttl] = update;
      return this.setByContent(pre, oldContent, newContent, type, ttl);
    },
    {
      groupBy: (update) => update[0], // 按子域名分组
      operationName: "批量内容更新",
    }
  );
}

/**
 * 根据记录内容查找并强制设置特定记录，如果未找到则添加新记录
 * @param {string} pre - 子域名前缀
 * @param {string} oldContent - 原记录内容（旧IP）
 * @param {string} newContent - 新记录内容（新IP）
 * @param {string} type - 记录类型，默认A
 * @param {number} ttl - TTL值，默认60
 * @returns {Promise<Object>} - 操作结果，包含action字段标识是'updated'还是'added'
 */
async function setByContentForce(
  pre,
  oldContent,
  newContent,
  type = "A",
  ttl = 60
) {
  // 先尝试正常设置
  const result = await this.setByContent(
    pre,
    oldContent,
    newContent,
    type,
    ttl
  );

  // 如果找到记录，直接返回结果
  if (result.success) {
    return result;
  }

  // 如果没找到记录，强制添加新记录
  if (result.action === "not_found") {
    console.log(
      `未找到旧记录，强制添加新记录: ${pre}.${this.domain} ${newContent}`
    );

    try {
      const addResult = await add.bind({
        auth: this.auth,
        headers: this.headers,
        zid: this.zid,
      })({
        type: type,
        name: pre + "." + this.domain,
        content: newContent,
        proxied: false,
        priority: 10,
        ttl: ttl,
      });

      if (addResult.success) {
        console.log(`✅ 强制添加成功: ${pre}.${this.domain} ${newContent}`);
        return {
          success: true,
          message: `已为 ${pre}.${this.domain} 强制添加新记录 ${newContent}`,
          record: addResult.result,
          action: "added",
        };
      } else {
        throw new Error(
          `强制添加记录失败: ${JSON.stringify(addResult.errors)}`
        );
      }
    } catch (error) {
      console.error(`强制添加记录时出错:`, error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // 其他错误直接返回
  return result;
}

// 批量根据内容强制设置记录（未找到则强制添加）- 按子域名分组处理
async function msetByContentForce(updates) {
  return batchProcess(
    updates,
    async (update) => {
      const [pre, oldContent, newContent, type, ttl] = update;
      return this.setByContentForce(pre, oldContent, newContent, type, ttl);
    },
    {
      groupBy: (update) => update[0], // 按子域名分组
      operationName: "批量强制更新",
    }
  );
}

async function getZoneId() {
  try {
    console.dev("获取Zone ID，域名:", this.domain);

    let res = await retryOperation(
      async () => {
        if (this.headers && Object.keys(this.headers).length > 0) {
          return await req(
            `https://api.cloudflare.com/client/v4/zones?name=${this.domain}`,
            {},
            this.headers
          );
        } else {
          return await req(
            `https://api.cloudflare.com/client/v4/zones?name=${this.domain}`,
            { auth: this.auth }
          );
        }
      },
      CONFIG.MAX_RETRIES,
      CONFIG.RETRY_DELAY,
      `获取Zone ID for ${this.domain}`
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

// 批量设置记录 - 按子域名分组处理，避免竞态条件
async function mset(arr) {
  return batchProcess(arr, async (item) => this.set(item), {
    groupBy: (item) => {
      // 提取子域名作为分组键
      if (Array.isArray(item)) {
        return item[0];
      } else {
        const parts = item.split(" ");
        return parts[0];
      }
    },
    operationName: "批量设置记录",
  });
}

/**
 * set,没有添加,冲突覆盖|单条或多条| 支持数组[pre, content, type(A), priority(10), ttl(60)] String就用空格隔开(String主要处理IP,复杂内容输入的TXT用Array)
 * 此类set都不使用cf代理
 * @param {String|Array} str "starlink-sg 13.212.109.57" | "z-sg 13.212.109.57,47.128.145.173,54.179.185.61 A 10 60"
 * @returns
 */
async function set(str) {
  // --- 步骤 1 & 2: 解析输入并确定期望状态 (逻辑不变) ---
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
    if (!this.zid) {
      throw new Error(`无法获取Zone ID，请检查域名: ${this.domain}`);
    }
    
    const desiredRecords = [];
    if ((type === "A" || type === "AAAA") && content.includes(",")) {
      const ipList = [ ...new Set( content.split(",").map((ip) => ip.trim()).filter((ip) => ip !== "") ), ];
      ipList.forEach((ip) => {
        desiredRecords.push({ type, name: host, content: ip, proxied: false, priority, ttl });
      });
    } else {
      desiredRecords.push({ type, name: host, content, proxied: false, priority, ttl });
    }

    // --- 步骤 3: 查询云端的当前记录状态 (逻辑不变) ---
    let res = await retryOperation(
      async () => {
        const reqUrl = `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records?type=${type}&name=${host}`;
        if (this.headers && Object.keys(this.headers).length > 0) {
          return await req(reqUrl, {}, this.headers);
        } else {
          return await req(reqUrl, { auth: this.auth });
        }
      },
      CONFIG.MAX_RETRIES, CONFIG.RETRY_DELAY, `查询 ${host} 的现有记录`
    );
    const existingRecords = res.data.result || [];

    // --- 步骤 4: 计算需要执行的操作 (逻辑不变) ---
    const existingContents = new Set(existingRecords.map(r => r.content));
    const desiredContents = new Set(desiredRecords.map(r => r.content));
    const recordsToActuallyAdd = desiredRecords.filter(
      record => !existingContents.has(record.content)
    );
    const recordsToActuallyDelete = existingRecords.filter(
      record => !desiredContents.has(record.content)
    );

    // --- 步骤 4.1: 【核心改动】判断是否真的有变更 ---
    const isChanged = recordsToActuallyAdd.length > 0 || recordsToActuallyDelete.length > 0;

    // 如果没有任何变更，则提前结束并报告
    if (!isChanged) {
      const currentContent = desiredRecords.map(r => r.content).join(', ');
      console.log(`✅ 记录无变化: ${host} ${type} → [${currentContent}]`);
      return { success: true, message: "记录无变化" };
    }

    // --- 步骤 5 & 6: 使用您的 queue 函数执行 API 操作 (逻辑不变，去掉了日志) ---
    const runInQueue = queue(10, { minInterval: 100 });

    if (recordsToActuallyAdd.length > 0) {
      const addPromises = recordsToActuallyAdd.map(record => 
        runInQueue(() => 
          retryOperation(
            () => add.bind({ auth: this.auth, headers: this.headers, zid: this.zid })(record),
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
            await retryOperation(
              async () => {
                const reqUrl = `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records/${record.id} delete`;
                if (this.headers && Object.keys(this.headers).length > 0) {
                  return await req(reqUrl, {}, this.headers);
                } else {
                  return await req(reqUrl, { auth: this.auth });
                }
              },
              CONFIG.MAX_RETRIES, CONFIG.RETRY_DELAY, `删除记录 ${record.id} (${record.content})`
            );
          } catch (error) {
            console.warn(`删除旧记录失败 (ID: ${record.id}):`, error.message);
          }
        })
      );
      await Promise.allSettled(deletePromises);
    }

    // --- 步骤 7: 【重构核心】基于变更结果输出最终的、准确的成功信息 ---
    const message = desiredRecords.length > 1
        ? `已为 ${host} 设置 ${desiredRecords.length} 条 ${type} 记录`
        : `已更新 ${host} 的记录`;

    if (desiredRecords.length > 1) {
        const ips = desiredRecords.map((r) => r.content).join(", ");
        console.log(`✅ 成功设置: ${host} ${type} → [${ips}]`);
    } else {
        const oldContents = existingRecords.map((r) => r.content).join(", ");
        // 只有当真的存在旧记录时，才显示 "更新"
        if (existingRecords.length > 0) {
            console.log(`✅ 成功更新: ${host} ${type} [${oldContents}] → ${content}`);
        } else {
            // 否则就是 "添加"
            console.log(`✅ 成功添加: ${host} ${type} ${content}`);
        }
    }

    return { success: true, message };

  } catch (error) {
    console.error(`操作 ${host} 时出错:`, error.message);
    return { success: false, error: error.message };
  }
}


// 批量添加记录 - 按域名分组处理
async function madd(arr) {
  return batchProcess(arr, async (item) => this.add(item), {
    groupBy: (item) => item.name, // 按域名分组
    operationName: "批量添加记录",
  });
}

/**
 * 添加DNS记录
 * @param {Object} json - 记录配置
 * {
 *   type: "A",
 *   name: "starlink-sfo2",
 *   content: "146.190.127.168",
 *   "proxied": true,
 * }
 */
async function add(json) {
  try {
    let res = await retryOperation(
      async () => {
        if (this.headers && Object.keys(this.headers).length > 0) {
          return await req(
            `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records post`,
            { json },
            this.headers
          );
        } else {
          return await req(
            `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records post`,
            { auth: this.auth, json }
          );
        }
      },
      CONFIG.MAX_RETRIES,
      CONFIG.RETRY_DELAY,
      `添加记录 ${json.name}`
    );

    // 添加成功提示
    if (res.data.success) {
      console.log(`✅ 成功添加: ${json.name} ${json.type} ${json.content}`);
    }

    return res.data;
  } catch (error) {
    console.error(`添加记录 ${json.name} 失败:`, error.message);
    throw error;
  }
}

// 批量删除记录 - 按域名分组处理
async function mdel(arr) {
  return batchProcess(arr, async (pre) => this.del(pre), {
    groupBy: (pre) => pre, // 按子域名分组
    operationName: "批量删除记录",
  });
}

// 删除单个记录（需先查询 ID）
async function del(pre) {
  try {
    // 1. 查询记录 ID（带重试）
    const host = pre + "." + this.domain;
    let res = await retryOperation(
      async () => {
        if (this.headers && Object.keys(this.headers).length > 0) {
          return await req(
            `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records?type=A&name=${host}`,
            {},
            this.headers
          );
        } else {
          return await req(
            `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records?type=A&name=${host}`,
            { auth: this.auth }
          );
        }
      },
      CONFIG.MAX_RETRIES,
      CONFIG.RETRY_DELAY,
      `查询记录 ${host}`
    );

    const recordId = res.data.result[0]?.id;
    if (!recordId) {
      console.log(`记录 ${host} 不存在，跳过删除`);
      return { success: true, message: `记录 ${host} 不存在` };
    }

    // 2. 删除记录（带重试）
    res = await retryOperation(
      async () => {
        if (this.headers && Object.keys(this.headers).length > 0) {
          return await req(
            `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records/${recordId} delete`,
            {},
            this.headers
          );
        } else {
          return await req(
            `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records/${recordId} delete`,
            { auth: this.auth }
          );
        }
      },
      CONFIG.MAX_RETRIES,
      CONFIG.RETRY_DELAY,
      `删除记录 ${host}`
    );

    console.log(`删除${host}: ${res.data.success ? "成功" : "失败"}`);
    return res.data;
  } catch (error) {
    console.error(`删除记录失败:`, error.message);
    throw error;
  }
}

/**
 * 添加安全规则
 * @param {Object} options - 规则配置选项
 * @param {string} options.description - 规则描述
 * @param {string} options.expression - 规则表达式
 * @param {string} options.action - 规则触发的动作，如 "managed_challenge", "block", "js_challenge" 等
 * @param {number} options.priority - 规则优先级，数字越大优先级越低
 * @returns {Promise<Object>} - 返回 API 响应结果
 */
async function setSecurity(options = {}) {
  try {
    const {
      description = "安全规则",
      expression = "",
      action = "managed_challenge",
      priority = 999,
    } = options;

    // 首先查找是否存在同名规则（带重试）
    let existingRule = null;
    let listResponse = await retryOperation(
      async () => {
        if (this.headers && Object.keys(this.headers).length > 0) {
          return await req(
            `https://api.cloudflare.com/client/v4/zones/${this.zid}/firewall/rules`,
            {},
            this.headers
          );
        } else {
          return await req(
            `https://api.cloudflare.com/client/v4/zones/${this.zid}/firewall/rules`,
            { auth: this.auth }
          );
        }
      },
      CONFIG.MAX_RETRIES,
      CONFIG.RETRY_DELAY,
      "查询安全规则"
    );

    // 查找同名规则
    if (listResponse.data.success && listResponse.data.result.length > 0) {
      existingRule = listResponse.data.result.find(
        (rule) => rule.description === description
      );
    }

    let response;
    if (existingRule) {
      // 更新现有规则
      console.log(`找到现有规则 "${description}"，准备更新...`);

      // 更新过滤器表达式（带重试）
      const filterId = existingRule.filter.id;
      let filterUpdateResponse = await retryOperation(
        async () => {
          if (this.headers && Object.keys(this.headers).length > 0) {
            return await req(
              `https://api.cloudflare.com/client/v4/zones/${this.zid}/filters/${filterId} put`,
              { json: { expression: expression, paused: false } },
              this.headers
            );
          } else {
            return await req(
              `https://api.cloudflare.com/client/v4/zones/${this.zid}/filters/${filterId} put`,
              {
                auth: this.auth,
                json: { expression: expression, paused: false },
              }
            );
          }
        },
        CONFIG.MAX_RETRIES,
        CONFIG.RETRY_DELAY,
        "更新过滤器"
      );

      if (!filterUpdateResponse.data.success) {
        throw new Error(
          `更新过滤器失败: ${JSON.stringify(filterUpdateResponse.data.errors)}`
        );
      }

      // 更新规则本身（带重试）
      response = await retryOperation(
        async () => {
          if (this.headers && Object.keys(this.headers).length > 0) {
            return await req(
              `https://api.cloudflare.com/client/v4/zones/${this.zid}/firewall/rules/${existingRule.id} put`,
              {
                json: {
                  action: action,
                  priority: priority,
                  paused: false,
                  description: description,
                  filter: {
                    id: filterId,
                  },
                },
              },
              this.headers
            );
          } else {
            return await req(
              `https://api.cloudflare.com/client/v4/zones/${this.zid}/firewall/rules/${existingRule.id} put`,
              {
                auth: this.auth,
                json: {
                  action: action,
                  priority: priority,
                  paused: false,
                  description: description,
                  filter: {
                    id: filterId,
                  },
                },
              }
            );
          }
        },
        CONFIG.MAX_RETRIES,
        CONFIG.RETRY_DELAY,
        "更新安全规则"
      );

      if (response.data.success) {
        console.log(`安全规则 "${description}" 更新成功！`);
        return response.data.result;
      } else {
        console.error("更新安全规则失败:", response.data.errors);
        throw new Error(JSON.stringify(response.data.errors));
      }
    } else {
      // 创建新规则
      console.log(`未找到安全规则 "${description}"，准备创建...`);

      // 构建正确的请求体结构
      const requestBody = [
        {
          filter: {
            expression: expression,
            paused: false,
          },
          action: action,
          priority: priority,
          paused: false,
          description: description,
        },
      ];

      response = await retryOperation(
        async () => {
          if (this.headers && Object.keys(this.headers).length > 0) {
            return await req(
              `https://api.cloudflare.com/client/v4/zones/${this.zid}/firewall/rules post`,
              { json: requestBody },
              this.headers
            );
          } else {
            return await req(
              `https://api.cloudflare.com/client/v4/zones/${this.zid}/firewall/rules post`,
              { auth: this.auth, json: requestBody }
            );
          }
        },
        CONFIG.MAX_RETRIES,
        CONFIG.RETRY_DELAY,
        "创建安全规则"
      );

      if (response.data.success) {
        console.log(`安全规则 "${description}" 创建成功！`);
        return response.data.result[0];
      } else {
        console.error("创建安全规则失败:", response.data.errors);
        throw new Error(JSON.stringify(response.data.errors));
      }
    }
  } catch (error) {
    console.error("设置安全规则时出错:", error.message);
    throw error;
  }
}
