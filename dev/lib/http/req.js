export { req, h2req, h1req };
import http2 from "http2";
import https from "https";
import http from "http";
import { empty } from "../basic.js";
import { br_decompress, inflate, zstd_decompress, gunzip } from "../codec.js";

// 缓存 HTTP/2 连接
const h2session = new Map();
// 可能性拓展 maxSockets:256 maxSessionMemory:64 maxConcurrentStreams:100 minVersion:'TLSv1.2' ciphers ca cert key
const options_keys = ["settings", "cert", "timeout", "json"];
const d_headers = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
};
const d_timeout = 8000;
/*
 * req直接发请求(适合简单发送)
 * @example
 * 完整路径+方法(默认get)
 * req("https://www.baidu.com?a=1&a=2&b=2")
 * req("/test post",body,headers,option)
 * req(reqbuild)
 *
 * timeout 超时时长
 * maxsize 最大响应体长度
 * certificate 证书
 * [api schema validation]
 * [CA 信任链]
 * @headers
 * no-cache
 * auto-redirects
 */
function reqbuild(...argv) {
  try {
    // console.dev(this,argv);
    let { h2session, urlobj, url, method, headers, body, options } = this || {};
    // 当this存在时,说明路径复用
    if (argv.length === 0) {
      if (empty(this)) throw new Error("首次构建,至少传入url");
      else return this;
    } else {
      // 不使用原body
      body = "";
    }
    if (typeof argv[0] === "object") {
      // this留给旧reqobj自动传递,argv[0]留给新reqobj,析构有更强的解构组织力
      // 默认复用urlobj[origin pathname] method headers options
      h2session = argv[0].h2session || h2session;
      method = argv[0].method || method;
      body = argv[0].body || body;
      headers = { ...headers, ...argv[0].headers };
      options = { ...options, ...argv[0].options };
      // url urlobj交给下面统一处理,后面再跟的内容无效
      argv = [argv[0].url];
    }
    let new_headers, new_options;
    if (typeof argv[0] === "string") {
      // 第一个一定是url+method,method不单独放,以确定第二个string为body
      // 路径完全复用时,第一个string为body
      const arr = argv[0].split(" ");
      if (arr[0].startsWith("http")) {
        url = arr[0];
        method = arr[1] || method || "GET";
      } else if (arr[0].startsWith("/")) {
        url = urlobj.origin + arr[0];
        method = arr[1] || method;
      } else if (arr[0].startsWith("?")) {
        url = urlobj.origin + urlobj.pathname + arr[0];
        method = arr[1] || method;
      } else {
        if (empty(this)) throw new Error("构造错误,请参考文档或示例");
        data = argv[0];
      }
      // 第二个字符串是body
      // 对象options有且仅有[timeout,cert],如果headers的keys完全在options_keys里,先写options或用空占位,第二份为headers;或者直接构造指定
      argv.slice(1).forEach((item) => {
        {
          // ''body无意义,留给options占位,虽然最推荐null,但'' 0 undefined {} []都行
          if (!body && typeof item === "string" && item !== "") body = item;
          else if (empty(item)) new_options = {};
          else if (typeof item === "object") {
            if (Object.keys(item).every((key) => options_keys.includes(key))) {
              if (!new_options) new_options = item;
              else if (!new_headers) new_headers = item;
            } else {
              if (!new_headers) new_headers = item;
            }
          }
        }
      });
    }
    method = method.toUpperCase();
    urlobj = new URL(url) || urlobj;
    headers = { ...headers, ...new_headers } || {};
    options = { ...options, ...new_options } || {};
    // options选项统一处理
    if (options) {
      if ("cert" in options) {
        options.rejectUnauthorized = options.cert;
        delete options.cert;
      }
      if ("json" in options) {
        headers["content-type"] = headers["content-type"] || "application/json";
        body = JSON.stringify(options.json);
        delete options.json;
      }
    }
    return {
      h2session,
      urlobj,
      url,
      method,
      body,
      headers,
      options,
    };
  } catch (err) {
    console.error(err);
  }
}
// 比h1req h2req多一步detect判断
/** @returns {Promise<ReturnType<typeof resbuild>>} */
async function req(...argv) {
  const obj = reqbuild(...argv);
  try {
    if (obj.urlobj.protocol === "http:") {
      return h1req(obj);
    }
    const h2session = await h2connect(obj);
    if (h2session) {
      obj.h2session = h2session;
      return h2req(obj);
    }
    return h1req(obj);
  } catch (error) {
    if (error.code === "EPROTO" || error.code === "ECONNRESET") {
      if (obj.method.toUpperCase() === "CONNECT")
        return console.error("CONNECT method unsupperted");
      console.error(
        error.code,
        "maybe",
        obj.urlobj.protocol === "https:" ? "http" : "https"
      );
    } else {
      // const stack = error.stack.split("\n");
      // console.error(stack[0], stack[1]);
      console.error(error);
      return resbuild.bind(obj)(false);
    }
  }
}
// 一般都能马上返回,不用设置超时
// 检测已有h2会话直接拿来用,没有则创建测连
async function h2connect(obj) {
  const { urlobj, options } = obj;
  const host = urlobj.host;
  if (h2session.has(host)) {
    // console.dev("已有session", host);
    const session = h2session.get(host);
    if (!session.destroyed && !session.closed) {
      console.dev("复用h2session", host);
      return session;
    } else {
      h2session.delete(host);
    }
  }
  return new Promise((resolve, reject) => {
    console.dev("创建h2session", host);
    const session = http2.connect(urlobj.origin, {
      ...{
        settings: { enablePush: false },
        // rejectUnauthorized: true,
      },
      ...options,
    });
    // once 只监听一次事件后自动取消监听
    session.once("connect", () => {
      h2session.set(host, session);
      return resolve(session);
    });
    function fn(err) {
      session.destroy();
      // ERR_SSL_TLSV1_ALERT_NO_APPLICATION_PROTOCOL protocol错误,使用h2访问h1
      // ERR_SSL_WRONG_VERSION_NUMBER  使用https访问http
      // ECONNRESET 网络状态变化
      if (err.code.startsWith("ERR_SSL") || err.code === "ECONNRESET") {
        console.dev("server不支持h2,智能降级http/1.1");
        return resolve(false);
      }
      // ENOTFOUND 域名解析失败
      // ETIMEDOUT 连接超时
      // ECONNREFUSED 无连接
      return reject(err);
      // return resolve(resbuild.bind(obj)(false));
    }
    // session.socket?.once("error", fn.bind("socketerror1")); //最快,领先2ms
    session.once("error", fn.bind("error")); //第二,领先1ms
    // session.once("close", fn.bind('close')); //第三
  });
}
/** @returns {Promise<ReturnType<typeof resbuild>>} */
async function h2req(...argv) {
  const reqobj = reqbuild(...argv);
  let { h2session, urlobj, method, headers, body, options } = reqobj;
  console.dev("h2", urlobj.protocol, method, body);
  // 在connect('https://www.example.com')已经隐式设置了:authority和:scheme
  headers = {
    ...d_headers,
    ...headers,
    ...{
      ":path": urlobj.pathname + urlobj.search,
      ":method": method || "GET",
    },
  };
  // console.dev(options);
  let req;
  if (h2session) req = await h2session.request(headers);
  else {
    // 走这里的,基本是直接调用h2req,没打算智能降级
    try {
      h2session = await h2connect(reqobj);
      if (h2session === false) throw new Error("H2 connect failed");
      req = await h2session.request(headers);
    } catch (error) {
      console.error(error);
      return resbuild.bind(reqobj)(false, "h2");
    }
  }
  return new Promise((resolve, reject) => {
    if (!empty(body)) req.write(body);
    req.end();
    req.on("response", (headers, flags) => {
      const chunks = [];
      req.on("data", (chunk) => {
        chunks.push(chunk);
      });
      req.on("end", () => {
        clearTimeout(timeoutId);
        const body = Buffer.concat(chunks);
        headers = Object.keys(headers).reduce((obj, key) => {
          obj[key] = headers[key];
          return obj;
        }, {});
        const code = headers[":status"] || 200;
        delete headers[":status"];
        resolve(resbuild.bind(reqobj)(true, "h2", code, headers, body));
      });
    });
    // 设置超时
    const timeout = options.timeout || d_timeout;
    const timeoutId = setTimeout(() => {
      req.close();
      console.error(`H2 req timeout >${timeout}ms`);
      resolve(resbuild.bind(reqobj)(false, "h2", 408));
      // throw new Error(`H2 req timeout >${timeout}ms`);
      // return resolve(`timeout >${timeout}ms`);
      // reject(new Error("HTTP/2 request timed out"));
    }, timeout);
    req.on("error", (err) => {
      clearTimeout(timeoutId);
      console.error(err);
      resolve(resbuild.bind(reqobj)(false, "h2"));
    });
  });
}

