const createObject = () => {
  // 私有方法
  const privateMethod = () => {
    console.log('这是私有方法');
    return 'private result';
  };

  // 返回公共接口
  return {
    publicMethod() {
      const result = privateMethod();
      console.log('这是公共方法,调用了私有方法得到:', result);
    }
  };
};

const obj = createObject();
console.log(obj); 
obj.publicMethod(); // 正常工作
obj.privateMethod(); // undefined - 无法访问


// publicMethod拿不出来,无法解耦