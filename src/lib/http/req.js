export { req, h2req, h1req, myip, obj2furl, reqdata };
import http2 from "http2";
import https from "https";
import http from "http";
import { empty } from "../index.js";
import { br_decompress, inflate, zstd_decompress, gunzip } from "../codec.js";
import { cerror } from "../console.js";
import os from "os";
import { SocksProxyAgent } from "socks-proxy-agent";
/**
 * 只要data数据的req
 */
async function reqdata(...argv) {
  return (await req(...argv)).data;
}
const h2session = new Map();
const options_keys = [
  "settings",
  "cert",
  "timeout",
  "json",
  "auth",
  "ua",
  "furl",
  "proxy",
];
const d_headers = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
};
const d_timeout = 30000;
const FATAL_NETWORK_ERRORS = [
  'ENOTFOUND',      
  'ENOENT',         
  'EAI_AGAIN',      
  'EAI_FAIL',       
  'EHOSTUNREACH',   
  'ENETUNREACH',    
];
/** @returns {Promise<ReturnType<typeof resbuild>>} */
async function req(...argv) {
  const reqbd = reqbuild(...argv);
  try {
    if (reqbd.urlobj.protocol === "http:") {
      return await h1req(reqbd);
    }
    const sess = await h2connect(reqbd);
    if (sess) {
      const h2result = await h2req.bind(sess)(reqbd);
      if (h2result.ok || (h2result.code >= 400 && h2result.code < 600)) {
        return h2result;
      }
      cerror.bind({ info: -1 })("HTTP/2协议失败，回退到HTTP/1.1");
      return await h1req(reqbd);
    }
    return await h1req(reqbd);
  } catch (error) {
    if (FATAL_NETWORK_ERRORS.includes(error.code)) {
      cerror.bind({ info: -1 })(error.code, error.message || "网络错误");
      return resbuild.bind(reqbd)(false);
    }
    if (reqbd.method.toUpperCase() === "CONNECT") {
      cerror.bind({ info: -1 })("CONNECT method unsupported");
      return resbuild.bind(reqbd)(false);
    }
    cerror.bind({ info: -1 })(error.code || error.name, "尝试回退到HTTP/1.1");
    try {
      return await h1req(reqbd);
    } catch (fallbackError) {
      cerror.bind({ info: -1 })(
        fallbackError.code || fallbackError.name,
        fallbackError.message || "HTTP/1.1也失败"
      );
      return resbuild.bind(reqbd)(false);
    }
  }
}
/**
 * HTTP/2连接检测和建立
 * 一般都能马上返回,不用设置超时
 * 检测已有h2会话直接拿来用,没有则创建测连
 */
async function h2connect(obj) {
  const { urlobj, options } = obj;
  const host = urlobj.host;
  if (options.proxy) {
    return false;
  }
  if (h2session.has(host)) {
    const session = h2session.get(host);
    if (session && 
        !session.destroyed && 
        !session.closed && 
        typeof session.request === 'function') {
      return session;
    } else {
      h2session.delete(host);
    }
  }
  return new Promise((resolve, reject) => {
    if (!options.servername && !urlobj.hostname.match(/[a-zA-Z]/))
      options.servername = "_";
    const session = http2.connect(urlobj.origin, {
      ...{
        settings: { enablePush: false },
        rejectUnauthorized: false,
      },
      ...options,
    });
    const connectTimeout = setTimeout(() => {
      session.destroy();
      resolve(false); 
    }, 5000);
    session.once("connect", () => {
      clearTimeout(connectTimeout);
      h2session.set(host, session);
      resolve(session);
    });
    session.once("error", (err) => {
      clearTimeout(connectTimeout);
      session.destroy();
      if (FATAL_NETWORK_ERRORS.includes(err.code)) {
        return reject(err);
      }
      if (err.code === 'ECONNREFUSED') {
        return reject(err);
      }
      resolve(false);
    });
  });
}
/**
 * 纯粹的HTTP/2请求实现
 * 使用h2为线路复用,会默认保持连接池,所以进程不会自动退出,可用process.exit()主动退出
 * @returns {Promise<ReturnType<typeof resbuild>>}
 */
