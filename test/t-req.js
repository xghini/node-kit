import kit from "@ghini/kit/dev";
kit.xconsole({
  dev: { info: 3 },
});
// 创建http https h2服务器,并设置/test路由
const sarr = [kit.hs(3300), kit.hss(3301), kit.h2s(3302)];
function fn(g) {
  const { query, data, cookie } = g;
  g.setcookie([
    `t=${performance.now()};max-age=3600`,
    "a=1;max-age=3600",
  ])
  g.json({ query, data, cookie });
}
sarr.forEach((s) => s.addr("/test", fn));

// req测试
// http
console.log("超时(错误处理)示例===========================================");
let [res, res1, res2] = await Promise.all([
  kit.req("http://localhost:3300").then((res) => console.log(res) || res),
  kit
    .req("https://localhost:3301", { cert: false, timeout: 4000 })
    .then((res) => console.log(res) || res),
  kit
    .req("https://localhost:3302", { cert: false, timeout: 1000 })
    .then((res) => console.log(res) || res),
]);

console.log(res.reqbd);
console.log(res1.reqbd);
console.log(res2.reqbd);
await kit.sleep(3000);
console.log(
  "method,query,body,options,headers示例==========================================="
);
const json = { foo: "hello" };
[res, res1, res2] = await Promise.all([
  res
    .req("/test?a=1&a=2&b=宝贝 post", { json })
    .then((res) => console.log(res) || res),
  res1
    .req("/test?a=1&a=2&b=宝贝 post", { cert: false, timeout: 4000, json })
    .then((res) => console.log(res) || res),
  res2
    .req("/test?a=1&a=2&b=宝贝 post", { cert: false, timeout: 1000, json })
    .then((res) => console.log(res) || res),
]);
await kit.sleep(3000);
console.log("快速完全重复请求示例===========================================");
res.req().then((res) => console.log(res) || res);
res1.req().then((res) => console.log(res) || res);
res2.req().then((res) => console.log(res) || res);
