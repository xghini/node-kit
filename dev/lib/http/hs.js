export { h2s, hs, hss };

import { gcatch, rf, xpath, style, myip, metaroot } from "../index.js";
import kit from "../../main.js";
import http2 from "http2";
import https from "https";
import http from "http";
import EventEmitter from "events";
import { hd_stream } from "./gold.js";
import { addr, _404 } from "./router.js";
import { extname } from "path";
import { fileSystem } from "./template.js";
/*
 * hs定位:业务核心服务器,及h2测试服务器,生产环境中主要反代使用
 * 安防交给nginx cf等网关
 */
/**
 * @typedef {Object} ServerExtension
 * @property {number} open
 * @property {any[]} routes
 * @property {Function} addr
 * @property {Function} static
 * @property {Function} _404
 * @property {Function} router_begin
 * @property {number} cnn
 * @property {any} cluster
 * @property {number} port
 */

/**
 * @param {...any} argv
 * @returns {Promise<import('http').Server & ServerExtension>}
 */
async function hs(...argv) {
  return new Promise((resolve, reject) => {
    let { port, config } = argv_port_config(argv),
      server,
      scheme,
      open = 0,
      protocol = "http/1.1",
      currentConnections = 0; //记录当前连接数
    if (config?.key) {
      if (config.hasOwnProperty("allowHTTP1")) {
        server = http2.createSecureServer(config);
        if (config.allowHTTP1) protocol = "h2,http/1.1";
        else protocol = "h2";
      } else server = https.createServer(config);
      scheme = "https";
      open = 2;
    } else {
      server = http.createServer({ insecureHTTPParser: false });
      scheme = "http";
    }
    server.listen(port, () => {
      console.info.bind({ xinfo: 2 })(
        `${style.reset}${style.bold}${style.brightGreen} ✓ ${
          style.brightWhite
        }Running on ${style.underline}${scheme}://${
          open === 0 ? "127.0.0.1" : server.ip
        }:${port}${style.reset}`
      );
      gcatch();
      server.port = port;
      if (config?.key) {
        server.on("stream", (stream, headers) => {
          stream.protocol = "h2";
          hd_stream(server, stream, headers);
        });
      }
      return resolve(server);
    });
    // 监听tcp connection✅  session(❌不够底层,防不了tcp级别ddos)
    // 先不管理连接数,在此作用不大,徒增开销
    // server.on("connection", (socket) => {
    //   currentConnections++; // 增加连接数
    //   // console.dev(`当前连接数：${currentConnections}`);
    //   socket.on("close", () => {
    //     currentConnections--; // 减少连接数
    //   });
    // });
    server.on("request", (req, res) => {
      if (req.headers[":path"]) return;
      req.scheme = scheme;
      let { stream, headers } = simulateHttp2Stream(req, res);
      hd_stream(server, stream, headers);
    });
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE" && port < 65535) {
        console.warn.bind({ xinfo: 2 })(
          `${style.bold}${style.yellow} ⚠ ${style.dim}${
            style.brightMagenta
          }Port ${port} is in use, trying ${port + 1} instead...${style.reset}`
        );
        port++;
        server.listen(port);
      } else {
        console.error(`Server error: ${err.message}`);
        return reject(err);
      }
    });
    console.info.bind({ xinfo: 2 })(
      `🚀 Start [${protocol}] ${scheme} server...`
    );
    // 虽然不赋值server也进行了修改,但ide跟踪不到,所以这里赋值一下
    server = Object.assign(server, {
      ip: myip(),
      open, //开放级别 0本地 1局域网 2公网
      routes: [],
      addr,
      static: fn_static,
      _404,
      router_begin: (server, gold) => {},
      cnn: 0,
      cluster_config: {},
      cluster,
      master,
      ismaster: false,
    });
    Object.defineProperties(server, {
      routes: { writable: false, configurable: false },
      addr: { writable: false, configurable: false },
      cnn: {
        get: () => currentConnections,
        enumerable: true,
      },
      _404: {
        get: () => server.routes.__404 || _404,
        set: (v) => {
          server.routes.__404 = typeof v === "function" ? v : () => {};
        },
        enumerable: true,
      },
    });
  });
}
/**
 * h2s 默认创建 h2tls 兼容 http1.1 tls 的服务器,也可通过配置仅创建h2server
 * @param  {...any} argv
 * @returns
 */
