// import { xconsole, timelog,sleep } from "@ghini/kit/dev";
// xconsole();
// for (let i = 0; i < 5; i++) {
//   await timelog(() => {});
// }

for (let i = 0; i < 5; i++) {
  const start = process.hrtime.bigint();
  const dur=process.hrtime.bigint() - start;
  console.log(dur);
}
console.log('----------------')
for (let i = 0; i < 5; i++) {
  const start = process.hrtime.bigint();
  console.log(process.hrtime.bigint() - start);
}
console.log('----------------')
for (let i = 0; i < 5; i++) {
  const start = process.hrtime.bigint();
  const dur=process.hrtime.bigint() - start;
  console.log(dur);
}
console.log('----------------')
for (let i = 0; i < 5; i++) {
  const start = process.hrtime.bigint();
  console.log(process.hrtime.bigint() - start);
}

