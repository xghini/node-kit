import { rf, wf, mkdir, isdir, xpath, isfile, rm } from "../index.js";
export default { keypath };
export function keypath(key) {
  // \/:*?"<>|`  路径不允许的符号,被当成/处理
  // 标准使用:分隔层级(redis风格) 减少使用敏感符号写key
  if (key.match(/[\\*?"<>|`]/))
    return console.error(
      key,
      '含不支持作为key命名的字符【\\*?"<>|`】,可用【/:】作分隔符'
    );
  let keypath = key.replace(/[/:]/g, "/");
  if (keypath.startsWith("/")) {
    console.error("无效路径", key);
    return;
  }
  return xpath(keypath, this.root) + "`";
}