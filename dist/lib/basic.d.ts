export function rf(filename: string, option?: string): string | null;
export function wf(filename: string, data: string | Buffer, append?: boolean, option?: string): boolean;
export function mkdir(dir: any): undefined;
export function isdir(path: string): boolean | undefined;
export function isfile(path: string): boolean | undefined;
export function dir(path: string): string[] | undefined;
export function exist(path: string): boolean;
export function xpath(targetPath: any, basePath?: string, separator?: string): string;
export function rm(targetPath: string): undefined;
export function cp(oldPath: string, newPath: string): void;
export function arf(filename: any, option?: string): Promise<Buffer<ArrayBufferLike> & string>;
export function awf(filename: any, data: any, append?: boolean, option?: string): Promise<boolean>;
export function amkdir(dir: any): Promise<string>;
export function aisdir(path: any): Promise<boolean>;
export function aisfile(path: any): Promise<boolean>;
export function adir(path: any): Promise<string[]>;
export function aexist(path: any): Promise<boolean>;
export function arm(targetPath: any, confirm?: boolean): Promise<boolean>;
export function aonedir(dir: any): Promise<string>;
export function aloadyml(filePath: string): Promise<any>;
export function aloadenv(filePath: string): Promise<object>;
export function aloadjson(filePath: any): Promise<any>;
export function xconsole(config?: {}): {
    log: Function;
    err: Function;
};
export function xlog(...args: any[]): void;
export function xerr(...args: any[]): void;
export function cookie_obj(str: any): {
    value: {};
    flags: {};
};
export function cookie_str(obj: any): string;
export function cookie_merge(str1: any, str2: any): string;
export function cookies_obj(str: any): any;
export function cookies_str(obj: any): string;
export function cookies_merge(str1: any, str2: any): string;
export function mreplace(str: string, replacements: Array<[string | RegExp, string]>): string;
export function mreplace_calc(str: string, replacements: Array<[string | RegExp, string]>): [string, Array<[number, string | RegExp]>, Array<[number, string]>];
export function xreq(path: string): object;
export function ast_jsbuild(code: string): string;
export function sleep(ms: number): Promise<void>;
export function interval(fn: Function, ms: number, PX?: number): Promise<void>;
export function timelog(fn: any): Promise<void>;
export function prompt(promptText: string, validator: () => boolean, option: any): Promise<any>;
export function stack(): string[];
export function getDate(offset?: number): string;
export function uuid(len?: number): string;
export function rint(a: any, b?: number): any;
export function rside(): 1 | -1;
export function gchar(n?: number, characters?: number): string;
export function fhash(cx: string | Buffer | TypedArray | DataView, encode?: string, type?: string): string;
export function empty(x: any, recursive?: boolean): any;
