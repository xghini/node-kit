export { rf, wf, mkdir, isdir, isfile, dir, exist, xpath, rm, cp, arf, awf, amkdir, aisdir, aisfile, adir, aexist, arm, aonedir, aloadyml, aloadenv, aloadjson, xconsole, xlog, xerr, cookie_obj, cookie_str, cookie_merge, cookies_obj, cookies_str, cookies_merge, mreplace, mreplace_calc, xreq, ast_jsbuild, sleep, interval, timelog, prompt, stack, getDate, gcatch, uuid, rint, rside, gchar, fhash, empty, };
import { createRequire } from "module";
import { parse } from "acorn";
import fs from "fs";
import crypto from "crypto";
import path from "path";
import yaml from "yaml";
const platform = process.platform;
const sep_file = platform == "win32" ? "file:///" : "file://";
const slice_len_file = platform == "win32" ? 8 : 7;
const originalLog = console.log;
const originalError = console.error;
const reset = "\x1b[0m";
const dim = "\x1b[30m";
const red = "\x1b[31m";
const green = "\x1b[92m";
const cyan = "\x1b[97m";
const yellow = "\x1b[93m";
const blue = "\x1b[94m";
let globalCatchError = false;
function gcatch(open = true) {
    if (open) {
        if (!globalCatchError) {
            globalCatchError = true;
            process.on("unhandledRejection", fn0);
            process.on("uncaughtException", fn1);
        }
    }
    else {
        globalCatchError = false;
        process.off("unhandledRejection", fn0);
        process.off("uncaughtException", fn1);
    }
    function fn0(reason, promise) {
        console.error("gcatch异步中未捕获错误:", promise, "reason:", reason);
    }
    function fn1(err) {
        console.error("gcatch主线程未捕获错误:", err);
    }
}
function empty(x, recursive = false) {
    if (recursive) {
        if (!x)
            return true;
        if (Array.isArray(x)) {
            return x.length === 0 || x.every((item) => empty(item, true));
        }
        if (typeof x === "object") {
            return (Object.keys(x).length === 0 ||
                Object.values(x).every((value) => empty(value, true)));
        }
        return false;
    }
    return !x || (typeof x === "object" && Object.keys(x).length === 0);
}
function fhash(cx, encode = "base64url", type = "sha256") {
    return crypto.createHash(type).update(cx).digest(encode);
}
function gchar(n = 6, characters = 0) {
    if (typeof characters === "number") {
        switch (characters) {
            case 0:
                characters = "0123456789";
                break;
            case 1:
                characters = "23457ACDFGHJKLPQRSTUVWXY23457";
                break;
            case 2:
                characters =
                    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz012345678901234567890123456789";
                break;
            case 2:
                characters =
                    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
                break;
            case 3:
                characters =
                    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
                break;
        }
    }
    let result = "";
    for (let i = 0; i < n; i++) {
        const idx = Math.floor(Math.random() * characters.length);
        result += characters[idx];
    }
    return result;
}
function rside() {
    return Math.random() > 0.5 ? 1 : -1;
}
function rint(a, b = 0) {
    if (a > b) {
        return Math.floor(Math.random() * (a + 1 - b)) + b;
    }
    else {
        return Math.floor(Math.random() * (b + 1 - a)) + a;
    }
}
function randint(a, b = 0) {
    if (a > b) {
        return Math.floor(Math.random() * (a + 1 - b)) + b;
    }
    else {
        return Math.floor(Math.random() * (b + 1 - a)) + a;
    }
}
function getDate(offset = 8) {
    const now = new Date();
    const beijingTime = new Date(now.getTime() + offset * 3600000);
    return beijingTime.toISOString().replace("T", " ").substring(0, 19);
}
function uuid(len = 21) {
    const byteLength = Math.ceil((len * 3) / 4);
    const randomString = crypto.randomBytes(byteLength).toString("base64url");
    return randomString.substring(0, len);
}
function stack() {
    const stack = new Error("STACK").stack.split("\n");
    originalLog(stack);
    return stack;
}
async function aloadyml(filePath) {
    try {
        const absolutePath = path.isAbsolute(filePath)
            ? filePath
            : path.resolve(process.cwd(), filePath);
        const content = await fs.promises.readFile(absolutePath, "utf8");
        return yaml.parse(content);
    }
    catch (error) {
        console.error(error.message);
    }
}
function parseENV(content) {
    const result = {};
    const lines = content.split("\n");
    for (let line of lines) {
        if (!line.trim() ||
            line.trim().startsWith("#") ||
            line.trim().startsWith("export")) {
            continue;
        }
        const separatorIndex = line.indexOf("=");
        if (separatorIndex !== -1) {
            const key = line.slice(0, separatorIndex).trim();
            let value = line.slice(separatorIndex + 1).trim();
            value = value.replace(/^["'](.*)["']$/, "$1");
            result[key] = value;
        }
    }
    return result;
}
async function aloadenv(filePath) {
    try {
        const absolutePath = path.isAbsolute(filePath)
            ? filePath
            : path.resolve(path.dirname(process.argv[1]), filePath);
        const content = await fs.promises.readFile(absolutePath, "utf8");
        return parseENV(content);
    }
    catch (error) {
        throw new Error(`Error loading ENV file ${filePath}: ${error.message}`);
    }
}
async function aloadjson(filePath) {
    try {
        const absolutePath = path.isAbsolute(filePath)
            ? filePath
            : path.resolve(path.dirname(process.argv[1]), filePath);
        const content = await fs.promises.readFile(absolutePath, "utf8");
        const processedContent = content
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/\/\/.*/g, "")
            .replace(/,(\s*[}\]])/g, "$1")
            .replace(/^\s+|\s+$/gm, "");
        try {
            return JSON.parse(processedContent);
        }
        catch (parseError) {
            const strictContent = processedContent
                .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":')
                .replace(/\n/g, "\\n")
                .replace(/\t/g, "\\t");
            return JSON.parse(strictContent);
        }
    }
    catch (error) {
        console.error(error.message);
    }
}
async function aonedir(dir) {
    try {
        const dirHandle = await fs.promises.opendir(dir);
        const firstEntry = await dirHandle.read();
        dirHandle.close();
        return firstEntry ? firstEntry.name : null;
    }
    catch {
        return undefined;
    }
}
async function prompt(promptText = "ENTER continue , CTRL+C exit: ", validator = () => true, option) {
    option = {
        ...{ loop: true, show: true },
        ...option,
    };
    let inputBuffer = "";
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    process.stdout.write(promptText);
    return new Promise((resolve) => {
        process.stdin.on("data", onData);
        function onData(key) {
            const char = key.toString();
            const code = char.codePointAt(0);
            if ((code > 31 && code < 127) ||
                (code > 0x4e00 && code < 0x9fff) ||
                (code > 0x3000 && code < 0x303f)) {
                if (option.show)
                    process.stdout.write(char);
                inputBuffer += char;
            }
            switch (char) {
                case "\r":
                case "\n":
                    process.stdout.write("\n");
                    if (validator(inputBuffer)) {
                        close();
                        resolve(inputBuffer);
                    }
                    else {
                        if (option.loop) {
                            inputBuffer = "";
                            process.stdout.write(promptText);
                        }
                        else {
                            close();
                            resolve(false);
                        }
                    }
                    return;
                case "\b":
                case "\x7f":
                    if (inputBuffer.length > 0) {
                        if (option.show) {
                            const charWidth = getCharWidth(inputBuffer.at(-1));
                            process.stdout.write("\b".repeat(charWidth));
                            process.stdout.write(" ".repeat(charWidth));
                            process.stdout.write("\b".repeat(charWidth));
                        }
                        inputBuffer = inputBuffer.slice(0, -1);
                    }
                    return;
                case "\x17":
                    if (inputBuffer.length > 0) {
                        process.stdout.clearLine();
                        process.stdout.cursorTo(0);
                        process.stdout.write(promptText);
                        inputBuffer = "";
                    }
                    return;
                case "\u0003":
                    process.stdout.write("\x1b[30m^C\n\x1b[0m");
                    close();
                    process.exit();
            }
        }
        function close() {
            process.stdin.setRawMode(false);
            process.stdin.removeListener("data", onData);
            process.stdin.pause();
        }
        function getCharWidth(char) {
            const code = char.codePointAt(0);
            if ((code > 0x3000 && code < 0x303f) ||
                (code > 0x4e00 && code < 0x9fff)) {
                return 2;
            }
            return 1;
        }
    });
}
async function arf(filename, option = "utf8") {
    try {
        const data = await fs.promises.readFile(xpath(filename), option);
        return data;
    }
    catch (error) {
        if (error.code === "ENOENT") {
            return;
        }
    }
}
async function awf(filename, data, append = false, option = "utf8") {
    try {
        await amkdir(path.dirname(filename));
        const writeOption = append ? { encoding: option, flag: "a" } : option;
        await fs.promises.writeFile(filename, data, writeOption);
        return true;
    }
    catch (error) {
        console.error("写入" + filename + "文件失败:", error);
    }
}
async function amkdir(dir) {
    try {
        return await fs.promises.mkdir(dir, { recursive: true });
    }
    catch (err) {
        console.error(err.message);
    }
}
async function aisdir(path) {
    try {
        const stats = await fs.promises.lstat(path);
        return stats.isDirectory();
    }
    catch (err) {
        console.error(err.message);
        return;
    }
}
async function aisfile(path) {
    try {
        const stats = await fs.promises.lstat(path);
        return stats.isFile();
    }
    catch (err) {
        return;
    }
}
async function adir(path) {
    try {
        return await fs.promises.readdir(path);
    }
    catch (err) {
        console.error(err.message);
        return;
    }
}
async function aexist(path) {
    try {
        await fs.promises.access(path);
        return true;
    }
    catch {
        return false;
    }
}
async function arm(targetPath, confirm = false) {
    try {
        if (confirm)
            await prompt(`确认删除? ${targetPath} `);
        await fs.promises.stat(targetPath);
        await fs.promises.rm(targetPath, { recursive: true });
        return true;
    }
    catch (err) {
        return;
    }
}
async function timelog(fn) {
    const start = performance.now();
    await fn();
    console.log(performance.now() - start + "ms");
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function interval(fn, ms, PX) {
    const start = Date.now();
    let id = setInterval(() => {
        if (PX && Date.now() - start > PX) {
            clearInterval(id);
        }
        else
            fn();
    }, ms);
}
function xpath(targetPath, basePath, separator = "/") {
    try {
        if (basePath) {
            if (basePath.startsWith("file:///"))
                basePath = basePath.slice(slice_len_file);
            if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
                basePath = path.dirname(basePath);
            }
        }
        else {
            basePath = path.dirname(process.argv[1]);
        }
        let resPath;
        if (targetPath.startsWith("file:///"))
            targetPath = targetPath.slice(slice_len_file);
        if (path.isAbsolute(targetPath)) {
            resPath = path.normalize(targetPath);
        }
        else {
            if (path.isAbsolute(basePath)) {
                resPath = path.resolve(basePath, targetPath);
            }
            else {
                resPath = path.resolve(path.dirname(process.argv[1]), path.join(basePath, targetPath));
            }
        }
        if (separator === "/" && slice_len_file === 7) {
            return resPath.split(path.sep).join("/");
        }
        if (separator === "\\")
            return resPath.split("/").join("\\");
        return resPath.split(path.sep).join(separator);
    }
    catch (error) {
        console.error(error);
    }
}
function cp(oldPath, newPath) {
    try {
        const stats = fs.statSync(oldPath);
        if (stats.isDirectory()) {
            fs.mkdirSync(newPath, { recursive: true });
            const entries = fs.readdirSync(oldPath);
            for (const entry of entries) {
                const srcPath = path.join(oldPath, entry);
                const destPath = path.join(newPath, entry);
                cp(srcPath, destPath);
            }
        }
        else if (stats.isFile()) {
            const targetDir = path.dirname(newPath);
            fs.mkdirSync(targetDir, { recursive: true });
            fs.copyFileSync(oldPath, newPath);
        }
        else {
            throw new Error(`不支持的文件类型: ${oldPath}`);
        }
    }
    catch (error) {
        throw new Error(`复制失败 "${oldPath}" -> "${newPath}": ${error.message}`);
    }
}
function rm(targetPath) {
    try {
        const stats = fs.statSync(targetPath);
        fs.rmSync(targetPath, { recursive: true });
        return true;
    }
    catch (err) {
        return;
    }
}
function exist(path) {
    try {
        return fs.existsSync(path);
    }
    catch (err) {
        console.error(err.message);
    }
}
function dir(path) {
    try {
        return fs.readdirSync(path);
    }
    catch (err) {
        return;
    }
}
function isfile(path) {
    try {
        return fs.lstatSync(path).isFile();
    }
    catch (err) {
        return;
    }
}
function isdir(path) {
    try {
        return fs.lstatSync(path).isDirectory();
    }
    catch (err) {
        return;
    }
}
function mkdir(dir) {
    try {
        return fs.mkdirSync(dir, { recursive: true });
    }
    catch (err) {
        console.error(err.message);
    }
}
function ast_jsbuild(code) {
    let comments = [];
    const ast = parse(code, {
        ecmaVersion: "latest",
        sourceType: "module",
        onComment: comments,
    });
    let cursor = 0;
    let newContent = "";
    comments.forEach((item) => {
        if (item.type == "Block" && item.value.match(/\*(\r\n|\n)/))
            return;
        newContent += code.slice(cursor, item.start);
        cursor = item.end;
    });
    return (newContent + code.slice(cursor)).replace(/^\s*[\r\n]/gm, "");
}
function xreq(path) {
    const require = createRequire(process.argv[1]);
    return require(path);
}
function rf(filename, option = "utf8") {
    try {
        const data = fs.readFileSync(xpath(filename), option);
        return data;
    }
    catch (error) {
        if (error.code === "ENOENT") {
            return;
        }
    }
}
function wf(filename, data, append = false, option = "utf8") {
    try {
        mkdir(path.dirname(filename));
        append ? (option = { encoding: option, flag: "a" }) : 0;
        fs.writeFileSync(filename, data, option);
        return true;
    }
    catch (error) {
        console.error("写入" + filename + "文件失败:", error);
    }
}
function getTimestamp() {
    const now = new Date();
    return `${(now.getMonth() + 1).toString().padStart(2, "0")}-${now
        .getDate()
        .toString()
        .padStart(2, "0")} ${now.getHours().toString().padStart(2, "0")}:${now
        .getMinutes()
        .toString()
        .padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}.${now
        .getMilliseconds()
        .toString()
        .padStart(3, "0")}`;
}
function getLineInfo(i = 3) {
    const arr = new Error().stack.split("\n");
    let res = arr[i].split("(").at(-1).split(sep_file).at(-1);
    if (res?.endsWith(")"))
        res = res.slice(0, -1);
    if (!res)
        originalLog(555, arr);
    return res;
}
function xlog(...args) {
    const timeString = getTimestamp();
    const line = getLineInfo(this?.trace || 4);
    let pre;
    switch (this?.info) {
        case 0:
            pre = "";
            break;
        case 1:
            pre = `${dim}[${timeString}]: ${reset}`;
            break;
        case 2:
            pre = `${blue}${line}: ${reset}`;
            break;
        default:
            pre = `${dim}[${timeString}]${blue} ${line}: ${reset}`;
    }
    process.stdout.write(pre);
    originalLog(...args);
}
function xerr(...args) {
    const timeString = getTimestamp();
    const line = getLineInfo(this?.trace || 4);
    let pre;
    switch (this?.info) {
        case 0:
            pre = "";
            break;
        case 1:
            pre = `${dim}[${timeString}]: ${red}`;
            break;
        case 2:
            pre = `${blue}${line}: ${red}`;
            break;
        default:
            pre = `${dim}[${timeString}]${blue} ${line}: ${red}`;
    }
    process.stdout.write(pre);
    originalError(...args, `${reset}`);
}
function xconsole(config = {}) {
    if (typeof config === "object") {
        config = {
            ...{
                log: {
                    info: 3,
                    trace: 3,
                },
                err: {
                    info: 3,
                    trace: 3,
                },
            },
            ...config,
        };
        console.log = xlog.bind(config.log);
        console.error = xerr.bind(config.err);
    }
    else {
        console.log = originalLog;
        console.error = originalError;
    }
}
function mreplace(str, replacements) {
    for (const [search, replacement] of replacements) {
        str = str.replace(new RegExp(search), (...args) => {
            return replacement.replace(/(\$)?\$(\d+)/g, (...args_$) => {
                if (args_$[1]) {
                    return args_$[1] + args_$[2];
                }
                else {
                    return args[args_$[2]] || args_$[0];
                }
            });
        });
    }
    return str;
}
function mreplace_calc(str, replacements) {
    const counts = [];
    const detail = [];
    counts.sum = 0;
    let result = str;
    for (const [search, replacement] of replacements) {
        let count = 0;
        result = result.replace(new RegExp(search), (...args) => {
            count++;
            detail.push([args.at(-2), args[0]]);
            return replacement.replace(/(\$)?\$(\d+)/g, (...args_$) => {
                if (args_$[1]) {
                    return args_$[1] + args_$[2];
                }
                else {
                    return args[args_$[2]] || args_$[0];
                }
            });
        });
        counts.push([count, search]);
        counts.sum += count;
    }
    return [result, counts, detail];
}
function cookies_obj(str) {
    if (!str)
        return {};
    return str.split("; ").reduce((obj, pair) => {
        const [key, value] = pair.split("=");
        if (key && value) {
            obj[key] = value;
        }
        return obj;
    }, {});
}
function cookies_str(obj) {
    if (!obj || Object.keys(obj).length === 0)
        return "";
    return Object.entries(obj)
        .filter(([key, value]) => key && value)
        .map(([key, value]) => `${key}=${value}`)
        .join("; ");
}
function cookies_merge(str1, str2) {
    const obj1 = cookies_obj(str1);
    const obj2 = cookies_obj(str2);
    const merged = { ...obj1, ...obj2 };
    return cookies_str(merged);
}
function cookie_obj(str) {
    const cookieFlags = [
        "Max-Age",
        "Path",
        "Domain",
        "SameSite",
        "Secure",
        "HttpOnly",
    ];
    const result = {
        value: {},
        flags: {},
    };
    str
        .split(";")
        .map((part) => part.trim())
        .forEach((part) => {
        if (!part.includes("=")) {
            result.flags[part] = true;
            return;
        }
        const [key, value] = part.split("=", 2).map((s) => s.trim());
        if (cookieFlags.includes(key)) {
            result.flags[key] = value;
        }
        else {
            result.value[key] = value;
        }
    });
    return result;
}
function cookie_str(obj) {
    const parts = [];
    for (const [key, value] of Object.entries(obj.value)) {
        parts.push(`${key}=${value}`);
    }
    for (const [key, value] of Object.entries(obj.flags)) {
        if (value === true) {
            parts.push(key);
        }
        else {
            parts.push(`${key}=${value}`);
        }
    }
    return parts.join("; ");
}
function cookie_merge(str1, str2) {
    const obj1 = cookie_obj(str1);
    const obj2 = cookie_obj(str2);
    const merged = {
        value: { ...obj1.value, ...obj2.value },
        flags: { ...obj1.flags, ...obj2.flags },
    };
    return cookie_str(merged);
}
