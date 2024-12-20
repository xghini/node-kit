const weakmap = new WeakMap();
const createObject = () => {
  const a = Math.random();
  const obj = {};
  // 存储私有方法
  weakmap.set(obj, {
    privateMethod: () => {
      console.log("这是私有方法", a);
    },
    private0,
    hi:'hello',
  });
  // 定义公共方法
  obj.publicMethod = publicMethod;
  return obj;
};
function private0(){
  console.log("这是私有方法0,this跟随function的风格,绑定其属性父对象",this,this.a);
}
function publicMethod() {
  const private1 = weakmap.get(this);
  private1.privateMethod();
  console.log("这是公共方法");
}
const obj = createObject();
console.log(obj);
obj.publicMethod();
weakmap.get(obj).privateMethod(); // 虽然技术上可行,但需要访问 weakmap
const obj1 = createObject();
console.log(obj1);
obj1.publicMethod();
weakmap.get(obj1).privateMethod();
weakmap.get(obj1).private0();
console.log(weakmap);
