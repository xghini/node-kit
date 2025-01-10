export { req, h2req, h1req };
import http2 from "http2";
import https from "https";
import http from "http";
import { empty } from "../basic.js";
const h2session = new Map();
const options_keys = ["settings", "cert", "timeout"];
const d_headers = {
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
};
function build(...argv) {
    try {
        let client, urlobj, url, method, headers, body, options;
        if (argv.length === 0) {
            if (this)
                return this;
            else
                throw new Error("首次构建,至少传入url");
        }
        if (typeof argv[0] === "string") {
            const arr = argv[0].split(" ");
            if (arr[0].startsWith("http")) {
                url = arr[0];
                method = arr[1] || this.method || "GET";
            }
            else if (arr[0].startsWith("/")) {
                url = this.urlobj.origin + arr[0];
                method = arr[1] || this.method;
            }
            else if (arr[0].startsWith("?")) {
                url = this.urlobj.origin + this.urlobj.pathname + arr[0];
                method = arr[1] || this.method;
            }
            else {
                if (!this)
                    throw new Error("构造错误,请参考文档或示例");
                urlobj = this.urlobj;
                data = argv[0];
            }
            argv.slice(1).forEach((item) => {
                {
                    if (!body && typeof item === "string" && item !== "")
                        body = item;
                    else if (empty(item))
                        options = {};
                    else if (typeof item === "object") {
                        if (Object.keys(item).every((key) => options_keys.includes(key))) {
                            if (!options)
                                options = item;
                            else if (!headers)
                                headers = item;
                        }
                        else {
                            if (!headers)
                                headers = item;
                        }
                    }
                }
            });
        }
        else if (typeof argv[0] === "object") {
            ({ client, urlobj, url, method, body, headers, options } = argv[0]);
        }
        method = method.toUpperCase();
        urlobj = urlobj || new URL(url);
        if (options && "cert" in options) {
            options.rejectUnauthorized = options.cert;
            delete options.cert;
        }
        options = { ...this?.options, ...options };
        return {
            client,
            urlobj,
            method,
            body,
            headers,
            options,
        };
    }
    catch (err) {
        console.error(err);
    }
}
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
    }
    catch (error) {
        if (error.code === "EPROTO" || error.code === "ECONNRESET") {
            if (method.toUpperCase() === "CONNECT")
                return console.error("CONNECT method unsupperted");
            console.error(error.code, "maybe", urlobj.protocol === "https:" ? "http" : "https");
        }
        else {
            console.error(error);
        }
    }
}
async function h2detect(urlobj, options) {
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
        const session = http2.connect(urlobj.origin, {
            ...{
                settings: { enablePush: false },
                timeout: 15000,
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
    let { client, urlobj, method, headers, body, options } = build(...argv);
    console.dev("h2");
    return new Promise((resolve, reject) => {
        headers = {
            ...d_headers,
            ...headers,
            ...{
                ":path": urlobj.pathname + urlobj.search,
                ":method": method || "GET",
            },
        };
        const req = client.request(headers);
        if (!empty(body))
            req.write(body);
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
                resolve(enddata.bind(argv[0])(status, headers, parseResponseData(responseData), "h2"));
            });
        });
        const timeout = options.timeout || 15000;
        const timeoutId = setTimeout(() => {
            req.close();
            return resolve(`timeout >${timeout}ms`);
        }, timeout);
        req.on("error", (err) => {
            clearTimeout(timeoutId);
            reject(err);
        });
    });
}
const httpsAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 5000,
});
const httpAgent = new http.Agent({
    keepAlive: true,
    keepAliveMsecs: 5000,
});
async function collectResponseData(stream) {
    let data = "";
    for await (const chunk of stream) {
        data += chunk;
    }
    return data;
}
function parseResponseData(data) {
    try {
        return data.startsWith("{") || data.startsWith("[")
            ? JSON.parse(data)
            : data;
    }
    catch {
        return data;
    }
}
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
        },
        ...options,
    };
    return new Promise((resolve, reject) => {
        const req = protocol.request(options, async (res) => {
            try {
                const data = await collectResponseData(res);
                resolve(enddata.bind(argv[0])(res.statusCode, res.headers, parseResponseData(data), "http/1.1"));
            }
            catch (err) {
                reject(err);
            }
        });
        req.on("error", (error) => {
            reject(error);
        });
        req.on("timeout", () => {
            resolve(`timeout >${options.timeout}ms`);
        });
        req.on("socket", (socket) => {
            if (socket.connecting) {
                console.dev("新建连接");
            }
            else {
                console.dev("复用连接");
            }
        });
        if (!empty(body))
            req.write(body);
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
