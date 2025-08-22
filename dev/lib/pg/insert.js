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
  const { onconflict } = options;
  const columns = Object.keys(data[0]);
  const valuePlaceholders = [];
  const params = [];
  let paramIndex = 1;
  for (const item of data) {
    const values = columns.map((col) => item[col]);
    params.push(...values);
    // 2. 动态地根据列的数量，生成占位符
    valuePlaceholders.push(
      `(${values.map(() => `$${paramIndex++}`).join(",")})`
    );
  }
  // --- 2. [核心] 根据你的最终设计，解析conflict参数 ---
  let onConflictClause = "";
  if (onconflict) {
    if (typeof onconflict === "string") {
      console.log(`CONFLICT: DO NOTHING`);
      onConflictClause = `ON CONFLICT ("${onconflict}") DO NOTHING`;
    } else if (Array.isArray(onconflict)) {
      const targetString = onconflict[0];
      if (!targetString)
        return [new Error("onconflict数组必须至少包含一个目标键字符串"), null];
      const customUpdateColumns =
        onconflict.length > 1 ? onconflict.slice(1) : undefined;
      // [采纳你的思路] 将逗号分隔的字符串解析为键数组
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
  // if (sql.length > 800) console.log(sql.slice(0, 200), "\n...\n", sql.slice(-200));
  // else console.log(sql);
  const [err, res] = await pg.query(sql, params);
  if (err) {
    console.error("批量创建卡数据失败:", err.message);
    return [err, null];
  }
  // res.rowCount 会准确返回实际插入的行数（已跳过冲突行）
  console.log(`操作完成，成功插入 ${res.rowCount} 条新卡数据。`);
  return [null, res];
}
