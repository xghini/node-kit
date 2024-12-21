import kit from "@ghini/kit/dev";
kit.xconsole();
const stack = new Error().stack.split("\n");
console.log(stack);
kit.xlog(555);
