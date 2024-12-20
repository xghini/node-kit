// hs.js
import http from "http";
export { hs, _404 };
function hs(port) {
  const server = http.createServer();
  server.listen(port);

  // server.routes = [];
  // server._404 = _404;
  // return server; //跳转找不到

  const newserver = Object.assign(server, {
    routes: [],
    _404,
  });
  console.log(newserver === server); //true
  console.log(server.routes); //[]
  // return server; //跳转找不到
  return newserver; //跳转能找到
}
function _404() {
  console.error("404");
}
