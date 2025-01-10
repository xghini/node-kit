export { hd_stream };
import { cookies_obj, cookie_merge, cerror } from "../basic.js";
import { router_find_resolve } from "./router.js";
function hd_stream(server, stream, headers) {
    headers = Object.keys(headers).reduce((obj, key) => {
        obj[key] = headers[key];
        return obj;
    }, {});
    const gold = (() => {
        let notresponded = true;
        let respond_headers = { ":status": 200 };
        const direct_ip = function () {
            if (this.startsWith("::ffff:"))
                return this.slice(7);
            else
                return this;
        }.call(stream.ip || stream.session.socket.remoteAddress);
        const url = new URL(`${headers[":scheme"]}://${headers[":authority"]}${headers[":path"]}`);
        return {
            headers: headers,
            method: headers[":method"].toUpperCase(),
            ct: headers["content-type"],
            auth: headers["authorization"],
            protocol: stream.protocol,
            cookie: cookies_obj(headers["cookie"]),
            path: url.pathname,
            search: url.search,
            query: (() => {
                const obj = {}, params = url.searchParams;
                params.forEach((v, k) => {
                    obj[k] = params.getAll(k).length > 1 ? params.getAll(k) : v;
                });
                return obj;
            })(),
            data: {},
            body: "",
            direct_ip,
            ip: headers["cf-connecting-ip"] || headers["x-forwarded-for"] || direct_ip,
            config: {
                MAX_BODY: 4 * 1024 * 1024,
            },
            end: stream.end.bind(stream),
            write: stream.write.bind(stream),
            pushStream: stream.pushStream?.bind(stream),
            setcookie: (arr) => {
                typeof arr === "string" ? (arr = [arr]) : 0;
                respond_headers["set-cookie"] = arr.map((ck) => cookie_merge("HttpOnly; Path=/; Secure; SameSite=Strict;Max-Age=300", ck));
            },
            delcookie: (arr) => {
                typeof arr === "string" ? (arr = [arr]) : 0;
                respond_headers["set-cookie"] = arr.map((ck) => ck + "=;HttpOnly; Path=/; Secure; SameSite=Strict;Max-Age=0");
            },
            respond: (obj) => {
                if (notresponded) {
                    notresponded = false;
                    stream.respond.bind(stream)({ ...respond_headers, ...obj });
                }
            },
            json: (data) => {
                gold.respond({
                    "content-type": "application/json; charset=utf-8",
                });
                try {
                    if (typeof data === "string") {
                        data = JSON.parse(data);
                    }
                }
                catch (error) {
                    data = { msg: data };
                }
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
                if (typeof data === "string")
                    data = { msg: data };
                else if (typeof data === "number" && !code && data >= 100 && data < 600)
                    code = data;
                else if (typeof data === "number")
                    data = { msg: data };
                code = code || 400;
                data = { ...{ code }, ...data };
                gold.respond({
                    ":status": data.code,
                    "content-type": "application/json; charset=utf-8",
                });
                data = JSON.stringify(data);
                cerror(gold.ip, headers["cf-ipcountry"] || "", headers[":path"], headers[":method"], data);
                gold.end(data);
            },
        };
    })();
    try {
        router_find_resolve(server, stream, gold);
    }
    catch (error) {
        console.error(error);
    }
}
