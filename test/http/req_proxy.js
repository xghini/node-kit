import kit from "@ghini/kit/dev";

const res = await kit.req("http://ipv4.ping0.cc", {
  // proxy: "192.168.0.100:50001",
  proxy: "127.0.0.1:7897",
});

console.log(res);
