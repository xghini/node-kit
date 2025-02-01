export {
  cs,
  csm,
  cdev,
  cdebug,
  cinfo,
  cwarn,
  clog,
  cerror,
  prompt,
  style,
  clear,
  echo,
  fresh,
};
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
// 错误跟log不一样,往往不需要重复显示,但高频请求错误会导致如此,所以使用error_map限制频率
const error_map = new Map();
const MAX_ERRORS = 1000;
const TTL = 180000;
let timer;
const sep_file = process.platform == "win32" ? "file:///" : "file://"; //win32|linux|darwin
console.sm = csm; //对长内容能简短输出 smart simple small
console.dev = cdev.bind({ info: -1 }); //
const originalDebug = console.debug;
const originalInfo = console.info;
const originalWarn = console.warn;
const originalLog = console.log;
const originalError = console.error;

const reset = "\x1b[0m"; // 重置所有样式
const bold = "\x1b[1m"; // 加粗
const dim = "\x1b[2m"; // 暗淡
const underline = "\x1b[4m"; // 下划线
// const blink = "\x1b[5m"; // 闪烁 (windows支持不佳)
const reverse = "\x1b[7m"; // 反显
const hidden = "\x1b[8m"; // 隐藏
const hidcursor = "\x1b[?25l"; // 隐藏光标
const showcursor = "\x1b[?25h"; // 显示光标
// 前景色（字体颜色）
const black = "\x1b[30m"; // 黑色(灰色)
const red = "\x1b[31m"; // 红色
const green = "\x1b[32m"; // 绿色
const yellow = "\x1b[33m"; // 黄色
const blue = "\x1b[34m"; // 蓝色
const magenta = "\x1b[35m"; // 洋红色(暗红)
const cyan = "\x1b[36m"; // 青色(暗绿)
const white = "\x1b[37m"; // 白色
// 明亮的前景色（字体颜色）
const brightBlack = "\x1b[90m";
const brightRed = "\x1b[91m";
const brightGreen = "\x1b[92m";
const brightYellow = "\x1b[93m";
const brightBlue = "\x1b[94m";
const brightMagenta = "\x1b[95m";
const brightCyan = "\x1b[96m";
const brightWhite = "\x1b[97m";
// 背景色
const bgBlack = "\x1b[40m"; // 黑
const bgRed = "\x1b[41m"; // 红
const bgGreen = "\x1b[42m"; // 绿
const bgYellow = "\x1b[43m"; // 黄
const bgBlue = "\x1b[44m"; // 蓝
const bgMagenta = "\x1b[45m"; // 洋红
const bgCyan = "\x1b[46m"; // 青
const bgWhite = "\x1b[47m"; // 白
// 明亮的背景色
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
  // blink,
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
  line: 4, // 0错误名, 1new Error, 2preStyle, 3clog, 4首次clog调用位置
  xinfo: undefined,
  xline: undefined,
};
/*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/
// 数字会影响后面的样式,将其转换为string; 还可以将长对象适当收缩显示摘要
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
            return value.slice(0, 200) + ` ... [TOTAL:${value.length}]`; // 压缩显示
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

// 简短打印
function csm(...args) {
  let pre = preStyle(this, `${reset}`);
  if (!pre) return;
  process.stdout.write(pre);
  originalLog(...arvg_final_sm(args), `${reset}`);
}
function cdev(...args) {
  let pre = preStyle(this, `${cyan}[dev] ${reset}${yellow}`);
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
  // 从源头来判断是否阻断,往往error不会太长,所以不需要hash;如果有记录且未超时return,否则记录
  const jerr = JSON.stringify(
    args.map((arg) => (arg instanceof Error ? arg.message : arg))
  );
  const now = Date.now();
  const tmp = error_map.get(jerr);
  if (tmp && now - tmp.t < TTL) return;
  // 容量控制
  if (error_map.size >= MAX_ERRORS) {
    const oldestKey = Array.from(error_map.entries()).sort(
      (a, b) => a[1].t - b[1].t
    )[0][0];
    error_map.delete(oldestKey);
  }
  error_map.set(jerr, { t: now });
  // 设置清理定时器,回头清理缓存
  if (!timer) {
    timer = setInterval(() => {
      const now = Date.now();
      error_map.forEach((v, k) => {
        if (Date.now() - v.t > TTL) error_map.delete(k);
      });
      if (!error_map.size) {
        clearInterval(timer);
        timer = undefined;
      }
    }, TTL + 15000);
  }
  const mainstyle = `${reset}${red}`;
  let pre = preStyle(this, mainstyle);
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
          // 带//的有文件路径
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
 *
 * @example 实用用法
 * cs() cs(3) 简单使用:一般性的都能显示
 * cs(66) cs(88,5) 进阶使用:两者等效,大于10后看个位,可加入第二个参数调整line
 * cs({xinfo:4,xline:5}) 可读性强的使用,与上效果一致
 * bind绑定的xinfo xline为最高优先级,不可改
 */
