export {
  exefile,
  exedir,
  exeroot,
  metaroot,
  xpath,
  fileurl2path,
  stamps,
  date,
  now,
  sleep,
  interval,
  timelog,
  ttl,
  TTLMap,
  rf,
  wf,
  mkdir,
  isdir,
  isfile,
  dir,
  exist,
  rm,
  cp,
  env,
  exe,
  arf,
  awf,
  amkdir,
  aisdir,
  aisfile,
  adir,
  aexist,
  arm,
  aonedir,
  astat,
  aloadyml,
  aloadjson,
  cookie_obj,
  cookie_str,
  cookie_merge,
  cookies_obj,
  cookies_str,
  cookies_merge,
  mreplace,
  mreplace_calc,
  xreq,
  ast_jsbuild,
  gcatch,
  isipv4,
  isipv6,
  tcpping,
  getip,
};
import { createRequire } from "module";
import { parse } from "acorn";
import fs from "fs";
import { dirname, resolve, join, normalize, isAbsolute, sep } from "path";
import yaml from "yaml";
import { exec } from "child_process";
import net from "net";
import { performance } from "perf_hooks"; 
import dns from 'dns/promises';
const platform = process.platform; 
const slice_len_file = platform == "win32" ? 8 : 7;
const exefile =
  process.env.KIT_EXEPATH || process.env.KIT_EXEFILE || process.argv[1]; 
const exedir = dirname(exefile);
const exeroot = findPackageJsonDir(exefile);
/**
 * 当前库的rootpath
 * @returns {string} 返回当前文件所处最近nodejs项目的绝对路径
 */
const metaroot = findPackageJsonDir(import.meta.dirname);
let globalCatchError = false;
/**
 * 根据域名获取其IP地址。
 * @param {string} domain 需要查询的域名。
 * @returns {Promise<string|null>} 返回一个 Promise，成功时解析为 IP 地址字符串，失败时解析为 null。
 */
async function getip(domain) {
  if (!domain || typeof domain !== 'string') {
    console.error("错误：提供的域名无效。");
    return null;
  }
  try {
    const { address } = await dns.lookup(domain);
    return address;
  } catch (error) {
    return null; 
  }
}
/** tcpping @returns 返回延迟 | false */
function tcpping(ip, port = 443, timeout = 2000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    const startTime = performance.now(); 
    socket.connect(port, ip, () => {
      resolve(Math.round(performance.now() - startTime));
      socket.destroy();
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false); 
    });
    socket.on("error", (err) => {
      socket.destroy();
      resolve(false); 
    });
  });
}
/** isipv4 */
function isipv4(ip) {
  const ipv4Regex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipv4Regex.test(ip);
}
/** isipv6 */
function isipv6(ip) {
  const ipv6Regex =
    /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/i;
  return ipv6Regex.test(ip);
}
/** 根据日期获取秒时间戳,不传参数则获取当前秒时间戳 */
function stamps(date) {
  return Math.floor((Date.parse(date) || Date.now()) / 1000);
}
/** 获取秒时间戳 */
function now() {
  return Math.floor(Date.now() / 1000);
}
/** 执行命令行指令 默认打印日志,返回输出 */
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
      if (log) console.log(stdout);
      resolve(stdout);
    });
  });
}
/**
 * gcatch 捕获全局异常
 * @param {boolean} open 是否开启
 */
