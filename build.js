import {
  ast_jsbuild,
  xconsole,
  mkdir,
  isdir,
  isfile,
  dir,
  xpath,
  rf,
  wf,
  exist,
  rm,
} from "@ghini/kit/dev";
xconsole();

// 清空指定目录下所有.js和.ts文件
function clearDir(dirPath) {
  dir(dirPath)?.forEach((file) => {
    const filePath = xpath(file, dirPath);
    if (isdir(filePath)) {
      clearDir(filePath);
    } else if (file.endsWith(".js") || file.endsWith(".ts")) {
      rm(filePath);
    }
  });
}
function traverseAndProcess(inputDir, outputDir) {
  if (!exist(outputDir)) mkdir(outputDir);
  dir(inputDir).forEach((item) => {
    const inputPath = xpath(item, inputDir);
    const outputPath = xpath(item, outputDir);
    if (isdir(inputPath)) {
      traverseAndProcess(inputPath, outputPath); // Recursive call for directories
    } else if (inputPath.endsWith(".js")) {
      const code = rf(inputPath);
      const processedCode = ast_jsbuild(code);
      wf(outputPath, processedCode);
      console.log(`Processed: ${inputPath} -> ${outputPath}`);
    }
  });
}
// clearDir("./src");
// clearDir("./dist");
rm("./src");
rm("./dist");
traverseAndProcess("./dev", "./src");
// process.stdin.resume();
