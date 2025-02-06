export function xredis(...argv: any[]): Redis & {
    scankey: typeof scankey;
    scankeys: typeof scankeys;
    sync: typeof sync;
    query: typeof query;
    sum: typeof sum;
};
import Redis from "ioredis";
declare function scankey(pattern: any): Promise<any>;
declare function scankeys(pattern: any): Promise<any[]>;
declare function sync(targetRedisList: any, pattern: any, options?: any): Promise<void>;
declare function query(pattern: string, options?: object, type?: string): Promise<string[]>;
declare function sum(pattern: any, fields: any): Promise<{}>;
export {};
