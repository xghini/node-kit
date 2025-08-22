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
    setByContent: typeof setByContent;
    msetByContent: typeof msetByContent;
    setByContentForce: typeof setByContentForce;
    msetByContentForce: typeof msetByContentForce;
}>;
declare function getZoneId(): Promise<any>;
declare function add(json: any): Promise<any>;
declare function madd(arr: any): Promise<any>;
declare function set(str: any): Promise<{
    success: boolean;
    changed: boolean;
    message: string;
    error?: undefined;
} | {
    success: boolean;
    changed: boolean;
    error: any;
    message?: undefined;
}>;
declare function mset(arr: any): Promise<any>;
declare function del(pre: any): Promise<{
    success: boolean;
    message: string;
    changed: boolean;
} | {
    success: boolean;
    changed: boolean;
    message?: undefined;
}>;
declare function mdel(arr: any): Promise<any>;
declare function setSecurity(options?: {}): Promise<any>;
declare function setByContent(pre: any, oldContent: any, newContent: any, type?: string, ttl?: number): Promise<{
    success: boolean;
    message: string;
    action: string;
    changed: boolean;
    error?: undefined;
} | {
    success: boolean;
    error: any;
    changed: boolean;
    message?: undefined;
    action?: undefined;
}>;
declare function msetByContent(updates: any): Promise<any>;
declare function setByContentForce(pre: any, oldContent: any, newContent: any, type?: string, ttl?: number): Promise<any>;
declare function msetByContentForce(updates: any): Promise<any>;
export {};
