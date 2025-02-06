import { rf, xpath, metaroot } from "../basic.js";
function load(path) {
    return rf(xpath(path, metaroot + "/store/lua"));
}
export default {
    query: load("query.lua"),
    sum: load("sum.lua"),
};
