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

const myip = await kit.myip();
console.log(myip);
