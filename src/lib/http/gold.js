export { hd_stream };
import { cookies_obj, cookie_merge } from "../index.js";
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
      if (this.startsWith("::ffff:")) return this.slice(7);
      else return this;
    }.call(stream.ip || stream.session.socket.remoteAddress);
    let url;
    try {
      url = new URL(
        `${headers[":scheme"]}://${headers[":authority"] || "_"}${
          headers[":path"]
        }`
      );
    } catch (error) {
      console.error(error, headers);
      url = new URL("http://error.com");
    }
    const pathname = decodeURI(url.pathname);
    return {
      headers: headers,
      method: headers[":method"].toUpperCase(),
      ua: headers["user-agent"] || "",
      ct: headers["content-type"] || "",
      auth: headers["authorization"] || "",
      protocol: stream.protocol,
      cookie: cookies_obj(headers["cookie"]),
      pathname,
      path: pathname.replace(/\/+/g, "/").replace(/\/$/, "") || "/", 
      search: decodeURI(url.search),
      query: (() => {
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
        MAX_BODY: 4 * 1024 * 1024,
      },
      info,
      server: server,
      end: stream.end.bind(stream),
      write: stream.write.bind(stream),
      pushStream: stream.pushStream?.bind(stream), 
      setcookie: (arr) => {
        typeof arr === "string" ? (arr = [arr]) : 0;
        respond_headers["set-cookie"] = arr.map((ck) =>
          cookie_merge(
            "HttpOnly; Path=/; Secure; SameSite=Lax; Max-Age=900",
            ck
          )
        );
      },
      delcookie: (arr) => {
        typeof arr === "string" ? (arr = [arr]) : 0;
        respond_headers["set-cookie"] = arr.map(
          (ck) => ck + "=; Path=/; Max-Age=0"
        );
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
        } catch (error) {
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
      html: (data) => {
        gold.respond({
          "content-type": "text/html; charset=utf-8",
        });
        gold.end(`${data}`);
      },
      download: (data, name) => {
        const opt = {
          ":status": 200,
          "content-type": "application/octet-stream",
        };
        if (name) opt["content-disposition"] = `attachment; filename=${name}`;
        gold.respond(opt);
        gold.end(data);
      },
      err: (data = 404, code = 404) => {
        data = data.toString();
        gold.respond({
          ":status": code,
          "content-type": "text/plain; charset=utf-8",
        });
        console.error.bind({ info: -1, line: 5 })(
          gold.ip,
          headers["cf-ipcountry"] || "",
          gold.path + gold.search,
          headers[":method"],
          data
        );
        gold.end(data);
      },
      jerr: (data, code) => {
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
        console.error.bind({ info: -1, line: 5 })(
          gold.ip,
          headers["cf-ipcountry"] || "",
          gold.path + gold.search,
          headers[":method"],
          data
        );
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
function info() {
  console.log.bind({ xinfo: 2 })(this.headers);
  console.log.bind({ xinfo: 2 })(this.query);
  console.log.bind({ xinfo: 2 })(this.body);
  console.log.bind({ xinfo: 2 })(this.data);
}
