import kit from "@ghini/kit/dev";
kit.cs(66);
let res;
// res = await kit.req("http://ipv4.ping0.cc", {
//   proxy: "192.168.0.100:50001",
//   // proxy: "127.0.0.1:7897",
// });
// res = await kit.h2req("https://ipv4.ping0.cc");
// res = await kit.req("https://ipv4.ping0.cc", { proxy: "192.168.0.100:50001" });

res = await kit.reqdata(
  `https://www.okx.com/api/v5/public/funding-rate?instId=BTC-USD-SWAP`,
  { proxy: "127.0.0.1:7897" }
);
// res = await kit.h1req("https://google.com", { proxy: "192.168.0.100:50001" });
// res = await kit.h1req("https://google.com", { proxy: "127.0.0.1:7897" });
console.log(res);
