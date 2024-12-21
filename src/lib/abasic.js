export {
  xpath,
  rf,
  wf,
  mkdir,
  isdir,
  isfile,
  dir,
  exist,
  rm,
  aonedir,
  loadyml,
  loadenv,
  loadjson,
  sleep,
  interval,
  timelog,
  prompt,
};
import fs from "fs";
import path from "path";
import yaml from "yaml";
const platform = process.platform; 
/**
 * Load and parse YAML file
 * @param {string} filePath - Absolute or relative path to YAML file
 * @returns {Promise<any>} Parsed YAML content
 */
async function loadyml(filePath) {
  try {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);
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
 * 加载并解析 ENV 文件
 * @param {string} filePath - ENV 文件的绝对或相对路径
 * @returns {Promise<object>} 解析后的对象
 */
async function loadenv(filePath) {
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
async function prompt(
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
        (code > 31 && code < 127) || 
        (code > 0x4e00 && code < 0x9fff) || 
        (code > 0x3000 && code < 0x303f) 
      ) {
        if (option.show) process.stdout.write(char);
        inputBuffer += char;
      }
      switch (char) {
        case "\r": 
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
      if (
        (code > 0x3000 && code < 0x303f) || 
        (code > 0x4e00 && code < 0x9fff)
      ) {
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
  } catch (error) {
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
  } catch (error) {
    console.error("写入" + filename + "文件失败:", error);
  }
}
async function mkdir(dir) {
  try {
    return await fs.promises.mkdir(dir, { recursive: true });
  } catch (err) {
    console.error(err.message);
  }
}
async function isdir(path) {
  try {
    const stats = await fs.promises.lstat(path);
    return stats.isDirectory();
  } catch (err) {
    console.error(err.message);
    return;
  }
}
async function isfile(path) {
  try {
    const stats = await fs.promises.lstat(path);
    return stats.isFile();
  } catch (err) {
    return;
  }
}
async function dir(path) {
  try {
    return await fs.promises.readdir(path);
  } catch (err) {
    console.error(err.message);
    return;
  }
}
async function exist(path) {
  try {
    await fs.promises.access(path);
    return true;
  } catch {
    return false;
  }
}
async function rm(targetPath, confirm = false) {
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
 * 使用此函数的最大好处是安全省心!符合逻辑,不用处理尾巴带不带/,../裁切,不能灵活拼接等;用了就不怕格式错误,要错都路径问题,且最后都输出绝对路径方便检验
 * @param {string} inputPath - 目标路径（可以是相对路径或绝对路径）
 * @param {string} [basePath=process.cwd()] - 辅助路径，默认为当前目录（可以是相对路径或绝对路径）
 * @returns {string} 绝对路径在前,相对路径在后,最终都转换为绝对路径
 */
function xpath(targetPath, basePath, separator = "/") {
  try {
    if (basePath) {
      if (basePath.startsWith("file:///"))
        basePath = basePath.slice(slice_len_file);
      if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
        basePath = path.dirname(basePath);
      }
    } else {
      basePath = path.dirname(process.argv[1]);
    }
    let resPath;
    if (targetPath.startsWith("file:///"))
      targetPath = targetPath.slice(slice_len_file);
    if (path.isAbsolute(targetPath)) {
      resPath = path.normalize(targetPath);
    } else {
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