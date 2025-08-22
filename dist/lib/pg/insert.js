export { insert };
async function insert(pg, table, data, options = {}) {
    if (!Array.isArray(data))
        data = [data];
    if (typeof data[0] !== "object")
        return console.error("data数据结构不正确");
    const { onconflict } = options;
    const columns = Object.keys(data[0]);
    const valuePlaceholders = [];
    const params = [];
    let paramIndex = 1;
    for (const item of data) {
        const values = columns.map((col) => item[col]);
        params.push(...values);
        valuePlaceholders.push(`(${values.map(() => `$${paramIndex++}`).join(",")})`);
    }
    let onConflictClause = "";
    if (onconflict) {
        if (typeof onconflict === "string") {
            console.log(`CONFLICT: DO NOTHING`);
            onConflictClause = `ON CONFLICT ("${onconflict}") DO NOTHING`;
        }
        else if (Array.isArray(onconflict)) {
            const targetString = onconflict[0];
            if (!targetString)
                return [new Error("onconflict数组必须至少包含一个目标键字符串"), null];
            const customUpdateColumns = onconflict.length > 1 ? onconflict.slice(1) : undefined;
            const conflictKeys = targetString.split(",").map((k) => k.trim());
            const conflictKeySql = conflictKeys.map((k) => `"${k}"`).join(", ");
            const columnsToUpdate = customUpdateColumns
                ? customUpdateColumns
                : columns.filter((col) => !conflictKeys.includes(col));
            if (columnsToUpdate.length === 0) {
                return [new Error("没有可供DO UPDATE操作的列"), null];
            }
            console.log(`CONFLICT: DO UPDATE`);
            const updateSetClause = columnsToUpdate
                .map((col) => `"${col}" = EXCLUDED."${col}"`)
                .join(", ");
            onConflictClause = `ON CONFLICT (${conflictKeySql}) DO UPDATE SET ${updateSetClause}`;
        }
    }
    console.dev(onConflictClause);
    const sql = `
    INSERT INTO "${table}" ("${columns.join('", "')}")
    VALUES ${valuePlaceholders.join(", ")}
    ${onConflictClause}
  `;
    const [err, res] = await pg.query(sql, params);
    if (err) {
        console.error("批量创建卡数据失败:", err.message);
        return [err, null];
    }
    console.log(`操作完成，成功插入 ${res.rowCount} 条新卡数据。`);
    return [null, res];
}
