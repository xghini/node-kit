import kit from "@ghini/kit/dev";
kit.xconsole();
import http2 from "http2";
import http from "node:http";
import https from "node:https";
// URL已内置
// import { URL } from "node:url";

// 缓存 HTTP/2 连接
const h2Hosts = new Set();
const h2session = new Map();
const DEFAULT_TIMEOUT = 5000;
const d_h2_option = {
  settings: { enablePush: false },
  rejectUnauthorized: false,
};
const d_h1_option = {
  rejectUnauthorized: false,
};
const d_headers={
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
}
async function req(
  url,
  method = "GET",
  postData = null,
  timeout = DEFAULT_TIMEOUT
) {
  // 1.构建好url 2.h1h2与构建做好对接 3.send
  // 记录最近一次请求的baseurl,baseheaders
  const urlObj = new URL(url);
  // console.log(urlObj);
  try {
    if (urlObj.protocol === "http:") {
      return await h1req(urlObj, method, postData, timeout);
    }
    if (await h2detect(urlObj, timeout)) {
      return await h2req(urlObj, method, postData, timeout);
    }
    return await h1req(urlObj, method, postData, timeout);
  } catch (error) {
    console.error(error);
  }
}
async function h2req(
  urlObj,
  method = "GET",
  postData = null,
  timeout = DEFAULT_TIMEOUT
) {
  const client = get_h2session(urlObj);
  return new Promise((resolve, reject) => {
    const headers = {...{
      ":path": urlObj.pathname + urlObj.search,
      ":method": method,
    }, ...d_headers};
    let dataToSend = null;
    if (postData) {
      dataToSend =
        typeof postData === "object" ? JSON.stringify(postData) : postData;
      headers["content-type"] = "application/json";
      headers["content-length"] = Buffer.byteLength(dataToSend);
    }
    const req = client.request(headers);
    if (dataToSend) {
      req.write(dataToSend);
    }
    req.end();
    req.on("response", (headers, flags) => {
      req.setEncoding("utf8");
      let responseData = "";
      req.on("data", (chunk) => {
        responseData += chunk;
      });
      req.on("end", () => {
        clearTimeout(timeoutId);
        resolve({
          statusCode: req.rstCode === 0 ? 200 : req.rstCode, // 简化处理
          headers: headers,
          data: parseResponseData(responseData),
          protocol: "h2",
        });
      });
    });
    // 设置超时
    const timeoutId = setTimeout(() => {
      req.close();
      reject(new Error("HTTP/2 request timed out"));
    }, timeout);
    req.on("error", (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });
  });
}
function get_h2session(urlObj) {
  const host = urlObj.origin;
  if (h2session.has(host)) {
    const session = h2session.get(host);
    if (!session.destroyed && !session.closed) {
      return session;
    } else {
      h2session.delete(host);
    }
  }
  const session = http2.connect(urlObj.origin, d_h2_option);
  session.on("error", () => {
    session.destroy();
    h2session.delete(host);
  });
  session.on("close", () => {
    h2session.delete(host);
  });
  h2session.set(host, session);
  return session;
}
// 一般都能马上返回,不用设置超时
async function h2detect(urlObj) {
  const host = urlObj.host;
  if (h2Hosts.has(host)) return true;
  return new Promise((resolve) => {
    const session = http2.connect(urlObj.origin, d_h2_option);
    // once 只监听一次事件后自动取消监听
    session.once("connect", () => {
      h2Hosts.add(host);
      session.destroy();
      // console.log("support h2");
      resolve(true);
    });
    session.once("error", () => {
      session.destroy();
      // console.log("unsupport h2");
      resolve(false);
    });
  });
}


// 收集响应数据的异步迭代器
async function collectResponseData(stream) {
  let data = "";
  for await (const chunk of stream) {
    data += chunk;
  }
  return data;
}
// 解析响应数据的辅助函数
function parseResponseData(data) {
  try {
    return data.startsWith("{") || data.startsWith("[")
      ? JSON.parse(data)
      : data;
  } catch {
    return data;
  }
}


// HTTP/1.1 请求
async function h1req(
  urlObj,
  method = "GET",
  postData = null,
  timeout = DEFAULT_TIMEOUT
) {
  const protocol = urlObj.protocol === "https:" ? https : http;
  const options = {
    protocol: urlObj.protocol,
    hostname: urlObj.hostname,
    rejectUnauthorized: false,
    port: urlObj.port || (urlObj.protocol === "https:" ? 443 : 80),
    path: urlObj.pathname + urlObj.search,
    method,
    headers: d_headers,
    timeout,
  };
  let dataToSend = null;
  if (postData) {
    dataToSend =
      typeof postData === "object" ? JSON.stringify(postData) : postData;
    options.headers["Content-Type"] = "application/json";
    options.headers["Content-Length"] = Buffer.byteLength(dataToSend);
  }
  return new Promise((resolve, reject) => {
    const req = protocol.request(options, async (res) => {
      try {
        const data = await collectResponseData(res);
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: parseResponseData(data),
          protocol: urlObj.protocol === "https:" ? "https" : "http",
        });
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", (error) => {
      reject(error);
    });
    req.on("timeout", () => {
      req.destroy(new Error("HTTP/1.1 request timed out"));
    });
    if (dataToSend) {
      req.write(dataToSend);
    }
    req.end();
  });
}


// 测试代码
let res;
const postData = { test: "data", timestamp: new Date().toISOString() };
// 测数据
res = await req(
  "https://localhost:3000/test?username=张三&password=123&a=1&a=2&b=李四#part1=#section2",
  "poST",
  postData
);
// 测超时 即时应用层超时,也能马上判断协议
// res = await req("https://localhost:3000/test/timeout");
// 测错误协议 能马上响应Error: socket hang up. code: 'ECONNRESET'
// res = await req("http://localhost:3000/test/timeout");
// 测无连接 能马上响应Error: connect ECONNREFUSED. code: 'ECONNREFUSED'
// res = await req("http://localhost:2000/test/timeout");
// 测降级
// res = await req("https://nginx.org/");
// delete res.data;
console.log(res.headers);
console.log(res.data);