// 创建全局 agent
const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 60000,
});
const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 60000,
});

// HTTP/1.1 请求
// /** @type {(argv: any[]) => Promise<ReturnType<typeof resbuild>>} */
/** @returns {Promise<ReturnType<typeof resbuild>>} */
async function h1req(...argv) {
  const reqobj = reqbuild(...argv);
  let { urlobj, method, body, headers, options } = reqobj;
  console.dev("h1", urlobj.protocol, method, body);
  const protocol = urlobj.protocol === "https:" ? https : http;
  const agent = urlobj.protocol === "https:" ? httpsAgent : httpAgent;
  const new_headers = {
    ...d_headers,
    ...headers,
  };
  options = {
    ...{
      protocol: urlobj.protocol,
      hostname: urlobj.hostname,
      port: urlobj.port || (urlobj.protocol === "https:" ? 443 : 80),
      path: urlobj.pathname + urlobj.search,
      method: method || "GET",
      headers: new_headers,
      agent,
      timeout: d_timeout,
      // rejectUnauthorized: true,
    },
    ...options,
  };
  return new Promise((resolve, reject) => {
    const req = protocol.request(options, async (res) => {
      try {
        const chunks = [];
        for await (const chunk of res) {
          chunks.push(chunk);
        }
        const body = Buffer.concat(chunks);
        // res = new Response(res); //新
        // const body = await res.text();
        // console.dev(res.status, res.statusText, res.ok);
        resolve(
          resbuild.bind(reqobj)(
            true,
            "http/1.1",
            res.statusCode,
            res.headers,
            body
          )
        );
      } catch (error) {
        console.error(error);
        // reject(error);
        resolve(resbuild.bind(reqobj)(false, "http/1.1"));
      }
    });
    req.on("error", (error) => {
      console.error(error);
      // reject(error);
      resolve(resbuild.bind(reqobj)(false, "http/1.1"));
    });
    req.on("timeout", () => {
      // 此destroy后再触发onerror来传递错误
      req.destroy(new Error(`HTTP/1.1 req timeout >${options.timeout}ms`));
      // req.destroy();
      // resolve(`timeout >${options.timeout}ms`);
      resolve(resbuild.bind(reqobj)(false, "http/1.1", 408));
    });
    req.on("socket", (socket) => {
      if (socket.connecting) {
        console.dev("新h1连接");
      } else {
        console.dev("复用h1连接");
      }
    });
    if (!empty(body)) req.write(body);
    req.end();
  });
}

