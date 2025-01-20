import kit from "@ghini/kit/dev";
kit.cs(66);
let data;
data = new URLSearchParams({ a: 1, b: 2 });
// data = new Uint16Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
// data = Buffer.from(data);
// data=new ArrayBuffer(10);
// data='asdfsda'
// data=NaN
// let res = await kit.req("https://209.38.84.122:13000/ping post", data);
let res = await kit.h1req("https://tls.peet.ws/api/all postaa", data);
// let res = await kit.req("http://localhost:3000/v1/test?a=1 delete",'asdf');
// let res = await kit.req("https://tls.peet.ws/api/all?a=1 options",'asdf');
// let res = await kit.req("https://baidu.com", { cert: false });
// let res = await kit.req("https://google.com", { cert: false });
// let res = await kit.req("https://nginx.org", { cert: false });
console.log(res);

// setInterval(() => {
//   res.req();
//   console.log(res);
// }, 5000);
