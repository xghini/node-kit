export { queue };
/**
 * 创建一个支持并发和速率控制的任务队列。
 * @param {number} num - 最大并发数量。默认为1。
 * @param {object} [options] - 配置选项。
 * @param {number} [options.minInterval=0] - 两个任务开始执行之间的最小时间间隔（毫秒）。
 * @returns {function(function): Promise} 返回一个任务添加函数。
 *
 * @example
 * // 最多3个并发，且每两个任务之间至少间隔100ms
 * const run = queue(3, { minInterval: 100 });
 * await run(() => myAsyncTask());
 */
function queue(num = 1, options = {}) {
  if (typeof num !== "number" || num < 1) {
    throw new TypeError("并发数(num)必须是一个大于等于1的数字。");
  }
  const { minInterval = 0 } = options;
  const taskQueue = [];
  const availableWorkerIds = Array.from({ length: num }, (_, i) => i);
  let nextAvailableSlotTime = Date.now();
  function next() {
    if (availableWorkerIds.length === 0 || taskQueue.length === 0) return;
    const workerId = availableWorkerIds.shift();
    const now = Date.now();
    const scheduledTime = Math.max(now, nextAvailableSlotTime);
    const delay = scheduledTime - now;
    nextAvailableSlotTime = scheduledTime + minInterval;
    setTimeout(async () => {
      const { task, resolve, reject } = taskQueue.shift();
      try {
        resolve(await task(workerId));
      } catch (error) {
        reject(error);
      } finally {
        availableWorkerIds.push(workerId);
        next();
      }
    }, delay);
  }
  return (task) => {
    return new Promise((resolve, reject) => {
      taskQueue.push({ task, resolve, reject });
      next(); 
    });
  };
}