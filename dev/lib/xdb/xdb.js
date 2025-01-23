export { Xdb };
import { rf, wf, mkdir, isdir, xpath, isfile, rm } from "../index.js";
import * as output from "./output.js";
import * as tool from "./tool.js";
const root =
  process.platform === "win32"
    ? "C:/ProgramData/xdb"
    : process.platform === "linux"
    ? "/var/lib/xdb"
    : "/usr/local/var/db/xdb";
// redis风格语法, 磁盘io的轻量nosql数据库;
// 初阶段:主从备份,文件锁,内存缓存
// 主要轻量高效处理中小型网站的数据, 如: 缓存, 计数器, 评论, 排行榜, 社交网络, 消息队列, 实时系统, 游戏, 电子商务, 实时分析, 日志, 监控等
// 主要支持键值,通过文件路径管控,给值分片,对值直接或序列化操作
// 此数据库具备较强的可读可操作性,因此也建议确保环境安全使用
/**
 * 默认系统路径xdb，但指定xdb+任意数字作为新库也是可以的（xdb0 xdb1 xDB2）
 * @param {*} dir 兼容大小写敏感,一律处理为小写
 */
function Xdb(dir) {
  // 检查最后一个是否以xdb 或+数字结尾
  if (dir) {
    dir = xpath.bind(1)(dir);
    const last = dir.split("/").at(-1).toLowerCase();
    if (last.match(/^xdb\d*$/)) {
      dir = dir.replace(/\/xdb(\d*)$/i, "/xdb$1");
    } else {
      console.error(dir, "路径指定不准确，应指向/xdb或/xdb+数字结尾的文件夹");
      return;
    }
  } else dir = root;
  // console.log(dir);
  mkdir(dir);
  if (!isdir(dir)) {
    console.error(dir, "目标文件夹创建失败，检查权限");
    return;
  }
  const xdb = {};
  Object.defineProperties(xdb, {
    keypath: { value: tool.keypath },
  });
  Object.defineProperty(xdb, "root", { value: dir, enumerable: true });
  return Object.assign(xdb, output);
}
// function keypath(key) {
//   // \/:*?"<>|`  路径不允许的符号,被当成/处理
//   // 标准使用:分隔层级(redis风格) 减少使用敏感符号写key
//   let keypath = key.replace(/[\\\/:*?"<>|`]/g, "/");
//   if (keypath.startsWith("/")) {
//     console.error("无效路径", key);
//     return;
//   }
//   return xpath(keypath, this.root) + "`";
// }
