export { req, h2req, h1req };
import http2 from "http2";
import https from "https";
import http from "http";
import { empty } from "../basic.js";

// 缓存 HTTP/2 连接
const h2session = new Map();
// 可能性拓展 maxSockets:256 maxSessionMemory:64 maxConcurrentStreams:100 minVersion:'TLSv1.2' ciphers ca cert key
const options_keys = ["settings", "cert", "timeout"];
const d_headers = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
};
/*
 * req直接发请求(适合简单发送)
 * @example
 * 完整路径+方法(默认get)
 * req("https://www.baidu.com?a=1&a=2&b=2")
 * req("/test post",body,headers,option)
 * req(build)
 * build.post()
 * build.jpost()
 * build.send()
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
function build(...argv) {
  try {
    let client,urlobj, url, method, headers, body, options;
    // 当this存在时,说明路径复用
    // ('/test')
    // ('data',{cookie:'auth=abc'})
    // ({data:'/test'})
    if (argv.length === 0) {
      if (this) return this;
      else throw new Error("首次构建,至少传入url");
    }
    if (typeof argv[0] === "string") {
      // 第一个一定是url+method,method不单独放,以确定第二个string为body
      // 路径完全复用时,第一个string为body
      const arr = argv[0].split(" ");
      if (arr[0].startsWith("http")) {
        url = arr[0];
        method = arr[1] || this.method || "GET";
      } else if (arr[0].startsWith("/")) {
        url = this.urlobj.origin + arr[0];
        method = arr[1] || this.method;
      } else if (arr[0].startsWith("?")) {
        url = this.urlobj.origin + this.urlobj.pathname + arr[0];
        method = arr[1] || this.method;
      } else {
        if (!this) throw new Error("构造错误,请参考文档或示例");
        urlobj = this.urlobj;
        data = argv[0];
      }
      // 第二个字符串是body
      // 对象options有且仅有[timeout,cert],如果headers的keys完全在options_keys里,先写options或用空占位,第二份为headers;或者直接构造指定
      argv.slice(1).forEach((item) => {
        {
          // ''body无意义,留给options占位,虽然最推荐null,但'' 0 undefined {} []都行
          if (!body && typeof item === "string" && item !== "") body = item;
          else if (empty(item)) options = {};
          else if (typeof item === "object") {
            if (Object.keys(item).every((key) => options_keys.includes(key))) {
              if (!options) options = item;
              else if (!headers) headers = item;
            } else {
              if (!headers) headers = item;
            }
          }
        }
      });
    } else if (typeof argv[0] === "object") {
      // 析构,有更强的解构组织力,主要用于复用连接
      // 默认复用urlobj[origin pathname] method headers options
      ({ client,urlobj, url, method, body, headers, options } = argv[0]);
    }
    method = method.toUpperCase();
    urlobj = urlobj || new URL(url);
    if (options && "cert" in options) {
      options.rejectUnauthorized = options.cert;
      delete options.cert;
    }
    options = { ...this?.options, ...options };
    // headers={...this.headers,...headers}
    return {
      client,
      urlobj,
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
async function req(...argv) {
  const obj = build(...argv);
  try {
    if (obj.protocol === "http:") {
      return await h1req(obj);
    }
    const client = await h2detect(obj.urlobj, obj.options);
    if (client) {
      obj.client = client;
      return await h2req(obj);
    }
    return await h1req(obj);
  } catch (error) {
    if (error.code === "EPROTO" || error.code === "ECONNRESET") {
      if (method.toUpperCase() === "CONNECT")
        return console.error("CONNECT method unsupperted");
      console.error(
        error.code,
        "maybe",
        urlobj.protocol === "https:" ? "http" : "https"
      );
    } else {
      // const stack = error.stack.split("\n");
      // console.error(stack[0], stack[1]);
      console.error(error);
    }
  }
}
// 一般都能马上返回,不用设置超时
// 检测已有h2会话直接拿来用,没有则创建测连
async function h2detect(urlobj, options) {
  const host = urlobj.host;
  if (h2session.has(host)) {
    // console.dev("已有session", host);
    const session = h2session.get(host);
    if (!session.destroyed && !session.closed) {
      return session;
    } else {
      h2session.delete(host);
    }
  }
  return new Promise((resolve, reject) => {
    const session = http2.connect(urlobj.origin, {
      ...{
        settings: { enablePush: false },
        // rejectUnauthorized: true,
        timeout: 15000,
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
        // console.dev("http/1.1");
        return resolve(false);
      }
      // ECONNREFUSED 无连接
      // console.dev(err.code, "其它错误,直接退出,不必降级尝试");
      return reject(err);
    }
    // session.socket?.once("error", fn.bind("socketerror1")); //最快,领先2ms
    session.once("error", fn.bind("error")); //第二,领先1ms
    // session.once("close", fn.bind('close')); //第三
    // session.once("timeout", fn.bind('timeout')); //无
    // session.once("goaway", fn.bind('goaway')); //无
    // session.once("socket", (socket) => { //无
    //   socket.once("error", fn.bind('socketerror2'));
    // });
  });
}
async function h2req(...argv) {
  let { client, urlobj, method, headers, body, options } = build(...argv);
  console.dev("h2");
  return new Promise((resolve, reject) => {
    // 在connect('https://www.example.com')已经隐式设置了:authority和:scheme
    headers = {
      ...d_headers,
      ...headers,
      ...{
        ":path": urlobj.pathname + urlobj.search,
        ":method": method || "GET",
      },
    };
    // let dataToSend = null;
    // if (postData) {
    //   dataToSend =
    //     typeof postData === "object" ? JSON.stringify(postData) : postData;
    //   headers["content-type"] = "application/json";
    //   headers["content-length"] = Buffer.byteLength(dataToSend);
    // }
    const req = client.request(headers);
    if (!empty(body)) req.write(body);
    req.end();
    req.on("response", (headers, flags) => {
      req.setEncoding("utf8");
      let responseData = "";
      req.on("data", (chunk) => {
        responseData += chunk;
      });
      req.on("end", () => {
        clearTimeout(timeoutId);
        headers = Object.keys(headers).reduce((obj, key) => {
          obj[key] = headers[key];
          return obj;
        }, {});
        const status = headers[":status"] || 200;
        delete headers[":status"];
        resolve(
          enddata.bind(argv[0])(
            status,
            headers,
            parseResponseData(responseData),
            "h2"
          )
        );
      });
    });
    // 设置超时
    const timeout = options.timeout || 15000;
    const timeoutId = setTimeout(() => {
      req.close();
      return resolve(`timeout >${timeout}ms`);
      // reject(new Error("HTTP/2 request timed out"));
    }, timeout);
    req.on("error", (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });
  });
}

// 创建全局 agent
const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 5000,
});
const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 5000,
});
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
async function h1req(...argv) {
  let { urlobj, method, body, headers, options } = build(...argv);
  console.dev("h1");
  const protocol = urlobj.protocol === "https:" ? https : http;
  const agent = urlobj.protocol === "https:" ? httpsAgent : httpAgent;
  const new_headers = {
    ...d_headers,
    ...headers,
  };
  console.dev(options, new_headers);
  options = {
    ...{
      protocol: urlobj.protocol,
      hostname: urlobj.hostname,
      port: urlobj.port || (urlobj.protocol === "https:" ? 443 : 80),
      path: urlobj.pathname + urlobj.search,
      method: method || "GET",
      headers: new_headers,
      agent,
      timeout: 15000,
      // rejectUnauthorized: true,
    },
    ...options,
  };

  return new Promise((resolve, reject) => {
    const req = protocol.request(options, async (res) => {
      try {
        const data = await collectResponseData(res);
        resolve(
          enddata.bind(argv[0])(
            res.statusCode,
            res.headers,
            parseResponseData(data),
            "http/1.1"
          )
        );
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", (error) => {
      reject(error);
    });
    req.on("timeout", () => {
      // 此destroy后再触发onerror来传递错误
      // req.destroy(new Error("HTTP/1.1 request timed out"));
      // req.destroy();
      resolve(`timeout >${options.timeout}ms`);
    });
    req.on("socket", (socket) => {
      if (socket.connecting) {
        console.dev("新建连接");
      } else {
        console.dev("复用连接");
      }
    });
    if (!empty(body)) req.write(body);
    req.end();
  });
}

function enddata(status, headers, body, protocol) {
  const res = {
    status,
    headers,
    body,
    data: undefined,
    protocol,
    client: 100,
    req: async (...argv) => req(build.bind(this)(...argv)),
  };
  return Object.defineProperties(res, {
    client: { enumerable: false, writable: false, configurable: false },
  });
}
