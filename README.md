js的实用工具函数库,开发完整版,有较详细的demo和注释.  
这是个汇总大模块,使用方便,代价是初始化开销略微大,但对现代性能来说微乎其微.  
要优化起来也很简单,直接把使用部分单独拎出去就行,仅在最求极致的速度(✅)和蚊子腿内存(❌)时才有可能这么做

# httpserver
- 基于原生的http和http2封装
- 高性能,拓展性强,安全稳健

## 1.初识:先使用预设的路由default_routes,涵盖了常见使用示例,便于了解
```js
import kit from "@ghini/kit/dev";
kit.xconsole();
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