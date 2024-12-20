export { Xdb };
import { rf, wf, mkdir, isdir, xpath, isfile, rm } from "../basic.js";
import * as output from "./output.js";
import * as tool from "./tool.js";
const root = process.platform === "win32"
    ? "C:/ProgramData/xdb"
    : process.platform === "linux"
        ? "/var/lib/xdb"
        : "/usr/local/var/db/xdb";
function Xdb(dir) {
    if (dir) {
        dir = xpath(dir);
        const last = dir.split("/").at(-1).toLowerCase();
        if (last.match(/^xdb\d*$/)) {
            dir = dir.replace(/\/xdb(\d*)$/i, "/xdb$1");
        }
        else {
            console.error(dir, "路径指定不准确，应指向/xdb或/xdb+数字结尾的文件夹");
            return;
        }
    }
    else
        dir = root;
    mkdir(dir);
    if (!isdir(dir)) {
        console.error(dir, "目标文件夹创建失败，检查权限");
        return;
    }
    const xdb = {};
    Object.defineProperties(xdb, {
        keypath: { value: tool.keypath },
    });
    Object.defineProperty(xdb, "root", { value: dir, enumerable: true });
    return Object.assign(xdb, output);
}
