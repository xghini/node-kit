export { h2s, hs, hss, req };
export * from "./routes.js";

import { cinfo,cwarn, gcatch, rf, xpath,style } from "../basic.js";
import http2 from "http2";
import https from "https";
import http from "http";
import { hd_stream, simulateHttp2Stream } from "./std.js";
import { addr, _404 } from "./router.js";

/**
 * hs定位:业务核心服务器,及h2测试服务器,生产环境中主要反代使用
 * 安防交给nginx cf等网关
 * @param  {...any} argv
 * @returns
 */
function hs(...argv) {
  let { port, config } = argv_port_config(argv),
    server,
    scheme,
    alpn = "http/1.1",
    ok = false,
    currentConnections = 0; //记录当前连接数
  if (config?.key) {
    if (config.hasOwnProperty("allowHTTP1")) {
      server = http2.createSecureServer(config);
      if (config.allowHTTP1) alpn = "h2,http/1.1";
      else alpn = "h2";
    } else server = https.createServer(config);
    scheme = "https";
  } else {
    server = http.createServer(config);
    scheme = "http";
  }
  server.listen(port, () => {
    ok = true;
    cinfo.bind({info:2})(`${style.reset}${style.bold}${style.brightGreen}✓ ${style.brightWhite}Running on ${style.underline}${scheme}://localhost:${port}${style.reset}`);
    gcatch();
    if (config?.key) {
      server.on("stream", (stream, headers) => {
        stream.alpn = "HTTP/2";
        hd_stream(server, stream, headers);
      });
    }
  });
  // 监听tcp connection✅  session(❌不够底层,防不了tcp级别ddos)
  // 先起个简单查看状态作用,如有需要以后再拓展安防
  server.on("connection", (socket) => {
    currentConnections++; // 增加连接数
    // console.log(`当前连接数：${currentConnections}`);
    // 监听连接关闭
    socket.on("close", () => {
      currentConnections--; // 减少连接数
      // console.log(`连接关闭，当前连接数：${currentConnections}`);
    });
    /* 给每ip限制最大连接数,超时断开连接 */
    // 模拟 3 秒后主动关闭 HTTP/2 连接
    // setTimeout(() => {
    //   console.log("主动关闭 HTTP/2 连接");
    //   socket.destroy(); // 关闭 HTTP/2 连接
    // }, 3000);
  });
  server.on("request", (req, res) => {
    if (req.headers[":path"]) return;
    req.scheme = scheme;
    let { stream, headers } = simulateHttp2Stream(req, res);
    hd_stream(server, stream, headers);
  });
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE" && port < 65535) {
      cwarn.bind({info:2})(
        `${style.bold}${style.yellow}⚠ ${style.dim}${style.brightMagenta}Port ${port} is in use, trying ${port + 1} instead...${style.reset}`
      );
      port++;
      server.listen(port);
    } else {
      console.error(`Server error: ${err.message}`);
    }
  });
  cinfo.bind({info:2})(`Start [${alpn}] ${scheme} server...`);
  // 虽然不赋值server也进行了修改,但ide跟踪不到,所以这里赋值一下
  server = Object.assign(server, {
    http_local: true,
    https_local: false,
    routes: [],
    addr,
    _404,
    router_begin: (server, gold) => {},
    cnn: 0,
  });
  Object.defineProperties(server, {
    routes: { writable: false, configurable: false },
    addr: { writable: false, configurable: false },
    cnn: {
      get: () => currentConnections,
      enumerable: true,
    },
  });
  return server;
}
/**
 * h2s 默认创建 h2tls 兼容 http1.1 tls 的服务器,也可通过配置仅创建h2server
 * @param  {...any} argv
 * @returns
 */
function h2s(...argv) {
  let { port, config } = argv_port_config(argv);
  config = {
    ...{
      key: rf(xpath("../../../store/cert/selfsigned.key", import.meta.url)),
      cert: rf(xpath("../../../store/cert/selfsigned.cert", import.meta.url)),
      allowHTTP1: true,
      // settings: {
      //   maxConcurrentStreams: 100, // 最大并发流数
      //   maxHeaderListSize: 32 * 1024, // 最大请求头大小 (32KB)
      // },
    },
    ...config,
  };
  return hs(port, config);
}
/**
 * hss 创建http1.1 tls server
 * @param  {...any} argv
 * @returns
 */
function hss(...argv) {
  // 启动一个 HTTPS 服务器，使用指定的证书和密钥文件
  let { port, config } = argv_port_config(argv);
  config = {
    ...{
      key: rf(xpath("../../../store/cert/selfsigned.key", import.meta.url)),
      cert: rf(xpath("../../../store/cert/selfsigned.cert", import.meta.url)),
    },
    config,
  };
  return hs(port, config);
}
/**
 * argv_port_config 动态分析argv返回端口和配置
 * @param {*} argv
 * @returns
 */
function argv_port_config(argv) {
  let port, config;
  argv.forEach((item) => {
    // 简单判断,写错了走报错去
    if (typeof item === "object") {
      config = item;
    } else {
      port = item;
    }
  });
  port = port || 3000;
  return { port, config };
}






// 先发送一个 HTTP/1.1 请求，如果允许升级到 HTTP/2
/**
 *
 * @param {*} curlString
 * @returns
 *
 * @example
 * https://tls.peet.ws/api/all
 * http://localhost:3000
 */
function connect(curlString) {
  const urlMatch = curlString.match(/https?:\/\/[^\s]+/);
  if (!urlMatch) {
    throw new Error("Invalid URL in curl command");
  }
  const parsedUrl = new URL(urlMatch[0]);
  const authority = parsedUrl.host;
  const path = parsedUrl.pathname;
  const method = curlString.includes("-X")
    ? curlString.match(/-X\s*(\w+)/)[1]
    : "GET";
  return new Promise((resolve, reject) => {
    const client = http2.connect(`https://${authority}`, {
      rejectUnauthorized: false, // For testing purposes
    });
    client.on("error", (err) => {
      // console.error("Connection error:", err);
      client.close();
      reject(err);
    });
    const req = client.request({
      ":method": method,
      ":path": path,
      ":scheme": "https",
      ":authority": authority,
    });
    let responseData = "";
    req.on("data", (chunk) => {
      responseData += chunk;
    });
    req.on("end", () => {
      client.close();
      resolve(responseData);
    });
    req.end();
  });
}



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
// 最底层req,原始xurl,body,headers,option
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
          headers: Object.keys(headers).reduce((obj, key) => {
            obj[key] = headers[key];
            return obj;
          }, {}),
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
      console.info("HTTP/2");
      resolve(true);
    });
    session.once("error", () => {
      session.destroy();
      console.info("HTTP/1.1");
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