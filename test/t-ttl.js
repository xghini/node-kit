import kit from "@ghini/kit/dev";
kit.cs(6);
const server = await kit.hs(3000);
server.addr("/", (gg) => {
  const a = kit.ttl.get("a");
  if(!a)kit.ttl.set("a", 1, 1000);
  console.log(23123, a);
  gg.raw("ok");
});
