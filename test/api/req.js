import kit from "@ghini/kit/dev";
kit.xconsole();
import http2 from "http2";
import http from "node:http";
import https from "node:https";

// 缓存 HTTP/2 连接
const h2session = new Map();
const DEFAULT_TIMEOUT = 5000;
const d_h2_option = {
  settings: { enablePush: false },
  rejectUnauthorized: false,
};
const d_h1_option = {
  rejectUnauthorized: false,
};
const d_headers = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
};
// breq完成构建
function breq(url) {
  // 1.构建好url 2.h1h2与构建做好对接 3.send
  return {
    urlobj: url ? new URL(url) : null,
    method: "GET",
    data: null,
    headers: d_headers,
    h1option: d_h1_option,
    h2option: d_h2_option,
    send: async function () {
      await req(this);
    },
  };
}
/**
 * req直接发请求(适合简单发送)
 * @example
 * 完整路径+方法(默认get)
 * req("https://www.baidu.com?a=1&a=2&b=2")
 * req("/test post",body,headers,option)
 * req(build)
 * build.post()
 * build.jpost()
 * build.send()
 */
async function req(url, method = "GET", postData = null) {
  const urlObj = new URL(url);
  // console.log(urlObj);
  try {
    if (urlObj.protocol === "http:") {
      return await h1req(urlObj, method, postData);
    }
    if (await h2detect(urlObj)) {
      return await h2req(urlObj, method, postData);
    }
    return await h1req(urlObj, method, postData);
  } catch (error) {
    console.error(error);
  }
}
async function h2req(urlObj, method = "GET", postData = null) {
  const client = get_h2session(urlObj);
  return new Promise((resolve, reject) => {
    const headers = {
      ...{
        ":path": urlObj.pathname + urlObj.search,
        ":method": method,
      },
      ...d_headers,
    };
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
    }, DEFAULT_TIMEOUT);
    req.on("error", (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });
  });
}
function get_h2session(urlObj) {
  const host = urlObj.host;
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
  return new Promise((resolve) => {
    const session = http2.connect(urlObj.origin, d_h2_option);
    // once 只监听一次事件后自动取消监听
    session.once("connect", () => {
      h2session.set(host, session);
      // session.destroy();
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
async function h1req(urlObj, method = "GET", postData = null) {
  const protocol = urlObj.protocol === "https:" ? https : http;
  const options = {
    protocol: urlObj.protocol,
    hostname: urlObj.hostname,
    rejectUnauthorized: false,
    port: urlObj.port || (urlObj.protocol === "https:" ? 443 : 80),
    path: urlObj.pathname + urlObj.search,
    method,
    headers: d_headers,
    timeout: DEFAULT_TIMEOUT,
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

// req('https://mana-x.aizex.net/c/677d9459-6900-8000-a150-51a684b8f05b')

// 测试代码
let res;
const postData = { test: "data", timestamp: new Date().toISOString() };
// // 测数据
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
// console.log(res.headers);
// console.log(h2session);
// setInterval(() => {
//   // 1.服务器首要设置中断
//   // 2.客户端也酌情设置中断
//   console.log(h2session.size);
// }, 1000);
// // console.log(res.data);


