import kit from "@ghini/kit/dev";
let obj1 = {
  name: "测试对象1",
  status: "loading",
  progress: 50,
  details: {
    step: 1,
    message: "正在处理...asdfsdafwtwte2435啊都是打工发的他",
  },
};

const zzz = kit.zzz(obj1);
let s = setInterval(() => {
  // kit.fresh();
  obj1.name = "asdfsafsdfsfsa".repeat(kit.rint(15));
}, 500);
await kit.sleep(3000);
clearInterval(s);
kit.fresh();
zzz.stop();
await kit.sleep(2000);
console.log(obj1);
