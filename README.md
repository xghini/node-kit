# @ghini/kit
### 很厉害的JS库哦，通过示例，轻松上手
### 基于原生的http,https和http2封装的高性能,拓展性强,安全稳健的httpserver和request,性能远超express,koa,axios,request
### 所有都是基于高性能,安全及实用性封装

## 一. 安装及使用
```bash
npm i @ghini/kit
```
### 导入,所有在kit命名空间下操作,这是推荐的方式:
```js
import kit from "@ghini/kit/dev";
```
## 二.快速开始
### 1. 创建一个httpserver
快速开始,非常实用,用完就离不开的cs(console):  
测试文件路径: `./test/t-cs.js`
```js
import kit from "@ghini/kit/dev";
kit.cs();
// kit.cs(0);
// kit.cs(1);
// kit.cs(2);
// kit.cs(3);
// kit.cs({
//   dev:{info:3},
// });
// kit.cs({
//   dev:{info:6},
//   err:{info:3},
//   log:{trace:2},
// });
console.log("Let's start!");
console.info("info");
console.debug("debug");
console.warn("warn");
console.error("error");
console.dev("dev");
```
```bash
node --watch ./test/t-console.js
```
进阶用法: 尝试依序将下方注释解开

## 3.httpserver
测试文件路径:`./test/api/main.js`
```js
import kit from "@ghini/kit";
kit.cs();
const server = kit.h2s();
kit.h2s({ allowHTTP1: false });
kit.hss();
kit.hs();
kit.h2s(8080);
server.addr("/", (gold) => gold.json(gold));
server.addr("/post", "post", (gold) => gold.raw("post only"));
server.addr(/regexp/, (gold) => gold.raw("任意包含regexp的路径  Any path that contains regexp"));
console.log(server.routes);
```
## 4.request
- 多路复用✅
- cookie管理✅
- 灵活的请求参数处理✅
- 可复用的参数构造✅
- 可高度自定义请求头,请求体✅
- 自动解码br,deflate,zstd,gzip压缩的响应体✅
- 自动解析json✅
测试文件路径:`./test/t-req.js`  
```js
import kit from "@ghini/kit/dev";
kit.cs({
  dev: { line: 3 },
});
// 创建http https h2服务器,并设置/test路由
const sarr = await Promise.all([kit.hs(3300), kit.hss(3301), kit.h2s(3302)]);
function fn(g) {
  const { query, data, cookie } = g;
  g.setcookie([`t=${performance.now()};max-age=3600`, "a=1;max-age=3600"]);
  g.json({ query, data, cookie });
}
sarr.forEach((s) => {
  s.addr("/timetout", () => {});
  s.addr("/test", fn);
});

// req使用示例
console.log("超时(错误处理)示例===========================================");
let [res, res1, res2] = await Promise.all([
  kit
    .req("http://localhost:3300/timetout")
    .then((res) => console.log(res) || res),
  kit
    .req("https://localhost:3301/timetout", { cert: false, timeout: 4000 })
    .then((res) => console.log(res) || res),
  kit
    .req("https://localhost:3302/timetout", { cert: false, timeout: 1000 })
    .then((res) => console.log(res) || res),
]);
console.log(res.reqbd);
console.log(res1.reqbd);
console.log(res2.reqbd);
await kit.sleep(5000);
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
```

## 5.redis
测试文件路径:`./test/t-redis.js`
## 6.pgsql

## 7.诸多使用的工具函数
测试文件路径:`./test/t-basic.js` `./test/t-codec.js`







# 旧版文档,server相关内容,若新文档没来得及更新,可以先对付看着,有条件建议直接看源码
## 1.初识:先使用预设的路由default_routes,涵盖了常见使用示例,便于了解
```js
import kit from "@ghini/kit/dev";
kit.cs();
// http1.1服务器
kit.hs(3001);
// http2tls服务器,兼容1.1
const server = kit.h2s(3002);
// 默认路由为空,但有全局404错误处理
console.log(server.routes);
// 这些是预定义的路由,可以尝试一一去访问,体会其效果
server.routes=kit.default_routes();
// function default_routes() {
//   return [
//     ["/", "*", "*", hd_hello.bind("Ghini"), undefined, {}],
//     [/^\/gold/, "*", "*", hd_hello.bind("RegExp"), undefined, {}],
//     ["/gold", "*", "*", hd_default, undefined, {}],
//     ["/data", "POST", "*", hd_data, undefined, {}],
//     ["/error", "*", "*", hd_error, undefined, {}],
//     ["/stream", "*", "*", hd_stream, undefined, {}],
//     ["/countdata", "*", "*", (g) => g.end(g.body), hd_countdata, {}],
//   ];
// }
console.log(server.routes);
```

