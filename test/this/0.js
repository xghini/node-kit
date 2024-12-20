import {} from "@ghini/kit";
function xdb() {
  const x = Object.defineProperties(
    {},
    {
      wrap: { value: wrap },
    }
  );
  return Object.assign(x, {
    showthis,
    w_showthis: x.wrap(showthis), //这层包裹直接返回showthis不影响的this指向;但如果返回包裹在内,则会影响this,此时需要绑定this
  });
}
function wrap(fn) {
  console.log(this); //因为此时assign还没绑定成功,所以只能调用assign之前绑定的
  return (key) => {
    fn.apply(this, [key]);
    fn.call(this, key);
    fn.bind(this)(key);
  };
  // return fn.bind(this);
}
function showthis(key) {
  console.log(this, key);
}
const x = xdb();
x.showthis(123123);
x.w_showthis(3333);
