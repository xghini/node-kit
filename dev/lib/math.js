export {
  uuid,
  rint,
  rside,
  gchar,
  fhash,
  empty,
  idhash,
  //arr操作
  arr_uniq,
  arr_diff,
  // obj操作
  addobjs,
  obj2v1,
  addTwoDimensionalObjects,
}
import crypto from "crypto";

/**
 * 将用户ID转换为高度随机化的唯一推广码
 * @param {number} userId - 用户ID (1-10000000000)
 * @returns {string} - 唯一推广码 (保证7位及以上)
 */
function idhash(userId) {
  // 定义Base62字符集
  const base62 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  // 计算模数 m = 62^7
  const m = BigInt(62) ** BigInt(7);
  // 选择变换参数 a，与 62 互质
  const a = BigInt(12345678901);
  // 计算变换后的数字
  let code_num = (a * BigInt(userId)) % m;
  // 转换为Base62字符串
  let digits = [];
  for (let i = 0; i < 7; i++) {
      let digit = code_num % BigInt(62);
      digits.push(base62[Number(digit)]);
      code_num = code_num / BigInt(62);
  }
  // 从低位到高位生成，反转后得到最终码
  return digits.reverse().join('');
}



/** 数组去重 */
function arr_uniq(arr) {
  return [...new Set(arr)];
}
/** 数组差集 从arr1中过滤掉arr2中存在的元素 */
function arr_diff(arr1, arr2) {
  const set2 = new Set(arr2);
  return arr1.filter(x => !set2.has(x));
}


// 通用唯一识别码 Universally unique identifier,此函数21位(64^21=2^126)已强于36位的uuidv4(2^122),这里的len为最终生成字符的长度
function uuid(len = 21) {
  // 计算需要的字节数，确保生成的 base64url 字符串长度至少为 len
  const byteLength = Math.ceil((len * 3) / 4);
  const randomString = crypto.randomBytes(byteLength).toString("base64url");
  // 截取到指定长度，确保返回结果为 len
  return randomString.substring(0, len);
}

/** 每个数同等概率,随机例如-3到10 10到-3的整数,可单写5:0-5 */ 
function rint(a, b = 0) {
  if (a > b) {
    return Math.floor(Math.random() * (a + 1 - b)) + b;
  } else {
    return Math.floor(Math.random() * (b + 1 - a)) + a;
  }
}


// 返回1或-1
function rside() {
  return Math.random() > 0.5 ? 1 : -1;
}



function addTwoDimensionalObjects(...objects) {
  // 第一步：收集所有可能的第一维度和第二维度的键
  const level1Keys = [...new Set(objects.flatMap((obj) => Object.keys(obj)))];
  const level2Keys = [
    ...new Set(
      objects.flatMap((obj) =>
        Object.values(obj).flatMap((innerObj) => Object.keys(innerObj))
      )
    ),
  ];
  // 第二步：构建结果对象
  const result = {};
  // 第三步：对每个第一维度的键进行处理
  level1Keys.forEach((key1) => {
    result[key1] = {};
    // 对每个第二维度的键进行处理
    level2Keys.forEach((key2) => {
      // 计算所有对象在这个位置的值的和
      result[key1][key2] = objects.reduce((sum, obj) => {
        // 如果第一维度的键不存在，返回0
        if (!obj[key1]) return sum;
        // 如果第二维度的键不存在，返回0
        return sum + (obj[key1][key2] || 0);
      }, 0);
    });
  });

  return result;
}

// 将二维对象变一维,sum
function obj2v1(obj2v) {
  // {x:{...}}=>{x:'11mb'}
  return Object.fromEntries(
    Object.entries(obj2v).map(([key, value]) => {
      // 如果值是对象且不是数组，计算它所有数值的和
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        return [
          key,
          Object.values(value).reduce(
            (sum, val) => sum + (typeof val === "number" ? val / 1048576 : 0),
            0
          ),
        ];
      }
      // 如果不是对象，保持原值
      return [key, value];
    })
  );
}
function addobjs(...objects) {
  const keys = [...new Set(objects.flatMap((obj) => Object.keys(obj)))];
  return keys.reduce((result, key) => {
    result[key] = objects.reduce((sum, obj) => sum + (obj[key] || 0), 0);
    return result;
  }, {});
}

/**
 * fhash(fasthash) 生成易于识别图像验证的验证码,服务端应设置最大8位,防止堵塞 n>8?n=8:n;也可以用来随机生码测试性能
 * @param {string|Buffer|TypedArray|DataView} cx - 要计算哈希的输入数据，可以是字符串、Buffer 或其他支持的数据类型。
 * @param {string} [encode='base64url'] - 指定哈希值的输出编码格式，支持 'hex'、'base64'、'base64url' 等。
 * @param {string} [type='sha256'] - 指定哈希算法，默认使用 'sha256'，支持 'md5'、'sha1'、'sha512' 等。
 * @returns {string} 生成的哈希值，编码格式由 `encode` 参数决定。
 */
function fhash(cx, encode = "base64url", type = "sha256") {
  //fast-hash,nodejs原生中,sha256表现最好,安全性也高,可以通杀,开销10微秒级
  return crypto.createHash(type).update(cx).digest(encode);
}

function gchar(n = 6, characters = 0) {
  if (typeof characters === "number") {
    switch (characters) {
      case 0: //数字
        characters = "0123456789";
        break;
      case 1: //用于生成易识别的验证码,去掉了混淆字符
        characters = "23457ACDFGHJKLPQRSTUVWXY23457";
        break;
      case 2: //英文字母大小写
        characters =
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
        break;
      case 3: //base64url
        characters =
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
        break;
      case 4: //base64
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
    // 如果是 falsy 值（null, undefined, false, 0, NaN, ''），直接返回 true
    if (!x) return true;
    if (Array.isArray(x)) {
      // 数组长度为 0 或者所有元素递归判断也为空
      return x.length === 0 || x.every((item) => empty(item, true));
    }
    if (typeof x === "object") {
      // 对象没有键值对，或者所有键的值递归判断也为空
      return (
        Object.keys(x).length === 0 ||
        Object.values(x).every((value) => empty(value, true))
      );
    }
    return false;
  }
  return !x || (typeof x === "object" && Object.keys(x).length === 0);
}