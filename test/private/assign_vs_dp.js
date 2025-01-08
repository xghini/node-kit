/*
server = Object.assign;
return server;
或return Object.assign;才能被ide识别,缺点是没法动态getter
Object.defineProperties能高度定义可否显示修改和动态getter setter,但没法被ide识别

assign 会将 getter 立即求值，并创建一个普通的数据属性（value）
defineProperty 会保留 getter 的特性，创建一个访问器属性（get/set）

assign 创建的属性默认是 writable、enumerable、configurable 的
defineProperty 创建的属性默认都是 false（不可写、不可枚举、不可配置）
*/
function hs() {
  let count = 0; // 全局计数器
  let server = {
    get a() {
      return count;
    },
  };
  setInterval(() => count++, 1000);
  server = Object.assign(server, {
    get b() {
      return count;
    }, //
  });
  server = Object.defineProperty(server, "c", {
    get() {
      return count;
    },
    enumerable: true,
    // configurable: true,
  });
  return server;
}
const server = hs();
setInterval(() => {
  console.log(`a=${server.a} b=${server.b} c=${server.c}`);
}, 1000);
