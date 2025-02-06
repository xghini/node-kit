// lua.js
import { rf, xpath } from "../basic.js";
function load(path) {
  return rf(xpath(path, import.meta.dirname))
}
export default {
  query: load("lua/query.lua"),
  sum: load("lua/sum.lua"),
};
