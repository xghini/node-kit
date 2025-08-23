import kit from "@ghini/kit/dev";
const app = await kit.hs(666);
// console.log(app);
app.addr("/a", (gold) => {
  console.log("/a", gold.data);
  gold.raw("/a");
});
app.addr("/b", "post", (gold) => {
  console.log("/b", gold.data);
  gold.raw("/b");
});
app.addr("/c1");
app.addr("/c2");
app.addr("/c3");
app.addr("/c4");
app.addr("/c5");
app.addr("/c6");
app.addr("/c7");
app.addr("/c8");
app.addr("/c9");
app.addr("/c10");
app.addr("/c11");
app.addr("/c111111111111111111111111111111111111111111111111111");
app.apidev();
