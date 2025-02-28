import kit from "@ghini/kit/dev";
kit.cs(6);
let res;

// 使用方式
const pg = kit.xpg();

// 检查表统计信息：
// const stats = await pg.getTableStats("qquser");
// console.log(stats);

// 分析查询性能：
// const explainResults = await pg.query("qquser", {
//   // id: ['>', 9999000],
//   // id: ['<', 100],
//   qq: ['<',200],
//   _sort: "id desc",
//   _limit: 10,
//   // _explain: true, // 添加此参数获取执行计划
// });
// console.log(explainResults);

// res = await pg.query(`SELECT qq, COUNT(*)
// FROM qquser
// GROUP BY qq
// HAVING COUNT(*) > 1;`);


// 2025/2/28
// 查询

res = await pg.query("qquser", {
  qq: '1025071499',
  _sort: "id desc",
  _limit: 100,
});
console.log(res)
// res=await pg.query(
//   'SELECT * FROM qquser WHERE email = $1 LIMIT $2',
//   ['3121838961@qq.com', 10]
// );

// console.log(res.length);
