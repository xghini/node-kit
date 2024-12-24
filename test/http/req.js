import kit from "@ghini/kit/dev";

const res = kit.connect("post http://localhost:5173/auth/captcha");

console.log(res);
