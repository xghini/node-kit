import Redis from "ioredis";
// const cluster = new Redis.Cluster([
//   {
//     port: 6380,
//     host: '199.7.140.74'
//   },
//   {
//     port: 6381,
//     host: '199.7.140.74'
//   },
//   {
//     port: 6382,
//     host: '199.7.140.74'
//   }
// ],{
//   redisOptions: {
//     password: '@123321'
//   }
// });
const cluster = new Redis.Cluster([
  { port: 6380, host: "127.0.0.1" },
  { port: 6381, host: "127.0.0.1" },
  { port: 6382, host: "127.0.0.1" },
]);
console.log("ok");
await cluster.set('key0', 'value');
await cluster.set('key1', 'value');
await cluster.set('key2', 'value');
await cluster.set('key3', 'value');
await cluster.set('key4', 'value');
await cluster.set('key5', 'value');
await cluster.set('key6', 'value');
await cluster.set('key7', 'value');
await cluster.set('key8', 'value8');
console.log(await cluster.get("key8"));
console.log(await cluster.get("key7"));
console.log(await cluster.get("key8"));
console.log(await cluster.get("key6"));
console.log(await cluster.get("key8"));
console.log(await cluster.get("key5"));
console.log(await cluster.get("key8"));
console.log(await cluster.get("key4"));
console.log(await cluster.get("key8"));
console.log(await cluster.get("key3"));
async function getAllKeys2(cluster) {
  const nodes = await cluster.nodes();
  const keyArrays = await Promise.all(
    nodes.map(node => node.keys('*'))
  );
  return Array.from(new Set(keyArrays.flat()));
}
console.log(await getAllKeys2(cluster));
cluster.disconnect();