async function h2req(...argv) {
  const reqbd = reqbuild(...argv);
  let { urlobj, method, headers, body, options } = reqbd;
  if (options.proxy) {
    cerror.bind({ info: -1 })(
      "h2req不支持代理（Node.js http2模块限制）",
      "请改用 req() 或 h1req()"
    );
    return resbuild.bind(reqbd)(false, "h2");
  }
  headers = {
    ...d_headers,
    ...headers,
    ...{
      ":path": urlobj.pathname + urlobj.search,
      ":method": method || "GET",
    },
  };
  let req, sess;
  try {
    const isValidSession = this && 
                          typeof this.request === 'function' && 
                          !this.destroyed && 
                          !this.closed;
    sess = isValidSession ? this : await h2connect(reqbd);
    if (!sess || sess === false || typeof sess.request !== 'function') {
      throw new Error("HTTP/2 connection unavailable");
    }
    req = sess.request(headers);
    if (method === "GET" || method === "DELETE" || method === "HEAD") {
      if (!empty(body))
        console.warn("NodeJS原生请求限制, ", method, "Body不会生效");
    } else {
      req.end(body);
    }
  } catch (error) {
    cerror.bind({ info: -1 })(error.code || error.message, "HTTP/2请求创建失败");
    return resbuild.bind(reqbd)(false, "h2");
  }
  return new Promise((resolve) => {
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
        resolve(resbuild.bind(reqbd)(true, "h2", code, headers, body));
      });
    });
    const timeout = options.timeout || d_timeout;
    const timeoutId = setTimeout(() => {
      req.close();
      cerror.bind({ info: -1 })(`HTTP/2 timeout >${timeout}ms`, urlobj.host);
      resolve(resbuild.bind(reqbd)(false, "h2", 408));
    }, timeout);
    req.on("error", (err) => {
      clearTimeout(timeoutId);
      cerror.bind({ info: -1 })(err.code || err.message, "HTTP/2请求错误");
      resolve(resbuild.bind(reqbd)(false, "h2"));
    });
  });
}
function getAgent(protocol, options) {
  if (options?.proxy) {
    let proxyUrl = options.proxy;
    if (!proxyUrl.match("://")) {
      proxyUrl = "socks5h://" + proxyUrl;
    } else {
      proxyUrl = proxyUrl.replace(/^socks5?:\/\//, 'socks5h://');
    }
    return new SocksProxyAgent(proxyUrl);
  } else {
    if (protocol === "https:") {
      return httpsAgent;
    } else {
      return httpAgent;
    }
  }
}
const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 60000,
});
const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 60000,
});
/**
 * 纯粹的HTTP/1.1请求实现
 * @returns {Promise<ReturnType<typeof resbuild>>}
 */
