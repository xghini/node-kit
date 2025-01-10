import kit from "@ghini/kit/dev";
kit.xconsole({
  error: { info: 3 },
  log: { info: 3 },
  dev: { info: 3 },
});
const postData = { test: "data", timestamp: new Date().toISOString() };
let res;

// 测试代码
// res = await kit.req();
res = await kit.req(
  "https://localhost:3000/test?username=张三&password=123&a=1&a=2&b=李四#part1=#section2 post ",
  JSON.stringify({ a: 1, b: "发多少" }),
  {
    "content-type": "application/json",
    cookie: "a=1;b=2;c=3;",
    cert: "test.pem",
    key: "test.key",
  },
  {
    timeout: 1000,
    cert: false,
    settings: {
      enablePush: false,
    },
  }
);
console.log(res);
await kit.sleep(1000);
res = await res.req("/test");
console.log(res);
await kit.sleep(1000);
res = await res.req();
console.log(res);
// 测持续连接
// setInterval(async () => {
//   res = await kit.req("https://localhost:3000/test");
//   console.log(res);
// }, 2000);

// 测body
// res = await kit.req(
//   "https://localhost:3000/test?username=张三&password=123&a=1&a=2&b=李四#part1=#section2",
//   "poST",
//   postData
// );

// 测超时 即时应用层超时,也能马上判断协议
// res = await kit.req("https://localhost:3000/test/timeout");
// 测错误协议 能马上响应Error: socket hang up. code: 'ECONNRESET'
// res = await kit.req("http://localhost:3000/test/timeout");
// 测无连接 能马上响应Error: connect ECONNREFUSED. code: 'ECONNREFUSED'
// res = await kit.req("http://localhost:2000/test/timeout");
// res = await kit.req("https://localhost:2000/test/timeout");
// 测降级
// res = await kit.req("https://nginx.org/");
// delete res.data;
// console.log(res.headers);
// console.log(h2session);

// console.log(res.client);
