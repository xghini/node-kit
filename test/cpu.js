import os from "os";

// 正确的实时CPU使用率计算方法
async function getCurrentCPUUsage() {
  // 第一次采样
  const startMeasure = os.cpus();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  // 第二次采样
  const endMeasure = os.cpus();
  let idleDifference = 0;
  let totalDifference = 0;
  for (let i = 0; i < startMeasure.length; i++) {
    const startTimes = startMeasure[i].times;
    const endTimes = endMeasure[i].times;
    // 计算空闲时间差
    idleDifference += endTimes.idle - startTimes.idle;
    // 计算总时间差
    totalDifference +=
      endTimes.user -
      startTimes.user +
      (endTimes.nice - startTimes.nice) +
      (endTimes.sys - startTimes.sys) +
      (endTimes.idle - startTimes.idle) +
      (endTimes.irq - startTimes.irq);
  }
  // 计算CPU使用率
  return 100 - (idleDifference / totalDifference) * 100;
}

const usage = await getCurrentCPUUsage();
console.log(usage);
