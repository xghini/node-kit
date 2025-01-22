import zlib from "zlib"; //异步
// import { zstd_compress, zstd_decompress } from "@ghini/zstd-win"; //同步
import { promisify } from "util";
import { xreq, metaroot, xpath } from "./basic.js";
export {
  gzip,
  gunzip,
  deflate,
  inflate,
  br_compress,
  br_decompress,
  zstd_compress,
  zstd_decompress,
};
// 这里提供直接加解压,大于100m的文件建议创建编解码器流式处理.
// 由原来的函数回调变成更现代化的async语法.
// gzip可以淘汰了,deflate和zstd快,br压缩率最好.
// 将 zlib 的回调函数转换为 Promise。他们可接收字符、typeArray 或 Buffer 类型的数据.最终都会处理成buffer再编解码

/**
 * 使用 Gzip 压缩数据
 * @param {Buffer|string} data - 要压缩的数据，可以是字符串或 Buffer。
 * @returns {Promise<Buffer>} - 返回一个 Promise，解析为压缩后的 Buffer。
 */
async function gzip(data) {
  return await promisify(zlib.gzip)(data);
}

/**
 * 使用 Gzip 解压缩数据
 * @param {Buffer} compressed - 需要解压的 Gzip 压缩数据（Buffer）。
 * @returns {Promise<Buffer>} - 返回一个 Promise，解析为解压后的 Buffer。
 * @throws {Error} - 如果解压失败，将抛出错误。
 */
async function gunzip(compressed) {
  try {
    return await promisify(zlib.gunzip)(compressed);
  } catch (error) {
    throw new Error(error.message);
  }
}

/**
 * 使用 Deflate 压缩数据
 * @param {Buffer|string} data - 要压缩的数据，可以是字符串或 Buffer。
 * @returns {Promise<Buffer>} - 返回一个 Promise，解析为压缩后的 Buffer。
 */
async function deflate(data) {
  return await promisify(zlib.deflate)(data);
}

/**
 * 使用 Deflate 解压缩数据
 * @param {Buffer} compressed - 需要解压的 Deflate 压缩数据（Buffer）。
 * @returns {Promise<Buffer>} - 返回一个 Promise，解析为解压后的 Buffer。
 * @throws {Error} - 如果解压失败，将抛出错误。
 */
async function inflate(compressed) {
  try {
    return await promisify(zlib.inflate)(compressed);
  } catch (error) {
    throw new Error(error.message);
  }
}

/**
 * 使用 Brotli 压缩数据
 * @param {Buffer|string} data - 要压缩的数据，可以是字符串或 Buffer。
 * @returns {Promise<Buffer>} - 返回一个 Promise，解析为压缩后的 Buffer。
 */
async function br_compress(data) {
  return await promisify(zlib.brotliCompress)(data);
}

/**
 * 使用 Brotli 解压缩数据
 * @param {Buffer} compressed - 需要解压的 Brotli 压缩数据（Buffer）。
 * @returns {Promise<Buffer>} - 返回一个 Promise，解析为解压后的 Buffer。
 * @throws {Error} - 如果解压失败，将抛出错误。
 */
async function br_decompress(compressed) {
  try {
    return await promisify(zlib.brotliDecompress)(compressed);
  } catch (error) {
    throw new Error(error.message);
  }
}

let path = process.platform.startsWith("win")
  ? "win.node"
  : process.platform === "linux"
  ? "linux.node"
  : "darwin.node";
const zstd = xreq(xpath("store/zstd/" + path, metaroot()));
const _compress = promisify(zstd.compress);
const _decompress = promisify(zstd.decompress);
async function zstd_compress(data, compressionLevel = 13) {
  data = toUint8Array(data);
  if (compressionLevel != null && typeof compressionLevel !== "number") {
    throw new TypeError(`parameter 'compressionLevel' must be a number.`);
  }
  try {
    return await _compress(data, compressionLevel);
  } catch (e) {
    throw new Error(`zstd: ${e.message}`);
  }
}
async function zstd_decompress(data) {
  try {
    return await _decompress(data);
  } catch (e) {
    throw new Error(`zstd: ${e.message}`);
  }
}
function toUint8Array(input) {
  // 如果已经是 Uint8Array，直接返回
  if (input instanceof Uint8Array) {
    return input;
  }
  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  if (typeof input === "string") {
    return new TextEncoder().encode(input);
  }
  throw new Error("无法将该类型转换为 Uint8Array");
}
