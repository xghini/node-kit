import { rf, xpath, metaroot } from "../basic.js";
function load(path) {
  return rf(xpath(path, metaroot + "/store/lua"));
}
export default {
  hquery: load("hquery.lua"),
  hsql: load("hsql.lua"),
  sum: load("sum.lua"),
};
