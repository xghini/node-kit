export { insert };

/**
 * 高性能批量插入或更新(Upsert)数据。
 *
 * @param {object} pg - pg客户端实例。
 * @param {string} table - 表名。
 * @param {object|object[]} data - 要插入的数据。
 * @param {object} [options] - 选项。
 * @param {string|Array} [options.onconflict] - 冲突处理配置, 类型决定行为:
 * - **`string`**: 冲突时跳过 (DO NOTHING)。
 * `{ onconflict: 'id' }`
 * - **`Array`**: 冲突时更新 (DO UPDATE)。
 * `['target', ...updateColumns]`
 * - `target`: (string) 冲突列, 多个用逗号隔开, e.g., `'id'` 或 `'user_id,post_id'`。
 * - `...updateColumns`: (string[]) 要更新的列。若省略, 则更新所有非冲突列。
 *
 * @example
 * // 跳过冲突
 * await insert(pg, 't', data, { onconflict: 'cid' });
 *
 * // 冲突时更新所有非冲突列
 * await insert(pg, 't', data, { onconflict: ['cid'] });
 *
 * // 冲突时只更新指定列
 * await insert(pg, 't', data, { onconflict: ['cid', 'exp_date', 'cvv'] });
 *
 * // 复合键冲突
 * await insert(pg, 't', data, { onconflict: ['user_id,post_id', 'updated_at'] });
 *
 * @returns {Promise<[Error, null] | [null, import("pg").QueryResult<any>]>} 返回一个元组。
 */
async function insert(pg, table, data, options = {}) {
  if (!Array.isArray(data)) data = [data];
  if (typeof data[0] !== "object") return console.error("data数据结构不正确");
  const startTime = Date.now();
  const { onconflict } = options;
  const columns = Object.keys(data[0]);
  const columnCount = columns.length;
  // ✅ 自适应分批：根据字段数动态计算每批大小
  const MAX_PARAMS = 60000; // 安全阈值（PostgreSQL上限65535，留余量）
  const BATCH_SIZE = Math.min(Math.floor(MAX_PARAMS / columnCount), 2000);

  // 如果数据量超过单批限制，自动分批
  if (data.length > BATCH_SIZE) {
    console.log(
      `数据: ${data.length}条 × ${columnCount}字段 = ${
        data.length * columnCount
      }参数，` +
        `将分 ${Math.ceil(
          data.length / BATCH_SIZE
        )} 批插入（每批${BATCH_SIZE}条）...`
    );

    let totalRowCount = 0;
    const totalBatches = Math.ceil(data.length / BATCH_SIZE);

    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;

      const [err, res] = await insert(pg, table, batch, options); // 递归调用
      if (err) {
        console.error(`批次 ${batchNum}/${totalBatches} 失败:`, err.message);
        return [err, null];
      }

      totalRowCount += res.rowCount;
      // console.log(`批次 ${batchNum}/${totalBatches}: 插入 ${res.rowCount} 条`);
    }
    const duration = Date.now() - startTime;
    console.log(
      `✅ 总共成功插入 ${totalRowCount} 条数据，耗时 ${duration}ms (${(
        duration / 1000
      ).toFixed(2)}s)`
    );
    return [null, totalRowCount];
  }

  // --- 单批插入逻辑（原有代码） ---
  const valuePlaceholders = [];
  const params = [];
  let paramIndex = 1;

  for (const item of data) {
    const values = columns.map((col) => item[col]);
    params.push(...values);
    valuePlaceholders.push(
      `(${values.map(() => `$${paramIndex++}`).join(",")})`
    );
  }

  let onConflictClause = "";
  if (onconflict) {
    if (typeof onconflict === "string") {
      // console.log(`CONFLICT: DO NOTHING`);
      const conflictKeys = onconflict.split(",").map((k) => k.trim());
      const conflictKeySql = conflictKeys.map((k) => `"${k}"`).join(", ");
      onConflictClause = `ON CONFLICT (${conflictKeySql}) DO NOTHING`;
    } else if (Array.isArray(onconflict)) {
      const targetString = onconflict[0];
      if (!targetString)
        return [new Error("onconflict数组必须至少包含一个目标键字符串"), null];
      const customUpdateColumns =
        onconflict.length > 1 ? onconflict.slice(1) : undefined;
      const conflictKeys = targetString.split(",").map((k) => k.trim());
      const conflictKeySql = conflictKeys.map((k) => `"${k}"`).join(", ");
      const columnsToUpdate = customUpdateColumns
        ? customUpdateColumns
        : columns.filter((col) => !conflictKeys.includes(col));
      if (columnsToUpdate.length === 0) {
        return [new Error("没有可供DO UPDATE操作的列"), null];
      }
      // console.log(`CONFLICT: DO UPDATE`);
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
  console.log(
    `✅ 总共成功插入 ${totalRowCount} 条数据，耗时 ${duration}ms (${(
      duration / 1000
    ).toFixed(2)}s)`
  );
  return [null, res.rowCount];
}
