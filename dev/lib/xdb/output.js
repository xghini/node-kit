import {
  rf,
  wf,
  mkdir,
  dir,
  isdir,
  xpath,
  isfile,
  rm,
  sleep,
  arf,
  awf,
  amkdir,
  aisdir,
  aisfile,
  adir,
  aexist,
  arm,
  aonedir,
  prompt,
} from "../index.js";

// export default { set, get, del, keys, flushall };

export async function set(key, value) {
  const path = this.keypath(key);
  if (!path) return;
  return awf(this.keypath(key), value);
}
export async function jset(key, value) {
  return set.call(this, key, JSON.stringify(value));
}
export async function get(key) {
  const path = this.keypath(key);
  if (!path) return;
  return arf(this.keypath(key));
}
export async function jget(key) {
  return JSON.parse(await get.call(this, key));
}
export async function del(key,confirm=false) {
  let path = this.keypath(key),
    tmp;
  if (!path) return;
  await arm(path, confirm);
  path = path.replace(/\/[^\/]+$/, "");
  tmp = await aonedir(path);
  while (path !== this.root && !tmp) {
    await arm(path, confirm);
    path = path.replace(/\/[^\/]+$/, "");
    tmp = await aonedir(path);
  }
  return tmp;
}
export function keys(key) {
  const path = key;
}
export async function flushall() {
  try {
    await arm(this.root);
    await amkdir(this.root);
    return true;
  } catch (e) {
    console.log(e);
    return;
  }
}

// export function clearVoidDir(key) {
//   // 递归清理这条路径下的空文件夹
//   key='a'
//   let path = this.keypath(key);
//   console.log(path);
// }
