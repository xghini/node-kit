// queue.js 并发队列,解决async这类异步函数才存在的并发性能和优先级问题
// 1.一个极简版本,只限制并发数（目前实现） 2.增强版本,增加 优先级、超时、on状态监控等，到时根据需求按需拓展（未来实现）
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
    // 没有可用worker或没有任务时直接返回
    if (availableWorkerIds.length === 0 || taskQueue.length === 0) return;
    // 取出最前的一个worker和任务，尝试执行
    const workerId = availableWorkerIds.shift();
    const { task, resolve, reject } = taskQueue.shift();
    try {
      // 会给task传入workerId，不需要可以不接收（忽略）
      resolve(await task(workerId));
    } catch (error) {
      reject(error);
    } finally {
      // 完成后将此worker放回可用队列
      availableWorkerIds.push(workerId);
      // 循环的关键，完成任务后继续调用处理任务
      next();
    }
  }
  // 返回一个函数，每次激活会接收任务放入queue处理并发
  return (task) => {
    return new Promise((resolve, reject) => {
      taskQueue.push({ task, resolve, reject });
      next(); //假如无可用worker，此处会直接返回，但之前的next在完成任务后还会自调用来继续完成等待中的新任务。
    });
  };
}
