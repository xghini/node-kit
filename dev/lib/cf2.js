// cf2.js 精简灵活的新版，采取换代逐步替代方案，不影响旧版使用
export { cf2 };
import { isipv4, isipv6, queue, req, reqdata } from "../main.js";
async function cf2(obj) {
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
    // 精确+一点魔法
    dnsObj,
    find,
    add,
    del,
    set, //尚未完善
    madd,
    mdel,
    mset,
    // 特化
    // 其他（安全规则）
    security,
  };
}
// --- 配置常量 ---
const CONFIG = {
  MAX_RETRIES: 3, // 最大重试次数
  RETRY_DELAY: 1000, // 初始重试延迟（毫秒）
};
const qrun = queue(100, { minInterval: 10 });

// --- 核心辅助函数 ---
/**
 * 重试机制 - 处理网络不稳定情况 (No changes needed)
 */
async function retry(
  fn,
  maxRetries = CONFIG.MAX_RETRIES,
  delay = CONFIG.RETRY_DELAY
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
        console.log(`第 ${i + 1} 次失败，${retryDelay}ms 后重试...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }
  console.error(`在 ${maxRetries} 次尝试后失败`);
  throw lastError;
}
/** 如果是字符串,默认根据名字找 */
async function find(filter) {
  filter = this.dnsObj(filter, `find`);
  const sp = new URLSearchParams(filter).toString();
  // console.log(111, sp);
  const reqUrl =
    `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records?` + sp;
  let res = await retry(() =>
    this.headers && Object.keys(this.headers).length > 0
      ? reqdata(reqUrl, {}, this.headers)
      : reqdata(reqUrl, { auth: this.auth })
  );
  res = res.result;
  if (filter) {
    res = res.filter((v) => {
      if (filter.type && v.type != filter.type) return;
      if (filter.content && v.content != filter.content) return;
      if (filter.proxiable && v.proxiable != filter.proxiable) return;
      if (filter.proxied && v.proxied != filter.proxied) return;
      if (filter.ttl && v.ttl != filter.ttl) return;
      if (filter.comment && v.comment != filter.comment) return;
      if (filter.tags && v.tags != filter.tags) return;
      return 1;
    });
  }
  res = res.map((v) => {
    delete v.proxiable;
    delete v.proxied;
    delete v.ttl;
    delete v.settings;
    delete v.meta;
    delete v.comment;
    delete v.tags;
    delete v.created_on;
    delete v.modified_on;
    return v;
  });
  return res;
}
/**
 * 添加DNS记录，保持纯粹1对1,能智能识别A和AAAA
 * @param {String|Array|Object} str
 * @returns 添加数量
 */
async function add(str) {
  const json = this.dnsObj(str);
  const res = await retry(async () => {
    const reqUrl = `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records post`;
    return this.headers && Object.keys(this.headers).length > 0
      ? await req(reqUrl, { json }, this.headers)
      : await req(reqUrl, { auth: this.auth, json });
  });
  if (res.data.success) return 1;
  //81058: record already exists
  if (res.data.errors[0].code != 81058)
    console.error(`add失败 "${json.name}" ：`, res.data.errors[0]);
  return 0;
}
/**
 * 删除指定前缀的所有A记录，需要先查出来，再根据id删除
 * @returns 删除的数组
 */
async function del(filter) {
  if (typeof filter === "object" && !filter.name && !filter.content) {
    console.warn("删除必须有name或content才能安全执行");
    return [];
  }
  let res = await this.find(filter);
  const del_arr = res.map((v) => {
    return {
      name: v.name,
      type: v.type,
      content: v.content,
    };
  });
  if (res.length === 0) return [];
  res = await Promise.all(
    res.map((record) =>
      qrun(() =>
        retry(() => {
          const reqUrl = `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records/${record.id} delete`;
          return this.headers && Object.keys(this.headers).length > 0
            ? reqdata(reqUrl, this.headers)
            : reqdata(reqUrl, { auth: this.auth });
        })
      )
    )
  );
  // 涉及到删除，还是打印出来好
  console.warn(
    del_arr.map((v) => v.name + " " + v.type + " " + v.content),
    res.length,
    `发生记录删除cf.del`
  );
  console.log(res);
  return del_arr;
}

/**
 * 智能处理dns参数为标准规格
 * @param {*} dnsParam
 * @param {*} option 对于复杂的情况，用option分别
 * @returns
 */
function dnsObj(dnsParam, option = "") {
  // 多种输入类型处理
  let name, content, type, priority, proxied, ttl;
  if (typeof dnsParam === "string") {
    dnsParam = dnsParam.trim().replace(/ +/g, " ").split(" ");
  }
  if (Array.isArray(dnsParam)) {
    [name, content, type, priority, proxied, ttl] = dnsParam;
  } else {
    ({ name, content, type, priority, proxied, ttl } = dnsParam);
  }
  if (option === "set") {
    if (!content) {
      content = name;
      name = "";
    }
    if (!type) {
      if (isipv4(content)) type = "A";
      else if (isipv6(content)) type = "AAAA";
      else {
        type = "TXT";
        if (content[0] != '"') content = `"` + content;
        if (content.slice(-1) != `"`) content += `"`;
      }
    } else type = type.toUpperCase();
    option = "find";
  }
  if (name && !name.includes("." + this.domain))
    name = name + "." + this.domain;
  if (option === "find") {
    // 不默认参数值
    const tmp = {};
    if (name) tmp.name = name;
    if (content) tmp.content = content;
    if (type) tmp.type = type.toUpperCase();
    if (priority || priority === 0) tmp.priority = priority;
    if (proxied) tmp.proxied = true;
    if (ttl) tmp.ttl = ttl;
    dnsParam = tmp;
  } else {
    if (!type) {
      if (isipv4(content)) type = "A";
      else if (isipv6(content)) type = "AAAA";
      else {
        type = "TXT";
        if (content[0] != '"') content = `"` + content;
        if (content.slice(-1) != `"`) content += `"`;
      }
    } else type = type.toUpperCase();
    priority = parseInt(priority) || 10;
    proxied = proxied ? true : false;
    ttl = parseInt(ttl) || 60;
    dnsParam = {
      name,
      content,
      type,
      priority, //MX和SRV 0-65535 默认给10（主要邮件系统用）
      proxied, //小黄云也挺少用到的
      ttl, //一般不用设置 60s有利无弊 cf也完全吃得消 有特殊需要依旧可以设置
    };
  }
  // console.log(`dnsObj`, option, dnsParam);
  return dnsParam;
}
/**
 * set有两个参数是合理且应该的，混合在一起会为本就复杂的情况复杂加倍。
 * set本质就是del+add 此函数复杂度高(因魔法重载处理),需要在实战中多多测试稳定性和推演
 * 为筛选出的内容,添加目标content,多对1;多对多(A AAAA)
 * 跟del异曲同工,找出所有符合条件的,进行覆盖设置,若没有则直接添加
 * 干净利落，会把匹配到的全删掉，然后添加新内容
 * @param {*} filter 用来选择目标删除
 * @param {*} content 待修改的内容
 * @returns 成功修改的数量
 */
