import kit from "@ghini/kit/dev";
const app = await kit.hs(320);
app.addr("/", async (gold) => {
  // const { svg, code } = kit.captcha();
  // gold.respond({
  //   "content-type": "image/svg+xml",
  //   "Cache-Control": "no-cache, no-store, must-revalidate",
  // });
  // gold.end(svg);
  const { png, code } = await kit.captcha2();
  gold.respond({
    "content-type": "image/png",
    "Cache-Control": "no-cache, no-store, must-revalidate",
  });
  gold.end(png);
});
