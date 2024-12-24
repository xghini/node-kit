import kit from "@ghini/kit/dev";
import Redis from "ioredis";
// import * as auth from "./auth.js";
// import * as user from "./user.js";
import conf from "./conf.js";
import lua from "./lua.js";

kit.xconsole();
const server = kit.hs();
const redis = new Redis();

// 1.cookie:admin@xship.top cookie:admin@xship.top1
// 2.jwt
// console.log(await redis.hgetall("user:admin@xship.top"));
// cookie 或 jwt
server.addr("/v1/auth/signin", "post", signin);
server.addr("/v1/auth/captcha", captcha);
server.addr("/v1/auth/emailverify", "post", emailverify);
server.addr("/v1/auth/signup", "post", signup);
server.addr("/v1/auth/reset", "post", reset);
server.addr("/v1/user/signout", signout);
server.addr("/v1/user/signoutall", signoutall);
server.addr("/v1/user/profile", profile);

export async function signin(gold) {
  const { email, pwd } = gold.data;
  const hashKey = "user:" + email;
  let res = await redis.hgetall(hashKey);
  if (Object.keys(res).length > 0 && res.pwd === pwd) {
    // 生成免密token 返回cookie
    const token = kit.uuid();
    const fields = [
      "token",
      token,
      "agent",
      gold.headers["user-agent"],
      "ip",
      gold.ip,
      "time",
      kit.getDate(),
    ];
    const user = await redis.eval(lua.signin, 2, email, 20, ...fields);
    if (user) {
      gold.setcookie([
        `auth_token=${token};Max-Age=3888000`,
        `user=${user}; Max-Age=3888000`,
      ]);
      gold.json("登录成功");
    } else {
      gold.err("服务器错误，请稍后再试", 503);
    }
  } else {
    gold.err("账号或密码错误");
  }
}
export async function signup(gold) {
  // user:admin@xship.top @123321 18812345678
  const { email, pwd, code } = gold.data;
  const fields = [
    "pwd",
    pwd,
    "name",
    email.replace(/@.*/, ""),
    "regdate",
    kit.getDate(8),
  ];
  // 使用Lua脚本一次连接搞定 ：验证邮箱,检查键是否存在，如果不存在则创建
  const result = await redis.eval(lua.signup, 2, email, code, ...fields);
  if (result[0]) {
    const token = kit.uuid();
    const fields = [
      "token",
      token,
      "agent",
      gold.headers["user-agent"],
      "ip",
      gold.ip,
      "time",
      kit.getDate(),
    ];
    const user = await redis.eval(lua.signin, 2, email, 20, ...fields);
    gold.setcookie([
      `auth_token=${token}; Max-Age=3888000`,
      `user=${user}; Max-Age=3888000`,
    ]);
    gold.json("注册成功");
  } else {
    gold.err(result[1]);
  }
}
export async function reset(gold) {
  // 重置密码防护级别要高一些
  const { email, pwd, code } = gold.data;
  // 使用Lua脚本一次连接搞定 ：验证邮箱,检查键是否存在，如果不存在则创建
  const result = await redis.eval(lua.reset, 2, email, code, "pwd", pwd);
  if (result[0]) {
    const token = kit.uuid();
    const fields = [
      "token",
      token,
      "agent",
      gold.headers["user-agent"],
      "ip",
      gold.ip,
      "time",
      kit.getDate(),
    ];
    const user = await redis.eval(lua.signin, 2, email, 20, ...fields);
    gold.setcookie([
      `auth_token=${token}; Max-Age=3888000`,
      `user=${user}; Max-Age=3888000`,
    ]);
    gold.json("ok");
  } else {
    gold.err(result[1]);
  }
}
export async function captcha(gold) {
  // 要防止高频恶意刷,速率限制,不过nodejs这块比较弱,交给rust nginx cf等网关处理
  const { svg, code } = kit.captcha();
  const hash = kit.uuid(8);
  redis.set("captcha:" + hash, code, "EX", 300);
  gold.respond({
    "content-type": "image/svg+xml",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "set-cookie": `captchaId=${hash}; Secure; HttpOnly;Path=/; SameSite=Strict; Max-Age=300`,
  });
  gold.end(svg);
}

export async function emailverify(gold) {
  const { type, email, code } = gold.data;
  const captchaId = gold.cookie.captchaId;
  console.log(type, email, code, captchaId);
  if (!captchaId) {
    gold.err("验证码已过期");
    return;
  }
  // 验证hash,尽量减少无效请求开销,如果参数合规,携带了captchaId就要给它查一次
  if (
    code?.length === 4 &&
    /.+@.+\..+/.test(email) &&
    ["signup", "reset"].includes(type)
  ) {
    // 邮箱是否存在&&验证码校验
    const res = await redis.eval(
      lua.emailverify,
      0,
      email,
      type === "signup" ? 1 : 0,
      captchaId,
      code
    );
    if (!res[0]) {
      gold.err(res[1]);
      return;
    }
  } else {
    gold.err("参数错误");
    return;
  }
  const subject = type === "signup" ? "注册验证码" : "重置密码验证码";
  const newcode =
    type === "signup" ? kit.gchar(6, "0123456789666888") : kit.gchar(8, 2);
  const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333; text-align: center;">XShip ${subject}</h2>
        <div style="background-color: #f8f9fa; border-radius: 5px; padding: 20px; margin: 20px 0;">
          <p style="color: #666; font-size: 16px;">您的验证码是：</p>
          <p style="color: #333; font-size: 24px; font-weight: bold; text-align: center; letter-spacing: 5px;">
            ${newcode}
          </p>
          <p style="color: #666; font-size: 14px;">验证码有效期为15分钟，请勿泄露给他人。</p>
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
    gold.err("Failed to send email");
  } else {
    redis.set("verify:" + email, newcode, "EX", 900);
    gold.json("ok");
  }
}
export async function signout(gold) {
  const token = "sess:" + gold.cookie["auth_token"];
  const result = await redis.eval(
    lua.signout,
    2,
    gold.cookie["user"],
    gold.cookie["auth_token"]
  );
  if (result) {
    gold.delcookie(["auth_token", "user"]);
    gold.json("ok");
  } else {
    gold.err("需要登录");
  }
}
export async function signoutall(gold) {
  const token = "sess:" + gold.cookie["auth_token"];
  const result = await redis.eval(
    lua.signoutall,
    2,
    gold.cookie["user"],
    gold.cookie["auth_token"]
  );
  if (result) {
    gold.delcookie(["auth_token", "user"]);
    gold.json("ok");
  } else {
    gold.err("需要登录");
  }
}
async function profile(gold) {
  const result = await redis.eval(
    lua.profile,
    2,
    gold.cookie["user"],
    gold.cookie["auth_token"]
  );
  if (result) {
    const obj = {};
    for (let i = 0; i < result.length; i += 2) {
      obj[result[i]] = result[i + 1];
    }
    delete obj.pwd;
    gold.json(obj);
  } else gold.err("需要登录");
}
