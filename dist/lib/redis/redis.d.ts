export function xredis(...argv: any[]): Redis & {
    scankey: typeof scankey;
    scankeys: typeof scankeys;
    sync: typeof sync;
    hquery: typeof hquery;
    sum: typeof sum;
    join: typeof join;
};
import Redis from "ioredis";
declare function scankey(pattern: any): Promise<any>;
declare function scankeys(pattern: any): Promise<any[]>;
declare function sync(targetRedisList: any, pattern: any, options?: any): Promise<void>;
declare function hquery(pattern: any, options?: {}): Promise<any>;
declare function sum(pattern: any, fields: any): Promise<{}>;
declare function join(aa: any, bb: any, cc: any, dd: any): Promise<any>;
export {};