async function h2s(...argv) {
  let { port, config } = argv_port_config(argv);
  const basicpath = metaroot();
  config = {
    ...{
      key: rf(xpath("store/cert/selfsigned.key", basicpath)),
      cert: rf(xpath("store/cert/selfsigned.cert", basicpath)),
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
async function hss(...argv) {
  // 启动一个 HTTPS 服务器，使用指定的证书和密钥文件
  let { port, config } = argv_port_config(argv);
  const basicpath = metaroot();
  config = {
    ...{
      key: rf(xpath("store/cert/selfsigned.key", basicpath)),
      cert: rf(xpath("store/cert/selfsigned.cert", basicpath)),
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
// 模拟 HTTP/2 的 `stream` 对象
function simulateHttp2Stream(req, res) {
  const headers = { ...req.headers };
  headers[":method"] = req.method;
  headers[":path"] = req.url;
  headers[":scheme"] = req.scheme;
  headers[":authority"] = req.headers.host || "";
  const stream = new EventEmitter(); // 添加事件发射器功能
  stream.protocol = "HTTP/" + req.httpVersion;
  stream.ip = req.socket.remoteAddress;
  stream.respond = (responseHeaders) => {
    const status = responseHeaders[":status"] || 200; // 默认状态码 200
    const filteredHeaders = Object.fromEntries(
      Object.entries(responseHeaders).filter(([key]) => !key.startsWith(":"))
    );
    res.writeHead(status, filteredHeaders);
  };
  stream.write = res.write.bind(res);
  stream.end = res.end.bind(res);
  // 将 req 的数据事件转发到 stream 上
  req.on("data", (chunk) => stream.emit("data", chunk));
  req.on("end", () => stream.emit("end"));
  req.on("error", (err) => stream.emit("error", err));
  return { stream, headers };
}

function fn_static(url, path = "./") {
  let reg;
  if (url === "/") reg = new RegExp(`^/(.*)?$`);
  else reg = new RegExp(`^${url}(\/.*)?$`);
  // console.log(url, "reg:", reg);
  this.addr(reg, "get", async (g) => {
    let filePath = kit.xpath(g.path.slice(url.length).replace(/^\//, ""), path);
    if (await kit.aisdir(filePath)) {
      let files = await kit.adir(filePath);
      let html = fileSystem;
      if (url != g.path) {
        let parentPath = g.path.split("/").slice(0, -1).join("/") || "/";
        html += `<a href="${parentPath}" class="parent-link"><i class="fas fa-arrow-left"></i> 返回上级目录 (Parent Directory)</a>`;
      }
      html += `<ul class="file-list">`;
      let directories = [];
      let regularFiles = [];
      for (let file of files) {
        let fullPath = kit.xpath(file, filePath);
        let isDir = await kit.aisdir(fullPath);
        if (isDir) {
          directories.push(file);
        } else {
          regularFiles.push(file);
        }
      }
      directories.sort((a, b) => a.localeCompare(b));
      regularFiles.sort((a, b) => a.localeCompare(b));
      const sortedFiles = [...directories, ...regularFiles];
      for (let file of sortedFiles) {
        let fullPath = kit.xpath(file, filePath);
        let isDir = await kit.aisdir(fullPath);
        let link = g.path === "/" ? "/" + file : g.path + "/" + file;
        let icon = isDir ? "fa-folder" : "fa-file";
        let fileName = file;
        let displayName;
        if (isDir) {
          displayName = `<span class="file-name">
                <span class="file-name-main">${fileName}</span>
                <span class="file-name-ext">/</span>
            </span>`;
        } else {
          // 分离文件名和后缀
          let lastDotIndex = fileName.lastIndexOf(".");
          let nameMain =
            lastDotIndex > 0 ? fileName.slice(0, lastDotIndex) : fileName;
          let nameExt = lastDotIndex > 0 ? fileName.slice(lastDotIndex) : "";
          displayName = `<span class="file-name">
                <span class="file-name-main">${nameMain}</span>
                <span class="file-name-ext">${nameExt}</span>
            </span>`;
        }
        html += `
            <li>
                <a href="${link}">
                    <i class="fas ${icon}"></i>
                    ${displayName}
                </a>`;
        if (!isDir) {
          html += `
                <button onclick="window.location.href='${link}?download=1'" 
                        class="download-btn" 
                        title="下载文件"
                        type="button">
                    <i class="fas fa-download"></i>
                </button>`;
        }
        html += `</li>`;
      }
      html += `</ul></div></body></html>`;
      g.respond({
        ":status": 200,
        "content-type": "text/html; charset=utf-8",
      });
      g.end(html);
    } else if (await kit.aisfile(filePath)) {
      // Check if this is a download request
      const isDownload = g.query && g.query.download === "1";
      const ext = extname(filePath).toLowerCase();
      const contentType = getContentType(ext);
      try {
        if (isDownload) {
          // 下载文件
          const content = await kit.arf(filePath, null); // 使用原始格式读取
          g.download(content);
          // const fileName = filePath.split("/").pop();
          // g.download(content, fileName);
        } else {
          const headers = {
            ":status": 200,
            "content-type": contentType,
            "cache-control": "public, max-age=31536000", // 添加缓存控制避免反复请求下载,添加版本号或变更名字来保持更新
          };
          // 获取文件大小
          // const stats = await kit.astat(filePath);
          // if (stats) {
          //   headers["content-length"] = stats.size;
          // }
          g.respond(headers);
          const content = await kit.arf(filePath, null); // 使用原始格式读取
          g.end(content);
        }
      } catch (error) {
        console.error(error);
        g.err();
      }
    } else {
      g.server._404(g);
    }
  });
}

// 获取文件的扩展名
// function extname(filename) {
//   const i = filename.lastIndexOf(".");
//   return i < 0 ? "" : filename.slice(i);
// }

function getContentType(ext) {
  const mimeTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".pdf": "application/pdf",
    ".json": "application/json; charset=utf-8",
    ".jsonc": "application/json; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".zip": "application/zip",
    ".doc": "application/msword",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx":
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };
  return mimeTypes[ext] || "application/octet-stream";
}

/* 集群间通讯,多主多从协同 
从将统计数据发给所有主,主1统一通知所有,主1->主2->...主n保持ping,顺位顶替
每个master也是worker,多份管理职责的worker
1.在当前节点端口+10000创建h2状态服务器,状态变化时由所有主均衡告知当前服务器和所有其它cluster
2.master之间顺位ping和替补
*/

// const cluster_config = {
//   master: ["146.190.127.168", "138.68.85.226", "209.38.84.122"],
//   worker: ["5.180.78.100"],
// };
async function master(fn) {
  // 检查自身是主执行,可以是定时器,也可以单次执行
  if (this.ismaster) {
    fn();
  }
}
async function cluster() {
  const config = this.cluster_config;
  if (kit.empty(config)) return;
  const myip = kit.myip();
  let leader;
  console.log(this.port, config);
  const app = await h2s(13000);
  app.addr("/build", (g) => {
    if (config.master.includes(myip)) {
      if (config.master[0] === myip) {
        leader = true;
      }
    }
  });
  // 有配置文件,按部就班;没有配置文件,等待通知接收配置文件.
  if (config) {
    // 检查自己职责
    if (config.master.includes(myip)) {
      if (config.master[0] === myip) {
        console.dev("leader,去通知");
        leader = true;
        let all = [...config.master.slice(1), ...config.worker];
        // all = all.filter(async (ip) => {
        //   const res = await kit.req(`https://${ip}:13000/build`, {
        //     json: config,
        //   });
        //   if (res.ok) return false;
        //   return true;
        // });
        // console.log(all);
      }
      // 收ping
      app.addr("/ping", "get", (g) => {
        // g.ip
        if (g.body === ".") {
          g.raw(".");
        }
      });
      // 发ping
    } else {
    }
  }
}
