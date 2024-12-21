import kit from "@ghini/kit/dev";
import Redis from "ioredis";
import crypto from "crypto";
// import * as auth from "./auth.js";
// import * as user from "./user.js";
import conf from "./conf.js";
kit.xconsole();

const server = kit.hs();
const redis = new Redis();
// redis.hsetnx('user:admin@xship.top',"fff",'6aasd545')
// redis.hdel("user:admin@xship.top", "fff");
const luaScript = `
local keys = redis.call('KEYS', 'token*')
if #keys > 0 then
    return redis.call('DEL', unpack(keys))
else
    return 0
end
`;
redis.eval(luaScript,0);
// 1.cookie:admin@xship.top cookie:admin@xship.top1
// 2.jwt
// console.log(await redis.hgetall("user:admin@xship.top"));
// cookie 或 jwt
server.addr("/v1/auth/signup", "post", signup);
server.addr("/v1/auth/signin", "post", signin);
server.addr("/v1/auth/reset", "post", reset);
server.addr("/v1/auth/sendemail", "post", sendemail);
server.addr("/v1/user/signout", signout);
server.addr("/v1/user/profile", profile);

export async function signin(gold) {
  let { email, pwd } = gold.data;
  const hashKey = "user:" + email;
  redis.hgetall(hashKey, (err, res) => {
    if (err || !res || res.pwd !== pwd) {
      gold.json("账号或密码错误");
    } else {
      // 生成免密token 返回cookie
      const token = makeToken();
      redis.setex("session:" + token, 3888000, email, (err) => {
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
}
export async function signup(gold) {
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
}
export async function reset(gold) {
  gold.end("resetpwd");
}

export async function sendemail(gold) {
  let { type, email, code } = gold.data;
  const subject = type === "register" ? "注册验证码" : "重置密码验证码";
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
      Authorization: `Bearer ${conf.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "XShip <admin@xship.top>",
      to: email,
      subject,
      html,
    }),
  });
  if (!response.ok) {
    gold.end("Failed to send email");
    console.log(response);
  } else {
    gold.json(response);
  }
}
export async function signout(gold) {
  const token = "session:" + gold.cookie["auth_token"];
  const luaScript = `
    local value = redis.call("GET", KEYS[1])
    if value then
        redis.call("DEL", KEYS[1])
        return true
    end
    return nil
  `;
  const result = await redis.eval(luaScript, 1, token);
  if (result) {
    gold.respond({
      "set-cookie": "auth_token=; Path=/; HttpOnly; Max-Age=0",
    });
    gold.end("ok");
  } else {
    gold.end("需要登录");
  }
}
async function profile(gold) {
  const token = "session:" + gold.cookie["auth_token"];
  const luaScript = `
    local email = redis.call("GET", KEYS[1])
    if not email then
        return nil
    end
    return redis.call("HGETALL", "user:" .. email)
  `;
  const result = await redis.eval(luaScript, 1, token);
  if (result) {
    const obj = {};
    for (let i = 0; i < result.length; i += 2) {
      obj[result[i]] = result[i + 1];
    }
    delete obj.pwd;
    gold.json(obj);
  } else gold.end("需要登录");
}
// Token 生成函数
function makeToken(len = 16) {
  return crypto.randomBytes(len).toString("base64url");
}
function getDate(offset = 8) {
  const now = new Date(); // 当前时间
  const beijingTime = new Date(now.getTime() + offset * 60 * 60 * 1000); // UTC 时间加 8 小时
  return beijingTime.toISOString().replace("T", " ").substring(0, 19); // 格式化为 'YYYY-MM-DD HH:MM:SS'
}
