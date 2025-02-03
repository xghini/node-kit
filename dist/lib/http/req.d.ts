export function req(...argv: any[]): Promise<ReturnType<typeof resbuild>>;
export function h2req(...argv: any[]): Promise<ReturnType<typeof resbuild>>;
export function h1req(...argv: any[]): Promise<ReturnType<typeof resbuild>>;
export const myip: string | Buffer<ArrayBufferLike>;
declare function resbuild(ok: any, protocol: any, code: any, headers: any, body: any): Promise<Resbd>;
declare class Resbd {
    constructor(props?: {});
    ok: boolean;
    code: number;
    headers: any;
    cookie: string;
    body: string | Buffer;
    data: any;
    protocol: string;
    reqbd: Reqbd;
    req: typeof req;
    h1req: typeof h1req;
    h2req: typeof h2req;
}
declare class Reqbd {
    constructor(props?: {});
    h2session: any;
    urlobj: URL;
    url: string;
    method: string;
    headers: any;
    body: string | Buffer;
    options: any;
}
export {};
