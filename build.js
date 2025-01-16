import {
  ast_jsbuild,
  cs,
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
cs();
// const version = process.env.npm_config_aaa || "0.0.1";
// console.log(version,process.argv);
// process.exit(0);

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
      console.log.bind({model:3})(`Processed: ${inputPath} -> ${outputPath}`);
    }
  });
}
// clearDir("./src");
// clearDir("./dist");
rm("./src");
rm("./dist");
traverseAndProcess("./dev", "./src");

// 每次加个小版本发布 +0.0.1
const packageJson = JSON.parse(rf("./package.json"));
const parts = packageJson.version.split(".").map(Number);
parts[2]+=1;
const newVersion = parts.join(".");
// 更新 package.json 中的版本号
packageJson.version = newVersion;
// 将更新后的 package.json 写回文件
// 原配置拷贝一份
// cp("./package.json", "./package.jsonc");
wf("./package.json", JSON.stringify(packageJson, null, 2));
// process.stdin.resume();
