export function xredis(...argv: any[]): Redis & {
    scankey: typeof scankey;
    scankeys: typeof scankeys;
    sync: typeof sync;
};
import Redis from "ioredis";
declare function scankey(pattern: any): Promise<any>;
declare function scankeys(pattern: any): Promise<any[]>;
declare function sync(targetRedisList: any, pattern: any, options?: any): Promise<void>;
export {};
