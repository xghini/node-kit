import kit from "@ghini/kit/dev";
kit.cs();
// kit.cs(0);
// kit.cs(1);
// kit.cs(2);
// kit.cs(3);
// kit.cs({
//   dev:{info:3},
// });
// kit.cs({
//   dev:{info:6},
//   err:{info:3},
//   log:{trace:2},
// });
console.log("Let's start!");
console.info("info");
console.debug("debug");
console.warn("warn");
console.error("error");
console.dev("dev");

// ============================================================
kit.cs(1);
await kit.sleep(2000);
let n=0;
const echo=kit.echo(n+'%');
while(n<100){
  n++;
  echo.show=n+'%';
  await kit.sleep(20);
}
let obj = {
  name: "测试对象1",
  status: "loading...",
};
echo.show = obj;
let s = setInterval(() => {
  // kit.fresh();
  obj.name = "asdfsafsdfsfsa".repeat(kit.rint(15));
}, 500);
await kit.sleep(3000);
clearInterval(s);
echo.stop();