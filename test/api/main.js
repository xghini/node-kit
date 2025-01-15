import kit from "@ghini/kit/dev";
import Redis from "ioredis";
// import * as auth from "./auth.js";
// import * as user from "./user.js";
import conf from "./conf.js";
import lua from "./lua.js";
kit.xconsole(
  {dev:{model:3}}
);
const server = kit.hs();
// const server = kit.hss();
// const server = kit.h2s();

/* Redis */
// const redis = new Redis();
const redis = kit.xredis(conf.redis[0]);
// const redis1 = new Redis(conf.redis[1]);
// const redis2 = new Redis(conf.redis[2]);
// const redis3 = new Redis(conf.redis[3]);
// const redis4 = new Redis(conf.redis[4]);
// 开发期间保持同步
// redis1.flushdb();
// redis.sync(redis2,'*');
// redis.sync([redis1, redis2, redis3, redis4], "plan:*");
// redis.sync([redis1, redis2, redis3, redis4], "plan:*",{
//   hash:['upload','download'],
// });

/* Routes */
server.addr("/v1/auth/signin", "post", signin);
server.addr("/v1/auth/captcha", captcha);
server.addr("/v1/auth/emailverify", "post", emailverify);
server.addr("/v1/auth/signup", "post", signup);
server.addr("/v1/auth/reset", "post", reset);
server.addr("/v1/user/signout", signout);
server.addr("/v1/user/signoutall", signoutall);
server.addr("/v1/user/profile", profile);
server.addr("/v1/user/orderplan", orderplan);
server.addr("/v1/admin/status", status);
server.addr("/v1/subscribe", "get", subscribe);
server.addr("/hy2auth", hy2auth);
server.addr("/v1/test", test);
server.addr("/v1/test/br", br);
// console.log(server.routes);
server.addr("/test/timeout", (gold) => console.log(gold));
export async function br(gold) {
  // 返回一段br加密
  console.log("br", gold.headers);
  gold.respond({
    "content-type": "application/json",
    "content-encoding": "br",
  });
  let d0 = JSON.stringify(gold);
  let d1 = await kit.br_compress(d0);
  // let d2 = (await kit.br_decompress(d1)).toString();
  // console.dev(888, d2 === d0, d0, d2);
  // gold.end(d0);
  gold.end(d1);
}
export async function status(gold) {
  // 服务器状态查询
  if (gold.auth !== conf.auth) return;
  gold.json({
    connect_number: server.cnn,
  });
}
export async function test(gold) {
  console.log("test", gold.headers, gold.body);
  // console.log(gold.query);
  // console.log(gold.protocol);
  gold.json({
    query: gold.query,
    data: gold.data,
  });
}
export async function hy2auth(gold) {
  // { addr: '120.85.169.188:5757', auth: 'mSIusSz2Ku3YUWxB85cQa', tx: 0 }
  const res = await redis.hgetall(`plan` + gold.data.auth);
  if (kit.empty(res))
    return gold.end(JSON.stringify({ ok: false, msg: "无效的订阅" }));
  // 判断流量是否用完
  if (res.upload + res.download > res.total)
    return gold.end(JSON.stringify({ ok: false, msg: "流量已用完" }));
  gold.end(
    JSON.stringify({
      ok: true,
      id: gold.data.auth,
    })
  );
}
export async function subscribe(gold) {
  // gold.query.starlink 查相关,填响应头 无结果返回404
  if (!gold.query.starlink || gold.query.starlink.length !== 21)
    return gold.end("404");
  let path,
    agent = gold.headers["user-agent"];
  console.log(agent);
  if (agent.startsWith("ClashforWindows")) {
    path = "./clash.yaml";
  } else if (agent.match(/clash/i)) {
    path = "./clash-verge.yaml";
  } else return gold.end("404");
  // const res = await redis.eval(lua.subscribe, 1, gold.query.starlink);
  let res = await redis.hgetall("plan:" + gold.query.starlink);
  if (kit.empty(res)) return gold.end("404");
  const data = (await kit.arf(path)).replace(
    /YourStrongPassword0085/g,
    gold.query.starlink
  );
  // const filename = "星链Starlink";
  const filename = encodeURIComponent("星链Starlink");
  // console.log(res);
  gold.respond({
    ":status": 200,
    "content-type": "application/octet-stream; charset=UTF-8", // 或 application/octet-stream
    // "content-encoding": "gzip",
    "subscription-userinfo": `upload=${res.upload}; download=${res.download}; total=${res.total}; expire=${res.expire}`,
    "content-disposition": "attachment; filename*=UTF-8''" + filename,
    // "profile-web-page-url": "https://stream.topchat.vip",
  });
  gold.end(data);
}

export async function signin(gold) {
  const { email, pwd } = gold.data;
  console.dev(gold.headers, email, pwd);
  const hashKey = "user:" + email;
  let res = await redis.hgetall(hashKey);
  if (Object.keys(res).length > 0 && res.pwd === pwd) {
    // 生成免密token 返回cookie
    const token = kit.uuid(21);
    const fields = [
      "token",
      token,
      "agent",
      gold.headers["user-agent"],
      "ip",
      gold.ip,
      "ipcountry",
      gold.headers["cf-ipcountry"] || "",
      "time",
      kit.getDate(),
    ];
    const user = await redis.eval(lua.signin, 2, email, 10, ...fields);
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
    const token = kit.uuid(21);
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
    const token = kit.uuid(21);
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
  const hash = kit.uuid(10);
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
  const subject = type === "signup" ? "注册账号" : "重置密码";
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
export async function profile(gold) {
  // const result = await redis.eval(
  //   lua.profile,
  //   2,
  //   gold.cookie["user"],
  //   gold.cookie["auth_token"]
  // );
  const result = await redis.hgetall(
    "user:" + gold.cookie["user"].split(":")[0]
  );
  if (Object.keys(result).length > 0) {
    delete result.pwd;
    if (result.plans) {
      const arr = [];
      await Promise.all(
        result.plans.split(";").map(async (item) => {
          arr.push(await redis.hgetall("plan:" + item));
        })
      );
      result.plans = arr;
    }
    gold.json(result);
  } else gold.err("需要登录");
}
export async function orderplan(gold) {
  // orderplan plan:维护列表,
  const key = "plan:" + kit.uuid(21);
  const data = {
    upload: 0,
    download: 0,
    total: 107374182400,
    expire: 1762502400,
    title: "凌日拓途计划",
    type: "hy2",
    resetDate: 0,
  };
  await redis.hset(key, data);
  await redis.expireat(key, 1762502400);
  // 添加订阅,并将订阅添加到user.subscribe中
  // const res = await redis.eval(lua.orderplan, 2, key, email, ...obj2arr(data));
  // await redis.hset(key,data);
  // await redis.expireat(key,1762502400);
  // await redis.hgetall(key);
  // await redis.ttl(key);
  // const a = await redis.keys();
  // redis.hset("user:admin@xship.top", "subscribe", JSON.stringify(a));
  gold.json("ok");
}

function obj2arr(obj) {
  const arr = [];
  for (const key in data) {
    if (data.hasOwnProperty(key)) {
      //确保只处理自身属性
      arr.push(key, String(data[key])); //将值转换为字符串（Redis HSET 格式要求）
    }
  }
  return arr;
}
