// 让我们用一个实际的例子来测试：
const obj1 = {
  team1: { salary: 1000, bonus: 200 },
  team2: { salary: 2000 }
};

const obj2 = {
  team1: { bonus: 300 },
  team3: { salary: 1500, bonus: 400 }
};

console.log(addTwoDimensionalObjects(obj1, obj2));
/*
输出:
{
  team1: { salary: 1000, bonus: 500 },
  team2: { salary: 2000, bonus: 0 },
  team3: { salary: 1500, bonus: 400 }
}
*/



function addobjs(...objects) {
  const keys = [...new Set(objects.flatMap((obj) => Object.keys(obj)))];
  return keys.reduce((result, key) => {
    result[key] = objects.reduce((sum, obj) => sum + (obj[key] || 0), 0);
    return result;
  }, {});
}



function addTwoDimensionalObjects(...objects) {
  // 第一步：收集所有可能的第一维度和第二维度的键
  const level1Keys = [...new Set(objects.flatMap((obj) => Object.keys(obj)))];
  const level2Keys = [
    ...new Set(
      objects.flatMap((obj) =>
        Object.values(obj).flatMap((innerObj) => Object.keys(innerObj))
      )
    ),
  ];
  // 第二步：构建结果对象
  const result = {};
  // 第三步：对每个第一维度的键进行处理
  level1Keys.forEach((key1) => {
    result[key1] = {};
    // 对每个第二维度的键进行处理
    level2Keys.forEach((key2) => {
      // 计算所有对象在这个位置的值的和
      result[key1][key2] = objects.reduce((sum, obj) => {
        // 如果第一维度的键不存在，返回0
        if (!obj[key1]) return sum;
        // 如果第二维度的键不存在，返回0
        return sum + (obj[key1][key2] || 0);
      }, 0);
    });
  });

  return result;
}