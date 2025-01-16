export { cs, csm, cdev, cdebug, cinfo, cwarn, clog, cerror, prompt, style };
/**
 * error 错误处理
 * log 日常输出
 * warn 警告
 * info 信息
 * debug 调试
 * dev(自定义) 开发环境输出,需要特别设置,默认不输出
 *
 * 普通输出console.log() (优先级100)
 * 强化输出cs() (优先级50)
 * 开发隐藏输出console.log.bind({info: -1})() (优先级10)
 * 强化输出带opt指明() (优先级5)
 */
const sep_file = process.platform == "win32" ? "file:///" : "file://"; 
console.sm = csm; 
console.dev = cdev.bind({ info: -1}); 
const originalDebug = console.debug;
const originalInfo = console.info;
const originalWarn = console.warn;
const originalLog = console.log;
const originalError = console.error;
const reset = "\x1b[0m"; 
const bold = "\x1b[1m"; 
const dim = "\x1b[2m"; 
const underline = "\x1b[4m"; 
const reverse = "\x1b[7m"; 
const hidden = "\x1b[8m"; 
const black = "\x1b[30m"; 
const red = "\x1b[31m"; 
const green = "\x1b[32m"; 
const yellow = "\x1b[33m"; 
const blue = "\x1b[34m"; 
const magenta = "\x1b[35m"; 
const cyan = "\x1b[36m"; 
const white = "\x1b[37m"; 
const brightBlack = "\x1b[90m";
const brightRed = "\x1b[91m";
const brightGreen = "\x1b[92m";
const brightYellow = "\x1b[93m";
const brightBlue = "\x1b[94m";
const brightMagenta = "\x1b[95m";
const brightCyan = "\x1b[96m";
const brightWhite = "\x1b[97m";
const bgBlack = "\x1b[40m"; 
const bgRed = "\x1b[41m"; 
const bgGreen = "\x1b[42m"; 
const bgYellow = "\x1b[43m"; 
const bgBlue = "\x1b[44m"; 
const bgMagenta = "\x1b[45m"; 
const bgCyan = "\x1b[46m"; 
const bgWhite = "\x1b[47m"; 
const bgBrightBlack = "\x1b[100m";
const bgBrightRed = "\x1b[101m";
const bgBrightGreen = "\x1b[102m";
const bgBrightYellow = "\x1b[103m";
const bgBrightBlue = "\x1b[104m";
const bgBrightMagenta = "\x1b[105m";
const bgBrightCyan = "\x1b[106m";
const bgBrightWhite = "\x1b[107m";
const style = {
  reset,
  bold,
  dim,
  underline,
  reverse,
  hidden,
  black,
  red,
  green,
  yellow,
  blue,
  magenta,
  cyan,
  white,
  brightBlack,
  brightRed,
  brightGreen,
  brightYellow,
  brightBlue,
  brightMagenta,
  brightCyan,
  brightWhite,
  bgBlack,
  bgRed,
  bgGreen,
  bgYellow,
  bgBlue,
  bgMagenta,
  bgCyan,
  bgWhite,
  bgBrightBlack,
  bgBrightRed,
  bgBrightGreen,
  bgBrightYellow,
  bgBrightBlue,
  bgBrightMagenta,
  bgBrightCyan,
  bgBrightWhite,
};
const csconf = {
  info: 6,
  line: 4, 
  xinfo: undefined,
  xline: undefined,
};
function arvg_final(arvg) {
  return arvg.map((item) => {
    if (typeof item === "number") item += "";
    return item;
  });
}
function arvg_final_sm(arvg) {
  return arvg.map((item) => {
    if (typeof item === "number") item += "";
    else if (typeof item === "object") {
      return JSON.stringify(
        item,
        (key, value) => {
          if (typeof value === "string" && value.length > 400)
            return value.slice(0, 200) + ` ...TOTAL:${value.length}`; 
          return value;
        },
        2
      );
    }
    if (item?.length > 200)
      item = item.slice(0, 100) + "... total:" + item.length;
    return item;
  });
}
function preStyle(opt, mainstyle) {
  let pre;
  if (opt == console) opt = undefined;
  const info = opt?.xinfo || csconf.xinfo || opt?.info || csconf.info; 
  let line = opt?.xline || csconf.xline || opt?.line || csconf.line;
  if (typeof line !== "number") line = 4;
  switch (info) {
    case 0:
      return;
    case 1:
      pre = `${reset} `;
      break;
    case 2:
      pre = `${black}[${getTimestamp()}]: ` + mainstyle;
      break;
    case 3:
      pre = `${blue}${getLineInfo(line)}: ` + mainstyle;
      break;
    default:
      pre =
        `${black}[${getTimestamp()}] ${dim}${blue}${getLineInfo(line)}: ` +
        mainstyle;
  }
  return pre;
}
function csm(...args) {
  let pre = preStyle(this, `${reset}`);
  if (!pre) return;
  process.stdout.write(pre);
  originalLog(...arvg_final_sm(args), `${reset}`);
}
function cdev(...args) {
  let pre = preStyle(this, `${cyan}[dev] ${reset}${dim}${yellow}`);
  if (!pre) return;
  process.stdout.write(pre);
  originalLog(...arvg_final(args), `${reset}`);
}
function cdebug(...args) {
  let pre = preStyle(this, `${reset}${brightYellow}`);
  if (!pre) return;
  process.stdout.write(pre);
  originalInfo(...arvg_final(args), `${reset}`);
}
function cinfo(...args) {
  let pre = preStyle(this, `${reset}${bold}${brightWhite}`);
  if (!pre) return;
  process.stdout.write(pre);
  originalInfo(...arvg_final(args), `${reset}`);
}
function cwarn(...args) {
  let pre = preStyle(this, `${reset}${bold}${brightMagenta}`);
  if (!pre) return;
  process.stdout.write(pre);
  originalWarn(...arvg_final(args), `${reset}`);
}
function clog(...args) {
  let pre = preStyle(this, `${reset}`);
  if (!pre) return;
  process.stdout.write(pre);
  originalLog(...arvg_final(args), `${reset}`);
}
function cerror(...args) {
  let pre = preStyle(this, `${reset}${dim}${red}`);
  if (!pre) return;
  process.stdout.write(pre);
  originalError(
    ...args.map((item) => {
      if (item instanceof Error) {
        const stack = item.stack.split("\n");
        return (
          stack[0] +
          " " +
          underline +
          (stack.slice(1).find((item) => item.match("//")) || stack[1]).split(
            "at "
          )[1] +
          reset +
          mainstyle
        );
      } else if (typeof item === "number") {
        return item + "";
      }
      return item;
    }),
    `${reset}`
  );
}
/**
 * 重写或扩展控制台输出方法，支持带时间戳和调用行号的 `console.log` 和 `console.error`。
 * @param {number} [rewrite=2] - 是否重写全局 `console.log` 和 `console.error` 方法,重写等级,默认2。
 * @returns {{ log: Function, error: Function }} - 返回扩展的日志方法：
 * - `log(...args: any[]): void` 用于日志输出。
 * - `error(...args: any[]): void` 用于错误输出。
 */
function cs(config) {
  if (config === null || (typeof config === "number" && config < 0)) {
    console.debug = originalDebug;
    console.info = originalInfo;
    console.warn = originalWarn;
    console.log = originalLog;
    console.error = originalError;
    return;
  } else if (Array.isArray(config)) {
    csconf.info = config[0];
    csconf.line = config[1];
    csconf.xinfo = config[2];
    csconf.xline = config[3];
  } else if (typeof config === "object") {
    config.info ? (csconf.info = config.info) : 0;
    config.line ? (csconf.line = config.line) : 0;
    config.xinfo ? (csconf.xinfo = config.xinfo) : 0;
    config.xline ? (csconf.xline = config.xline) : 0;
  } else if (typeof config === "number" && config >= 0) {
    csconf.info = config;
  }
  console.debug = cdebug;
  console.info = cinfo;
  console.warn = cwarn;
  console.log = clog;
  console.error = cerror;
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
  const arr = new Error().stack.split("\n");
  let res = arr[i]?.split("(").at(-1).split(sep_file).at(-1);
  if (res?.endsWith(")")) res = res.slice(0, -1);
  if (!res) originalLog(555, arr);
  return res;
}
