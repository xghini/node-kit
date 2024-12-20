export {
  // fs path相关
  rf,
  wf,
  mkdir,
  isdir,
  isfile,
  dir,
  exist,
  xpath,
  rm,
  // 异步版本
  arf,
  awf,
  amkdir,
  aisdir,
  aisfile,
  adir,
  aexist,
  arm,
  aonedir,
  aloadyml,
  aloadenv,
  aloadjson,
  //
  cookie_merge,
  cookie_obj,
  cookie_str,
  xconsole,
  xlog,
  xerr,
  mreplace,
  mreplace_calc,
  xreq,
  ast_jsbuild,
  sleep,
  interval,
  timelog,
  prompt,
};
import { createRequire } from "module";
import { parse } from "acorn";
import fs from "fs";
import path from "path";
import yaml from "yaml";
const platform = process.platform; //win32|linux|darwin
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
/*********************************************/
/**
 * Load and parse YAML file
 * @param {string} filePath - Absolute or relative path to YAML file
 * @returns {Promise<any>} Parsed YAML content
 */
async function aloadyml(filePath) {
  try {
    // Convert to absolute path if relative
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);

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
  const lines = content.split("\n");

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
 * 加载并解析 ENV 文件
 * @param {string} filePath - ENV 文件的绝对或相对路径
 * @returns {Promise<object>} 解析后的对象
 */
async function aloadenv(filePath) {
  try {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(path.dirname(process.argv[1]), filePath);

    const content = await fs.promises.readFile(absolutePath, "utf8");
    return parseENV(content);
  } catch (error) {
    throw new Error(`Error loading ENV file ${filePath}: ${error.message}`);
  }
}

async function aloadjson(filePath) {
  try {
    // 获取绝对路径
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(path.dirname(process.argv[1]), filePath);

    // 读取文件内容
    const content = await fs.promises.readFile(absolutePath, "utf8");

    // 预处理内容以移除注释
    const processedContent = content
      // 移除多行注释 /* ... */
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // 移除单行注释 // ...
      .replace(/\/\/.*/g, '')
      // 移除行尾的逗号
      .replace(/,(\s*[}\]])/g, '$1')
      // 处理多余的换行和空格
      .replace(/^\s+|\s+$/gm, '');

    // 尝试解析JSON
    try {
      return JSON.parse(processedContent);
    } catch (parseError) {
      // 如果解析失败,尝试进行更严格的处理
      const strictContent = processedContent
        // 确保属性名使用双引号
        .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":')
        // 处理未转义的换行符
        .replace(/\n/g, '\\n')
        // 处理未转义的制表符
        .replace(/\t/g, '\\t');

      return JSON.parse(strictContent);
    }
  } catch (error) {
    // 添加更多上下文信息到错误消息
    const errorMessage = `Error loading JSONC file ${filePath}: ${error.message}`;
    const enhancedError = new Error(errorMessage);
    enhancedError.code = error.code;
    enhancedError.path = absolutePath;
    throw enhancedError;
  }
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
function prompt(
  promptText = "ENTER continue , CTRL+C exit: ",
  validator = () => true,
  option
) {
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
      if (
        (code > 31 && code < 127) || // ASCII 可打印字符
        (code > 0x4e00 && code < 0x9fff) || // 常用汉字
        (code > 0x3000 && code < 0x303f) // 中文标点
      ) {
        if (option.show) process.stdout.write(char);
        inputBuffer += char;
      }
      switch (char) {
        case "\r": // 回车
        case "\n":
          process.stdout.write("\n");
          if (validator(inputBuffer)) {
            close();
            resolve(inputBuffer);
          } else {
            if (option.loop) {
              inputBuffer = "";
              process.stdout.write(promptText);
            } else {
              close();
              resolve(false);
            }
          }
          return;
        case "\b": // 退格键
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
        case "\x17": // Ctrl + 退格
          if (inputBuffer.length > 0) {
            process.stdout.clearLine();
            process.stdout.cursorTo(0);
            process.stdout.write(promptText);
            inputBuffer = "";
          }
          return;
        case "\u0003": // Ctrl + C
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
      if (
        (code > 0x3000 && code < 0x303f) || // 中文标点
        (code > 0x4e00 && code < 0x9fff)
      ) {
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
  } catch (error) {
    if (error.code === "ENOENT") {
      // console.error(filename + "文件不存在");
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
    console.error(err.message);
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
function interval(fn, ms, PX) {
  const start = Date.now();
  let id = setInterval(() => {
    if (PX && Date.now() - start > PX) {
      clearInterval(id);
    } else fn();
  }, ms);
}
/**
 * 使用此函数的最大好处是安全省心!符合逻辑,不用处理尾巴带不带/,../裁切,不能灵活拼接等;用了就不怕格式错误,要错都路径问题,且最后都输出绝对路径方便检验
 * @param {string} inputPath - 目标路径（可以是相对路径或绝对路径）
 * @param {string} [basePath=process.cwd()] - 辅助路径，默认为当前目录（可以是相对路径或绝对路径）
 * @returns {string} 绝对路径在前,相对路径在后,最终都转换为绝对路径
 */
function xpath(targetPath, basePath, separator = "/") {
  // 判断basePath是否存在,是否文件?处理为目录:继续
  try {
    if (basePath) {
      // 如果使用import.meta.url,则需要处理file:///开头的路径
      if (basePath.startsWith("file:///"))
        basePath = basePath.slice(slice_len_file);
      if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
        basePath = path.dirname(basePath);
      }
    } else {
      // basePath = import.meta.url;
      // basePath = process.cwd();
      basePath = path.dirname(process.argv[1]);
    }
    let resPath;
    // 判断targetPath是否为绝对路径,是就直接使用
    if (targetPath.startsWith("file:///"))
      targetPath = targetPath.slice(slice_len_file);
    if (path.isAbsolute(targetPath)) {
      resPath = path.normalize(targetPath);
    } else {
      // 判断basePath是否为绝对路径
      if (path.isAbsolute(basePath)) {
        resPath = path.resolve(basePath, targetPath);
      } else {
        resPath = path.resolve(
          path.dirname(process.argv[1]),
          path.join(basePath, targetPath)
        );
      }
    }
    if (separator === "/" && slice_len_file === 7) {
      return resPath.split(path.sep).join("/");
    }
    if (separator === "\\") return resPath.split("/").join("\\");
    return resPath.split(path.sep).join(separator);
  } catch (error) {
    console.error(error);
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
    // return fs.mkdirSync(path.dirname(dir), { recursive: true });
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
    if (item.type == "Block" && item.value.match(/\*(\r\n|\n)/)) return; //放过jsdoc
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
  const require = createRequire(process.argv[1]);
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
    mkdir(path.dirname(filename));
    append ? (option = { encoding: option, flag: "a" }) : 0;
    fs.writeFileSync(filename, data, option);
    // console.log(filename + "文件写入成功");
    return true;
  } catch (error) {
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
  const arr = new Error().stack.split("\n")[i].split(sep_file);
  // const res = arr[1]?.replace(/:[^:]*$/, "");
  let res = arr[1];
  if (res.endsWith(")")) res = res.slice(0, -1);
  // if (!res) console.log(arr);
  return res;
}
function xlog(...args) {
  const timeString = getTimestamp();
  const line = getLineInfo(3);
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
  // console.log(new Error().stack);
  const timeString = getTimestamp();
  const line = getLineInfo(4);
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
/**
 * 重写或扩展控制台输出方法，支持带时间戳和调用行号的 `console.log` 和 `console.error`。
 * @param {number} [rewrite=2] - 是否重写全局 `console.log` 和 `console.error` 方法,重写等级,默认2。
 * @returns {{ log: Function, err: Function }} - 返回扩展的日志方法：
 * - `log(...args: any[]): void` 用于日志输出。
 * - `err(...args: any[]): void` 用于错误输出。
 */
function xconsole(rewrite = 3) {
  console.log = xlog.bind(rewrite);
  console.error = xerr.bind(rewrite);
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
/**
 * 解析一个 cookie 字符串并返回键值对对象。
 * @param str 要解析的 cookie 字符串。
 * @returns 表示 cookies 的对象。
 */
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

/**
 * 将键值对对象转换为 cookie 字符串。
 * @param obj 要转换为 cookie 字符串的对象。
 * @returns 表示 cookies 的字符串。
 */
function cookie_str(obj) {
  return Object.entries(obj)
    .map((r) => r[0] + "=" + r[1])
    .join(";");
}
/**
 * 合并两个 cookie 字符串，第二个字符串的值会覆盖第一个字符串中的重复键。
 * @param str1 第一个 cookie 字符串。
 * @param str2 第二个 cookie 字符串。
 * @returns 合并后的 cookie 字符串。
 */
function cookie_merge(str1, str2) {
  return cookie_str({ ...cookie_obj(str1), ...cookie_obj(str2) });
}