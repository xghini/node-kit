export { Xdb };
import { rf, wf, mkdir, isdir, xpath, isfile,rm } from "@ghini/kit/dev";

// redis风格语法, 磁盘io的轻量nosql数据库;
// 初阶段:主从备份,文件锁,内存缓存
// 主要轻量高效处理中小型网站的数据, 如: 缓存, 计数器, 评论, 排行榜, 社交网络, 消息队列, 实时系统, 游戏, 电子商务, 实时分析, 日志, 监控等
// 主要支持键值,通过文件路径管控,给值分片,对值直接或序列化操作
const root =
  process.platform === "win32"
    ? "C:/ProgramData/Xdb"
    : process.platform === "linux"
    ? "/var/lib/Xdb"
    : "/usr/local/var/db/Xdb";

function Xdb(dir) {
  // 默认当前进程目录下的xdb文件夹做数据库,或指定文件夹
  // 检查最后一个是否以xdb 或+数字结尾
  if (dir) {
    dir = xpath(dir);
    const last = dir.split("/").at(-1).toLowerCase();
    if (last.match(/^xdb\d*$/)) {
      dir = dir.replace(/\/xdb(\d*)$/i, "/Xdb$1");
    } else {
      console.error(dir, "路径指定不准确，应指向/Xdb或/Xdb+数字结尾的文件夹");
      return;
    }
  } else dir = root;
  console.log(mkdir(dir));
  if (!isdir(dir)) {
    console.error(dir, "目标文件夹创建失败，检查权限");
    return;
  }
  dir = 'root';
  const xdb = {};
  Object.defineProperty(xdb, "x", {
    value: {
      keypath,
    },
  });
  Object.defineProperty(xdb, "root", { value: dir, enumerable: true });
  xdb.set = set;
  xdb.get = get;
  xdb.flushall = flushall;
  return xdb;
}
function keypath(key) {
  return xpath(key.replace(/\:/g, "/"), this.dir) + ".x";
}
function set(key, value) {
  // key = key.replace(/\:/g, "/");
  // const path = xpath(key, this.dir) + ".x";
  wf(this.x.keypath(key), value);
}
function get(key) {
  // key = key.replace(/\:/g, "/");
  // const path = xpath(key, this.dir) + ".x";
  return rf(this.x.keypath(key));
}
function del(key) {
  const path = xpath(key, this.dir);
  if (isfile(path)) {
    return rm(path);
  } else {
    return false;
  }
}
function keys(key) {
  const path = xpath(key, this.dir);
}
function flushall(){
  rm(this.root);
  mkdir(this.root);
}

