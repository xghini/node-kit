import kit from "@ghini/kit/dev";
import Redis from "ioredis";
import crypto from "crypto";
kit.xconsole();

const server = kit.hs();
const redis = new Redis();
console.log(await redis.hgetall("user:admin@xship.top"));

const RESEND_API_KEY = "re_BAAEebqp_LsB31AKvRrT3XwWsrHvjDvP4"; //xship.top
// cookie 或 jwt
server.addr("/v1/user/profile", "post", async (gold) => {
  gold.json(await redis.hgetall("user:admin@xship.top"));
});
server.addr("/v1/auth/register", "post", async (gold) => {
  // user:admin@xship.top @123321 18812345678
  let { email, pwd, phone } = gold.data;
  const hashKey = "user:" + email;
  const fields = ["pwd", pwd, "phone", phone, "regdate", getDate(8)];
  // 使用Lua脚本一次连接搞定 ：检查键是否存在，如果不存在则创建
  const luaScript = `
    if redis.call('EXISTS', KEYS[1]) == 0 then
      redis.call('HSET', KEYS[1], unpack(ARGV))
      return 1
    else
      return 0
    end
  `;
  const result = await redis.eval(luaScript, 1, hashKey, ...fields);
  if (result === 1) {
    gold.json("注册成功");
  } else {
    gold.json("用户已存在");
  }
});
server.addr("/v1/auth/resetpwd", "post", (gold) => {
  gold.end("resetpwd");
});
server.addr("/v1/auth/login", "post", (gold) => {
  let { email, pwd } = gold.data;
  const hashKey = "user:" + email;
  redis.hgetall(hashKey, (err, res) => {
    if (err || !res || res.pwd !== pwd) {
      gold.json("账号或密码错误");
    } else {
      // 生成免密token 返回cookie
      const token = generateToken(email);
      redis.setex("token:" + token, 3888000, email, (err) => {
        if (err) {
          gold.json("服务器错误，请稍后再试");
        } else {
          gold.respond({
            "Set-Cookie": `auth_token=${token}; Max-Age=3888000; HttpOnly; Path=/; Secure; SameSite=Strict`,
          });
          gold.json("登录成功");
        }
      });
    }
  });
});
server.addr("/v1/auth/sendemail", "post", async (gold) => {
  const subject =
    gold.data.type === "register" ? "注册验证码" : "重置密码验证码";
  const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333; text-align: center;">XShip ${subject}</h2>
        <div style="background-color: #f8f9fa; border-radius: 5px; padding: 20px; margin: 20px 0;">
          <p style="color: #666; font-size: 16px;">您的验证码是：</p>
          <p style="color: #333; font-size: 24px; font-weight: bold; text-align: center; letter-spacing: 5px;">
            $-{code}
          </p>
          <p style="color: #666; font-size: 14px;">验证码有效期为5分钟，请勿泄露给他人。</p>
        </div>
        <p style="color: #999; font-size: 12px; text-align: center;">
          此邮件由系统自动发送，请勿回复
        </p>
      </div>
    `;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "XShip <admin@xship.top>",
      to: gold.data.to,
      subject,
      html,
    }),
  });
  if (!response.ok) {
    gold.end("Failed to send email");
  }
  gold.json(response);
});

function getDate(offset = 8) {
  const now = new Date(); // 当前时间
  const beijingTime = new Date(now.getTime() + offset * 60 * 60 * 1000); // UTC 时间加 8 小时
  return beijingTime.toISOString().replace("T", " ").substring(0, 19); // 格式化为 'YYYY-MM-DD HH:MM:SS'
}
// Token 生成函数
function generateToken(email) {
  return crypto
    .createHash("sha256")
    .update(email + Date.now() + Math.random())
    .digest("hex");
}
