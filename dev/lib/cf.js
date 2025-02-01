// cloudflare使用api的便捷封装
// cloudflare使用api的便捷封装
import { req } from "./http/req.js";
export { cf };
function cf(obj) {
  return {
    auth: "Bearer " + obj.key,
    domain: obj.domain,
    getZoneId,
    add,
    madd,
    edit,
    medit,
    del,
    mdel,
  };
}
let res;
async function getZoneId() {
  try {
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
async function medit(arr) {
  return Promise.all(arr.map((item) => this.edit(item)));
}
// 查询ID+修改(没有批量)
async function edit(str) {
  const [pre, ip] = str.split(" ");
  const zid = await this.getZoneId();
  const host = pre + "." + this.domain;
  res = await req(
    `https://api.cloudflare.com/client/v4/zones/${zid}/dns_records?type=A&name=${host}`,
    { auth: this.auth }
  );
  // console.log(res.data);
  if (res.data.result.length > 0) {
    res = await req(
      `https://api.cloudflare.com/client/v4/zones/${zid}/dns_records/${res.data.result[0].id} put`,
      {
        auth: this.auth,
        json: {
          type: "A",
          name: host,
          content: ip,
          proxied: false,
        },
      }
    );
    console.log(`${host}`,res.data.success ? "修改成功" : res.data.errors[0].message);
  } else {
    console.log(`${host}`, "域名未找到或权限不足");
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
  const zid = await this.getZoneId();
  res = await req(
    `https://api.cloudflare.com/client/v4/zones/${zid}/dns_records post`,
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
  const zid = await this.getZoneId();
  const host = pre + "." + this.domain;
  let res = await req(
    `https://api.cloudflare.com/client/v4/zones/${zid}/dns_records?type=A&name=${host}`,
    { auth: this.auth }
  );
  const recordId = res.data.result[0]?.id;
  if (!recordId) {
    console.log(`记录 ${host} 不存在，跳过删除`);
    return;
  }
  res = await res.req(
    `https://api.cloudflare.com/client/v4/zones/${zid}/dns_records/${recordId} delete`
  );
  console.log(`删除${host}: ${res.data.success ? "成功" : "失败"}`);
}
