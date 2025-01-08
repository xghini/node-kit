import { xpath, rf, cookies_obj, cookie_merge, xerr } from "../basic.js";
import EventEmitter from "events";
import { router_find_resolve } from "./router.js";
export { hd_stream, getArgv, simulateHttp2Stream };

function hd_stream(server, stream, headers) {
  //去掉h2的headers继承于null prototype的多余显示,及无用的Symbol("sensitiveHeaders")
  headers = Object.keys(headers).reduce((obj, key) => {
    obj[key] = headers[key];
    return obj;
  }, {});
  const gold = (() => {
    // 私有变量
    let notresponded = true; //避免多次响应报错
    let respond_headers = { ":status": 200 };
    const direct_ip = function () {
      if (this.startsWith("::ffff:")) return this.slice(7);
      else return this;
    }.call(stream.ip || stream.session.socket.remoteAddress);
    const url = new URL(
      `${headers[":scheme"]}://${headers[":authority"]}${headers[":path"]}`
    );
    console.log(url);
    return {
      headers: headers,
      method: headers[":method"],
      ct: headers["content-type"],
      alpn: stream.alpn,
      cookie: cookies_obj(headers["cookie"]),
      path: url.pathname,
      search: url.search,
      query: (() => {
        // 最多解析一维数组,更复杂结构就通过search自行解析
        const obj = {},
          params = url.searchParams;
        params.forEach((v, k) => {
          obj[k] = params.getAll(k).length > 1 ? params.getAll(k) : v;
        });
        return obj;
      })(),
      data: {},
      body: "",
      direct_ip,
      ip:
        headers["cf-connecting-ip"] || headers["x-forwarded-for"] || direct_ip,
      config: {
        // 默认配置
        MAX_BODY: 4 * 1024 * 1024,
      },
      end: stream.end.bind(stream),
      write: stream.write.bind(stream),
      setcookie: (arr) => {
        typeof arr === "string" ? (arr = [arr]) : 0;
        respond_headers["set-cookie"] = arr.map((ck) =>
          cookie_merge(
            "HttpOnly; Path=/; Secure; SameSite=Strict;Max-Age=300",
            ck
          )
        );
      },
      delcookie: (arr) => {
        // 只需要传键名 ['ck1','ck2']
        typeof arr === "string" ? (arr = [arr]) : 0;
        respond_headers["set-cookie"] = arr.map(
          (ck) => ck + "=;HttpOnly; Path=/; Secure; SameSite=Strict;Max-Age=0"
        );
      },
      respond: (obj) => {
        if (notresponded) {
          notresponded = false;
          stream.respond.bind(stream)({ ...respond_headers, ...obj });
        }
      },
      // 任何类型的data都能返回,包括json字符串
      json: (data) => {
        gold.respond({
          "content-type": "application/json; charset=utf-8",
        });
        try {
          if (typeof data === "string") {
            data = JSON.parse(data);
          }
        } catch (error) {
          data = { msg: data };
        }
        // 再次确保 data 是一个对象，非对象类型统一包装
        if (typeof data !== "object" || data === null) {
          data = { msg: data };
        }
        gold.end(JSON.stringify(data));
      },
      raw: (data) => {
        gold.respond({
          "content-type": "text/plain; charset=utf-8",
        });
        gold.end(`${data}`);
      },
      err: (data, code) => {
        if (typeof data === "string") data = { msg: data };
        else if (typeof data === "number" && !code && data >= 100 && data < 600)
          code = data;
        else if (typeof data === "number") data = { msg: data };
        code = code || 400;
        data = { ...{ code }, ...data };
        gold.respond({
          ":status": data.code,
          "content-type": "application/json; charset=utf-8",
        });
        data = JSON.stringify(data);
        // console.error(gold.headers[":path"] + "\n", data);
        xerr(gold.ip, headers["cf-ipcountry"] || "", headers[":path"], data);
        gold.end(data);
      },
    };
  })();
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
  stream.alpn = "HTTP/" + req.httpVersion;
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
