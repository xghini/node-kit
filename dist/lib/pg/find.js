export function query(pool) {
    return async function (text, params = []) {
        const client = await pool.connect();
        try {
            const result = await client.query(text, params);
            return [null, result.rows];
        }
        catch (err) {
            console.dev('PG Query Error:', { query: text.substring(0, 100), message: err.message });
            return [err, null];
        }
        finally {
            client.release();
        }
    };
}
