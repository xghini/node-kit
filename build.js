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
      console.dev(`Processed: ${inputPath} -> ${outputPath}`);
    }
  });
}
// clearDir("./src");
// clearDir("./dist");
rm("./src");
rm("./dist");
traverseAndProcess("./dev", "./src");

// 根据当前日期生成版本号格式：年.月.日时分
function generateVersionFromDate() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2); // 获取年份后两位
  const month = (now.getMonth() + 1).toString() // 月份(1-12)
  const day = now.getDate().toString(); // 日(1-31)
  const hours = now.getHours().toString().padStart(2, '0'); // 小时(00-23)
  const minutes = now.getMinutes().toString().padStart(2, '0'); // 分钟(00-59)
  const seconds = now.getSeconds().toString().padStart(2, '0'); // 秒(00-59)
  
  return `${year}.${month}.${day}${hours}${minutes}${seconds}`;
}

// 读取 package.json
// console.log(rf("./package.json"));
const packageJson = JSON.parse(rf("./package.json"));

// 更新版本号为日期格式
const newVersion = generateVersionFromDate();
// 更新 package.json 中的版本号
packageJson.version = newVersion;

// 将更新后的 package.json 写回文件
// 原配置拷贝一份
// cp("./package.json", "./package.jsonc");
wf("./package.json", JSON.stringify(packageJson, null, 2));
// process.stdin.resume();