import * as index from "./lib/index.js"; //一些小工具的聚合，免得此处太过杂乱
// 单独建立文件夹的大工具
import * as http from "./lib/http/http.js";
import * as xdb from "./lib/xdb/xdb.js";
import * as redis from "./lib/redis/redis.js";
import * as captcha from "./lib/captcha/captcha.js";
import * as pg from "./lib/pg/pg.js";
export default {
  ...index,
  ...http,
  ...xdb,
  ...redis,
  ...captcha,
  ...pg,
};
export * from "./lib/index.js";
export * from "./lib/http/http.js";
export * from "./lib/xdb/xdb.js";
export * from "./lib/redis/redis.js";
export * from "./lib/captcha/captcha.js";
export * from "./lib/pg/pg.js";
