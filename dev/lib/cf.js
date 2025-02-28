// cloudflare使用api的便捷封装
// cloudflare使用api的便捷封装
import { req } from "./http/req.js";
export { cf };
async function cf(obj) {
  const auth = "Bearer " + obj.key;
  const domain = obj.domain;
  const zid = await getZoneId.bind({ auth, domain })();
  return {
    auth,
    domain,
    zid,
    getZoneId,
    add,
    madd,
    set,
    mset,
    del,
    mdel,
  };
}
let res;
async function getZoneId() {
  try {
    console.log(this);
    const res = await req(
      `https://api.cloudflare.com/client/v4/zones?name=${this.domain}`,
      { auth: this.auth }
    );
    if (res.data.success && res.data.result.length > 0) {
      return res.data.result[0].id;
    } else {
      throw new Error("域名未找到或权限不足");
    }
  } catch (error) {
    console.error("获取 Zone ID 失败:", error.message);
    return null;
  }
}
async function mset(arr) {
  return Promise.all(arr.map((item) => this.set(item)));
}
// 查询ID+修改(没有批量)
/**
 * 强大的set能力 能够处理如'em962 "test test test" txt'
 * @param {*} str 
 */
async function set(str) {
  let pre, content, type, priority;
  if (Array.isArray(str)) {
    [pre, content, type, priority] = str;
  } else {
    // 处理引号内的空格
    let processedStr = '';
    let inQuotes = false;
    // 首先替换引号内的空格为{+}
    for (let i = 0; i < str.length; i++) {
      const char = str.charAt(i);
      if (char === '"') {
        inQuotes = !inQuotes;
        processedStr += char;
      } else if (char === ' ') {
        processedStr += inQuotes ? '{+}' : char;
      } else {
        processedStr += char;
      }
    }
    // 然后将多个空格标准化为一个空格
    processedStr = processedStr.replace(/ +/g, ' ').trim();
    // 分割并还原{+}为空格
    const parts = processedStr.split(' ');
    pre = parts[0];
    // 处理带引号的内容
    if (parts[1] && parts[1].startsWith('"')) {
      // 找到闭合引号的位置
      let quoteContent = parts[1];
      let contentEndIndex = 1;
      // 如果第一个部分没有闭合引号，继续查找
      if (!parts[1].endsWith('"') || parts[1].length <= 1) {
        for (let i = 2; i < parts.length; i++) {
          quoteContent += ' ' + parts[i];
          contentEndIndex = i;
          if (parts[i].endsWith('"')) break;
        }
      }
      // 提取引号内的内容并还原{+}为空格
      content = '"'+quoteContent.substring(1, quoteContent.length - 1).replace(/\{\+\}/g, ' ')+'"';
      // 提取剩余部分
      type = parts[contentEndIndex + 1] || 'A';
      priority = parts[contentEndIndex + 2] || 10;
    } else {
      // 没有引号的情况
      content = parts[1] || '';
      type = parts[2] || 'A';
      priority = parts[3] || 10;
    }
  }
  const host = pre + "." + this.domain;
  try {
    // 查询是否存在记录
    let res = await req(
      `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records?type=${type}&name=${host}`,
      { auth: this.auth }
    );
    if (res.data.result.length > 0) {
      // 保持原始URL和HTTP方法分开的写法
      const recordId = res.data.result[0].id;
      res = await req(
        `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records/${recordId} put`,
        {
          auth: this.auth,
          json: {
            type: type || "A",
            name: host,
            content,
            proxied: false,
            priority: priority * 1 || 10,
          },
        }
      );
      console.log(
        `${host}`,
        res.data.success ? "修改成功" : res.data.errors[0].message
      );
    } else {
      // 添加新记录
      console.log(`${host}`, "域名未找到或权限不足,尝试添加");
      await add.bind({
        auth: this.auth,
        zid: this.zid,
      })({
        type: type || "A",
        name: host,
        content,
        proxied: false,
        priority: priority * 1 || 10,
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
  res = await req(
    `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records post`,
    {
      auth: this.auth,
      json,
    }
  );
  console.log(
    json.name,
    res.data.success ? "添加成功" : res.data.errors[0].message
  );
}

async function mdel(arr) {
  return Promise.all(arr.map((item) => this.del(item)));
}
// 删除单个记录（需先查询 ID）
async function del(pre) {
  // 1. 查询记录 ID（保持原逻辑）
  const host = pre + "." + this.domain;
  let res = await req(
    `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records?type=A&name=${host}`,
    { auth: this.auth }
  );
  const recordId = res.data.result[0]?.id;
  if (!recordId) {
    console.log(`记录 ${host} 不存在，跳过删除`);
    return;
  }
  res = await res.req(
    `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records/${recordId} delete`
  );
  console.log(`删除${host}: ${res.data.success ? "成功" : "失败"}`);
}