function gcatch(open = true) {
  if (open) {
    if (!globalCatchError) {
      console.dev("use gcatch");
      globalCatchError = true;
      process.on("unhandledRejection", fn0);
      process.on("uncaughtException", fn1);
    }
  } else {
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
function date(timestamp, offset = 8) {
  if (timestamp) {
    timestamp = timestamp.toString();
    if (timestamp.length < 12) timestamp = timestamp * 1000;
    else timestamp = timestamp * 1;
  } else timestamp = Date.now();
  return new Date(timestamp + offset * 3600000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
}
/**
 * Load and parse YAML file
 * @param {string} filePath - Absolute or relative path to YAML file
 * @returns {Promise<any>} Parsed YAML content
 */
async function aloadyml(filePath) {
  try {
    const absolutePath = isAbsolute(filePath)
      ? filePath
      : resolve(process.cwd(), filePath);
    const content = await fs.promises.readFile(absolutePath, "utf8");
    return yaml.parse(content);
  } catch (error) {
    console.error(error.message);
  }
}
/**
 * 解析 ENV 内容
 * @param {string} content - ENV 文件内容
 * @returns {object} 解析后的对象
 */
function parseENV(content) {
  const result = {};
  const lines = content?.split("\n") || [];
  for (let line of lines) {
    if (
      !line.trim() ||
      line.trim().startsWith("#") ||
      line.trim().startsWith("export")
    ) {
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
/**
 * 加载ENV 默认读取根目录下的.env文件,系统环境变量优先,可直接从返回取用
 * 写相对路径则从当前运行文件
 * @param {string} filePath - ENV 文件的绝对或相对路径
 * @returns {Promise<object>} 解析后的对象
 */
function env(filePath, cover = false) {
  try {
    if (filePath) filePath = xpath(filePath);
    else {
      filePath = join(exeroot, ".env");
      if (!isfile(filePath)) {
        filePath = join(exefile, ".env");
        if (!isfile(filePath)) return null;
      }
    }
    const content = parseENV(rf(filePath));
    if (cover) process.env = { ...process.env, ...content };
    else process.env = { ...content, ...process.env };
    return content || {};
  } catch (error) {
    console.error(error);
  }
}
function findPackageJsonDir(currentPath) {
  if (isdir(currentPath)) {
    if (isfile(join(currentPath, "package.json"))) return currentPath;
  } else {
    currentPath = dirname(currentPath);
    if (isfile(join(currentPath, "package.json"))) return currentPath;
  }
  while (currentPath !== dirname(currentPath)) {
    currentPath = dirname(currentPath);
    if (isfile(join(currentPath, "package.json"))) return currentPath;
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
    } catch (parseError) {
      const strictContent = processedContent
        .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":')
        .replace(/\n/g, "\\n")
        .replace(/\t/g, "\\t");
      return JSON.parse(strictContent);
    }
  } catch (error) {
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
  } catch {
    return undefined;
  }
}
async function arf(filename, option = "utf8") {
  try {
    const data = await fs.promises.readFile(xpath(filename), option);
    return data;
  } catch (error) {
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
  } catch (error) {
    console.error("写入" + filename + "文件失败:", error);
  }
}
async function amkdir(dir) {
  try {
    return await fs.promises.mkdir(dir, { recursive: true });
  } catch (err) {
    console.error(err.message);
  }
}
async function aisdir(path) {
  try {
    const stats = await fs.promises.lstat(path);
    return stats.isDirectory();
  } catch (err) {
    console.error.bind({ info: -1 })(err.message);
    return;
  }
}
async function aisfile(path) {
  try {
    const stats = await fs.promises.lstat(path);
    return stats.isFile();
  } catch (err) {
    return;
  }
}
async function adir(path) {
  try {
    return await fs.promises.readdir(path);
  } catch (err) {
    console.error(err.message);
    return;
  }
}
async function aexist(path) {
  try {
    await fs.promises.access(path);
    return true;
  } catch {
    return false;
  }
}
async function arm(targetPath, confirm = false) {
  try {
    if (confirm) await prompt(`确认删除? ${targetPath} `);
    await fs.promises.stat(targetPath);
    await fs.promises.rm(targetPath, { recursive: true });
    return true;
  } catch (err) {
    return;
  }
}
/**
 * 纳秒计时,由于封装函数调用计时,有10微秒|10000n往上的波动开销,跟使用console.time相当
 * 需要精确还是直接用process.hrtime.bigint() (误差1微妙|1000n)
 * @param {*} fn
 */
async function timelog(fn) {
  const start = performance.now();
  await fn();
  console.log(performance.now() - start + "ms");
}
/**
 * 使当前执行暂停指定的毫秒数。
 *
 * @param {number} ms - 暂停的时间，以毫秒为单位。
 * @returns {Promise<void>} 一个在指定时间后解决的 Promise 对象,使用await暂停,线程阻塞。
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * 按照指定的时间间隔重复执行函数，并在达到指定的总持续时间后停止。
 *
 * @param {Function} fn - 要执行的回调函数。
 * @param {number} ms - 两次函数执行之间的时间间隔，以毫秒为单位。
 * @param {number} [PX] - 可选参数，总持续时间，以毫秒为单位。超过此时间后将停止执行。因函数有运行时间,通常运行次数是PX/ms-1向上取整
 */
async function interval(fn, ms, PX) {
  const start = Date.now();
  let id = setInterval(() => {
    if (PX && Date.now() - start > PX) {
      clearInterval(id);
    } else fn();
  }, ms);
}
/**
 * 将file:///形式的url转换为绝对路径,初始开发场景为解决stack中的file:///格式
 * @param {string} url
 */
function fileurl2path(url) {
  return (url = url
    .slice(url.indexOf("file:///"))
    .replace(/\:\d.*$/, "")
    .slice(slice_len_file));
}
/**
 * 强大可靠的路径处理
 * 使用此函数的最大好处是安全省心!符合逻辑,不用处理尾巴带不带/,../裁切,不能灵活拼接等;用了就不怕格式错误,要错都路径问题,且最后都输出绝对路径方便检验
 * @param {string} inputPath - 目标路径（最终指向,可以是相对路径或绝对路径）
 * @param {string} [basePath=exedir] - 辅助路径，默认为exedir（可以是相对路径或绝对路径）
 * @returns {string} 绝对路径在前,相对路径在后,最终都转换为绝对路径统一sep,方便比较路径
 */
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
    } else {
      basePath = exedir;
    }
    let resPath;
    if (targetPath.startsWith("file:///"))
      resPath = normalize(targetPath.slice(slice_len_file));
    else if (isAbsolute(targetPath)) {
      resPath = normalize(targetPath);
    } else {
      resPath = join(basePath, targetPath);
    }
    if (separator === "/") {
      if (slice_len_file === 7) return resPath;
      else return resPath.split(sep).join("/");
    }
    if (separator === "\\") {
      if (slice_len_file === 8) return resPath;
      else return resPath.split(sep).join("\\");
    }
    return resPath.split(sep).join(separator);
  } catch (error) {
    console.error(error);
  }
}
/**
 * 递归复制文件或目录
 * @param {string} oldPath - 源路径
 * @param {string} newPath - 目标路径
 * @throws {Error} 当路径不存在或复制过程出错时抛出异常
 */
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
    } else if (stats.isFile()) {
      const targetDir = dirname(newPath);
      fs.mkdirSync(targetDir, { recursive: true });
      fs.copyFileSync(oldPath, newPath);
    } else {
      throw new Error(`不支持的文件类型: ${oldPath}`);
    }
  } catch (error) {
    throw new Error(`复制失败 "${oldPath}" -> "${newPath}": ${error.message}`);
  }
}
/**
 * 删除指定路径的文件或文件夹（同步方法）。
 * @param {string} targetPath - 要删除的文件或文件夹路径，支持相对路径或绝对路径。
 * @returns {undefined} - 无返回值。如果删除失败，会打印错误信息。
 */
