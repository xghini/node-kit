import kit from "@ghini/kit/dev";

// 还是需要实现一个js中的缓存,map纳秒级查询（≈100ns）,redis微秒级（100μs 左右）,相差1000倍,省掉序列化和网络传输协议
/**
这个实现采用了几个关键的性能优化策略：

1.使用最小堆维护过期时间：
O(log n) 的插入和删除复杂度
能快速找到最早过期的项
比遍历所有键值对要高效得多

2.惰性清理策略：
不使用定时器，避免了定时器的开销
只在 set/get 操作时才触发清理
通过 cleanupInterval 控制清理频率，避免过于频繁的清理

3.双 Map 结构：
storage 存储实际数据
expiry_map 存储过期时间
分离数据结构使得查询更高效

4.时间戳缓存：
使用 lastCleanup 记录上次清理时间
减少 Date.now() 调用次数

5.位运算优化：
使用 >>> 1 代替 Math.floor(x/2)
使用 << 1 代替 x * 2
 */


class TTLMap {
  constructor() {
    // 主存储 过期时间存储;set时对整体惰性清理(通过最小堆优化性能),get时对目标单独检测,这样确保了ttl的正确执行和get性能
    this.storage = new Map();
    this.expiry_map = new Map();
    // 存入{key,ttl}对象,最小的往上冒泡;使用最小堆结构,定义_siftUp,_siftDown代替unshift牺牲了部分排序换取更高性能
    // 为何选最小堆而不是最大堆?最小堆的优势在于:清理时可以"早停"- 一旦发现未过期就可以安全退出,而最大堆必须检查所有可能过期的项,虽然都是 O(k * log n)，但最小堆的 k 往往更小
    this.expiry_arr = [];
    // 上次清理时间
    this.lastCleanup = Date.now();
    // 清理阈值(100ms)
    this.cleanupInterval = 100;
  }
  // 设置键值对和过期时间
  set(key, value, ttl) {
    const expiryTime = Date.now() + ttl;
    // 存储数据 添加到过期时间堆
    this.storage.set(key, value);
    this.expiry_map.set(key, expiryTime);
    this.expiry_arr.push({ key, expiryTime });
    this._siftUp(this.expiry_arr.length - 1);
    // 惰性清理
    this._lazyCleanup();
    return this;
  }
  // 获取值
  get(key) {
    // 检查是否过期
    const expiryTime = this.expiry_map.get(key);
    if (!expiryTime || expiryTime <= Date.now()) {
      this.delete(key);
      return undefined;
    }
    return this.storage.get(key);
  }
  // 删除键
  delete(key) {
    this.storage.delete(key);
    this.expiry_map.delete(key);
    return true;
  }
  // 惰性清理过期项
  _lazyCleanup() {
    const now = Date.now();
    // 控制清理频率 100ms最多触发一次
    if (now - this.lastCleanup < this.cleanupInterval) {
      return;
    }
    // 从堆顶开始清理过期项
    while (this.expiry_arr.length > 0) {
      const top = this.expiry_arr[0];
      if (top.expiryTime > now) {
        break;
      }
      // 移除过期项
      this.delete(top.key);
      this._removeFromHeap();
    }
    this.lastCleanup = now;
  }
  // ttl大的往下沉
  _siftDown(index) {
    const element = this.expiry_arr[index];
    const halfLength = this.expiry_arr.length >>> 1; // >>> 1 代替 Math.floor(x/2)
    while (index < halfLength) {
      let minIndex = (index << 1) + 1; // << 1 代替 x * 2
      let minChild = this.expiry_arr[minIndex];
      const rightIndex = minIndex + 1;
      if (rightIndex < this.expiry_arr.length) {
        const rightChild = this.expiry_arr[rightIndex];
        if (rightChild.expiryTime < minChild.expiryTime) {
          minIndex = rightIndex;
          minChild = rightChild;
        }
      }
      if (element.expiryTime <= minChild.expiryTime) {
        break;
      }
      this.expiry_arr[index] = minChild;
      index = minIndex;
    }
    this.expiry_arr[index] = element;
  }
  // ttl小的往上冒
  _siftUp(index) {
    const element = this.expiry_arr[index];
    while (index > 0) {
      const parentIndex = (index - 1) >>> 1;
      const parent = this.expiry_arr[parentIndex];
      if (element.expiryTime >= parent.expiryTime) {
        break;
      }
      this.expiry_arr[index] = parent;
      index = parentIndex;
    }
    this.expiry_arr[index] = element;
  }
  // 移除堆顶元素
  _removeFromHeap() {
    const lastElement = this.expiry_arr.pop();
    if (this.expiry_arr.length > 0) {
      this.expiry_arr[0] = lastElement;
      this._siftDown(0);
    }
  }
}

// 使用示例
// const cache = new TTLMap();
kit.ttl.set("key1", "value1", 1000); // 1秒后过期
kit.ttl.set("key1", "value1", 2000); // 1秒后过期
kit.ttl.set("key2", "value2", 2000); // 2秒后过期
kit.ttl.set("key2", "value2", 200);
kit.ttl.set("key3", "value3");
kit.ttl.set("key3", "value3", 111);
console.log(kit.ttl.get("key1"));
console.log(kit.ttl.get("key2"));
console.log(kit.ttl.get("key3"));
setTimeout(() => {
  console.log(kit.ttl.get("key1")); // undefined (已过期)
  console.log(kit.ttl.get("key2")); // "value2" (未过期)
  console.log(kit.ttl.get("key3")); // "value2" (未过期)
}, 1100);
