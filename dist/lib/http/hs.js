export { h2s, hs, hss };
import { gcatch, rf, xpath, style, metaroot } from "../index.js";
import kit from "../../main.js";
import http2 from "http2";
import https from "https";
import http from "http";
import EventEmitter from "events";
import { hd_stream } from "./gold.js";
import { addr, _404 } from "./router.js";
import { extname } from "path";
import { fileSystem } from "./template.js";
async function hs(...argv) {
    return new Promise((resolve, reject) => {
        let { port, config } = argv_port_config(argv), server, scheme, open = 0, protocol = "http/1.1", currentConnections = 0;
        if (config?.key) {
            if (config.hasOwnProperty("allowHTTP1")) {
                server = http2.createSecureServer(config);
                if (config.allowHTTP1)
                    protocol = "h2,http/1.1";
                else
                    protocol = "h2";
            }
            else
                server = https.createServer(config);
            scheme = "https";
            open = 2;
        }
        else {
            server = http.createServer({ insecureHTTPParser: false });
            scheme = "http";
        }
        server.listen(port, () => {
            console.info.bind({ xinfo: 2 })(`${style.reset}${style.bold}${style.brightGreen} ✓ ${style.brightWhite}Running on ${style.underline}${scheme}://${"127.0.0.1"}:${port}${style.reset}  open:${open}`);
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
        server.on("request", (req, res) => {
            if (req.headers[":path"])
                return;
            req.scheme = scheme;
            let { stream, headers } = simulateHttp2Stream(req, res);
            hd_stream(server, stream, headers);
        });
        server.on("error", (err) => {
            if (err.code === "EADDRINUSE" && port < 65535) {
                console.warn.bind({ xinfo: 2 })(`${style.bold}${style.yellow} ⚠ ${style.dim}${style.brightMagenta}Port ${port} is in use, trying ${port + 1} instead...${style.reset}`);
                port++;
                server.listen(port);
            }
            else {
                console.error(`Server error: ${err.message}`);
                return reject(err);
            }
        });
        console.info.bind({ xinfo: 2 })(`🚀 Start [${protocol}] ${scheme} server...`);
        server = Object.assign(server, {
            open,
            routes: [],
            addr,
            static: fn_static,
            _404,
            router_begin: (server, gold) => { },
            cnn: 0,
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
                    server.routes.__404 = typeof v === "function" ? v : () => { };
                },
                enumerable: true,
            },
        });
    });
}
async function h2s(...argv) {
    let { port, config } = argv_port_config(argv);
    config = {
        ...{
            key: rf(xpath("store/cert/selfsigned.key", metaroot)),
            cert: rf(xpath("store/cert/selfsigned.cert", metaroot)),
            allowHTTP1: true,
        },
        ...config,
    };
    return hs(port, config);
}
async function hss(...argv) {
    let { port, config } = argv_port_config(argv);
    config = {
        ...{
            key: rf(xpath("store/cert/selfsigned.key", metaroot)),
            cert: rf(xpath("store/cert/selfsigned.cert", metaroot)),
        },
        config,
    };
    return hs(port, config);
}
function argv_port_config(argv) {
    let port, config;
    argv.forEach((item) => {
        if (typeof item === "object") {
            config = item;
        }
        else {
            port = item;
        }
    });
    port = port || 3000;
    return { port, config };
}
function simulateHttp2Stream(req, res) {
    const headers = { ...req.headers };
    headers[":method"] = req.method;
    headers[":path"] = req.url;
    headers[":scheme"] = req.scheme;
    headers[":authority"] = req.headers.host || "";
    const stream = new EventEmitter();
    stream.protocol = "HTTP/" + req.httpVersion;
    stream.ip = req.socket.remoteAddress;
    stream.respond = (responseHeaders) => {
        const status = responseHeaders[":status"] || 200;
        const filteredHeaders = Object.fromEntries(Object.entries(responseHeaders).filter(([key]) => !key.startsWith(":")));
        res.writeHead(status, filteredHeaders);
    };
    stream.write = res.write.bind(res);
    stream.end = res.end.bind(res);
    req.on("data", (chunk) => stream.emit("data", chunk));
    req.on("end", () => stream.emit("end"));
    req.on("error", (err) => stream.emit("error", err));
    return { stream, headers };
}
function fn_static(url, path = ".") {
    let reg;
    if (url === "/")
        reg = new RegExp(`^/(.*)?$`);
    else
        reg = new RegExp(`^${url}(\/.*)?$`);
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
                }
                else {
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
                    displayName = `<span class="file-name">                <span class="file-name-main">${fileName}</span>                <span class="file-name-ext">/</span>            </span>`;
                }
                else {
                    let lastDotIndex = fileName.lastIndexOf(".");
                    let nameMain = lastDotIndex > 0 ? fileName.slice(0, lastDotIndex) : fileName;
                    let nameExt = lastDotIndex > 0 ? fileName.slice(lastDotIndex) : "";
                    displayName = `<span class="file-name">                <span class="file-name-main">${nameMain}</span>                <span class="file-name-ext">${nameExt}</span>            </span>`;
                }
                html += `            <li>                <a href="${link}">                    <i class="fas ${icon}"></i>                    ${displayName}                </a>`;
                if (!isDir) {
                    html += `                <button onclick="window.location.href='${link}?download=1'"                         class="download-btn"                         title="下载文件"                        type="button">                    <i class="fas fa-download"></i>                </button>`;
                }
                html += `</li>`;
            }
            html += `</ul></div></body></html>`;
            g.respond({
                ":status": 200,
                "content-type": "text/html; charset=utf-8",
            });
            g.end(html);
        }
        else if (await kit.aisfile(filePath)) {
            const isDownload = g.query && g.query.download === "1";
            const ext = extname(filePath).toLowerCase();
            const contentType = getContentType(ext);
            try {
                if (isDownload) {
                    const content = await kit.arf(filePath, null);
                    g.download(content);
                }
                else {
                    const headers = {
                        ":status": 200,
                        "content-type": contentType,
                        "cache-control": "public, max-age=31536000",
                    };
                    g.respond(headers);
                    const content = await kit.arf(filePath, null);
                    g.end(content);
                }
            }
            catch (error) {
                console.error(error);
                g.err();
            }
        }
        else {
            g.server._404(g);
        }
    });
}
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
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".xls": "application/vnd.ms-excel",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".ppt": "application/vnd.ms-powerpoint",
        ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    };
    return mimeTypes[ext] || "application/octet-stream";
}