function rm(targetPath) {
  try {
    const stats = fs.statSync(targetPath);
    fs.rmSync(targetPath, { recursive: true });
    return true;
  } catch (err) {
    return;
  }
}
/**
 * 检查指定路径是否存在（同步方法）。
 * @param {string} path - 要检查的路径，支持文件或目录路径。
 * @returns {boolean} - 如果路径存在返回 `true`，否则返回 `false`。发生错误时打印错误信息。
 */
function exist(path) {
  try {
    return fs.existsSync(path);
  } catch (err) {
    console.error(err.message);
  }
}
/**
 * 读取目录内容（同步方法）。
 * @param {string} path - 要读取的目录路径。
 * @returns {string[]|undefined} - 返回目录中的文件和子目录名称数组。如果路径不是目录或发生错误，打印错误信息并返回 `undefined`。
 */
function dir(path) {
  try {
    return fs.readdirSync(path);
  } catch (err) {
    return;
  }
}
/**
 * 判断路径是否为文件（同步方法）。
 * @param {string} path - 要判断的路径。
 * @returns {boolean|undefined} - 如果路径是文件返回 `true`，否则返回 `false`。发生错误时打印错误信息并返回 `undefined`。
 */
function isfile(path) {
  try {
    return fs.lstatSync(path).isFile();
  } catch (err) {
    return;
  }
}
/**
 * 判断路径是否为目录（同步方法）。
 * @param {string} path - 要判断的路径。
 * @returns {boolean|undefined} - 如果路径是目录返回 `true`，否则返回 `false`。发生错误时打印错误信息并返回 `undefined`。
 */
function isdir(path) {
  try {
    return fs.lstatSync(path).isDirectory();
  } catch (err) {
    return;
  }
}
/**
 * 递归创建目录，如果路径中有不存在自动创建
 * @param {string} path
 * @returns {undefined}
 */
