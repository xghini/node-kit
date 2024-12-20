export { Fdb };
import { rf, wf, mkdir, isdir, xpath, isfile,rm } from "@ghini/kit/dev";

const root =
  process.platform === "win32"
    ? "C:/ProgramData/Xdb"
    : process.platform === "linux"
    ? "/var/lib/Xdb"
    : "/usr/local/var/db/Xdb";
/**
 * 默认Xdb，但指定Xdb+任意数字作为新库也是可以的（Xdb0 Xdb1 XDB2）
 * @param {*} dir
 * @returns
 */
function Fdb(dir) {
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
