// 使用 Intl.DateTimeFormat 的现代实现
const getUTC8Time = () => {
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  return formatter.format(new Date()).replace(/\//g, '-');
};

// 更简短的版本(如果不需要严格的格式要求)
const getSimpleUTC8Time = () => 
  new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 19).replace('T', ' ');

// 使用示例
console.log(getUTC8Time());      // 输出: "2024-01-24 14:30:45"
console.log(getSimpleUTC8Time()); // 输出: "2024-01-24 14:30:45"