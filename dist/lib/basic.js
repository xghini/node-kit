export { exefile, exedir, exeroot, metaroot, xpath, fileurl2path, stamps, now, sleep, interval, timelog, getDate, ttl, TTLMap, rf, wf, mkdir, isdir, isfile, dir, exist, rm, cp, env, exe, arf, awf, amkdir, aisdir, aisfile, adir, aexist, arm, aonedir, astat, aloadyml, aloadjson, cookie_obj, cookie_str, cookie_merge, cookies_obj, cookies_str, cookies_merge, mreplace, mreplace_calc, xreq, ast_jsbuild, gcatch, };
import { createRequire } from "module";
import { parse } from "acorn";
import fs from "fs";
import crypto from "crypto";
import { dirname, resolve, join, normalize, isAbsolute, sep } from "path";
import yaml from "yaml";
import { exec } from "child_process";
const platform = process.platform;
const slice_len_file = platform == "win32" ? 8 : 7;
const exefile = process.env.KIT_EXEPATH || process.env.KIT_EXEFILE || process.argv[1];
const exedir = dirname(exefile);
const exeroot = findPackageJsonDir(exefile);
const metaroot = findPackageJsonDir(import.meta.dirname);
let globalCatchError = false;
function stamps(date) {
    return Math.floor((Date.parse(date) || Date.now()) / 1000);
}
function now() {
    return Math.floor(Date.now() / 1000);
}
function exe(command, log = true) {
    return new Promise((resolve) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(error);
                return resolve(0);
            }
            if (stderr) {
                console.warn("Warning:", stderr);
            }
            if (log)
                console.log(stdout);
            resolve(stdout);
        });
    });
}
function gcatch(open = true) {
    if (open) {
        if (!globalCatchError) {
            console.dev("use gcatch");
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
function getDate(timestamp, offset = 8) {
    if (timestamp) {
        timestamp = timestamp.toString();
        if (timestamp.length < 12)
            timestamp = timestamp * 1000;
        else
            timestamp = timestamp * 1;
    }
    else
        timestamp = Date.now();
    return new Date(timestamp + offset * 3600000)
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");
}
async function aloadyml(filePath) {
    try {
        const absolutePath = isAbsolute(filePath)
            ? filePath
            : resolve(process.cwd(), filePath);
        const content = await fs.promises.readFile(absolutePath, "utf8");
        return yaml.parse(content);
    }
    catch (error) {
        console.error(error.message);
    }
}
function parseENV(content) {
    const result = {};
    const lines = content?.split("\n") || [];
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
function env(filePath, cover = false) {
    try {
        if (filePath)
            filePath = xpath(filePath);
        else {
            filePath = join(exeroot, ".env");
            if (!isfile(filePath)) {
                filePath = join(exefile, ".env");
                if (!isfile(filePath))
                    return null;
            }
        }
        const content = parseENV(rf(filePath));
        if (cover)
            process.env = { ...process.env, ...content };
        else
            process.env = { ...content, ...process.env };
        return content;
    }
    catch (error) {
        console.error(error);
    }
}
function findPackageJsonDir(currentPath) {
    if (isdir(currentPath)) {
        if (isfile(join(currentPath, "package.json")))
            return currentPath;
    }
    else {
        currentPath = dirname(currentPath);
        if (isfile(join(currentPath, "package.json")))
            return currentPath;
    }
    while (currentPath !== dirname(currentPath)) {
        currentPath = dirname(currentPath);
        if (isfile(join(currentPath, "package.json")))
            return currentPath;
    }
    return null;
}
async function aloadjson(filePath) {
    try {
        const absolutePath = xpath(filePath);
        const content = await arf(absolutePath);
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
async function astat(path) {
    return await fs.promises.stat(path);
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
        await amkdir(dirname(filename));
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
        console.error.bind({ info: -1 })(err.message);
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
function fileurl2path(url) {
    return (url = url
        .slice(url.indexOf("file:///"))
        .replace(/\:\d.*$/, "")
        .slice(slice_len_file));
}
function xpath(targetPath, basePath, separator = "/") {
    try {
        if (basePath) {
            if (basePath.startsWith("file:///"))
                basePath = basePath.slice(slice_len_file);
            else if (!isAbsolute(basePath)) {
                if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
                    basePath = dirname(basePath);
                }
                basePath = join(exedir, basePath);
            }
        }
        else {
            basePath = exedir;
        }
        let resPath;
        if (targetPath.startsWith("file:///"))
            resPath = normalize(targetPath.slice(slice_len_file));
        else if (isAbsolute(targetPath)) {
            resPath = normalize(targetPath);
        }
        else {
            resPath = join(basePath, targetPath);
        }
        if (separator === "/") {
            if (slice_len_file === 7)
                return resPath;
            else
                return resPath.split(sep).join("/");
        }
        if (separator === "\\") {
            if (slice_len_file === 8)
                return resPath;
            else
                return resPath.split(sep).join("\\");
        }
        return resPath.split(sep).join(separator);
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
                const srcPath = join(oldPath, entry);
                const destPath = join(newPath, entry);
                cp(srcPath, destPath);
            }
        }
        else if (stats.isFile()) {
            const targetDir = dirname(newPath);
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
        if (item.type == "Block" && item.value.match(/^\*\s/))
            return;
        newContent += code.slice(cursor, item.start);
        cursor = item.end;
    });
    return (newContent + code.slice(cursor)).replace(/^\s*[\r\n]/gm, "");
}
function xreq(path) {
    const require = createRequire(exefile);
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
        mkdir(dirname(filename));
        append ? (option = { encoding: option, flag: "a" }) : 0;
        fs.writeFileSync(filename, data, option);
        return true;
    }
    catch (error) {
        console.error("写入" + filename + "文件失败:", error);
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
class TTLMap {
    constructor() {
        this.storage = new Map();
        this.expiry_map = new Map();
        this.expiry_arr = [];
        this.lastCleanup = Date.now();
        this.cleanupInterval = 100;
    }
    set(key, value, ttl) {
        const expiryTime = Date.now() + ttl;
        this.storage.set(key, value);
        this.expiry_map.set(key, expiryTime);
        this.expiry_arr.push({ key, expiryTime });
        this._siftUp(this.expiry_arr.length - 1);
        this._lazyCleanup();
        return this;
    }
    get(key) {
        const expiryTime = this.expiry_map.get(key);
        if (!expiryTime || expiryTime <= Date.now()) {
            this.delete(key);
            return undefined;
        }
        return this.storage.get(key);
    }
    delete(key) {
        this.storage.delete(key);
        this.expiry_map.delete(key);
        return true;
    }
    _lazyCleanup() {
        const now = Date.now();
        if (now - this.lastCleanup < this.cleanupInterval) {
            return;
        }
        while (this.expiry_arr.length > 0) {
            const top = this.expiry_arr[0];
            if (top.expiryTime > now) {
                break;
            }
            this.delete(top.key);
            this._removeFromHeap();
        }
        this.lastCleanup = now;
    }
    _siftDown(index) {
        const element = this.expiry_arr[index];
        const halfLength = this.expiry_arr.length >>> 1;
        while (index < halfLength) {
            let minIndex = (index << 1) + 1;
            let minChild = this.expiry_arr[minIndex];
            const rightIndex = minIndex + 1;
            if (rightIndex < this.expiry_arr.length) {
                const rightChild = this.expiry_arr[rightIndex];
                if (rightChild.expiryTime < minChild.expiryTime) {
                    minIndex = rightIndex;
                    minChild = rightChild;
                }
            }
            if (element.expiryTime <= minChild.expiryTime) {
                break;
            }
            this.expiry_arr[index] = minChild;
            index = minIndex;
        }
        this.expiry_arr[index] = element;
    }
    _siftUp(index) {
        const element = this.expiry_arr[index];
        while (index > 0) {
            const parentIndex = (index - 1) >>> 1;
            const parent = this.expiry_arr[parentIndex];
            if (element.expiryTime >= parent.expiryTime) {
                break;
            }
            this.expiry_arr[index] = parent;
            index = parentIndex;
        }
        this.expiry_arr[index] = element;
    }
    _removeFromHeap() {
        const lastElement = this.expiry_arr.pop();
        if (this.expiry_arr.length > 0) {
            this.expiry_arr[0] = lastElement;
            this._siftDown(0);
        }
    }
}
const ttl = new TTLMap();