async function set(filter, json) {
  // filter如果没有type继承json识别的type，json如果没有name继承filter的name
  filter = this.dnsObj(filter, "find");
  json = this.dnsObj(json, "set");
  if (!filter.type) filter.type = json.type;
  if (!json.name) json.name = filter.name;
  console.log(filter);
  console.log(json);
  let res = await this.del(filter);
  console.log(res);
  if (!json.name) {
    if (res.length === 0) return 0;
    return (
      await Promise.all(
        res.map((v) => this.add({ ...json, ...{ name: v.name } }))
      )
    ).reduce((pre, cur) => pre + cur, 0);
  }
  return this.add(json);
}
async function mset(arr) {
  const grouped = new Map();
  arr.forEach((item, index) => {
    const key = Array.isArray(item) ? item[0] : item.split(" ")[0];
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push({ item, index });
  });
  let results = new Array(arr.length);
  const groupPromises = Array.from(grouped.values()).map((group) =>
    qrun(async () => {
      for (const { item, index } of group) {
        try {
          results[index] = await this.set(item);
        } catch (error) {
          results[index] = { success: false, error: error.message };
        }
      }
    })
  );
  await Promise.all(groupPromises);
  return results;
}
async function madd(arr) {
  const grouped = new Map();
  arr.forEach((item, index) => {
    if (!grouped.has(item.name)) grouped.set(item.name, []);
    grouped.get(item.name).push({ item, index });
  });
  let results = new Array(arr.length);
  const groupPromises = Array.from(grouped.values()).map((group) =>
    qrun(async () => {
      for (const { item, index } of group) {
        try {
          results[index] = await this.add(item);
        } catch (error) {
          results[index] = { success: false, error: error.message };
        }
      }
    })
  );
  await Promise.all(groupPromises);
  return results;
}
async function mdel(arr) {
  const grouped = new Map();
  arr.forEach((pre, index) => {
    if (!grouped.has(pre)) grouped.set(pre, []);
    grouped.get(pre).push({ pre, index });
  });
  let results = new Array(arr.length);
  const groupPromises = Array.from(grouped.values()).map((group) =>
    qrun(async () => {
      for (const { pre, index } of group) {
        try {
          results[index] = await this.del(pre);
        } catch (error) {
          results[index] = { success: false, error: error.message };
        }
      }
    })
  );
  await Promise.all(groupPromises);
  return results;
}