function mkdir(dir) {
  try {
    return fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    console.error(err.message);
  }
}
/**
 * 使用ast,删除非jsdoc注释,将代码变得紧凑
 * @param {string} code - The JavaScript code to process.
 * @returns {string} New code.
 */
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
    if (item.type == "Block" && item.value.match(/^\*\s/)) return; 
    newContent += code.slice(cursor, item.start);
    cursor = item.end;
  });
  return (newContent + code.slice(cursor)).replace(/^\s*[\r\n]/gm, "");
}
/**
 * @param {string} path
 * @returns {object}
 */
function xreq(path) {
  const require = createRequire(exefile);
  return require(path);
}
/**
 * 同步读取文件
 * @param {string} filename - 文件路径
 * @param {string} [option="utf8"] - 文件编码，默认为 "utf8"
 * @returns {string|null} 文件内容或undefined(文件不存在)
 */
function rf(filename, option = "utf8") {
  try {
    const data = fs.readFileSync(xpath(filename), option);
    return data;
  } catch (error) {
    if (error.code === "ENOENT") {
      return;
    }
  }
}
/**
 * 同步写入文件，默认覆写，append=true时为追加
 * @param {string} filename - 文件路径
 * @param {string|Buffer} data - 要写入的内容
 * @param {boolean} [append=false] - 是否追加写入，默认为false
 * @param {string} [option="utf8"] - 文件编码，默认为 "utf8"
 * @returns {boolean} 是否写入成功
 */
function wf(filename, data, append = false, option = "utf8") {
  try {
    mkdir(dirname(filename));
    append ? (option = { encoding: option, flag: "a" }) : 0;
    fs.writeFileSync(filename, data, option);
    return true;
  } catch (error) {
    console.error("写入" + filename + "文件失败:", error);
  }
}
/**
 * 批量替换字符串中的内容。
 * @param {string} str - 待替换的原字符串。
 * @param {Array<[string|RegExp, string]>} replacements - 替换规则数组，每项包含两个元素：
 * - `search`：要匹配的字符串或正则表达式。
 * - `replacement`：替换的目标字符串，支持 `$1` 等引用捕获组。
 * @returns {string} - 替换后的字符串。
 */
