import kit from "@ghini/kit/dev";
const app = await kit.h2s(666);
// console.log(app);
app.addr("/a", (gold) => {
  console.log(666);
  gold.raw(666);
});
app.addr("/b","post", (gold) => {
  console.log('bbb');
  gold.raw('bbb');
});
app.apidev();