async function h1req(...argv) {
  const reqbd = reqbuild(...argv);
  let { urlobj, method, body, headers, options } = reqbd;
  const protocol = urlobj.protocol === "https:" ? https : http;
  const agent = getAgent(urlobj.protocol, options);
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
      timeout: options.timeout || d_timeout,
      rejectUnauthorized: false,
    },
    ...options,
  };
  return new Promise((resolve) => {
    const req = protocol.request(options, async (res) => {
      try {
        const chunks = [];
        for await (const chunk of res) {
          chunks.push(chunk);
        }
        const body = Buffer.concat(chunks);
        resolve(
          resbuild.bind(reqbd)(
            true,
            "http/1.1",
            res.statusCode,
            res.headers,
            body
          )
        );
      } catch (error) {
        cerror.bind({ info: -1 })(error.code || error.message, "HTTP/1.1响应处理错误");
        resolve(resbuild.bind(reqbd)(false, "http/1.1"));
      }
    });
    req.on("error", (error) => {
      if (error.message) {
        cerror.bind({ info: -1 })(error.code || "ERROR", error.message);
      }
      resolve(resbuild.bind(reqbd)(false, "http/1.1"));
    });
    req.on("timeout", () => {
      cerror.bind({ info: -1 })(
        `HTTP/1.1 timeout >${options.timeout}ms`,
        urlobj.host
      );
      resolve(resbuild.bind(reqbd)(false, "http/1.1", 408));
      req.destroy();
    });
    if (!empty(body)) req.write(body);
    req.end();
  });
}
function body2data(body, ct) {
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    data = {};
    const params = new URLSearchParams(body);
    for (const [key, value] of params) {
      data[key] = value;
    }
    if (empty(data)) data = body;
  }
  return data;
}
function setcookie(arr, str) {
  if (arr) return str || "" + arr.map((item) => item.split(";")[0]).join("; ");
  else return str || "";
}
async function autoDecompressBody(body, ce) {
  if (!body) return "";
  try {
    if (ce === "br") body = await br_decompress(body);
    else if (ce === "deflate") body = await inflate(body);
    else if (ce === "zstd") body = await zstd_decompress(body);
    else if (ce === "gzip") body = await gunzip(body);
  } catch (err) {
    cerror.bind({ info: -1 })("返回数据解压失败", err);
  }
  return body.toString();
}
class Reqbd {
  /** @type {any} */ h2session;
  /** @type {URL} */ urlobj;
  /** @type {string} */ url;
  /** @type {string} */ method;
  /** @type {Object} */ headers;
  /** @type {string|Buffer} */ body;
  /** @type {Object} */ options;
  constructor(props = {}) {
    Object.assign(this, props);
  }
}
class Resbd {
  /** @type {boolean} */ ok;
  /** @type {number} */ code;
  /** @type {Object} */ headers;
  /** @type {string} */ cookie;
  /** @type {string|Buffer} */ body;
  /** @type {Object} */ data;
  /** @type {string} */ protocol;
  /** @type {Reqbd} */ reqbd;
  /** @type {typeof req} */ req;
  /** @type {typeof h1req} */ h1req;
  /** @type {typeof h2req} */ h2req;
  constructor(props = {}) {
    Object.assign(this, props);
  }
}
function reqbuild(...argv) {
  try {
    let props = this || {};
    let {
      h2session,
      urlobj,
      url,
      method,
      headers = {},
      body = "",
      options = {},
    } = props;
    if (argv.length === 0) {
      if (empty(this)) throw new Error("首次构建,至少传入url");
      else return this;
    }
    if (typeof argv[0] === "object") {
      const {
        h2session: newSession,
        method: newMethod,
        body: newBody,
        headers: newHeaders,
        options: newOptions,
        url: newUrl,
      } = argv[0];
      h2session = newSession || h2session;
      method = newMethod || method;
      body = newBody || body;
      headers = { ...headers, ...newHeaders };
      options = { ...options, ...newOptions };
      argv = [newUrl];
    }
    let new_headers, new_options;
    if (typeof argv[0] === "string") {
      const arr = argv[0].replace(/ +/, " ").split(" ");
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
      }
      argv.slice(1).forEach((item) => {
        if (
          (!body &&
            ((typeof item === "string" && item !== "") ||
              (() => {
                if (typeof item !== "number") return false;
                item = item.toString();
                return true;
              })() ||
              item instanceof Buffer ||
              ArrayBuffer.isView(item))) || 
          (() => {
            if (item instanceof URLSearchParams) {
              item = item.toString();
              headers["content-type"] =
                headers["content-type"] || "application/x-www-form-urlencoded";
              return true;
            } else return false;
          })()
        )
          body = item;
        else if (empty(item)) new_options = {};
        else if (typeof item === "object") {
          if (Object.keys(item).some((key) => options_keys.includes(key))) {
            if (!new_options) new_options = item;
            else if (!new_headers) new_headers = item;
          } else {
            if (!new_headers) new_headers = item;
          }
        }
      });
    }
    method = method?.toUpperCase();
    try {
      urlobj = new URL(url);
    } catch {
      console.dev("url构造错误", url, "使用原urlobj");
    }
    headers = { ...headers, ...new_headers } || {};
    options = { ...options, ...new_options } || {};
    if (options) {
      if ("cert" in options) {
        options.rejectUnauthorized = options.cert;
        delete options.cert;
      }
      if ("json" in options) {
        headers["content-type"] = "application/json";
        body = JSON.stringify(options.json);
        delete options.json;
      }
      if ("furl" in options) {
        headers["content-type"] = "application/x-www-form-urlencoded";
        body =
          typeof options.param === "string"
            ? options.param
            : obj2furl(options.furl);
        delete options.param;
      }
      if ("auth" in options) headers["authorization"] = options.auth;
      if ("ua" in options) headers["user-agent"] = options.ua;
    }
    return new Reqbd({
      h2session,
      urlobj,
      url,
      method,
      headers,
      body,
      options,
    });
  } catch (err) {
    cerror.bind({ info: -1 })(err);
  }
}
async function resbuild(ok, protocol, code, headers, body) {
  ok = code >= 200 && code < 300 ? true : false;
  const reqbd = this;
  let cookie = setcookie(headers?.["set-cookie"], reqbd.headers.cookie);
  if (cookie) reqbd.headers.cookie = cookie;
  let data;
  if (body) {
    body = await autoDecompressBody(body, headers["content-encoding"]);
    data = body2data(body, headers["content-type"]);
  }
  const res = new Resbd({
    ok,
    code,
    headers,
    cookie,
    body,
    data,
    protocol,
    reqbd,
  });
  res.req = async (...argv) => req(reqbuild.bind(reqbd)(...argv));
  res.h1req = async (...argv) => h1req(reqbuild.bind(reqbd)(...argv));
  res.h2req = async (...argv) => h2req(reqbuild.bind(reqbd)(...argv));
  return Object.defineProperties(res, {
    h2session: { enumerable: false, writable: false, configurable: false },
    req: { enumerable: false, writable: false, configurable: false },
    h1req: { enumerable: false, writable: false, configurable: false },
    h2req: { enumerable: false, writable: false, configurable: false },
    reqbd: { enumerable: false, writable: false, configurable: false },
    reset: { enumerable: false, writable: false, configurable: false },
    reset_org: { enumerable: false, writable: false, configurable: false },
    reset_hds: { enumerable: false, writable: false, configurable: false },
    reset_ops: { enumerable: false, writable: false, configurable: false },
  });
}
async function myip() {
  let res =
    (await h1req("http://api.ipify.org", { timeout: 1500 })).body ||
    (await h1req("http://ipv4.icanhazip.com", { timeout: 1500 })).body ||
    (await h1req("http://v4.ident.me", { timeout: 1500 })).body ||
    fn_myip();
  return res.replace(/[^\d.]/g, ""); 
}
function fn_myip() {
  const networkInterfaces = os.networkInterfaces();
  let arr = [];
  for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName];
    for (const infa of interfaces) {
      if (infa.family === "IPv4" && !infa.internal) {
        if (
          infa.address.startsWith("10.") || 
          infa.address.startsWith("192.168.") 
        )
          arr.push(infa.address);
        else if (infa.address.startsWith("172.")) {
          const n = infa.address.split(".")[1];
          if (n < 16 && n > 31) return infa.address;
        } else return infa.address;
      }
    }
  }
  return arr.length > 0 ? arr[0] : "127.0.0.1";
}
/**
 * 对象转form-urlencode 支持url/utf8编码 common/php/java风格(可拓展)
 * 一维都一样,二维以上处理各有不同,默认common风格
 * @param {*} obj
 * @param {*} encoding
 * @param {*} standard
 * @returns
 */
