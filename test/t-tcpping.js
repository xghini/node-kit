import kit from "@ghini/kit/dev";
// let res = await kit.tcpping("baidu.com");
let res = await kit.tcpping("starlink-jp.2513142.xyz");
console.log(res);
res = await kit.getip(`starlink-jp.2513142.xyz`);
console.log(res);