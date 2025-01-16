import { cs, Xdb, xpath, timelog, dir, adir } from "@ghini/kit/dev";
cs(2);
const xdb = Xdb();

// let n = 0;
// setInterval(() => {
//   n++;
//   process.stdout.write(`\rtick: ${n++} `); //退到头覆盖输出
// }, 100);
console.log(await aonedir("C:/ProgramData/xdb/"))
// timelog(t0);
// 高并发测试
async function t0() {
  for (let i = 0; i < 1000; i++) {
    // await xdb.set(`${i}`, `this is ${i}`); //16s
    // await xdb.get(`${i}`); //4s
    // dir('C:/ProgramData/xdb') //0.4s-36s 万文件遍历压力,所以要设计出scan,或先用adir也是足够的
    // await adir('C:/ProgramData/xdb')
    await xdb.del(`${i}`); //30s
    // await checkDir("C:/ProgramData/xdb"); //2.65s
    // await checkDir("C:/ProgramData/xdb/c"); //2.2s
  }
}
import fs from "fs";
export async function aonedir(dir) {
  try {
    const dirHandle = await fs.promises.opendir(dir);
    const firstEntry = await dirHandle.read();
    dirHandle.close();
    return firstEntry ? firstEntry.name : null;
  } catch {
    return undefined;
  }
}

// console.log(await xdb.set("c://s", "333111"));
// console.log(await xdb.get("c://s"));
// await xdb.jset("user/pzn", {
//   name: "pzn",
//   age: 20,
//   1: "1",
//   "1": "2",
//   "11": "3",
// });
// console.log(await xdb.jget("user/pzn"));

// console.log(xdb.set("c/c/c/ss/ff", "333"));
// console.log(xdb.set("c/c/ss", "333111"));
console.log(await xdb.del("c/c/c/ss/ff")); //这个设计,让它删到c/c
// xdb.flushall();

// console.log(xdb.root);
// console.log(xdb.root.children);
// console.log(xdb.root.children.user);
// console.log(xdb.root.children.user.children);

// Xdb('C:\\ProgramData\\xDB888');
// Xdb('C:\\ProgramData\\xDdB888');
