export { rf, wf, mkdir, isdir, isfile, dir, exist, xpath, rm, arf, awf, amkdir, aisdir, aisfile, adir, aexist, arm, aonedir, cookie_merge, cookie_obj, cookie_str, xconsole, xlog, xerr, mreplace, mreplace_calc, xreq, ast_jsbuild, sleep, interval, timelog, prompt, };
import { createRequire } from "module";
import { parse } from "acorn";
import fs from "fs";
import path from "path";
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
function prompt(promptText = "ENTER continue , CTRL+C exit: ", validator = () => true, option) {
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
function interval(fn, ms, PX) {
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
                resPath = path.resolve(process.cwd(), path.join(basePath, targetPath));
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
function getLineInfo() {
    const arr = new Error().stack.split("\n")[3].split(sep_file);
    let res = arr[1];
    if (res.endsWith(")"))
        res = res.slice(0, -1);
    return res;
}
function xlog(...args) {
    const timeString = getTimestamp();
    const line = getLineInfo();
    let pre;
    switch (this) {
        case 1:
            pre = `${dim}[${timeString}]: ${reset}`;
            break;
        case 2:
            pre = `${blue}${line}: ${reset}`;
            break;
        case 3:
            pre = `${dim}[${timeString}]${blue} ${line}: ${reset}`;
            break;
        default:
            pre = "";
    }
    process.stdout.write(pre);
    originalLog(...args);
}
function xerr(...args) {
    const timeString = getTimestamp();
    const line = getLineInfo();
    let pre;
    switch (this) {
        case 1:
            pre = `${dim}[${timeString}]: ${red}`;
            break;
        case 2:
            pre = `${blue}${line}: ${red}`;
            break;
        case 3:
            pre = `${dim}[${timeString}]${blue} ${line}: ${red}`;
            break;
        default:
            pre = "";
    }
    process.stdout.write(pre);
    originalError(...args, `${reset}`);
}
function xconsole(rewrite = 3) {
    console.log = xlog.bind(rewrite);
    console.error = xerr.bind(rewrite);
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
function cookie_obj(str) {
    let obj = {};
    if (str) {
        str
            .split(";")
            .map((r) => r.trim())
            .forEach((r) => {
            let a = r.split("=");
            obj[a[0]] = a[1];
        });
    }
    return obj;
}
function cookie_str(obj) {
    return Object.entries(obj)
        .map((r) => r[0] + "=" + r[1])
        .join(";");
}
function cookie_merge(str1, str2) {
    return cookie_str({ ...cookie_obj(str1), ...cookie_obj(str2) });
}