## 2.进阶:拥有灵活强大的添加路由能力,尝试添加和覆写route
```js
server.addr(/^\/gold/, (gold) => gold.raw("cover"));
server.addr("/data", "post", (gold) => gold.json(gold));
server.addr(/any/, (gold) => {
  gold.respond({
    "content-type": "text/plain;charset=UTF-8",
    "set-cookie":
      "name=ghini;max-age=3600;path=/;httponly;secure;samesite=strict",
  });
  gold.write("你可以使用任何带有any的url访问这个路由\n");
  gold.end("但不包括?后面的参数,其属于param");
});
// 第一个函数是handle_onend,第二个函数(很少用)是handle_ondata(需要传body,多一点效果明显)
server.addr(
  "/handle_ondata",
  (g) => g.end(g.body),
  (g, chunk, chunks) => {
    // 响应头一定是在body前返回的,如果直接write会默认给响应头
    // gold.respond方法做过优化,不会重复给响应头
    g.respond({
      "content-type": "text/plain;charset=UTF-8",
    });
    console.log(chunk, chunks.length);
    // 这里我们尝试改掉原来的chunks.push(chunk); 会影响gold.body的生成
    // chunks.push(chunk);
    chunks.push(Buffer.from(chunks.length+','));
    g.write(`data: ${chunks.length}\n`);
  }
);
console.log(server.routes);
```


## 3.自定义错误处理
```js
server._404 = undefined; //虽然能去掉,但后台会报错
server._404 = () => {}; //正确不报错的去404提示
server._404 = (g) => {
  g.err("404 not found , 自定义的404响应", 404);
};
```

## 4.方便的数据获取,已对主要类型进行健全的自动化处理
```js
// 用postman之类工具,对/data进行一些测试,比如[/post](https://localhost:3002/data?a=123&中文=你好),对body的json x-www-form-urlencoded form-data的主流类型都进行了支持,轻松一键获取数据.
// 我们使用最复杂的情况,form-data指定key携带多文件,和空key多文件
server.addr("/data",'post', (gold) => {
  gold.respond({ "content-type": "text/plain;charset=UTF-8" });
  gold.write(JSON.stringify(gold.param)+'\n');
  gold.end(JSON.stringify(gold.data,0,2));
});
```
## 可以看到诸如此类的数据,使用gold.param和gold.data直接调用
```json
{"a":"123","中文":"你好"}
{
  "vk_swiftshader_icd.json": {
    "filename": "vk_swiftshader_icd.json",
    "content": "{\"file_format_version\": \"1.0.0\", \"ICD\": {\"library_path\": \".\\\\vk_swiftshader.dll\", \"api_version\": \"1.0.5\"}}",
    "contentType": "application/json"
  },
  "Squirrel-UpdateSelf.log": {
    "filename": "Squirrel-UpdateSelf.log",
    "content": "﻿[15/12/24 09:23:05] info: Program: Starting Squirrel Updater: --updateSelf=C:\\Users\\pznfo\\AppData\\Local\\SquirrelTemp\\Update.exe\r\n[15/12/24 09:23:05] info: Program: About to wait for parent PID 46400\r\n[15/12/24 09:23:07] info: Program: Finished Squirrel Updater",
    "contentType": "text/plain"
  },
  "usekey": [
    {
      "filename": "profile.json",
      "content": "{\n  \"name\": \"Postman\",\n  \"company\": \"Postman\",\n  \"installationOptions\": {}\n}",
      "contentType": "application/json"
    },
    {
      "filename": "icon.png",
      "content": "�PNG\r\n\u001a\n+00:00���:\u0000\u0000\u0000%tEXtdate:modify\u0000IEND�B`�",
      "contentType": "image/png"
    }
  ],
  "ok": "good"
}
```