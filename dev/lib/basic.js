export {
  // path路径相关
  exefile,
  exedir,
  exeroot,
  metaroot,
  xpath,
  fileurl2path,
  // 时间相关
  stamps,
  date,  
  now,
  sleep,
  interval,
  timelog,
  ttl,
  TTLMap,
  // fs path相关 同步
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
  // 异步版本
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
  //
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
};
import { createRequire } from "module";
import { parse } from "acorn";
import fs from "fs";
import { dirname, resolve, join, normalize, isAbsolute, sep } from "path";
import yaml from "yaml";
import { exec } from "child_process";
const platform = process.platform; //win32|linux|darwin
const slice_len_file = platform == "win32" ? 8 : 7;
const exefile =
  process.env.KIT_EXEPATH || process.env.KIT_EXEFILE || process.argv[1]; //执行文件的路径,如果使用如pm2等工具需要设置,补偿process.argv[1]的修改
const exedir = dirname(exefile);
const exeroot = findPackageJsonDir(exefile);
/**
 * 当前库的rootpath
 * @returns {string} 返回当前文件所处最近nodejs项目的绝对路径
 */
const metaroot = findPackageJsonDir(import.meta.dirname);

let globalCatchError = false;
/*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/
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
    // 避免重复监听
    if (!globalCatchError) {
      console.dev("use gcatch");
      globalCatchError = true;
      // 捕获异步的未处理错误
      process.on("unhandledRejection", fn0);
      // 捕获同步的未处理错误
      process.on("uncaughtException", fn1);
    }
  } else {
    globalCatchError = false;
    process.off("unhandledRejection", fn0);
    process.off("uncaughtException", fn1);
  }
  function fn0(reason, promise) {
    // console.error("Unhandled Rejection at:");
    console.error("gcatch异步中未捕获错误:", promise, "reason:", reason);
  }
  function fn1(err) {
    // console.error("Uncaught Exception:");
    console.error("gcatch主线程未捕获错误:", err);
  }
}

/*
Date.now() msstamp
*/
// 生成各时区时间,默认北京时间
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
    // Convert to absolute path if relative
    const absolutePath = isAbsolute(filePath)
      ? filePath
      : resolve(process.cwd(), filePath);

    // Read and parse YAML file
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
    // 跳过空行、注释和导出语句
    if (
      !line.trim() ||
      line.trim().startsWith("#") ||
      line.trim().startsWith("export")
    ) {
      continue;
    }

    // 查找第一个等号的位置
    const separatorIndex = line.indexOf("=");
    if (separatorIndex !== -1) {
      const key = line.slice(0, separatorIndex).trim();
      let value = line.slice(separatorIndex + 1).trim();

      // 移除值两端的引号
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
    // 获取绝对路径
    const absolutePath = xpath(filePath);
    const content = await arf(absolutePath);

    // 预处理内容以移除注释
    const processedContent = content
      // 移除多行注释 /* ... */
      .replace(/\/\*[\s\S]*?\*\//g, "")
      // 移除单行注释 // ...
      .replace(/\/\/.*/g, "")
      // 移除行尾的逗号
      .replace(/,(\s*[}\]])/g, "$1")
      // 处理多余的换行和空格
      .replace(/^\s+|\s+$/gm, "");

    // 尝试解析JSON
    try {
      return JSON.parse(processedContent);
    } catch (parseError) {
      // 如果解析失败,尝试进行更严格的处理
      const strictContent = processedContent
        // 确保属性名使用双引号
        .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":')
        // 处理未转义的换行符
        .replace(/\n/g, "\\n")
        // 处理未转义的制表符
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
  // 检查文件夹是否含有内容,返回:第一个|null|路径不存在undefined
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
      // console.error(filename + "文件不存在");
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
    // console.error(err.message);
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
    // await fs.promises.rm(targetPath);
    await fs.promises.rm(targetPath, { recursive: true });
    return true;
  } catch (err) {
    // console.error(`删除失败: ${err.message.replace(/[\r\n]+/, "")}`);
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
  // console.log(`${dur / 1000000n}ms`);
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
  // 从file://开始,去掉末尾行号,最后根据系统去掉开头长度转化为path
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
  // 判断basePath是否存在,是否文件?处理为目录:继续
  try {
    if (basePath) {
      if (basePath.startsWith("file:///"))
        basePath = basePath.slice(slice_len_file);
      else if (!isAbsolute(basePath)) {
        // 如果存在且是个文件,dirname处理
        if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
          basePath = dirname(basePath);
        }
        basePath = join(exedir, basePath);
      }
    } else {
      basePath = exedir;
    }
    let resPath;
    // 判断targetPath是否为绝对路径,是就直接使用
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
    // 获取源文件/目录的状态
    const stats = fs.statSync(oldPath);

    if (stats.isDirectory()) {
      // 处理目录复制
      fs.mkdirSync(newPath, { recursive: true });

      // 读取并遍历目录内容
      const entries = fs.readdirSync(oldPath);
      for (const entry of entries) {
        // 构建源和目标的完整路径
        const srcPath = join(oldPath, entry);
        const destPath = join(newPath, entry);
        // 递归复制子项
        cp(srcPath, destPath);
      }
    } else if (stats.isFile()) {
      // 处理文件复制
      // 确保目标文件的父目录存在
      const targetDir = dirname(newPath);
      fs.mkdirSync(targetDir, { recursive: true });

      // 执行文件复制
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
    // if (stats.isFile()) {
    //   // 如果是文件，删除文件
    //   fs.unlinkSync(targetPath);
    // } else if (stats.isDirectory()) {
    //   // 如果是文件夹，递归删除文件夹内容
    //   fs.rmSync(targetPath, { recursive: true });
    // }
  } catch (err) {
    // console.error(`删除失败: ${err.message.replace(/[\r\n]+/, "")}`);
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
    // console.error(err.message);
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
    // console.error(err.message);
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
    // console.error(err.message);
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
    // return fs.mkdirSync(dirname(dir), { recursive: true });
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
    if (item.type == "Block" && item.value.match(/^\*\s/)) return; //放过jsdoc
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
      // console.error(filename + "文件不存在");
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
    // fs.writeFileSync()
    mkdir(dirname(filename));
    append ? (option = { encoding: option, flag: "a" }) : 0;
    fs.writeFileSync(filename, data, option);
    // console.log(filename + "文件写入成功");
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
      // 第一个是完整匹配内容，中间捕获组，最后两个参数是 offset 和原字符串，为节省运算不做切割，原版有如下下切割
      // const captures = args.slice(0, -2);
      return replacement.replace(/(\$)?\$(\d+)/g, (...args_$) => {
        // 保留$0可引用(原版无), $1 对应 captures[1], $2 对应 captures[2], 以此类推
        // 另考虑$1可能有用，$$1基本无用，可用作转义保护真正要用的$1
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
      // 第一个是完整匹配内容，中间捕获组，最后两个参数是 offset 和原字符串，为节省运算不做切割，原版有如下下切割
      // const captures = args.slice(0, -2);
      return replacement.replace(/(\$)?\$(\d+)/g, (...args_$) => {
        // 保留$0可引用(原版无), $1 对应 captures[1], $2 对应 captures[2], 以此类推
        // 另考虑$1可能有用，$$1基本无用，可用作转义保护真正要用的$1
        if (args_$[1]) {
          //(\$)不为undefined，即有转义不做变量，返回拼接
          return args_$[1] + args_$[2];
        } else {
          //正常作为变量，在范围内输出变量，否则输出原匹配即不变。
          return args[args_$[2]] || args_$[0];
        }
        // mreplace_calc('这苹果的价格为￥7',[[/￥(\d+)/,'$$1/￥$1']])
        // '这苹果的价格为￥7'.replace(/￥(\d+)/,'$$1/￥$1') 输出结果一致
      });
    });
    counts.push([count, search]);
    counts.sum += count;
  }
  // if (
  //   res[1][3][0] > 0 ||
  //   res[1][4][0] > 0 ||
  //   res[1][5][0] > 0 ||
  //   res[1][6][0] > 0
  // ) {
  //   console.log(content.length, res[1], res[2], req.url);
  // }
  return [result, counts, detail];
}

