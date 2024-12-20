const createObject = () => {
  const a = Math.random();
  const obj = {};
  // 存储私有方法
  Object.defineProperty(obj, "privateMethod", {
    value: {
      p0:()=>console.log("privateMethod"),
      private0,
      hi:"hello"
    },
    // writable: true,       // 是否允许修改函数,默认false
    // enumerable: true,     // 是否允许枚举(看到)该属性,默认false
    // configurable: true,   // 是否允许删除或重新定义该属性,默认false
  });  
  // 定义公共方法
  obj.publicMethod = publicMethod;
  return obj;
};
function private0(){
  console.log("这是私有方法0",this);
}
function publicMethod() {
  this.privateMethod();
  console.log("这是公共方法");
}
const obj = createObject();
// obj.privateMethod=()=>console.log("这xxxxx法");
// delete obj.privateMethod
console.log(obj);
// obj.publicMethod();
obj.privateMethod.private0(); //虽然看不到，但若知道名称可以调用,可以起到幽灵函数的效果