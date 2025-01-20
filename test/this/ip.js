import kit from "@ghini/kit/dev";
kit.cs(66);
let res = await kit.req("https://146.190.127.168:13000/ping", { cert: false });
// let res = await kit.req("https://baidu.com", { cert: false });
// let res = await kit.req("https://google.com", { cert: false });
// let res = await kit.req("https://nginx.org", { cert: false });
console.log(res);

setInterval(() => {
  res.req();
}, 2000);
