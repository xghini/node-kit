import kit from "@ghini/kit/dev";
kit.xconsole({
  info: { info: 3 },
  log: { info: 3 },
});
// 测试代码
let res;
res = await kit.req("https://localhost:3000/test");

// 测持续连接
setInterval(async () => {
  res = await kit.req("https://localhost:3000/test");
  console.log(res.data);
}, 5000);

// 测body
const postData = { test: "data", timestamp: new Date().toISOString() };
// res = await kit.req(
//   "https://localhost:3000/test?username=张三&password=123&a=1&a=2&b=李四#part1=#section2",
//   "poST",
//   postData
// );
console.log(res);
// 测超时 即时应用层超时,也能马上判断协议
// res = await req("https://localhost:3000/test/timeout");
// 测错误协议 能马上响应Error: socket hang up. code: 'ECONNRESET'
// res = await req("http://localhost:3000/test/timeout");
// 测无连接 能马上响应Error: connect ECONNREFUSED. code: 'ECONNREFUSED'
// res = await req("http://localhost:2000/test/timeout");
// 测降级
// res = await req("https://nginx.org/");
// delete res.data;
// console.log(res.headers);
// console.log(h2session);