/**
 * 获取Zone ID
 */
async function getZoneId() {
  try {
    const res = await retry(async () => {
      const reqUrl = `https://api.cloudflare.com/client/v4/zones?name=${this.domain}`;
      return this.headers && Object.keys(this.headers).length > 0
        ? await req(reqUrl, {}, this.headers)
        : await req(reqUrl, { auth: this.auth });
    });
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
 * 设置安全规则 (WAF)
 */
async function security(options = {}) {
  const {
    description = "安全规则",
    expression = "",
    action = "managed_challenge",
    priority = 999,
  } = options;
  try {
    const listResponse = await retry(async () => {
      const reqUrl = `https://api.cloudflare.com/client/v4/zones/${this.zid}/firewall/rules`;
      return this.headers && Object.keys(this.headers).length > 0
        ? await req(reqUrl, {}, this.headers)
        : await req(reqUrl, { auth: this.auth });
    });
    const existingRule = listResponse.data.result.find(
      (rule) => rule.description === description
    );
    if (existingRule) {
      // 更新
      const filterId = existingRule.filter.id;
      await retry(async () => {
        const reqUrl = `https://api.cloudflare.com/client/v4/zones/${this.zid}/filters/${filterId} put`;
        const json = { expression, paused: false };
        return this.headers && Object.keys(this.headers).length > 0
          ? await req(reqUrl, { json }, this.headers)
          : await req(reqUrl, { auth: this.auth, json });
      });
      const updateRes = await retry(async () => {
        const reqUrl = `https://api.cloudflare.com/client/v4/zones/${this.zid}/firewall/rules/${existingRule.id} put`;
        const json = {
          action,
          priority,
          paused: false,
          description,
          filter: { id: filterId },
        };
        return this.headers && Object.keys(this.headers).length > 0
          ? await req(reqUrl, { json }, this.headers)
          : await req(reqUrl, { auth: this.auth, json });
      });
      console.log(`✅ 安全规则 "${description}" 更新成功！`);
      return updateRes.data.result;
    } else {
      // 创建
      const requestBody = [
        { filter: { expression }, action, priority, description },
      ];
      const createRes = await retry(async () => {
        const reqUrl = `https://api.cloudflare.com/client/v4/zones/${this.zid}/firewall/rules post`;
        return this.headers && Object.keys(this.headers).length > 0
          ? await req(reqUrl, { json: requestBody }, this.headers)
          : await req(reqUrl, { auth: this.auth, json: requestBody });
      });
      console.log(`✅ 安全规则 "${description}" 创建成功！`);
      return createRes.data.result[0];
    }
  } catch (error) {
    console.error(`[!] 设置安全规则 "${description}" 时出错:`, error.message);
    throw error;
  }
}
