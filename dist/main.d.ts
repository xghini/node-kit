export default kit;
export * from "./lib/index.js";
export * from "./lib/http/http.js";
export * from "./lib/xdb/xdb.js";
export * from "./lib/redis/redis.js";
export * from "./lib/captcha/captcha.js";
declare const kit: {
    captcha: typeof captcha.captcha;
    xredis: typeof redis.xredis;
    Xdb: typeof xdb.Xdb;
    h2s: typeof http.h2s;
    hs: typeof http.hs;
    hss: typeof http.hss;
    default_routes: typeof http.default_routes;
    req: typeof http.req;
    h2req: typeof http.h2req;
    h1req: typeof http.h1req;
    myip: typeof http.myip;
    exefile: string;
    exedir: string;
    exeroot: any;
    metaroot: any;
    xpath: typeof index.xpath;
    fileurl2path: typeof index.fileurl2path;
    sleep: typeof index.sleep;
    interval: typeof index.interval;
    timelog: typeof index.timelog;
    getDate: typeof index.getDate;
    rf: typeof index.rf;
    wf: typeof index.wf;
    mkdir: typeof index.mkdir;
    isdir: typeof index.isdir;
    isfile: typeof index.isfile;
    dir: typeof index.dir;
    exist: typeof index.exist;
    rm: typeof index.rm;
    cp: typeof index.cp;
    env: typeof index.env;
    exe: typeof index.exe;
    arf: typeof index.arf;
    awf: typeof index.awf;
    amkdir: typeof index.amkdir;
    aisdir: typeof index.aisdir;
    aisfile: typeof index.aisfile;
    adir: typeof index.adir;
    aexist: typeof index.aexist;
    arm: typeof index.arm;
    aonedir: typeof index.aonedir;
    astat: typeof index.astat;
    aloadyml: typeof index.aloadyml;
    aloadjson: typeof index.aloadjson;
    cookie_obj: typeof index.cookie_obj;
    cookie_str: typeof index.cookie_str;
    cookie_merge: typeof index.cookie_merge;
    cookies_obj: typeof index.cookies_obj;
    cookies_str: typeof index.cookies_str;
    cookies_merge: typeof index.cookies_merge;
    mreplace: typeof index.mreplace;
    mreplace_calc: typeof index.mreplace_calc;
    xreq: typeof index.xreq;
    ast_jsbuild: typeof index.ast_jsbuild;
    gcatch: typeof index.gcatch;
    uuid: typeof index.uuid;
    rint: typeof index.rint;
    rside: typeof index.rside;
    gchar: typeof index.gchar;
    fhash: typeof index.fhash;
    empty: typeof index.empty;
    addobjs: typeof index.addobjs;
    obj2v1: typeof index.obj2v1;
    addTwoDimensionalObjects: typeof index.addTwoDimensionalObjects;
    cs: typeof index.cs;
    csm: typeof index.csm;
    cdev: typeof index.cdev;
    cdebug: typeof index.cdebug;
    cinfo: typeof index.cinfo;
    cwarn: typeof index.cwarn;
    clog: typeof index.clog;
    cerror: typeof index.cerror;
    prompt: typeof index.prompt;
    style: {
        reset: string;
        bold: string;
        dim: string;
        underline: string;
        reverse: string;
        hidden: string;
        black: string;
        red: string;
        green: string;
        yellow: string;
        blue: string;
        magenta: string;
        cyan: string;
        white: string;
        brightBlack: string;
        brightRed: string;
        brightGreen: string;
        brightYellow: string;
        brightBlue: string;
        brightMagenta: string;
        brightCyan: string;
        brightWhite: string;
        bgBlack: string;
        bgRed: string;
        bgGreen: string;
        bgYellow: string;
        bgBlue: string;
        bgMagenta: string;
        bgCyan: string;
        bgWhite: string;
        bgBrightBlack: string;
        bgBrightRed: string;
        bgBrightGreen: string;
        bgBrightYellow: string;
        bgBrightBlue: string;
        bgBrightMagenta: string;
        bgBrightCyan: string;
        bgBrightWhite: string;
    };
    clear: typeof index.clear;
    echo: typeof index.echo;
    fresh: typeof index.fresh;
    gzip: typeof index.gzip;
    gunzip: typeof index.gunzip;
    deflate: typeof index.deflate;
    inflate: typeof index.inflate;
    br_compress: typeof index.br_compress;
    br_decompress: typeof index.br_decompress;
    zstd_compress: typeof index.zstd_compress;
    zstd_decompress: typeof index.zstd_decompress;
    cf: typeof index.cf;
};
import * as captcha from "./lib/captcha/captcha.js";
import * as redis from "./lib/redis/redis.js";
import * as xdb from "./lib/xdb/xdb.js";
import * as http from "./lib/http/http.js";
import * as index from "./lib/index.js";
