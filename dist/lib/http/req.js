export { req, h2req, h1req, myip, obj2furl };
import http2 from "http2";
import https from "https";
import http from "http";
import { empty } from "../index.js";
import { br_decompress, inflate, zstd_decompress, gunzip } from "../codec.js";
import { cerror } from "../console.js";
import os from "os";
const h2session = new Map();
const options_keys = ["settings", "cert", "timeout", "json", "auth", "ua", 'furl'];
const d_headers = {
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
};
const d_timeout = 8000;
async function req(...argv) {
    const reqbd = reqbuild(...argv);
    try {
        if (reqbd.urlobj.protocol === "http:") {
            return h1req(reqbd);
        }
        const sess = await h2connect(reqbd);
        if (sess) {
            return h2req.bind(sess)(reqbd);
        }
        return h1req(reqbd);
    }
    catch (error) {
        if (error.code === "EPROTO" || error.code === "ECONNRESET") {
            if (reqbd.method.toUpperCase() === "CONNECT")
                return cerror.bind({ info: -1 })("CONNECT method unsupperted");
            cerror.bind({ info: -1 })(error.code, "maybe", reqbd.urlobj.protocol === "https:" ? "http" : "https");
        }
        else {
            cerror.bind({ info: -1 })(error, "目标服务器无法连接");
            return resbuild.bind(reqbd)(false);
        }
    }
}
async function h2connect(obj) {
    const { urlobj, options } = obj;
    const host = urlobj.host;
    if (h2session.has(host)) {
        const session = h2session.get(host);
        if (!session.destroyed && !session.closed) {
            return session;
        }
        else {
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
        session.once("connect", () => {
            h2session.set(host, session);
            return resolve(session);
        });
        function fn(err) {
            session.destroy();
            if (err.code.startsWith("ERR_SSL") || err.code === "ECONNRESET") {
                return resolve(false);
            }
            return reject(err);
        }
        session.once("error", fn.bind("error"));
    });
}
async function h2req(...argv) {
    const reqbd = reqbuild(...argv);
    let { urlobj, method, headers, body, options } = reqbd;
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
        sess = this ? this : await h2connect(reqbd);
        if (sess === false)
            throw new Error("H2 connect failed");
        req = await sess.request(headers);
        if (method === "GET" || method === "DELETE" || method === "HEAD") {
            if (!empty(body))
                console.warn("NodeJS原生请求限制, ", method, "Body不会生效");
        }
        else {
            req.end(body);
        }
    }
    catch (error) {
        cerror.bind({ info: -1 })(error);
        return resbuild.bind(reqbd)(false, "h2");
    }
    return new Promise((resolve, reject) => {
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
            cerror.bind({ info: -1 })(`H2 req timeout >${timeout}ms`, urlobj.host);
            resolve(resbuild.bind(reqbd)(false, "h2", 408));
        }, timeout);
        req.on("error", (err) => {
            clearTimeout(timeoutId);
            if (err.code === "ERR_HTTP2_ERROR") {
                try {
                    return resolve(h1req(reqbd));
                }
                catch (error) {
                    cerror.bind({ info: -1 })(error);
                    return resolve(resbuild.bind(reqbd)(false));
                }
            }
            cerror.bind({ info: -1 })(err);
            resolve(resbuild.bind(reqbd)(false, "h2"));
        });
    });
}
const httpsAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 60000,
});
const httpAgent = new http.Agent({
    keepAlive: true,
    keepAliveMsecs: 60000,
});
async function h1req(...argv) {
    const reqbd = reqbuild(...argv);
    let { urlobj, method, body, headers, options } = reqbd;
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
            rejectUnauthorized: false,
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
                resolve(resbuild.bind(reqbd)(true, "http/1.1", res.statusCode, res.headers, body));
            }
            catch (error) {
                cerror.bind({ info: -1 })(error);
                resolve(resbuild.bind(reqbd)(false, "http/1.1"));
            }
        });
        req.on("error", (error) => {
            if (!error.message)
                cerror.bind({ info: -1 })(error.message, "目标存在，当前协议不通");
            resolve(resbuild.bind(reqbd)(false, "http/1.1"));
        });
        req.on("timeout", () => {
            cerror.bind({ info: -1 })(`HTTP/1.1 req timeout >${options.timeout}ms`, urlobj.host);
            resolve(resbuild.bind(reqbd)(false, "http/1.1", 408));
            req.destroy();
        });
        if (!empty(body))
            req.write(body);
        req.end();
    });
}
function body2data(body, ct) {
    let data;
    if (ct.startsWith("application/json")) {
        try {
            data = JSON.parse(body);
        }
        catch {
            data = {};
        }
    }
    else if (ct === "application/x-www-form-urlencoded") {
        data = {};
        const params = new URLSearchParams(body);
        for (const [key, value] of params) {
            data[key] = value;
        }
    }
    return data;
}
function setcookie(arr, str) {
    if (arr)
        return str || "" + arr.map((item) => item.split(";")[0]).join("; ");
    else
        return str || "";
}
async function autoDecompressBody(body, ce) {
    if (!body)
        return "";
    try {
        if (ce === "br")
            body = await br_decompress(body);
        else if (ce === "deflate")
            body = await inflate(body);
        else if (ce === "zstd")
            body = await zstd_decompress(body);
        else if (ce === "gzip")
            body = await gunzip(body);
    }
    catch (err) {
        cerror.bind({ info: -1 })("返回数据解压失败", err);
    }
    return body.toString();
}
class Reqbd {
    constructor(props = {}) {
        Object.assign(this, props);
    }
}
class Resbd {
    constructor(props = {}) {
        Object.assign(this, props);
    }
}
function reqbuild(...argv) {
    try {
        let props = this || {};
        let { h2session, urlobj, url, method, headers = {}, body = "", options = {}, } = props;
        if (argv.length === 0) {
            if (empty(this))
                throw new Error("首次构建,至少传入url");
            else
                return this;
        }
        if (typeof argv[0] === "object") {
            const { h2session: newSession, method: newMethod, body: newBody, headers: newHeaders, options: newOptions, url: newUrl, } = argv[0];
            h2session = newSession || h2session;
            method = newMethod || method;
            body = newBody || body;
            headers = { ...headers, ...newHeaders };
            options = { ...options, ...newOptions };
            argv = [newUrl];
        }
        let new_headers, new_options;
        if (typeof argv[0] === "string") {
            const arr = argv[0].split(" ");
            if (arr[0].startsWith("http")) {
                url = arr[0];
                method = arr[1] || method || "GET";
            }
            else if (arr[0].startsWith("/")) {
                url = urlobj.origin + arr[0];
                method = arr[1] || method;
            }
            else if (arr[0].startsWith("?")) {
                url = urlobj.origin + urlobj.pathname + arr[0];
                method = arr[1] || method;
            }
            else {
                if (empty(this))
                    throw new Error("构造错误,请参考文档或示例");
            }
            argv.slice(1).forEach((item) => {
                if ((!body &&
                    ((typeof item === "string" && item !== "") ||
                        (() => {
                            if (typeof item !== "number")
                                return false;
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
                        }
                        else
                            return false;
                    })())
                    body = item;
                else if (empty(item))
                    new_options = {};
                else if (typeof item === "object") {
                    if (Object.keys(item).some((key) => options_keys.includes(key))) {
                        if (!new_options)
                            new_options = item;
                        else if (!new_headers)
                            new_headers = item;
                    }
                    else {
                        if (!new_headers)
                            new_headers = item;
                    }
                }
            });
        }
        method = method?.toUpperCase();
        try {
            urlobj = new URL(url);
        }
        catch {
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
            if ("auth" in options)
                headers["authorization"] = options.auth;
            if ("ua" in options)
                headers["user-agent"] = options.ua;
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
    }
    catch (err) {
        cerror.bind({ info: -1 })(err);
    }
}
async function resbuild(ok, protocol, code, headers, body) {
    ok = code >= 200 && code < 300 ? true : false;
    const reqbd = this;
    let cookie = setcookie(headers?.["set-cookie"], reqbd.headers.cookie);
    if (cookie)
        reqbd.headers.cookie = cookie;
    let data;
    if (body) {
        body = await autoDecompressBody(body, headers["content-encoding"]);
        data = headers["content-type"]
            ? body2data(body, headers["content-type"])
            : {};
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
    let res = (await h1req("http://api.ipify.org", { timeout: 1500 })).body ||
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
                if (infa.address.startsWith("10.") ||
                    infa.address.startsWith("192.168."))
                    arr.push(infa.address);
                else if (infa.address.startsWith("172.")) {
                    const n = infa.address.split(".")[1];
                    if (n < 16 && n > 31)
                        return infa.address;
                }
                else
                    return infa.address;
            }
        }
    }
    return arr.length > 0 ? arr[0] : "127.0.0.1";
}
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
                if (!parentKey)
                    return key;
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
                if (!parentKey)
                    return key;
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
