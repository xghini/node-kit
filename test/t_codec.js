import d from "./data.js";

// async function zstd_compress(data) {
//   const compressed = await zstd.compress(data,{level:3});
//   return compressed;
// }

// async function zstd_decompress(compressedData) {
//   const decompressed = await zstd.decompress(compressedData);
//   return decompressed;
// }

/**
 * @codec
 */
import {
  gzip,
  gunzip,
  deflate,
  inflate,
  br_compress,
  br_decompress,
  zstd_compress,
  zstd_decompress,
  xpath,
  xreq,
  xconsole,
} from "@ghini/kit/dev";
xconsole();
test();

async function test() {
  let a0 = d.long;
  console.log("Original size:", Buffer.from(a0).length, "bytes");
  try {
    let start;
    console.log("\n=== Testing GZip ===");
    console.time('gzip')
    const gzipped = await gzip(a0);
    console.timeEnd('gzip')
    console.log("Compressed size:", gzipped.length, "bytes");
    console.time('gzip')
    const gzipDecoded = await gunzip(gzipped);
    console.timeEnd('gzip')
    console.log(
      "GZip compression ratio:",
      ((1 - gzipped.length / Buffer.from(a0).length) * 100).toFixed(2) + "%",
      "GZip test passed:", a0 === gzipDecoded.toString()
    );
    console.log("\n=== Testing Deflate ===");
    console.time('Deflate')
    const deflated = await deflate(a0);
    console.timeEnd('Deflate')
    console.log("Compressed size:", deflated.length, "bytes");
    console.time('Deflate')
    const deflateDecoded = await inflate(deflated);
    console.timeEnd('Deflate')
    console.log(
      "Deflate compression ratio:",
      ((1 - deflated.length / Buffer.from(a0).length) * 100).toFixed(2) + "%",
      "Deflate test passed:", a0 === deflateDecoded.toString()
    );
    console.log("\n=== Testing br ===");
    console.time('br')
    const br = await br_compress(a0);
    console.timeEnd('br')
    console.log("Compressed size:", br.length, "bytes");
    console.time('br')
    const brDecoded = await br_decompress(br);
    console.timeEnd('br')
    console.log(
      "br compression ratio:",
      ((1 - br.length / Buffer.from(a0).length) * 100).toFixed(2) + "%",
      "br test passed:", a0 === brDecoded.toString()
    );
    console.log("\n=== Testing zstd ===");
    // a0='{a:156484}'
    console.time("zstd");
    const zstd = await zstd_compress(a0);
    console.timeEnd("zstd");
    
    console.log("Compressed size:", zstd.length, "bytes");
    console.time("zstd");
    const zstdDecoded = await zstd_decompress(zstd);
    console.timeEnd("zstd");
    console.log(
      "zstd compression ratio:",
      ((1 - zstd.length / Buffer.from(a0).length) * 100).toFixed(2) + "%",
      "zstd test passed:", a0 === zstdDecoded.toString()
    );
  } catch (error) {
    console.error("Test failed:", error);
  }
}
