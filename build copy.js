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
  cp,
} from "@ghini/kit/dev";
xconsole();

// 根据输入参数 默认0.0.1 增加版本号
// 获取命令行参数或使用默认增量值 0.0.1
const increment = process.argv[2] || "0.0.1";
// 读取并解析 package.json
const packageJson = JSON.parse(rf("./package.json"));
const currentVersion = packageJson.version;
if (!currentVersion) {
  throw new Error("No version field found in package.json");
}
const currentParts = currentVersion.split(".").map(Number);
const incrementParts = increment.split(".").map(Number);
const newParts = [0, 0, 0];
for (let i = 0; i < 3; i++) {
  newParts[i] = (currentParts[i] || 0) + (incrementParts[i] || 0);
}
const newVersion = newParts.join(".");
// 更新 package.json 中的版本号
packageJson.version = newVersion;
// 将更新后的 package.json 写回文件
console.log(`Version updated: ${currentVersion} -> ${newVersion}`);
// 原配置拷贝一份
cp("./package.json", "./package.jsonc");
// wf("./package.json", JSON.stringify(packageJson, null, 2));



// process.stdin.resume();
