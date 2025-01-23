import kit from "@ghini/kit/dev";
export default () => {
  // 容易变动
  console.log("cwd:", process.cwd());
  // 比较牢固指向库文件(库path当下自用)
  console.log("meta:", import.meta);
  // 通过传递指向当前文件(库提供封装,动态调用)
  console.log("stack:", kit.callfile());
  console.log("stack:", kit.callroot());
  console.log("stack:", kit.metaroot());
  kit.h2s(3333);
};
