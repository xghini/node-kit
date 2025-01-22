import zlib from "zlib";
import { promisify } from "util";
import { xreq, metaroot, xpath } from "./basic.js";
export { gzip, gunzip, deflate, inflate, br_compress, br_decompress, zstd_compress, zstd_decompress, };
import { fileURLToPath } from "url";
async function gzip(data) {
    return await promisify(zlib.gzip)(data);
}
async function gunzip(compressed) {
    try {
        return await promisify(zlib.gunzip)(compressed);
    }
    catch (error) {
        throw new Error(error.message);
    }
}
async function deflate(data) {
    return await promisify(zlib.deflate)(data);
}
async function inflate(compressed) {
    try {
        return await promisify(zlib.inflate)(compressed);
    }
    catch (error) {
        throw new Error(error.message);
    }
}
async function br_compress(data) {
    return await promisify(zlib.brotliCompress)(data);
}
async function br_decompress(compressed) {
    try {
        return await promisify(zlib.brotliDecompress)(compressed);
    }
    catch (error) {
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
    }
    catch (e) {
        throw new Error(`zstd: ${e.message}`);
    }
}
async function zstd_decompress(data) {
    try {
        return await _decompress(data);
    }
    catch (e) {
        throw new Error(`zstd: ${e.message}`);
    }
}
function toUint8Array(input) {
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
