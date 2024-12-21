export { xpath, rf, wf, mkdir, isdir, isfile, dir, exist, rm, aonedir, loadyml, loadenv, loadjson, sleep, interval, timelog, prompt, };
import fs from "fs";
import path from "path";
import yaml from "yaml";
const platform = process.platform;
async function loadyml(filePath) {
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
async function loadenv(filePath) {
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
async function loadjson(filePath) {
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
async function rf(filename, option = "utf8") {
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
async function wf(filename, data, append = false, option = "utf8") {
    try {
        await mkdir(path.dirname(filename));
        const writeOption = append ? { encoding: option, flag: "a" } : option;
        await fs.promises.writeFile(filename, data, writeOption);
        return true;
    }
    catch (error) {
        console.error("写入" + filename + "文件失败:", error);
    }
}
async function mkdir(dir) {
    try {
        return await fs.promises.mkdir(dir, { recursive: true });
    }
    catch (err) {
        console.error(err.message);
    }
}
async function isdir(path) {
    try {
        const stats = await fs.promises.lstat(path);
        return stats.isDirectory();
    }
    catch (err) {
        console.error(err.message);
        return;
    }
}
async function isfile(path) {
    try {
        const stats = await fs.promises.lstat(path);
        return stats.isFile();
    }
    catch (err) {
        return;
    }
}
async function dir(path) {
    try {
        return await fs.promises.readdir(path);
    }
    catch (err) {
        console.error(err.message);
        return;
    }
}
async function exist(path) {
    try {
        await fs.promises.access(path);
        return true;
    }
    catch {
        return false;
    }
}
async function rm(targetPath, confirm = false) {
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
