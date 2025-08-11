export { queue };
/**
 * 创建一个并发任务队列控制器。
 * @param {number} concurrency - 最大并发数量。
 * @returns {function(function): Promise} 返回一个任务添加函数。
 * example: const run = queue(2);
 * await run((id)=>task(id))
 */
function queue(num = 3) {
  if (typeof num !== "number" || num < 1) {
    throw new TypeError("并发数(num)必须是一个大于等于1的数字。");
  }
  const taskQueue = [];
  const availableWorkerIds = Array.from({ length: num }, (_, i) => i);
  async function next() {
    if (availableWorkerIds.length === 0 || taskQueue.length === 0) return;
    const workerId = availableWorkerIds.shift();
    const { task, resolve, reject } = taskQueue.shift();
    try {
      resolve(await task(workerId));
    } catch (error) {
      reject(error);
    } finally {
      availableWorkerIds.push(workerId);
      next();
    }
  }
  return (task) => {
    return new Promise((resolve, reject) => {
      taskQueue.push({ task, resolve, reject });
      next(); 
    });
  };
}
