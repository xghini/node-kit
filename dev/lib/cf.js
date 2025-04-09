// cloudflare使用api的便捷封装 - 兼容Global API Key和API Token
import { req } from "./http/req.js";
export { cf };

async function cf(obj) {
  const key = obj.key;
  const domain = obj.domain;
  const email = obj.email;
  
  // 根据是否提供email决定认证方式
  let auth, headers = {};
  
  if (email) {
    // Global API Key认证方式 - 使用headers
    headers = {
      "X-Auth-Email": email,
      "X-Auth-Key": key
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
    add,
    madd,
    set,
    mset,
    del,
    mdel,
    setSecurity,
  };
}

async function getZoneId() {
  try {
    console.dev("获取Zone ID，域名:", this.domain);
    let res;
    if (this.headers && Object.keys(this.headers).length > 0) {
      // 使用Global API Key认证（通过headers）
      res = await req(
        `https://api.cloudflare.com/client/v4/zones?name=${this.domain}`,
        { }, // 空对象
        this.headers // 第三个参数传入headers
      );
    } else {
      // 使用API Token认证（通过auth）
      res = await req(
        `https://api.cloudflare.com/client/v4/zones?name=${this.domain}`,
        { auth: this.auth }
      );
    }
    // console.log("API 响应:", res.data);
    if (res.data.success && res.data.result.length > 0) {
      return res.data.result[0].id;
    } else {
      throw new Error("记录未找到或权限不足");
    }
  } catch (error) {
    console.error("获取 Zone ID 失败:", error.message);
    return null; // 返回null而不是抛出错误，以便允许回退到API Token
  }
}

async function mset(arr) {
  return Promise.all(arr.map((item) => this.set(item)));
}

// 查询ID+修改(没有批量)
/**
 * 强大的set能力 能够处理如'em962 "test test test" txt'
 * 默认ttl = 1
 * @param {*} str
 */
async function set(str) {
  let pre, content, type, priority, ttl;
  if (Array.isArray(str)) {
    [pre, content, type, priority, ttl] = str;
  } else {
    // 省略处理字符串的代码...此处保持不变
    // 处理引号内的空格
    let processedStr = "";
    let inQuotes = false;
    // 首先替换引号内的空格为{+}
    for (let i = 0; i < str.length; i++) {
      const char = str.charAt(i);
      if (char === '"') {
        inQuotes = !inQuotes;
        processedStr += char;
      } else if (char === " ") {
        processedStr += inQuotes ? "{+}" : char;
      } else {
        processedStr += char;
      }
    }
    // 然后将多个空格标准化为一个空格
    processedStr = processedStr.replace(/ +/g, " ").trim();
    // 分割并还原{+}为空格
    const parts = processedStr.split(" ");
    pre = parts[0];
    // 处理带引号的内容
    if (parts[1] && parts[1].startsWith('"')) {
      // 找到闭合引号的位置
      let quoteContent = parts[1];
      let contentEndIndex = 1;
      // 如果第一个部分没有闭合引号，继续查找
      if (!parts[1].endsWith('"') || parts[1].length <= 1) {
        for (let i = 2; i < parts.length; i++) {
          quoteContent += " " + parts[i];
          contentEndIndex = i;
          if (parts[i].endsWith('"')) break;
        }
      }
      // 提取引号内的内容并还原{+}为空格
      content =
        '"' +
        quoteContent
          .substring(1, quoteContent.length - 1)
          .replace(/\{\+\}/g, " ") +
        '"';
      // 提取剩余部分
      type = parts[contentEndIndex + 1] || "A";
      priority = parts[contentEndIndex + 2] || 10;
      ttl = parts[contentEndIndex + 3] || 60; // 添加TTL参数，默认为60秒
    } else {
      // 没有引号的情况
      content = parts[1] || "";
      type = parts[2] || "A";
      priority = parts[3] || 10;
      ttl = parts[4] || 60; // 添加TTL参数，默认为60秒
    }
  }
  const host = pre + "." + this.domain;
  try {
    // 确保zid存在
    if (!this.zid) {
      throw new Error(`无法获取Zone ID，请检查域名: ${this.domain}`);
    }
    
    let res;
    // 查询是否存在记录
    if (this.headers && Object.keys(this.headers).length > 0) {
      // 使用Global API Key认证
      res = await req(
        `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records?type=${type}&name=${host}`,
        {},
        this.headers
      );
    } else {
      // 使用API Token认证
      res = await req(
        `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records?type=${type}&name=${host}`,
        { auth: this.auth }
      );
    }
    
    // console.log("查询记录结果:", res.data.success ? "成功" : "失败");
    
    if (res.data.result && res.data.result.length > 0) {
      // 保存原始记录
      const record = res.data.result[0];
      const recordId = record.id;

      // 处理ttl，如果是auto或其他非数字值，强制设为60
      const recordTtl =
        ttl === "auto" || isNaN(parseInt(ttl)) ? 60 : parseInt(ttl) || 60;

      // 正确分离URL和HTTP方法
      if (this.headers && Object.keys(this.headers).length > 0) {
        // 使用Global API Key认证
        res = await req(
          `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records/${recordId} put`,
          {
            json: {
              type: type || "A",
              name: host,
              content,
              proxied: false,
              priority: parseInt(priority) || 10,
              ttl: recordTtl, // 使用处理后的ttl值
            }
          },
          this.headers
        );
      } else {
        // 使用API Token认证
        res = await req(
          `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records/${recordId} put`,
          {
            auth: this.auth,
            json: {
              type: type || "A",
              name: host,
              content,
              proxied: false,
              priority: parseInt(priority) || 10,
              ttl: recordTtl, // 使用处理后的ttl值
            }
          }
        );
      }
      
      console.log(
        `${host}`,
        res.data.success ? "修改成功" : res.data.errors[0].message
      );
    } else {
      // 添加新记录
      // 处理ttl，确保新添加的记录也使用正确的ttl值
      const recordTtl =
        ttl === "auto" || isNaN(parseInt(ttl)) ? 60 : parseInt(ttl) || 60;

      await add.bind({
        auth: this.auth,
        headers: this.headers,
        zid: this.zid,
      })({
        type: type || "A",
        name: host,
        content,
        proxied: false,
        priority: parseInt(priority) || 10,
        ttl: recordTtl, // 使用处理后的ttl值
      });
    }
  } catch (error) {
    console.error(`操作 ${host} 时出错:`, error.message);
  }
}

async function madd(arr) {
  return Promise.all(arr.map((item) => this.add(item)));
}

/**
 * 
 * @param {*} json 
 * {
    type: "A",
    name: "starlink-sfo2",
    content: "146.190.127.168",
    "proxied": true,
 * }
 */
async function add(json) {
  try {
    let res;
    if (this.headers && Object.keys(this.headers).length > 0) {
      // 使用Global API Key认证
      res = await req(
        `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records post`,
        { json },
        this.headers
      );
    } else {
      // 使用API Token认证
      res = await req(
        `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records post`,
        { auth: this.auth, json }
      );
    }
    
    console.log(
      json.name,
      res.data.success ? "添加成功" : res.data.errors[0].message
    );
    return res.data;
  } catch (error) {
    console.error(`添加记录 ${json.name} 失败:`, error.message);
    throw error;
  }
}

async function mdel(arr) {
  return Promise.all(arr.map((item) => this.del(item)));
}

// 删除单个记录（需先查询 ID）
async function del(pre) {
  try {
    // 1. 查询记录 ID
    const host = pre + "." + this.domain;
    let res;
    
    if (this.headers && Object.keys(this.headers).length > 0) {
      // 使用Global API Key认证
      res = await req(
        `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records?type=A&name=${host}`,
        {},
        this.headers
      );
    } else {
      // 使用API Token认证
      res = await req(
        `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records?type=A&name=${host}`,
        { auth: this.auth }
      );
    }
    
    const recordId = res.data.result[0]?.id;
    if (!recordId) {
      console.log(`记录 ${host} 不存在，跳过删除`);
      return;
    }
    
    // 2. 删除记录
    if (this.headers && Object.keys(this.headers).length > 0) {
      // 使用Global API Key认证
      res = await req(
        `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records/${recordId} delete`,
        {},
        this.headers
      );
    } else {
      // 使用API Token认证
      res = await req(
        `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records/${recordId} delete`,
        { auth: this.auth }
      );
    }
    
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

    // 首先查找是否存在同名规则
    let existingRule = null;
    let listResponse;
    
    // 查询所有规则
    if (this.headers && Object.keys(this.headers).length > 0) {
      listResponse = await req(
        `https://api.cloudflare.com/client/v4/zones/${this.zid}/firewall/rules`,
        {},
        this.headers
      );
    } else {
      listResponse = await req(
        `https://api.cloudflare.com/client/v4/zones/${this.zid}/firewall/rules`,
        { auth: this.auth }
      );
    }
    
    // 查找同名规则
    if (listResponse.data.success && listResponse.data.result.length > 0) {
      existingRule = listResponse.data.result.find(rule => rule.description === description);
    }
    
    let response;
    if (existingRule) {
      // 更新现有规则
      // console.log(`找到现有规则 "${description}"，准备更新...`);
      
      // 更新过滤器表达式
      const filterId = existingRule.filter.id;
      let filterUpdateResponse;
      
      if (this.headers && Object.keys(this.headers).length > 0) {
        filterUpdateResponse = await req(
          `https://api.cloudflare.com/client/v4/zones/${this.zid}/filters/${filterId} put`,
          { json: { expression: expression, paused: false } },
          this.headers
        );
      } else {
        filterUpdateResponse = await req(
          `https://api.cloudflare.com/client/v4/zones/${this.zid}/filters/${filterId} put`,
          { auth: this.auth, json: { expression: expression, paused: false } }
        );
      }
      
      if (!filterUpdateResponse.data.success) {
        throw new Error(`更新过滤器失败: ${JSON.stringify(filterUpdateResponse.data.errors)}`);
      }
      
      // 更新规则本身
      if (this.headers && Object.keys(this.headers).length > 0) {
        response = await req(
          `https://api.cloudflare.com/client/v4/zones/${this.zid}/firewall/rules/${existingRule.id} put`,
          { 
            json: {
              action: action,
              priority: priority,
              paused: false,
              description: description, // 保留原有描述
              filter: {
                id: filterId  // 更新规则时必须包含过滤器ID
              }
            } 
          },
          this.headers
        );
      } else {
        response = await req(
          `https://api.cloudflare.com/client/v4/zones/${this.zid}/firewall/rules/${existingRule.id} put`,
          { 
            auth: this.auth, 
            json: {
              action: action,
              priority: priority,
              paused: false,
              description: description, // 保留原有描述
              filter: {
                id: filterId  // 更新规则时必须包含过滤器ID
              }
            } 
          }
        );
      }
      
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
      const requestBody = [{
        filter: {
          expression: expression,
          paused: false
        },
        action: action,
        priority: priority,
        paused: false,
        description: description
      }];
      
      if (this.headers && Object.keys(this.headers).length > 0) {
        // 使用Global API Key认证
        response = await req(
          `https://api.cloudflare.com/client/v4/zones/${this.zid}/firewall/rules post`,
          { json: requestBody },
          this.headers
        );
      } else {
        // 使用API Token认证
        response = await req(
          `https://api.cloudflare.com/client/v4/zones/${this.zid}/firewall/rules post`,
          { auth: this.auth, json: requestBody }
        );
      }
      
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