function mreplace(str, replacements) {
  for (const [search, replacement] of replacements) {
    str = str.replace(new RegExp(search), (...args) => {
      return replacement.replace(/(\$)?\$(\d+)/g, (...args_$) => {
        if (args_$[1]) {
          return args_$[1] + args_$[2];
        } else {
          return args[args_$[2]] || args_$[0];
        }
      });
    });
  }
  return str;
}
/**
 * 批量替换字符串，并统计替换次数和详细信息。
 * @param {string} str - 待替换的原字符串。
 * @param {Array<[string|RegExp, string]>} replacements - 替换规则数组，每项包含两个元素：
 * - `search`：要匹配的字符串或正则表达式。
 * - `replacement`：替换的目标字符串，支持 `$1` 等引用捕获组。
 * @returns {[string, Array<[number, string|RegExp]>, Array<[number, string]>]} - 返回包含以下三部分：
 * - 替换后的字符串。
 * - 替换统计数组：每项为 `[匹配次数, 对应的 search]`。
 * - 替换详情数组：每项为 `[替换位置, 替换前的内容]`。
 */
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
        } else {
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
  if (!str) return {};
  return str.split("; ").reduce((obj, pair) => {
    const [key, value] = pair.split("=");
    if (key && value) {
      obj[key] = value;
    }
    return obj;
  }, {});
}
function cookies_str(obj) {
  if (!obj || Object.keys(obj).length === 0) return "";
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
/**
 * 解析一个 cookie 字符串并返回键值对对象。
 * @param str 要解析的 cookie 字符串。
 * @returns 表示 cookies 的对象, 如果没有 cookie 字符串，则返回一个空对象。
 */
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
      } else {
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
    } else {
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
/**
 * An optimized time-to-live (TTL) map implementation with efficient memory management.
 * Provides automatic expiration of entries based on specified TTL values.
 */
class TTLMap {
  /**
   * Creates a new TTLMap instance
   * @param {Object} options - Configuration options
   * @param {number} [options.defaultTTL=Infinity] - Default TTL in milliseconds
   * @param {number} [options.cleanupInterval=1000] - Minimum time between cleanup operations in milliseconds
   */
  constructor(options = {}) {
    this.storage = new Map();
    this.expiryMap = new Map();
    this.expiryHeap = [];
    this.heapIndices = new Map();
    this.lastCleanup = Date.now();
    this.cleanupInterval = options.cleanupInterval || 1000;
    this.defaultTTL = options.defaultTTL || Infinity;
  }
  /**
   * Sets a key-value pair with an optional TTL
   * @param {any} key - The key
   * @param {any} value - The value to store
   * @param {number} [ttl] - The TTL in milliseconds (uses defaultTTL if not provided)
   * @returns {TTLMap} - Returns this instance for chaining
   */
  set(key, value, ttl) {
    if (ttl !== undefined && (!Number.isFinite(ttl) || ttl < 0)) {
      throw new Error("TTL must be a non-negative finite number");
    }
    const finalTTL = ttl === undefined ? this.defaultTTL : ttl;
    const expiryTime = finalTTL === Infinity ? Infinity : Date.now() + finalTTL;
    this.storage.set(key, value);
    this.expiryMap.set(key, expiryTime);
    if (this.heapIndices.has(key)) {
      this._removeFromHeap(key);
    }
    if (expiryTime !== Infinity) {
      const heapItem = { key, expiryTime };
      this.expiryHeap.push(heapItem);
      this.heapIndices.set(key, this.expiryHeap.length - 1);
      this._siftUp(this.expiryHeap.length - 1);
    }
    this._lazyCleanup();
    return this;
  }
  /**
   * Updates the TTL for an existing key without changing its value
   * @param {any} key - The key to update
   * @param {number} ttl - The new TTL in milliseconds
   * @returns {boolean} - True if the key was found and updated, false otherwise
   */
  updateTTL(key, ttl) {
    if (!this.storage.has(key)) {
      return false;
    }
    if (!Number.isFinite(ttl) || ttl < 0) {
      throw new Error("TTL must be a non-negative finite number");
    }
    const value = this.storage.get(key);
    this.set(key, value, ttl);
    return true;
  }
  /**
   * Gets the remaining TTL for a key in milliseconds
   * @param {any} key - The key to check
   * @returns {number|undefined} - The remaining TTL or undefined if the key doesn't exist
   */
  getTTL(key) {
    const expiryTime = this.expiryMap.get(key);
    if (expiryTime === undefined) {
      return undefined;
    }
    if (expiryTime === Infinity) {
      return Infinity;
    }
    const remaining = expiryTime - Date.now();
    if (remaining <= 0) {
      this.delete(key);
      return undefined;
    }
    return remaining;
  }
  /**
   * Gets a value by key, returning undefined if expired or not found
   * @param {any} key - The key to retrieve
   * @returns {any} - The stored value or undefined
   */
  get(key) {
    if (!this.storage.has(key)) {
      return undefined;
    }
    const expiryTime = this.expiryMap.get(key);
    if (expiryTime !== Infinity && expiryTime <= Date.now()) {
      this.delete(key);
      return undefined;
    }
    return this.storage.get(key);
  }
  /**
   * Checks if a key exists and is not expired
   * @param {any} key - The key to check
   * @returns {boolean} - True if the key exists and is not expired
   */
  has(key) {
    if (!this.storage.has(key)) {
      return false;
    }
    const expiryTime = this.expiryMap.get(key);
    if (expiryTime !== Infinity && expiryTime <= Date.now()) {
      this.delete(key);
      return false;
    }
    return true;
  }
  /**
   * Gets all unexpired keys
   * @returns {Array} - Array of keys
   */
  keys() {
    this._lazyCleanup();
    return [...this.storage.keys()];
  }
  /**
   * Gets all unexpired values
   * @returns {Array} - Array of values
   */
  values() {
    this._lazyCleanup();
    return [...this.storage.values()];
  }
  /**
   * Gets all unexpired entries as [key, value] pairs
   * @returns {Array} - Array of [key, value] pairs
   */
  entries() {
    this._lazyCleanup();
    return [...this.storage.entries()];
  }
  /**
   * Deletes a key and all its associated data
   * @param {any} key - The key to delete
   * @returns {boolean} - True if the key was found and deleted
   */
  delete(key) {
    const existed = this.storage.delete(key);
    if (!existed) {
      return false;
    }
    this.expiryMap.delete(key);
    if (this.heapIndices.has(key)) {
      this._removeFromHeap(key);
    }
    return true;
  }
  /**
   * Clears all data from the TTLMap
   */
  clear() {
    this.storage.clear();
    this.expiryMap.clear();
    this.expiryHeap = [];
    this.heapIndices.clear();
  }
  /**
   * Gets the number of unexpired items
   * @returns {number} - The count of unexpired items
   */
  get size() {
    this._lazyCleanup();
    return this.storage.size;
  }
  /**
   * Sift up operation for min-heap maintenance
   * @private
   * @param {number} index - The index to sift up from
   */
  _siftUp(index) {
    if (index === 0) return;
    const element = this.expiryHeap[index];
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const parent = this.expiryHeap[parentIndex];
      if (element.expiryTime >= parent.expiryTime) {
        break;
      }
      this.expiryHeap[index] = parent;
      this.expiryHeap[parentIndex] = element;
      this.heapIndices.set(parent.key, index);
      this.heapIndices.set(element.key, parentIndex);
      index = parentIndex;
    }
  }
  /**
   * Sift down operation for min-heap maintenance
   * @private
   * @param {number} index - The index to sift down from
   */
  _siftDown(index) {
    const heapLength = this.expiryHeap.length;
    const element = this.expiryHeap[index];
    const halfLength = Math.floor(heapLength / 2);
    while (index < halfLength) {
      let childIndex = 2 * index + 1;
      let child = this.expiryHeap[childIndex];
      const rightChildIndex = childIndex + 1;
      if (rightChildIndex < heapLength) {
        const rightChild = this.expiryHeap[rightChildIndex];
        if (rightChild.expiryTime < child.expiryTime) {
          childIndex = rightChildIndex;
          child = rightChild;
        }
      }
      if (element.expiryTime <= child.expiryTime) {
        break;
      }
      this.expiryHeap[index] = child;
      this.expiryHeap[childIndex] = element;
      this.heapIndices.set(child.key, index);
      this.heapIndices.set(element.key, childIndex);
      index = childIndex;
    }
  }
  /**
   * Removes an item from the heap by key
   * @private
   * @param {any} key - The key to remove
   */
  _removeFromHeap(key) {
    const index = this.heapIndices.get(key);
    if (index === undefined) return;
    const lastIndex = this.expiryHeap.length - 1;
    if (index === lastIndex) {
      this.expiryHeap.pop();
      this.heapIndices.delete(key);
      return;
    }
    const lastElement = this.expiryHeap.pop();
    this.expiryHeap[index] = lastElement;
    this.heapIndices.set(lastElement.key, index);
    this.heapIndices.delete(key);
    const parentIndex = index > 0 ? Math.floor((index - 1) / 2) : 0;
    if (
      index > 0 &&
      this.expiryHeap[index].expiryTime <
        this.expiryHeap[parentIndex].expiryTime
    ) {
      this._siftUp(index);
    } else {
      this._siftDown(index);
    }
  }
  /**
   * Performs lazy cleanup of expired items
   * @private
   */
  _lazyCleanup() {
    const now = Date.now();
    if (now - this.lastCleanup < this.cleanupInterval) {
      return;
    }
    while (this.expiryHeap.length > 0) {
      const top = this.expiryHeap[0];
      if (top.expiryTime > now) {
        break;
      }
      this.storage.delete(top.key);
      this.expiryMap.delete(top.key);
      const lastElement = this.expiryHeap.pop();
      this.heapIndices.delete(top.key);
      if (this.expiryHeap.length > 0 && top !== lastElement) {
        this.expiryHeap[0] = lastElement;
        this.heapIndices.set(lastElement.key, 0);
        this._siftDown(0);
      }
    }
    this.lastCleanup = now;
  }
  /**
   * Manually triggers a cleanup of all expired items
   * @returns {number} - Number of items removed
   */
  cleanup() {
    const sizeBefore = this.storage.size;
    const now = Date.now();
    while (this.expiryHeap.length > 0) {
      const top = this.expiryHeap[0];
      if (top.expiryTime > now) {
        break;
      }
      this.delete(top.key);
    }
    this.lastCleanup = now;
    return sizeBefore - this.storage.size;
  }
  /**
   * Iterator implementation to allow for...of loops
   */
  [Symbol.iterator]() {
    this._lazyCleanup();
    return this.storage.entries();
  }
}
const ttl = new TTLMap();
