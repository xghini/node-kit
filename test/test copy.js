import crypto from "crypto";
console.log(change());
console.log(change1());
console.log(change2());
function change() {
  // 1. 获取当前时间的整点时间戳（对齐crontab每小时触发）
  const hourlyTimestamp = Math.floor(Date.now() / (3600 * 1000)) * 3600 * 1000;
  // 2. 转为秒级时间戳（对齐Shell的date +%s）
  const timestampSec = Math.floor(hourlyTimestamp / 1000);
  // 3. 严格字符串截断（完全对齐sed 's/..$//'）
  const truncated = timestampSec.toString().slice(0, -2);
  // 4. 添加换行符（关键！模拟echo行为）
  const input = truncated + "\n";
  // 5. 生成MD5（与md5sum完全一致）
  return crypto
    .createHash("md5")
    .update(input, "utf8") // 必须指定编码
    .digest("hex");
}

function change1() {
  const now = new Date();
  const targetTime = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    6,
    8,
    0
  ).getTime();
  let tt = now >= targetTime ? targetTime : targetTime - 24 * 60 * 60 * 1000;
  tt =
    Math.floor(tt / 1000)
      .toString()
      .slice(0, -2) + "\n";
  return crypto.createHash("md5").update(tt, "utf8").digest("hex");
}
function change2() {
  const now = new Date();
  const targetTime = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    12,
    50,
    0
  ).getTime();
  let tt = now >= targetTime ? targetTime : targetTime - 24 * 60 * 60 * 1000;
  // let tt = now;
  tt =
    Math.floor(tt / 1000)
      .toString()
      .slice(0, -2) + "\n";
  return crypto.createHash("md5").update(tt, "utf8").digest("hex");
}
