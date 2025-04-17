export function xredis(...argv: any[]): Redis & {
    host: any;
    scankey: typeof scankey;
    scankeys: typeof scankeys;
    sync: typeof sync;
    avatar: typeof avatar;
    hsql: typeof hsql;
    hquery: typeof hquery;
    sum: typeof sum;
    join: typeof join;
    num: typeof num;
};
export function redis(...argv: any[]): Redis;
import Redis from "ioredis";
declare function scankey(pattern: any): Promise<any>;
declare function scankeys(pattern: any): Promise<any[]>;
declare function sync(targetRedisList: any, pattern: any, options?: any): Promise<void>;
declare function avatar(rearr: Redis[], fn: any): Promise<any[]>;
declare function hsql(pattern: string, expression: string, options?: {
    limit: number;
    sort: string;
    fields: string[];
}): Promise<any[]>;
declare function hquery(pattern: any, options?: any, logic?: any): Promise<any>;
declare function sum(pattern: any, fields: any): Promise<{}>;
declare function join(aa: any, bb: any, cc: any, dd: any): Promise<any>;
declare function num(pattern: any): Promise<number>;
export {};
