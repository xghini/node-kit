export function set(key: any, value: any): Promise<boolean>;
export function jset(key: any, value: any): Promise<any>;
export function get(key: any): Promise<Buffer<ArrayBufferLike> & string>;
export function jget(key: any): Promise<any>;
export function del(key: any, confirm?: boolean): Promise<string>;
export function keys(key: any): void;
export function flushall(): Promise<boolean>;