function cookies_obj(str) {
  // 如果输入为空字符串，返回空对象
  if (!str) return {};

  // 将 cookies 字符串转换为对象
  return str.split("; ").reduce((obj, pair) => {
    // 处理每一个键值对
    const [key, value] = pair.split("=");
    if (key && value) {
      // 确保键和值都存在
      obj[key] = value;
    }
    return obj;
  }, {});
}

function cookies_str(obj) {
  // 如果输入为空对象，返回空字符串
  if (!obj || Object.keys(obj).length === 0) return "";

  // 将对象转换回 cookies 字符串
  return Object.entries(obj)
    .filter(([key, value]) => key && value) // 确保键和值都存在
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

function cookies_merge(str1, str2) {
  // 将两个字符串都转换为对象
  const obj1 = cookies_obj(str1);
  const obj2 = cookies_obj(str2);

  // 合并对象，str2 的值会覆盖 str1 中的重复键
  const merged = { ...obj1, ...obj2 };

  // 转换回字符串
  return cookies_str(merged);
}

/**
 * 解析一个 cookie 字符串并返回键值对对象。
 * @param str 要解析的 cookie 字符串。
 * @returns 表示 cookies 的对象, 如果没有 cookie 字符串，则返回一个空对象。
 */
function cookie_obj(str) {
  // 定义所有可能的属性标志
  const cookieFlags = [
    "Max-Age",
    "Path",
    "Domain",
    "SameSite",
    "Secure",
    "HttpOnly",
  ];

  // 结果对象会包含两个部分
  const result = {
    value: {}, // 存储实际的数据
    flags: {}, // 存储所有的属性标志
  };

  // 解析 cookie 字符串
  str
    .split(";")
    .map((part) => part.trim())
    .forEach((part) => {
      // 处理不带等号的标志位
      if (!part.includes("=")) {
        result.flags[part] = true;
        return;
      }

      // 处理带等号的部分
      const [key, value] = part.split("=", 2).map((s) => s.trim());

      // 判断是属性标志还是实际数据
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

  // 首先添加实际的数据值
  for (const [key, value] of Object.entries(obj.value)) {
    parts.push(`${key}=${value}`);
  }

  // 然后添加属性标志
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

  // 合并结果，注意保持结构
  const merged = {
    value: { ...obj1.value, ...obj2.value }, // 合并数据值
    flags: { ...obj1.flags, ...obj2.flags }, // 合并属性标志
  };

  return cookie_str(merged);
}

// Class ======================================================================
class TTLMap {
  constructor() {
    // 主存储 过期时间存储;set时对整体惰性清理(通过最小堆优化性能),get时对目标单独检测,这样确保了ttl的正确执行和get性能
    this.storage = new Map();
    this.expiry_map = new Map();
    // 存入{key,ttl}对象,最小的往上冒泡;使用最小堆结构,定义_siftUp,_siftDown代替unshift牺牲了部分排序换取更高性能
    // 为何选最小堆而不是最大堆?最小堆的优势在于:清理时可以"早停"- 一旦发现未过期就可以安全退出,而最大堆必须检查所有可能过期的项,虽然都是 O(k * log n)，但最小堆的 k 往往更小
    this.expiry_arr = [];
    // 上次清理时间
    this.lastCleanup = Date.now();
    // 清理阈值(100ms)
    this.cleanupInterval = 100;
  }
  // 设置键值对和过期时间
  set(key, value, ttl) {
    const expiryTime = Date.now() + ttl;
    // 存储数据 添加到过期时间堆
    this.storage.set(key, value);
    this.expiry_map.set(key, expiryTime);
    this.expiry_arr.push({ key, expiryTime });
    this._siftUp(this.expiry_arr.length - 1);
    // 惰性清理
    this._lazyCleanup();
    return this;
  }
  // 获取值
  get(key) {
    // 检查是否过期
    const expiryTime = this.expiry_map.get(key);
    if (!expiryTime || expiryTime <= Date.now()) {
      this.delete(key);
      return undefined;
    }
    return this.storage.get(key);
  }
  // 删除键
  delete(key) {
    this.storage.delete(key);
    this.expiry_map.delete(key);
    return true;
  }
  // 惰性清理过期项
  _lazyCleanup() {
    const now = Date.now();
    // 控制清理频率 100ms最多触发一次
    if (now - this.lastCleanup < this.cleanupInterval) {
      return;
    }
    // 从堆顶开始清理过期项
    while (this.expiry_arr.length > 0) {
      const top = this.expiry_arr[0];
      if (top.expiryTime > now) {
        break;
      }
      // 移除过期项
      this.delete(top.key);
      this._removeFromHeap();
    }
    this.lastCleanup = now;
  }
  // ttl大的往下沉
  _siftDown(index) {
    const element = this.expiry_arr[index];
    const halfLength = this.expiry_arr.length >>> 1; // >>> 1 代替 Math.floor(x/2)
    while (index < halfLength) {
      let minIndex = (index << 1) + 1; // << 1 代替 x * 2
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
  // ttl小的往上冒
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
  // 移除堆顶元素
  _removeFromHeap() {
    const lastElement = this.expiry_arr.pop();
    if (this.expiry_arr.length > 0) {
      this.expiry_arr[0] = lastElement;
      this._siftDown(0);
    }
  }
}
const ttl = new TTLMap();
