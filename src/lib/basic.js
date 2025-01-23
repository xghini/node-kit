export {
  myip,
  xpath,
  metafile,
  metadir,
  metaroot,
  fileurl2path,
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
  sleep,
  interval,
  timelog,
  getDate,
  gcatch,
  uuid,
  rint,
  rside,
  gchar,
  fhash,
  empty,
};
import { createRequire } from "module";
import { parse } from "acorn";
import fs from "fs";
import crypto from "crypto";
import { dirname, resolve, join, normalize, isAbsolute, sep } from "path";
import yaml from "yaml";
import os from "os";
const platform = process.platform; 
const slice_len_file = platform == "win32" ? 8 : 7;
let globalCatchError = false;
function myip() {
  const networkInterfaces = os.networkInterfaces();
  let arr = [];
  for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName];
    for (const infa of interfaces) {
      if (infa.family === "IPv4" && !infa.internal) {
        if (
          infa.address.startsWith("10.") || 
          infa.address.startsWith("192.168.") 
        )
          arr.push(infa.address);
        else if (infa.address.startsWith("172.")) {
          const n = infa.address.split(".")[1];
          if (n < 16 && n > 31) return infa.address;
        } else return infa.address;
      }
    }
  }
  return arr.length > 0 ? arr[0] : "127.0.0.1";
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
/**
 * empty 判断一切空,主要是{}和[],为true
 * 如果递归recursive=true,当所含内容全是空值,也判断为空返回true:
 * @example
 * empty({a:[[[[[]]]],{}],b:false,c:null,d:0,e:NaN,f:''},true) //true
 * @param {*} x
 * @param {*} recursive
 * @returns {bool}
 */
function empty(x, recursive = false) {
  if (recursive) {
    if (!x) return true;
    if (Array.isArray(x)) {
      return x.length === 0 || x.every((item) => empty(item, true));
    }
    if (typeof x === "object") {
      return (
        Object.keys(x).length === 0 ||
        Object.values(x).every((value) => empty(value, true))
      );
    }
    return false;
  }
  return !x || (typeof x === "object" && Object.keys(x).length === 0);
}
/**
 * fhash(fasthash) 生成易于识别图像验证的验证码,服务端应设置最大8位,防止堵塞 n>8?n=8:n;也可以用来随机生码测试性能
 * @param {string|Buffer|TypedArray|DataView} cx - 要计算哈希的输入数据，可以是字符串、Buffer 或其他支持的数据类型。
 * @param {string} [encode='base64url'] - 指定哈希值的输出编码格式，支持 'hex'、'base64'、'base64url' 等。
 * @param {string} [type='sha256'] - 指定哈希算法，默认使用 'sha256'，支持 'md5'、'sha1'、'sha512' 等。
 * @returns {string} 生成的哈希值，编码格式由 `encode` 参数决定。
 */
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
  } else {
    return Math.floor(Math.random() * (b + 1 - a)) + a;
  }
}
function randint(a, b = 0) {
  if (a > b) {
    return Math.floor(Math.random() * (a + 1 - b)) + b;
  } else {
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
function env(filePath) {
  try {
    if (filePath) filePath = xpath(filePath);
    else {
      let currentPath = metadir(1);
      if (isfile(join(currentPath, ".env")))
        filePath = join(currentPath, ".env");
      currentPath = findPackageJsonDir(currentPath);
      if (currentPath && isfile(join(currentPath, ".env")))
        filePath = join(currentPath, ".env");
      if (!filePath) return null;
    }
    console.log(filePath);
    const content = parseENV(rf(filePath));
    process.env = { ...content, ...process.env };
    return content;
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
 * 凡是meta路径自用不需要参数(),提供则设置(1)
 * @param {number} [n=0] 返回当前的为默认0即可,返回调用的设置n
 * @returns {string} 返回当前文件的绝对路径
 */
function metafile(n = 0) {
  const line = 2 + n;
  return fileurl2path(new Error().stack.split("\n")[line]);
}
/**
 * 凡是meta路径自用不需要参数(),提供则设置(1)
 * @param {number} [n=0] 返回当前的为默认0即可,返回调用的设置n
 * @returns {string} 返回当前文件目录的绝对路径
 */
function metadir(n = 0) {
  const line = 2 + n;
  return dirname(fileurl2path(new Error().stack.split("\n")[line]));
}
/**
 * 凡是meta路径自用不需要参数(),提供则设置(1)
 * @param {number} [n=0] 返回当前的为默认0即可,返回调用的设置n
 * @returns {string} 返回当前文件所处最近nodejs项目的绝对路径
 */
function metaroot(n = 0) {
  return findPackageJsonDir(metadir(n + 1));
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
 * @param {string} inputPath - 目标路径（可以是相对路径或绝对路径）
 * @param {string} [basePath=metadir(1)] - 辅助路径，默认为运行文件目录（可以是相对路径或绝对路径）
 * @returns {string} 绝对路径在前,相对路径在后,最终都转换为绝对路径
 */
function xpath(targetPath, basePath, separator = "/") {
  try {
    if (basePath) {
      if (basePath.startsWith("file:///"))
        basePath = basePath.slice(slice_len_file);
      if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
        basePath = dirname(basePath);
      }
    } else {
      basePath = process.cwd();
    }
    let resPath;
    if (targetPath.startsWith("file:///"))
      targetPath = targetPath.slice(slice_len_file);
    if (isAbsolute(targetPath)) {
      resPath = normalize(targetPath);
    } else {
      if (isAbsolute(basePath)) {
        resPath = resolve(basePath, targetPath);
      } else {
        resPath = resolve(process.cwd(), join(basePath, targetPath));
      }
    }
    if (separator === "/" && slice_len_file === 7) {
      return resPath.split(sep).join("/");
    }
    if (separator === "\\") return resPath.split("/").join("\\");
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
  const require = createRequire(metafile(1));
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
