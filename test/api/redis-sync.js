import kit from "@ghini/kit/dev";
import conf from "./conf.js";
const redis = kit.xredis(conf.redis[0]);
const redis1 = kit.xredis(conf.redis[1]);
const redis2 = kit.xredis(conf.redis[2]);
const redis3 = kit.xredis(conf.redis[3]);
const redis4 = kit.xredis(conf.redis[4]);
const arr = [redis, redis1, redis2, redis3, redis4];
// redis.sync([redis1, redis2, redis3, redis4], "plan:test*");
arr.forEach(async (re) => {
  const keys=await re.scankeys('plan:test*');
  keys.length>0?re.del(keys):0;
});
