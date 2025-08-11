import { queue } from "@ghini/kit/dev"; // 导入 queue 函数

/**
 * 模拟异步任务，现在它能接收并打印出正在执行它的“workerID”。
 * @param {string} name - 任务名
 * @param {number} duration - 任务执行所需的毫秒数
 * @param {number} workerId - 由队列分配的worker(柜台)ID
 * @returns {Promise<string>}
 */
async function task(name, duration, workerId) {
  // 在日志中清晰地标明是哪个worker在处理哪个任务
  console.log(
    `[worker #${workerId} ▶️  ] [任务 ${name}] (耗时: ${duration}ms)`
  );
  await new Promise((resolve) => setTimeout(resolve, duration));
  console.log(`[worker #${workerId} ✅ ] [任务 ${name}]`);
  return `task ${name} 的执行结果 (由worker #${workerId} 完成)`;
}

console.log("--- 并发任务可视化测试 ---");
const run = queue(2); // 我们依然使用2个并发“worker”
// 在 run() 中，我们传入一个接收 workerId 的新函数
const results = await Promise.all([
  run((id) => task("A最慢", 10000, id)),
  run((id) => task("B较快", 2000, id)),
  run((id) => task("C中等", 5000, id)),
  run((id) => task("D中等", 6000, id)),
  run((id) => task("E最快", 1000, id)),
]);
console.log("\n--- 所有任务均已成功完成！ ---");
console.log("返回结果:", results);

