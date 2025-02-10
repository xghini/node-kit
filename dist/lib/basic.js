export { exefile, exedir, exeroot, metaroot, xpath, fileurl2path, sleep, interval, timelog, getDate, rf, wf, mkdir, isdir, isfile, dir, exist, rm, cp, env, exe, arf, awf, amkdir, aisdir, aisfile, adir, aexist, arm, aonedir, astat, aloadyml, aloadjson, cookie_obj, cookie_str, cookie_merge, cookies_obj, cookies_str, cookies_merge, mreplace, mreplace_calc, xreq, ast_jsbuild, gcatch, uuid, rint, rside, gchar, fhash, empty, addobjs, obj2v1, addTwoDimensionalObjects, };
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
function exe(command) {
    return new Promise((resolve) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(error);
                return resolve(0);
            }
            if (stderr) {
                console.warn("Warning:", stderr);
            }
            console.log(stdout);
            resolve(stdout);
        });
    });
}
function addTwoDimensionalObjects(...objects) {
    const level1Keys = [...new Set(objects.flatMap((obj) => Object.keys(obj)))];
    const level2Keys = [
        ...new Set(objects.flatMap((obj) => Object.values(obj).flatMap((innerObj) => Object.keys(innerObj)))),
    ];
    const result = {};
    level1Keys.forEach((key1) => {
        result[key1] = {};
        level2Keys.forEach((key2) => {
            result[key1][key2] = objects.reduce((sum, obj) => {
                if (!obj[key1])
                    return sum;
                return sum + (obj[key1][key2] || 0);
            }, 0);
        });
    });
    return result;
}
function obj2v1(obj2v) {
    return Object.fromEntries(Object.entries(obj2v).map(([key, value]) => {
        if (typeof value === "object" &&
            value !== null &&
            !Array.isArray(value)) {
            return [
                key,
                Object.values(value).reduce((sum, val) => sum + (typeof val === "number" ? val / 1048576 : 0), 0),
            ];
        }
        return [key, value];
    }));
}
function addobjs(...objects) {
    const keys = [...new Set(objects.flatMap((obj) => Object.keys(obj)))];
    return keys.reduce((result, key) => {
        result[key] = objects.reduce((sum, obj) => sum + (obj[key] || 0), 0);
        return result;
    }, {});
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
function getDate(offset = 8) {
    return new Date(Date.now() + offset * 3600000)
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");
}
function uuid(len = 21) {
    const byteLength = Math.ceil((len * 3) / 4);
    const randomString = crypto.randomBytes(byteLength).toString("base64url");
    return randomString.substring(0, len);
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