function body2data(body, ct) {
  // console.dev(body);
  let data;
  if (ct.startsWith("application/json")) {
    try {
      data = JSON.parse(body);
    } catch {
      data = {};
    }
  }
  // 已经过测试
  else if (ct === "application/x-www-form-urlencoded") {
    data = {};
    const params = new URLSearchParams(body);
    for (const [key, value] of params) {
      data[key] = value;
    }
  } else if (ct?.startsWith("multipart/form-data")) {
    data = {};
    const boundaryMatch = ct.match(/boundary=(.+)$/);
    if (!boundaryMatch) {
      throw new Error("Boundary not found in Content-Type");
    }
    const boundary = boundaryMatch[1];
    const parts = body.split(`--${boundary}`);

    for (let part of parts) {
      part = part.trim();
      if (!part || part === "--") continue; // Skip empty parts and closing boundary

      const [rawHeaders, ...rest] = part.split("\r\n\r\n");
      const content = rest.join("\r\n\r\n").replace(/\r\n$/, "");
      const headers = rawHeaders.split("\r\n");

      let name = null;
      let filename = null;
      let contentType = null;

      // Extract headers
      headers.forEach((header) => {
        const nameMatch = header.match(/name="([^"]+)"/);
        if (nameMatch) {
          name = nameMatch[1];
        }
        const filenameMatch = header.match(/filename="([^"]+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
        const ctMatch = header.match(/Content-Type:\s*(.+)/i);
        if (ctMatch) {
          contentType = ctMatch[1];
        }
      });

      if (!name) continue; // Skip if no field name is found

      if (filename) {
        // Handle file fields
        const fileObj = {
          filename: filename,
          content: content,
          contentType: contentType || "application/octet-stream", // Default if not provided
        };

        if (data[name]) {
          if (Array.isArray(data[name])) {
            data[name].push(fileObj);
          } else {
            data[name] = [data[name], fileObj];
          }
        } else {
          data[name] = fileObj;
        }
      } else {
        // Handle regular text fields
        if (data[name] !== undefined) {
          if (Array.isArray(data[name])) {
            data[name].push(content);
          } else {
            data[name] = [data[name], content];
          }
        } else {
          data[name] = content;
        }
      }
    }
    // Convert single-item arrays back to single values if desired
    for (const key in data) {
      if (Array.isArray(data[key]) && data[key].length === 1) {
        data[key] = data[key][0];
      }
    }
  }
  return data;
}

