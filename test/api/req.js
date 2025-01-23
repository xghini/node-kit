import kit from "@ghini/kit/dev";
import conf from "./conf.js";

const arr = conf.redis.slice(1);
const ct = kit.echo();
let n = 0;
while (true) {
  arr.forEach(async (r) => {
    let res = await kit.req(`http://${r.host}:9999/traffic`, {
      authorization: conf.auth,
    });
    res.data.n = n;
    ct.show = res.data;
  });
  n++;
  await kit.sleep(1000);
}
