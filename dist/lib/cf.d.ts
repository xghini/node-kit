export function cf(obj: any): {
    auth: string;
    domain: any;
    getZoneId: typeof getZoneId;
    add: typeof add;
    madd: typeof madd;
    edit: typeof edit;
    medit: typeof medit;
    del: typeof del;
    mdel: typeof mdel;
};
declare function getZoneId(): Promise<any>;
declare function add(json: any): Promise<void>;
declare function madd(arr: any): Promise<any[]>;
declare function edit(str: any): Promise<void>;
declare function medit(arr: any): Promise<any[]>;
declare function del(pre: any): Promise<void>;
declare function mdel(arr: any): Promise<any[]>;
export {};