// cookie相关 键值数组,分号分割取第一个,跟现在的cookie相融
function setcookie(arr, str) {
  if (arr) return str || "" + arr.map((item) => item.split(";")[0]).join(";");
  else return str || "";
}
// 自动解码br(73.34%高 14.673ms慢) deflate(65.83% 0.7ms快) zstd(66.46% 1.556ms) gzip(65.71% 3.624ms全面落后)
async function autoDecompressBody(body, ce) {
  if (!body) return "";
  try {
    if (ce === "br") body = await br_decompress(body);
    else if (ce === "deflate") body = await inflate(body);
    else if (ce === "zstd") body = await zstd_decompress(body);
    else if (ce === "gzip") body = await gunzip(body);
  } catch (err) {
    console.error("返回数据解压失败", err);
  }
  return body.toString();
}

async function resbuild(ok, protocol, code, headers, body) {
  // ok代表成功响应
  // let { status, headers, body, protocol } = argv[0];
  const reqobj = this;
  let cookie, data;
  cookie = setcookie(headers?.["set-cookie"], reqobj.headers.cookie);
  if (ok) {
    body = await autoDecompressBody(body, headers["content-encoding"]);
    data = headers["content-type"]
      ? body2data(body, headers["content-type"])
      : {};
  }
  const res = {
    ok,
    code,
    headers,
    cookie,
    body,
    data,
    protocol,
    // 默认是融合
    req: async (...argv) => {
      // 将cookie添加到请求头
      reqobj.headers.cookie = cookie;
      return req(reqbuild.bind(reqobj)(...argv));
    },
    reqobj,
    reset: null, //重置hds,ops
    reset_org: null,
    reset_hds: null,
    reset_ops: null,
    // cookie融合
  };
  // console.dev(res);
  return Object.defineProperties(res, {
    h2session: { enumerable: false, writable: false, configurable: false },
    req: { enumerable: false, writable: false, configurable: false },
    // reqobj: { get: () => reqobj },
    reqobj: { enumerable: false, writable: false, configurable: false },
    reset: { enumerable: false, writable: false, configurable: false },
    reset_org: { enumerable: false, writable: false, configurable: false },
    reset_hds: { enumerable: false, writable: false, configurable: false },
    reset_ops: { enumerable: false, writable: false, configurable: false },
  });
}