function cs(config, n) {
  if (config === null || (typeof config === "number" && config < 0)) {
    // 复原
    console.debug = originalDebug;
    console.info = originalInfo;
    console.warn = originalWarn;
    console.log = originalLog;
    console.error = originalError;
    return;
  } else if (typeof config === "object") {
    config.info ? (csconf.info = config.info) : 0;
    config.line ? (csconf.line = config.line) : 0;
    config.xinfo ? (csconf.xinfo = config.xinfo) : 0;
    config.xline ? (csconf.xline = config.xline) : 0;
  } else if (typeof config === "number" && config >= 0) {
    csconf.info = config;
    csconf.line = n;
    if (config > 10) {
      csconf.xinfo = config % 10;
      csconf.xline = n;
    }
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
  // if (!res) console.warn('exceed:', arr);
  return res;
}

// b用来对其自定义log,比如dev sm
function preStyle(opt, mainstyle) {
  let pre;
  if (opt == console) opt = undefined;
  // 基本开启了cs就按default来,除非有效设置
  // originalLog("opt:", opt, "csconf:", csconf);
  // 0不适用,增加运算逻辑,使用0相当于没用
  const info = opt?.xinfo || csconf.xinfo || opt?.info || csconf.info; //number else default
  let line = opt?.xline || csconf.xline || opt?.line || csconf.line;
  if (typeof line !== "number") line = 4;
  // originalLog("final csconf", info, line);
  switch (info) {
    case -1:
      return;
    case 1:
      pre = `${reset}`;
      break;
    case 2:
      pre = `${black}[${getTimestamp()}]: ` + mainstyle;
      break;
    case 3:
      pre = `${blue}${getLineInfo(line)}: ` + mainstyle;
      break;
    default:
      pre =
        `${black}[${getTimestamp()}] ${blue}${getLineInfo(line)}: ` + mainstyle;
  }
  return pre;
}
/** @param {number} [n=999] 清理的行数,默认999相当于(仅限当前窗口高度)全部清理 */
function clear(n = 999) {
  process.stdout.write(`\x1b[${n}A\r`);
  process.stdout.write("\x1b[J");
}
function fresh() {
  // 不去做宽度计算,直接输出高度的空行,然后清屏来保留之前输出
  process.stdout.write("\n".repeat(process.stdout.rows));
  process.stdout.write(`\x1b[999A\r`);
  process.stdout.write("\x1b[J");
}
// 自清除的帧渲染输出
const echo1 = {
  show: "",
  frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
  intervalId: undefined,
  stop: () => {
    clearInterval(echo1.intervalId);
    echo1.intervalId = undefined;
    clear();
    console.log(obj.show);
    process.stdout.write(showcursor);
  },
};
function echo(data) {
  if (!echo1.intervalId) {
    process.stdout.write(hidcursor);
    fresh();
  }
  let frameIndex = 0;
  echo1.show = data; //如果是对象,会保持引用
  const frames = echo1.frames;
  const length = frames.length;
  echo1.intervalId = setInterval(() => {
    const frame = frames[frameIndex % length];
    clear();
    process.stdout.write(cyan + bold + frame + reset + " ");
    console.log(echo1.show);
    frameIndex++;
  }, 100);
  return echo1;
}
