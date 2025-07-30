import { req } from "./http/req.js";
export { cf };
async function cf(obj) {
  const key = obj.key;
  const domain = obj.domain;
  const email = obj.email;
  let auth,
    headers = {};
  if (email) {
    headers = {
      "X-Auth-Email": email,
      "X-Auth-Key": key,
    };
    console.dev("使用Global API Key认证");
  } else {
    auth = "Bearer " + key;
    console.dev("使用API Token认证");
  }
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
    setByContent,
    msetByContent,
    setByContentForce,
    msetByContentForce,
  };
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
    if (!this.zid) {
      throw new Error(`无法获取Zone ID，请检查域名: ${this.domain}`);
    }
    console.log(`查找记录: ${host} ${type} ${oldContent}`);
    let res;
    if (this.headers && Object.keys(this.headers).length > 0) {
      res = await req(
        `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records?type=${type}&name=${host}`,
        {},
        this.headers
      );
    } else {
      res = await req(
        `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records?type=${type}&name=${host}`,
        { auth: this.auth }
      );
    }
    if (!res.data.success) {
      throw new Error(`查询记录失败: ${JSON.stringify(res.data.errors)}`);
    }
    const targetRecord = res.data.result.find(record => record.content === oldContent);
    if (!targetRecord) {
      console.log(`未找到内容为 ${oldContent} 的记录`);
      return {
        success: false,
        message: `未找到内容为 ${oldContent} 的记录`,
        action: 'not_found'
      };
    }
    console.log(`找到目标记录ID: ${targetRecord.id}`);
    const updateData = {
      type: type,
      name: host,
      content: newContent,
      proxied: targetRecord.proxied || false,
      priority: targetRecord.priority || 10,
      ttl: ttl
    };
    let updateRes;
    if (this.headers && Object.keys(this.headers).length > 0) {
      updateRes = await req(
        `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records/${targetRecord.id} put`,
        { json: updateData },
        this.headers
      );
    } else {
      updateRes = await req(
        `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records/${targetRecord.id} put`,
        { auth: this.auth, json: updateData }
      );
    }
    if (updateRes.data.success) {
      console.log(`✅ 成功更新: ${host} ${oldContent} → ${newContent}`);
      return {
        success: true,
        message: `已将 ${host} 从 ${oldContent} 更新为 ${newContent}`,
        record: updateRes.data.result,
        action: 'updated'
      };
    } else {
      throw new Error(`更新记录失败: ${JSON.stringify(updateRes.data.errors)}`);
    }
  } catch (error) {
    console.error(`更新记录时出错:`, error.message);
    return { 
      success: false, 
      error: error.message 
    };
  }
}
async function msetByContent(updates) {
  const grouped = {};
  updates.forEach((update, index) => {
    const pre = update[0];
    if (!grouped[pre]) grouped[pre] = [];
    grouped[pre].push({ update, index });
  });
  const results = new Array(updates.length);
  await Promise.all(
    Object.values(grouped).map(async (group) => {
      for (const { update, index } of group) {
        try {
          const [pre, oldContent, newContent, type, ttl] = update;
          results[index] = await this.setByContent(pre, oldContent, newContent, type, ttl);
        } catch (error) {
          results[index] = { success: false, error: error.message };
        }
      }
    })
  );
  return results;
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
async function setByContentForce(pre, oldContent, newContent, type = "A", ttl = 60) {
  const result = await this.setByContent(pre, oldContent, newContent, type, ttl);
  if (result.success) {
    return result;
  }
  if (result.action === 'not_found') {
    console.log(`未找到旧记录，强制添加新记录: ${pre}.${this.domain} ${newContent}`);
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
        ttl: ttl
      });
      if (addResult.success) {
        console.log(`✅ 强制添加成功: ${pre}.${this.domain} ${newContent}`);
        return {
          success: true,
          message: `已为 ${pre}.${this.domain} 强制添加新记录 ${newContent}`,
          record: addResult.result,
          action: 'added'
        };
      } else {
        throw new Error(`强制添加记录失败: ${JSON.stringify(addResult.errors)}`);
      }
    } catch (error) {
      console.error(`强制添加记录时出错:`, error.message);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }
  return result;
}
async function msetByContentForce(updates) {
  const grouped = {};
  updates.forEach((update, index) => {
    const pre = update[0];
    if (!grouped[pre]) grouped[pre] = [];
    grouped[pre].push({ update, index });
  });
  const results = new Array(updates.length);
  await Promise.all(
    Object.values(grouped).map(async (group) => {
      for (const { update, index } of group) {
        try {
          const [pre, oldContent, newContent, type, ttl] = update;
          results[index] = await this.setByContentForce(pre, oldContent, newContent, type, ttl);
        } catch (error) {
          results[index] = { success: false, error: error.message };
        }
      }
    })
  );
  return results;
}
async function getZoneId() {
  try {
    console.dev("获取Zone ID，域名:", this.domain);
    let res;
    if (this.headers && Object.keys(this.headers).length > 0) {
      res = await req(
        `https://api.cloudflare.com/client/v4/zones?name=${this.domain}`,
        {}, 
        this.headers 
      );
    } else {
      res = await req(
        `https://api.cloudflare.com/client/v4/zones?name=${this.domain}`,
        { auth: this.auth }
      );
    }
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
async function mset(arr) {
  const grouped = {};
  arr.forEach((item, index) => {
    let pre;
    if (Array.isArray(item)) {
      pre = item[0];
    } else {
      const parts = item.split(' ');
      pre = parts[0];
    }
    if (!grouped[pre]) grouped[pre] = [];
    grouped[pre].push({ item, index });
  });
  const results = new Array(arr.length);
  await Promise.all(
    Object.values(grouped).map(async (group) => {
      for (const { item, index } of group) {
        try {
          results[index] = await this.set(item);
        } catch (error) {
          results[index] = { success: false, error: error.message };
        }
      }
    })
  );
  return results;
}
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
    let processedStr = "";
    let inQuotes = false;
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
    processedStr = processedStr.replace(/ +/g, " ").trim();
    const parts = processedStr.split(" ");
    pre = parts[0];
    if (parts[1] && parts[1].startsWith('"')) {
      let quoteContent = parts[1];
      let contentEndIndex = 1;
      if (!parts[1].endsWith('"') || parts[1].length <= 1) {
        for (let i = 2; i < parts.length; i++) {
          quoteContent += " " + parts[i];
          contentEndIndex = i;
          if (parts[i].endsWith('"')) break;
        }
      }
      content =
        '"' +
        quoteContent
          .substring(1, quoteContent.length - 1)
          .replace(/\{\+\}/g, " ") +
        '"';
      type = parts[contentEndIndex + 1] || "A";
      priority = parts[contentEndIndex + 2] || 10;
      ttl = parts[contentEndIndex + 3] || 60; 
    } else {
      content = parts[1] || "";
      type = parts[2] || "A";
      priority = parts[3] || 10;
      ttl = parts[4] || 60; 
    }
  }
  const host = pre + "." + this.domain;
  const recordTtl =
    ttl === "auto" || isNaN(parseInt(ttl)) ? 60 : parseInt(ttl) || 60;
  try {
    if (!this.zid) {
      throw new Error(`无法获取Zone ID，请检查域名: ${this.domain}`);
    }
    const recordsToAdd = [];
    if (type === "A" && content.includes(",")) {
      const ipList = [
        ...new Set(
          content
            .split(",")
            .map((ip) => ip.trim())
            .filter((ip) => ip !== "")
        ),
      ];
      ipList.forEach(ip => {
        recordsToAdd.push({
          type: type,
          name: host,
          content: ip,
          proxied: false,
          priority: parseInt(priority) || 10,
          ttl: recordTtl
        });
      });
    } else {
      recordsToAdd.push({
        type: type || "A",
        name: host,
        content,
        proxied: false,
        priority: parseInt(priority) || 10,
        ttl: recordTtl
      });
    }
    let res;
    if (this.headers && Object.keys(this.headers).length > 0) {
      res = await req(
        `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records?type=${type}&name=${host}`,
        {},
        this.headers
      );
    } else {
      res = await req(
        `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records?type=${type}&name=${host}`,
        { auth: this.auth }
      );
    }
    const existingRecords = res.data.result || [];
    const addResults = [];
    let addFailed = false;
    for (const record of recordsToAdd) {
      try {
        const result = await add.bind({
          auth: this.auth,
          headers: this.headers,
          zid: this.zid,
        })(record);
        if (result.success) {
          addResults.push(result);
        } else {
          throw new Error(`添加失败: ${JSON.stringify(result.errors)}`);
        }
      } catch (error) {
        addFailed = true;
        console.error(`添加新记录失败: ${error.message}`);
        throw new Error(`添加新记录失败，保留原有记录: ${error.message}`);
      }
    }
    if (!addFailed && existingRecords.length > 0) {
      console.log(`新记录添加成功，开始删除 ${existingRecords.length} 条旧记录`);
      const deletePromises = existingRecords.map((record) => {
        if (this.headers && Object.keys(this.headers).length > 0) {
          return req(
            `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records/${record.id} delete`,
            {},
            this.headers
          );
        } else {
          return req(
            `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records/${record.id} delete`,
            { auth: this.auth }
          );
        }
      });
      const deleteResults = await Promise.allSettled(deletePromises);
      deleteResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.warn(`删除旧记录失败 (ID: ${existingRecords[index].id}):`, result.reason);
        }
      });
    }
    const message = recordsToAdd.length > 1 
      ? `已为 ${host} 添加 ${recordsToAdd.length} 条${type}记录`
      : `已更新 ${host} 的记录`;
    return { success: true, message };
  } catch (error) {
    console.error(`操作 ${host} 时出错:`, error.message);
    return { success: false, error: error.message };
  }
}
async function madd(arr) {
  const grouped = {};
  arr.forEach((item, index) => {
    const name = item.name;
    if (!grouped[name]) grouped[name] = [];
    grouped[name].push({ item, index });
  });
  const results = new Array(arr.length);
  await Promise.all(
    Object.values(grouped).map(async (group) => {
      for (const { item, index } of group) {
        try {
          results[index] = await this.add(item);
        } catch (error) {
          results[index] = { success: false, error: error.message };
        }
      }
    })
  );
  return results;
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
      res = await req(
        `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records post`,
        { json },
        this.headers
      );
    } else {
      res = await req(
        `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records post`,
        { auth: this.auth, json }
      );
    }
    return res.data;
  } catch (error) {
    console.error(`添加记录 ${json.name} 失败:`, error.message);
    throw error;
  }
}
async function mdel(arr) {
  const grouped = {};
  arr.forEach((pre, index) => {
    if (!grouped[pre]) grouped[pre] = [];
    grouped[pre].push({ pre, index });
  });
  const results = new Array(arr.length);
  await Promise.all(
    Object.values(grouped).map(async (group) => {
      for (const { pre, index } of group) {
        try {
          results[index] = await this.del(pre);
        } catch (error) {
          results[index] = { success: false, error: error.message };
        }
      }
    })
  );
  return results;
}
async function del(pre) {
  try {
    const host = pre + "." + this.domain;
    let res;
    if (this.headers && Object.keys(this.headers).length > 0) {
      res = await req(
        `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records?type=A&name=${host}`,
        {},
        this.headers
      );
    } else {
      res = await req(
        `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records?type=A&name=${host}`,
        { auth: this.auth }
      );
    }
    const recordId = res.data.result[0]?.id;
    if (!recordId) {
      console.log(`记录 ${host} 不存在，跳过删除`);
      return { success: true, message: `记录 ${host} 不存在` };
    }
    if (this.headers && Object.keys(this.headers).length > 0) {
      res = await req(
        `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records/${recordId} delete`,
        {},
        this.headers
      );
    } else {
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
    let existingRule = null;
    let listResponse;
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
    if (listResponse.data.success && listResponse.data.result.length > 0) {
      existingRule = listResponse.data.result.find(
        (rule) => rule.description === description
      );
    }
    let response;
    if (existingRule) {
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
        throw new Error(
          `更新过滤器失败: ${JSON.stringify(filterUpdateResponse.data.errors)}`
        );
      }
      if (this.headers && Object.keys(this.headers).length > 0) {
        response = await req(
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
        response = await req(
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
      if (response.data.success) {
        console.log(`安全规则 "${description}" 更新成功！`);
        return response.data.result;
      } else {
        console.error("更新安全规则失败:", response.data.errors);
        throw new Error(JSON.stringify(response.data.errors));
      }
    } else {
      console.log(`未找到安全规则 "${description}"，准备创建...`);
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
      if (this.headers && Object.keys(this.headers).length > 0) {
        response = await req(
          `https://api.cloudflare.com/client/v4/zones/${this.zid}/firewall/rules post`,
          { json: requestBody },
          this.headers
        );
      } else {
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