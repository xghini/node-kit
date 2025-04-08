export {
  uuid,
  rint,
  rside,
  gchar,
  fhash,
  empty,
  idhash,
  arr_uniq,
  arr_diff,
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
  const base62 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const m = BigInt(62) ** BigInt(7);
  const a = BigInt(12345678901);
  let code_num = (a * BigInt(userId)) % m;
  let digits = [];
  for (let i = 0; i < 7; i++) {
      let digit = code_num % BigInt(62);
      digits.push(base62[Number(digit)]);
      code_num = code_num / BigInt(62);
  }
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
function uuid(len = 21) {
  const byteLength = Math.ceil((len * 3) / 4);
  const randomString = crypto.randomBytes(byteLength).toString("base64url");
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
function rside() {
  return Math.random() > 0.5 ? 1 : -1;
}
function addTwoDimensionalObjects(...objects) {
  const level1Keys = [...new Set(objects.flatMap((obj) => Object.keys(obj)))];
  const level2Keys = [
    ...new Set(
      objects.flatMap((obj) =>
        Object.values(obj).flatMap((innerObj) => Object.keys(innerObj))
      )
    ),
  ];
  const result = {};
  level1Keys.forEach((key1) => {
    result[key1] = {};
    level2Keys.forEach((key2) => {
      result[key1][key2] = objects.reduce((sum, obj) => {
        if (!obj[key1]) return sum;
        return sum + (obj[key1][key2] || 0);
      }, 0);
    });
  });
  return result;
}
function obj2v1(obj2v) {
  return Object.fromEntries(
    Object.entries(obj2v).map(([key, value]) => {
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
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
        break;
      case 3: 
        characters =
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
        break;
      case 4: 
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