import { xerr, xconsole, prompt } from "@ghini/kit/dev";
xconsole();

// let n = 0;
// setInterval(() => {
//   n ++;
//   process.stdout.write(`\rtick: ${n++} `); //退到头覆盖输出
// }, 100);

let text;
await prompt();
text = await prompt("5*6=: ", (input) => {
  switch (input) {
    case "30":
      return true;
    default:
      console.error(input, "答案错误");
      return;
  }
});
text = "";
while (!text) {
  // text = await prompt("输入六位及以上密码:", (p) => p.length >= 6, 1, 0);
  text = await prompt("输入六位及以上密码: ", pwd, { show: false });
  text = await prompt("确认密码: ", (input) => input == text, {
    loop: false,
    show: false,
  });
  if (!text) console.error("两次输入密码不一致");
}
function pwd(p) {
  if (p.length >= 6) {
    return true;
  } else {
    console.error("密码不能少于6位");
    return;
  }
}
