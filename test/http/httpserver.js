// ## 1.初识:先使用预设的路由default_routes,涵盖了常见使用示例,便于了解
import kit from "@ghini/kit/dev";
// http1.1服务器
const s=kit.hs(3001);
// http2tls服务器,兼容1.1
const server = kit.h2s(3002);
// 默认路由为空,但有全局404错误处理
console.log(server.routes);
// 这些是预定义的路由,可以尝试一一去访问,体会其效果
server.routes = kit.default_routes();
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

// ## 2.进阶:拥有灵活强大的添加路由能力,尝试添加和覆写route
// 拥有灵活强大的添加路由能力
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
    chunks.push(Buffer.from(chunks.length + ","));
    g.write(`data: ${chunks.length}\n`);
  }
);
console.log(server.routes);

// ## 3.自定义404处理
server._404 = undefined; //虽然能去掉,但后台会报错
server._404 = () => {}; //正确不报错的去404提示
server._404 = (g) => {
  g.err("404 not found , 自定义的404响应", 404);
};

// ## 4.方便的数据获取,已对主要类型进行健全的自动化处理
server.addr("/data",'post', (gold) => {
  gold.respond({ "content-type": "text/plain;charset=UTF-8" });
  gold.write(JSON.stringify(gold.param)+'\n');
  gold.end(JSON.stringify(gold.data,0,2));
});


async function testCurl() {
  try {
    const result = await connect("curl https://tls.peet.ws/api/all");
    console.log("Curl Result:", result);
  } catch (error) {
    console.error("Curl Error:", error);
  }
}
// testCurl();
