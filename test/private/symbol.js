const privateMethod = Symbol("private");

const createObject = () => {
  return {
    [privateMethod]: function () {
      console.log("这是私有方法");
    },
    publicMethod
  };
};
function publicMethod() {
  this[privateMethod]();
  console.log('这是公共方法');
}
const obj = createObject();
console.log(obj);
obj.publicMethod(); // 正常工作
obj[privateMethod](); // 虽然技术上可行,但需要知道 privateMethod的名称

// 能看到,从源码找到定义能调用