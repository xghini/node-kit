import kit from "@ghini/kit";
// ttt();
// ttt();
// await kit.sleep(3000);
// ttt();
// async function ttt() {
//   const res = kit.ttl.get("gold.cookie.user");
//   if (res) {
//     return console.log("请求频繁", res);
//   }
//   kit.ttl.set("gold.cookie.user", 1, 3000);
//   console.log("请求成功");
// }
const server = await kit.hs(3001);

server.addr("/", (gg) => {
  console.log(23123);
  gg.raw("ok");
});
