export { truncate };
async function truncate(pg, table) {
  const [err, res] = await pg.query(
    `TRUNCATE TABLE ${table} RESTART IDENTITY;`
    // `TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE;` //CASCADE 会清空所有关联表
  );
  if (err) return console.error(`清空 ${table} 表失败:`, err.message);
  console.log(table + " 表已成功清空。");
}