function obj2furl(obj, encoding = "url", standard = "common") {
  const encodeMap = {
    url: function (str) {
      return encodeURIComponent(str);
    },
    utf8: function (str) {
      return str;
    },
  };
  const standardMap = {
    common: {
      handleKey: function (parentKey, key) {
        return parentKey ? parentKey + "[" + key + "]" : key;
      },
      handleArray: function (key, value, encode) {
        return value
          .map((item, index) => {
            if (typeof item === "object" && item !== null) {
              return serialize(item, `${key}[${index}]`);
            }
            return `${key}[${index}]=${encode(String(item))}`;
          })
          .join("&");
      },
    },
    php: {
      handleKey: function (parentKey, key, value) {
        const isArray = Array.isArray(value);
        if (!parentKey) return key;
        if (parentKey.endsWith("[]")) {
          return parentKey + "[" + key + "]";
        }
        if (isArray) {
          return parentKey + "[" + key + "][]";
        }
        return parentKey + "[" + key + "]";
      },
      handleArray: function (key, value, encode) {
        return value
          .map((item) => {
            if (typeof item === "object" && item !== null) {
              return serialize(item, key);
            }
            return `${key}=${encode(String(item))}`;
          })
          .join("&");
      },
    },
    java: {
      handleKey: function (parentKey, key, value) {
        if (!parentKey) return key;
        if (parentKey.includes("[")) {
          return parentKey + "." + key;
        }
        return parentKey + "." + key;
      },
      handleArray: function (key, value, encode) {
        return value
          .map((item, index) => {
            if (typeof item === "object" && item !== null) {
              return serialize(item, `${key}[${index}]`);
            }
            return `${key}=${encode(String(item))}`;
          })
          .join("&");
      },
    },
  };
  const encode = encodeMap[encoding] || encodeMap.url;
  const formatter = standardMap[standard] || standardMap.common;
  function serialize(obj, parentKey) {
    const pairs = [];
    for (const key in obj) {
      if (!obj.hasOwnProperty(key)) {
        continue;
      }
      const value = obj[key];
      const currentKey = formatter.handleKey(parentKey, key, value);
      if (value == null) {
        pairs.push(currentKey + "=");
        continue;
      }
      if (typeof value === "object") {
        if (Array.isArray(value)) {
          pairs.push(formatter.handleArray(currentKey, value, encode));
          continue;
        }
        pairs.push(serialize(value, currentKey));
        continue;
      }
      pairs.push(currentKey + "=" + encode(String(value)));
    }
    return pairs.join("&");
  }
  return serialize(obj, "");
}