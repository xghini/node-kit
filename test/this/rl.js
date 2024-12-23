// server.js
import kit from "@ghini/kit/dev";
// kit.xconsole();
const app = kit.hs(3001);
kit.h2s();
app.addr("/api/captcha", (res) => {
  const { svg, code } = kit.captcha();
  const captchaId = kit.fnv1a(code);
  res.respond({
    "content-type": "image/svg+xml",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "set-cookie": `captchaId=${captchaId}; HttpOnly; Secure; SameSite=Strict; Max-Age=300`,
  });
  res.end(svg);
});
