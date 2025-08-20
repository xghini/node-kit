// queue.js 并发队列,解决async这类异步函数才存在的并发性能和优先级问题
// 1.一个极简版本,只限制并发数（目前实现） 2.增强版本,增加 优先级、超时、on状态监控等，到时根据需求按需拓展（未来实现）
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

  // 从选项中获取最小间隔时间，默认为0（无间隔）
  const { minInterval = 0 } = options;
  const taskQueue = [];
  const availableWorkerIds = Array.from({ length: num }, (_, i) => i);
  
  // 跟踪下一个任务可以开始的时间点，初始化为当前时间
  let nextAvailableSlotTime = Date.now();

  function next() {
    // 1. 检查是否有任务和可用的worker
    if (availableWorkerIds.length === 0 || taskQueue.length === 0) return;
    
    // 2. 立即预定一个worker并取出任务（关键修复：原子操作）
    const workerId = availableWorkerIds.shift();
    const taskItem = taskQueue.shift(); // 立即从队列中取出，防止重复处理
    
    const now = Date.now();
    
    // 3. 计算任务的计划执行时间
    const scheduledTime = Math.max(now, nextAvailableSlotTime);
    const delay = scheduledTime - now;

    // 4. 立即为下一个将要被调度的任务预定开始时间
    nextAvailableSlotTime = scheduledTime + minInterval;

    // 5. 使用计算出的延迟来执行任务
    setTimeout(async () => {
      const { task, resolve, reject } = taskItem; // 使用已取出的任务
      try {
        resolve(await task(workerId));
      } catch (error) {
        reject(error);
      } finally {
        // 任务完成后，归还worker并尝试处理下一个任务
        availableWorkerIds.push(workerId);
        next();
      }
    }, delay);
  }

  // 返回的函数保持不变
  return (task) => {
    return new Promise((resolve, reject) => {
      taskQueue.push({ task, resolve, reject });
      next(); // 尝试启动任务
    });
  };
}