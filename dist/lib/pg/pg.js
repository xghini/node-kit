import pkg from "pg";
export { pg };
const { Pool } = pkg;
const default_config = {
    host: "localhost",
    port: 5432,
    database: "mydb",
    user: "postgres",
    password: "postgres",
};
function pg(config = default_config) {
    const pool = new Pool(config);
    pool.on("error", (err) => {
        console.error("Unexpected error on idle client", err);
    });
    pool.a0 = a0;
    pool.a1 = a1;
    pool.a2 = a2;
    pool.a3 = a3;
    return pool;
}
