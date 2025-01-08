export { h2s, hs, connect };
export * from "./routes.js";
import { xlog, gcatch } from "../basic.js";
import http2 from "http2";
import http from "http";
import { hd_stream, getArgv, simulateHttp2Stream } from "./std.js";
import { addr, _404 } from "./router.js";
function hs(...argv) {
    let { port, config } = getArgv(argv), server, scheme, ok = false, currentConnections = 0;
    if (config?.key) {
        server = http2.createSecureServer(config);
        scheme = "https";
    }
    else {
        server = http.createServer(config);
        scheme = "http";
    }
    server.listen(port, () => {
        ok = true;
        console.log(`\x1b[92m✓\x1b[0m Running on ${scheme}://localhost:${port}`);
        gcatch();
        if (config?.key) {
            server.on("stream", (stream, headers) => {
                stream.alpn = "HTTP/2";
                hd_stream(server, stream, headers);
            });
        }
    });
    server.on("connection", (socket) => {
        currentConnections++;
        socket.on("close", () => {
            currentConnections--;
        });
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
            console.error(`\x1b[93m⚠\x1b[0m Port ${port} is in use, trying ${port + 1} instead.`);
            port++;
            server.listen(port);
        }
        else {
            console.error(`Server error: ${err.message}`);
        }
    });
    xlog("Start " + scheme + " server...");
    server = Object.assign(server, {
        http_local: true,
        https_local: false,
        routes: [],
        addr,
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
    });
    return server;
}
function h2s(...argv) {
    let { port, config } = getArgv(argv, true);
    return hs(port, config);
}
function connect(curlString) {
    const urlMatch = curlString.match(/https?:\/\/[^\s]+/);
    if (!urlMatch) {
        throw new Error("Invalid URL in curl command");
    }
    const parsedUrl = new URL(urlMatch[0]);
    const authority = parsedUrl.host;
    const path = parsedUrl.pathname;
    const method = curlString.includes("-X")
        ? curlString.match(/-X\s*(\w+)/)[1]
        : "GET";
    return new Promise((resolve, reject) => {
        const client = http2.connect(`https://${authority}`, {
            rejectUnauthorized: false,
        });
        client.on("error", (err) => {
            client.close();
            reject(err);
        });
        const req = client.request({
            ":method": method,
            ":path": path,
            ":scheme": "https",
            ":authority": authority,
        });
        let responseData = "";
        req.on("data", (chunk) => {
            responseData += chunk;
        });
        req.on("end", () => {
            client.close();
            resolve(responseData);
        });
        req.end();
    });
}
