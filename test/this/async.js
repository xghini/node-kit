import {
  rf,
  arf,
  timelog,
  sleep,
  xpath,
  mkdir,
  amkdir,
  rm,
  arm,
  isdir,
  aisdir,
  isfile,
  aisfile,
  exist,
  aexist,
  dir,
  adir,
} from "@ghini/kit/dev";
async function test() {
  // 如果是同步操作,这里会卡住,无论是否在async函数中(真实的sync 虚假的async)
  // for (let i = 0; i < 2; i++) {
  //   rf("C:/Code/software/vscode/Code.exe");
  // }
  // 万并发
  for (let i = 0; i < 10000; i++) {
    // 文件路径处理,异步没啥用,因为文件路径处理是同步的,算是原子性操作了
    // xpath("C:/Code/software/vscode/Code.exe");

    // 4.9s
    // mkdir("C:/Code/software/vscode/ttt"); //4.5s
    // dir("C:/Code/software/vscode/ttt"); //0.4s
    dir("C:/Code/software/vscode"); //0.56s
    // isdir("C:/Code/software/vscode/ttt"); //0.3s
    // isfile("C:/Code/software/vscode/ttt"); //0.3s
    // exist("C:/Code/software/vscode/ttt"); //0.23s
    // rm("C:/Code/software/vscode/ttt"); //0.32
    // 总6.9s,arm 0.7s,amkdir 6.2s 能做async就async,虽然总时间多了一点,平均到每个用户身上,就0.0007s完全无感,合在一起影响总进程就会比较明显
    // await amkdir("C:/Code/software/vscode/ttt");
    // await arm("C:/Code/software/vscode/ttt");
  }
}
async function test1() {
  // 如果是同步操作,这里会卡住,无论是否在async函数中(真实的sync 虚假的async)
  for (let i = 0; i < 2; i++) {
    await arf("C:/Code/software/vscode/Code.exe");
  }
}

// 如果其他操作被阻塞,说明是同步的
let n = 0;
setInterval(() => {
  n++;
  process.stdout.write(`\rtick: ${n++} `); //退到头覆盖输出
}, 100);
await sleep(300);
timelog(test);
// timelog(test1);
