import { readFile } from "fs/promises";
import { resolve, dirname } from "path";
import kit from "../../dev/main.js";
kit.xconsole();

export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfigError";
  }
}

/**
 * 解析环境变量文件内容
 * @param {string} content - env文件内容
 * @returns {Object} 解析后的配置对象
 */
function parseEnvContent(content) {
  const config = {};

  const lines = content.split("/n");

  for (const line of lines) {
    // 跳过空行和注释
    if (!line || line.startsWith("#")) continue;
    // 解析 KEY=VALUE 格式
    const [key, ...values] = line.split("=");
    const value = values.join("=").trim();
    // 移除可能存在的引号
    const cleanValue = value.replace(/^["']|["']$/g, "");

    if (key) {
      config[key.trim()] = cleanValue;
    }
  }

  return config;
}

/**
 * 读取并解析环境变量文件
 * @param {string} [path='.env'] - env文件路径
 * @param {Object} [options] - 配置选项
 * @param {boolean} [options.required=true] - 文件是否必须存在
 * @returns {Promise<Object>} 解析后的配置对象
 * @throws {ConfigError} 当文件不存在且required为true时抛出错误
 */
export async function loadEnvFile(path = ".env", options = { required: true }) {
  try {
    // const absolutePath = resolve(process.cwd(), path);
    const absolutePath = resolve(dirname(process.argv[1]), path);
    console.log(absolutePath);
    const content = await readFile(absolutePath, "utf-8");
    return parseEnvContent(content);
  } catch (error) {
    if (error.code === "ENOENT" && !options.required) {
      return {};
    }
    throw new ConfigError(`无法读取环境变量文件 ${path}: ${error.message}`);
  }
}

// 使用示例:
let config = await kit.aloadenv(".env");
console.log(config);
console.log(config.test);
// config=await kit.aloadyml('C:/Users/pznfo/AppData/Roaming/io.github.clash-verge-rev.clash-verge-rev/profiles/RPiN4hi9CSuT.yaml');
// console.log(config);
// console.log(config.rules);
// config=await kit.aloadyml('C:/Code/dev/Docker/aichat/docker-compose.yml');
// console.log(config);
// console.log(kit.xpath(".env", "abi"));
config=await kit.aloadjson('C:/Code/dev/Node/npm@ghini/kit/tsconfig.json')
// config=await kit.aloadjson('C:/Code/dev/Node/npm@ghini/kit/package.json')
console.log(config)
