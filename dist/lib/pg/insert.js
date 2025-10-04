export { insert };
async function insert(pg, table, data, options = {}) {
    if (!Array.isArray(data))
        data = [data];
    if (typeof data[0] !== "object")
        return console.error("data数据结构不正确");
    const startTime = Date.now();
    const { onconflict } = options;
    const columns = Object.keys(data[0]);
    const columnCount = columns.length;
    const MAX_PARAMS = 60000;
    const BATCH_SIZE = Math.min(Math.floor(MAX_PARAMS / columnCount), 2000);
    if (data.length > BATCH_SIZE) {
        console.log(`数据: ${data.length}条 × ${columnCount}字段 = ${data.length * columnCount}参数，` +
            `将分 ${Math.ceil(data.length / BATCH_SIZE)} 批插入（每批${BATCH_SIZE}条）...`);
        let totalRowCount = 0;
        const totalBatches = Math.ceil(data.length / BATCH_SIZE);
        for (let i = 0; i < data.length; i += BATCH_SIZE) {
            const batch = data.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            const [err, res] = await insert(pg, table, batch, options);
            if (err) {
                console.error(`批次 ${batchNum}/${totalBatches} 失败:`, err.message);
                return [err, null];
            }
            totalRowCount += res;
        }
        const duration = Date.now() - startTime;
        console.log(`✅ 总共成功插入 ${totalRowCount} 条数据，耗时 ${duration}ms (${(duration / 1000).toFixed(2)}s)`);
        return [null, totalRowCount];
    }
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
            const conflictKeys = onconflict.split(",").map((k) => k.trim());
            const conflictKeySql = conflictKeys.map((k) => `"${k}"`).join(", ");
            onConflictClause = `ON CONFLICT (${conflictKeySql}) DO NOTHING`;
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
            const updateSetClause = columnsToUpdate
                .map((col) => `"${col}" = EXCLUDED."${col}"`)
                .join(", ");
            onConflictClause = `ON CONFLICT (${conflictKeySql}) DO UPDATE SET ${updateSetClause}`;
        }
    }
    const sql = `
    INSERT INTO "${table}" ("${columns.join('", "')}")
    VALUES ${valuePlaceholders.join(", ")}
    ${onConflictClause}
  `;
    const [err, res] = await pg.query(sql, params);
    if (err) {
        console.error("批量插入失败:", err.message);
        return [err, null];
    }
    const duration = Date.now() - startTime;
    console.log(`✅ 总共成功插入 ${totalRowCount} 条数据，耗时 ${duration}ms (${(duration / 1000).toFixed(2)}s)`);
    return [null, res.rowCount];
}
