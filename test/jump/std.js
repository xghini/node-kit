import { xpath, rf } from "../basic.js";
import EventEmitter from "events";
import { router_find_resolve } from "./router.js";
export { hd_stream, getArgv, simulateHttp2Stream };

function hd_stream(server, stream, headers) {
  const gold = (() => {
    let notresponded = true; // 私有变量
    return {
      headers,
      path: headers[":path"],
      method: headers[":method"],
      ct: headers["content-type"],
      httpVersion: stream.httpVersion,
      param: undefined,
      data: undefined,
      body: "",
      config: {
        // 默认配置
        MAX_BODY: 4 * 1024 * 1024,
      },
      end: stream.end.bind(stream),
      write: stream.write.bind(stream),
      respond: (obj) => {
        if (notresponded) {
          notresponded = false;
          stream.respond.bind(stream)(obj);
        }
      },
      json: (data) => {
        gold.respond({
          ":status": 200,
          "content-type": "application/json; charset=utf-8",
        });
        gold.end(JSON.stringify(data));
      },
      raw: (data) => {
        gold.respond({
          ":status": 200,
          "content-type": "text/plain; charset=utf-8",
        });
        gold.end(`${data}`);
      },
      err: (data, code) => {
        if (typeof data === "string") data = { msg: data };
        else if (typeof data === "number" && !code && data >= 100 && data < 600)
          code = data;
        else if (typeof data === "number") data = { msg: data };
        code = code || 500;
        data = { ...{ code }, ...data };
        gold.respond({
          ":status": data.code,
          "content-type": "application/json; charset=utf-8",
        });
        data=JSON.stringify(data)
        console.error(gold.headers[':path'], data);
        gold.end(data);
      },
    };
  })();
  let matched = gold.path.match(/\?/);
  if (matched) {
    gold.param = Object.fromEntries(
      new URLSearchParams(gold.path.slice(matched.index + 1))
    );
    gold.path = gold.path.slice(0, matched.index);
  }
  try {
    router_find_resolve(server, stream, gold);
  } catch (error) {
    console.error(error);
  }
}
function getArgv(argv, is_https = false) {
  // 返回端口和配置
  let port, config;
  argv.forEach((item) => {
    if (typeof item === "number") {
      port = item;
    } else if (typeof item === "object") {
      config = item;
    }
  });
  port = port || 3000;
  let default_config;
  if (is_https) {
    default_config = {
      key: rf(xpath("../../../store/cert/selfsigned.key", import.meta.url)),
      cert: rf(xpath("../../../store/cert/selfsigned.cert", import.meta.url)),
      allowHTTP1: true,
      // settings: {
      //   maxConcurrentStreams: 100, // 最大并发流数
      //   maxHeaderListSize: 32 * 1024, // 最大请求头大小 (32KB)
      // },
    };
  } else {
    // default_config = {
    //   maxHeaderSize: 32 * 1024, // 32KB - 这个可以生效
    //   headersTimeout: 60000,
    //   maxRequestsPerSocket: 100 // 这个可以控制并发连接数
    // }
  }
  config = {
    ...default_config,
    ...config,
  };
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
  stream.httpVersion = req.httpVersion;
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
