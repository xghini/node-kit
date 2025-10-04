export function update(pool) {
    return async function (table, data, options = {}) {
        const { where = {}, whereColumn = 'id', returning = false, returningColumns = '*', silent = false } = options;
        try {
            if (Array.isArray(data)) {
                return await batchUpdate(pool, table, data, options);
            }
            const setKeys = Object.keys(data);
            if (setKeys.length === 0) {
                return [new Error('No data to update'), null];
            }
            const setClause = setKeys.map((key, index) => `"${key}" = $${index + 1}`).join(', ');
            let whereClause = '';
            let whereValues = [];
            let paramOffset = setKeys.length;
            if (whereColumn && data[Array.isArray(whereColumn) ? whereColumn[0] : whereColumn] !== undefined) {
                const columns = Array.isArray(whereColumn) ? whereColumn : [whereColumn];
                whereClause = ' WHERE ' + columns.map((col, index) => {
                    whereValues.push(data[col]);
                    return `"${col}" = $${paramOffset + index + 1}`;
                }).join(' AND ');
                paramOffset += columns.length;
            }
            else if (Object.keys(where).length > 0) {
                const whereKeys = Object.keys(where);
                whereClause = ' WHERE ' + whereKeys.map((key, index) => {
                    whereValues.push(where[key]);
                    return `"${key}" = $${paramOffset + index + 1}`;
                }).join(' AND ');
            }
            const returningClause = returning
                ? ` RETURNING ${Array.isArray(returningColumns) ? returningColumns.join(', ') : returningColumns}`
                : '';
            const sql = `UPDATE "${table}" SET ${setClause}${whereClause}${returningClause}`;
            const values = [...setKeys.map(key => data[key]), ...whereValues];
            if (!silent) {
                console.log('Update SQL:', sql);
                console.log('Values:', values);
            }
            const result = await pool.query(sql, values);
            return [null, {
                    rowCount: result.rowCount,
                    ...(returning && { rows: result.rows })
                }];
        }
        catch (error) {
            if (!silent) {
                console.error('Update error:', error);
            }
            return [error, null];
        }
    };
}
async function batchUpdate(pool, table, dataArray, options = {}) {
    const { whereColumn = 'id', returning = false, returningColumns = '*', silent = false } = options;
    if (dataArray.length === 0) {
        return [null, { rowCount: 0, rows: [] }];
    }
    const allKeys = [...new Set(dataArray.flatMap(item => Object.keys(item)))];
    const whereColumns = Array.isArray(whereColumn) ? whereColumn : [whereColumn];
    const updateFieldCount = allKeys.length - whereColumns.length;
    const paramsPerRow = whereColumns.length + updateFieldCount;
    const MAX_PARAMS = 55000;
    const BATCH_SIZE = Math.floor(MAX_PARAMS / (paramsPerRow * 2));
    if (dataArray.length > BATCH_SIZE) {
        if (!silent) {
            console.log(`批量更新: ${dataArray.length}条 × ${allKeys.length}字段，` +
                `将分 ${Math.ceil(dataArray.length / BATCH_SIZE)} 批处理（每批${BATCH_SIZE}条）...`);
        }
        let totalRowCount = 0;
        const allRows = [];
        const totalBatches = Math.ceil(dataArray.length / BATCH_SIZE);
        for (let i = 0; i < dataArray.length; i += BATCH_SIZE) {
            const batch = dataArray.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            const [err, result] = await batchUpdate(pool, table, batch, {
                ...options,
                silent: true
            });
            if (err) {
                console.error(`批次 ${batchNum}/${totalBatches} 失败:`, err.message);
                return [err, null];
            }
            totalRowCount += result.rowCount;
            if (returning && result.rows) {
                allRows.push(...result.rows);
            }
            if (!silent) {
                console.log(`批次 ${batchNum}/${totalBatches}: 更新 ${result.rowCount} 条`);
            }
        }
        if (!silent) {
            console.log(`✅ 总共成功更新 ${totalRowCount} 条数据`);
        }
        return [null, {
                rowCount: totalRowCount,
                batches: totalBatches,
                ...(returning && { rows: allRows })
            }];
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let totalRowCount = 0;
        const allRows = [];
        if (dataArray.length > 1) {
            const setClauseParts = [];
            const values = [];
            let paramIndex = 1;
            allKeys.forEach(key => {
                if (!whereColumns.includes(key)) {
                    const caseParts = [`"${key}" = CASE`];
                    dataArray.forEach(item => {
                        if (item[key] !== undefined) {
                            const conditions = whereColumns.map(col => {
                                values.push(item[col]);
                                return `"${col}" = $${paramIndex++}`;
                            }).join(' AND ');
                            values.push(item[key]);
                            caseParts.push(`WHEN ${conditions} THEN $${paramIndex++}`);
                        }
                    });
                    caseParts.push(`ELSE "${key}" END`);
                    setClauseParts.push(caseParts.join(' '));
                }
            });
            const whereInConditions = whereColumns.map(col => {
                const uniqueValues = [...new Set(dataArray.map(item => item[col]))];
                const placeholders = uniqueValues.map(() => `$${paramIndex++}`).join(', ');
                values.push(...uniqueValues);
                return `"${col}" IN (${placeholders})`;
            }).join(' AND ');
            const returningClause = returning
                ? ` RETURNING ${Array.isArray(returningColumns) ? returningColumns.join(', ') : returningColumns}`
                : '';
            const sql = `UPDATE "${table}" SET ${setClauseParts.join(', ')} WHERE ${whereInConditions}${returningClause}`;
            if (!silent) {
                console.log('Batch update SQL (preview):', sql.slice(0, 200) + '...');
                console.log('Total params:', values.length);
            }
            const result = await client.query(sql, values);
            totalRowCount = result.rowCount;
            if (returning) {
                allRows.push(...result.rows);
            }
        }
        else {
            const updateMethod = update(client);
            const [error, result] = await updateMethod(table, dataArray[0], {
                whereColumn,
                returning,
                returningColumns,
                silent: true
            });
            if (error)
                throw error;
            totalRowCount = result.rowCount;
            if (returning && result.rows) {
                allRows.push(...result.rows);
            }
        }
        await client.query('COMMIT');
        return [null, {
                rowCount: totalRowCount,
                ...(returning && { rows: allRows })
            }];
    }
    catch (error) {
        await client.query('ROLLBACK');
        if (!silent) {
            console.error('Batch update error:', error);
        }
        return [error, null];
    }
    finally {
        client.release();
    }
}
