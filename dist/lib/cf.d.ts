export function cf(obj: any): Promise<{
    auth: string;
    headers: {};
    domain: any;
    zid: any;
    getZoneId: typeof getZoneId;
    add: typeof add;
    madd: typeof madd;
    set: typeof set;
    mset: typeof mset;
    del: typeof del;
    mdel: typeof mdel;
    setSecurity: typeof setSecurity;
}>;
declare function getZoneId(): Promise<any>;
declare function add(json: any): Promise<any>;
declare function madd(arr: any): Promise<any[]>;
declare function set(str: any): Promise<{
    success: boolean;
    message: string;
    error?: undefined;
} | {
    success: boolean;
    error: any;
    message?: undefined;
}>;
declare function mset(arr: any): Promise<any[]>;
declare function del(pre: any): Promise<any>;
declare function mdel(arr: any): Promise<any[]>;
declare function setSecurity(options?: {
    description: string;
    expression: string;
    action: string;
    priority: number;
}): Promise<any>;
export {};
