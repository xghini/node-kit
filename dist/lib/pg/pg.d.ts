export function xpg(config?: any): PGClient;
declare class PGClient {
    constructor(config?: {});
    pool: any;
    columnTypeCache: {};
    getColumnTypes(tableName: any): Promise<any>;
    query(tableName: any, options?: {}): Promise<any>;
    createIndex(tableName: any, columns: any, options?: {}): Promise<{
        success: boolean;
        indexName: any;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        indexName?: undefined;
    }>;
    getTableStats(tableName: any): Promise<{
        size: any;
        rowEstimate: any;
        indexes: any;
    }>;
    close(): Promise<void>;
}
export {};
