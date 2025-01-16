import kit from "@ghini/kit";
kit.xconsole();
const server = kit.h2s();
kit.h2s({ allowHTTP1: false });
kit.hss();
kit.hs();
kit.h2s(8080);
server.addr("/", (gold) => gold.json(gold));
server.addr("/post", "post", (gold) => gold.raw("post only"));
server.addr(/regexp/, (gold) => gold.raw("任意包含regexp的路径  Any path that contains regexp"));
console.log(server.routes);

// 静态文件服务,默认./
// server.static("/", "..");
server.static("/a/b/c/download", "..");