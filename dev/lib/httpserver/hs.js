export { h2s, hs, connect };
export * from "./routes.js";

import { xlog, gcatch } from "../basic.js";
import http2 from "http2";
import http from "http";
import { hd_stream, getArgv, simulateHttp2Stream } from "./std.js";
import { addr, _404 } from "./router.js";

/**
 * hs定位:业务核心服务器,及h2测试服务器,生产环境中主要反代使用
 * 安防交给nginx cf等网关
 * @param  {...any} argv 
 * @returns 
 */
function hs(...argv) {
  let { port, config } = getArgv(argv),
    server,
    scheme,
    ok = false,
    currentConnections = 0; //记录当前连接数
  if (config?.key) {
    server = http2.createSecureServer(config);
    scheme = "https";
  } else {
    server = http.createServer(config);
    scheme = "http";
  }
  server.listen(port, () => {
    ok = true;
    console.log(`\x1b[92m✓\x1b[0m Running on ${scheme}://localhost:${port}`);
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
      console.error(
        `\x1b[93m⚠\x1b[0m Port ${port} is in use, trying ${port + 1} instead.`
      );
      port++;
      server.listen(port);
    } else {
      console.error(`Server error: ${err.message}`);
    }
  });
  xlog("Start " + scheme + " server...");
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
function h2s(...argv) {
  let { port, config } = getArgv(argv, true);
  return hs(port, config);
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
