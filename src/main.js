import * as index from "./lib/index.js";
import * as http from "./lib/http/http.js";
import * as xdb from "./lib/xdb/xdb.js";
import * as redis from "./lib/redis/redis.js";
import * as captcha from "./lib/captcha/captcha.js";
const kit = {
  ...index,
  ...http,
  ...xdb,
  ...redis,
  ...captcha,
};
export default kit;
export * from "./lib/index.js";
export * from "./lib/http/http.js";
export * from "./lib/xdb/xdb.js";
export * from "./lib/redis/redis.js";
export * from "./lib/captcha/captcha.js";
