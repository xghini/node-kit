export function xpg(config?: any): PGClient;
export namespace xpg {
    function transaction<T>(callback: (client: any) => Promise<T>, config?: any): Promise<[Error, null] | [null, T]>;
    function getAllInstancesStatus(): any[];
    function closeAll(): Promise<void>;
}
declare class PGClient {
    constructor(config?: {});
    config: {
        user: string;
        password: string;
        host: string;
        port: string | number;
        database: string;
        max: number;
        idleTimeoutMillis: number;
        connectionTimeoutMillis: number;
    };
    pool: any;
    insert: (table: string, data: object | object[], options?: {
        onconflict?: string | any[];
    }) => Promise<[Error, null] | [null, any]>;
    truncate: (table: any) => Promise<void>;
    query(text: string, params?: any[]): Promise<[Error, null] | [null, any]>;
    getClient(): Promise<[Error, null] | [null, any]>;
    transaction<T>(callback: (client: any) => Promise<T>, options?: {
        isolationLevel?: "READ COMMITTED" | "REPEATABLE READ" | "SERIALIZABLE";
    }): Promise<[Error, null] | [null, T]>;
    mquery(mquery: Array<{
        text: string;
        params?: any[];
    }>): Promise<[Error, null] | [null, any[]]>;
    getPoolStatus(): any;
    testConnection(): Promise<[Error, null] | [null, boolean]>;
    close(): Promise<void>;
}
export {};
