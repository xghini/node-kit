export { cf2 };
import { isipv4, isipv6, queue, req, reqdata } from "../main.js";
async function cf2(obj) {
    const key = obj.key;
    const domain = obj.domain;
    const email = obj.email;
    let auth, headers = {};
    if (email) {
        headers = {
            "X-Auth-Email": email,
            "X-Auth-Key": key,
        };
    }
    else {
        auth = "Bearer " + key;
    }
    const zid = await getZoneId.bind({ domain, auth, headers })();
    return {
        auth,
        headers,
        domain,
        zid,
        getZoneId,
        dnsObj,
        find,
        add,
        del,
        set,
        madd,
        mdel,
        mset,
        security,
    };
}
const CONFIG = {
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,
};
const qrun = queue(100, { minInterval: 10 });
async function retry(fn, maxRetries = CONFIG.MAX_RETRIES, delay = CONFIG.RETRY_DELAY) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            if (error.message &&
                (error.message.includes("权限不足") ||
                    error.message.includes("认证失败") ||
                    error.message.includes("Invalid API key") ||
                    error.message.includes("unauthorized"))) {
                throw error;
            }
            if (i < maxRetries - 1) {
                const retryDelay = delay * Math.pow(2, i);
                console.log(`第 ${i + 1} 次失败，${retryDelay}ms 后重试...`);
                await new Promise((resolve) => setTimeout(resolve, retryDelay));
            }
        }
    }
    console.error(`在 ${maxRetries} 次尝试后失败`);
    throw lastError;
}
async function find(filter) {
    filter = this.dnsObj(filter, `find`);
    const sp = new URLSearchParams(filter).toString();
    const reqUrl = `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records?` + sp;
    let res = await retry(() => this.headers && Object.keys(this.headers).length > 0
        ? reqdata(reqUrl, {}, this.headers)
        : reqdata(reqUrl, { auth: this.auth }));
    res = res.result;
    if (filter) {
        res = res.filter((v) => {
            if (filter.type && v.type != filter.type)
                return;
            if (filter.content && v.content != filter.content)
                return;
            if (filter.proxiable && v.proxiable != filter.proxiable)
                return;
            if (filter.proxied && v.proxied != filter.proxied)
                return;
            if (filter.ttl && v.ttl != filter.ttl)
                return;
            if (filter.comment && v.comment != filter.comment)
                return;
            if (filter.tags && v.tags != filter.tags)
                return;
            return 1;
        });
    }
    res = res.map((v) => {
        delete v.proxiable;
        delete v.proxied;
        delete v.ttl;
        delete v.settings;
        delete v.meta;
        delete v.comment;
        delete v.tags;
        delete v.created_on;
        delete v.modified_on;
        return v;
    });
    return res;
}
async function add(str) {
    const json = this.dnsObj(str);
    const res = await retry(async () => {
        const reqUrl = `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records post`;
        return this.headers && Object.keys(this.headers).length > 0
            ? await req(reqUrl, { json }, this.headers)
            : await req(reqUrl, { auth: this.auth, json });
    });
    if (res.data.success)
        return 1;
    if (res.data.errors[0].code != 81058)
        console.error(`add失败 "${json.name}" ：`, res.data.errors[0]);
    return 0;
}
async function del(filter) {
    if (typeof filter === "object" && !filter.name && !filter.content) {
        console.warn("删除必须有name或content才能安全执行");
        return 0;
    }
    let res = await this.find(filter);
    const del_arr = res.map((v) => v.name + " " + v.type + " " + v.content);
    if (res.length === 0)
        return 0;
    res = await Promise.all(res.map((record) => qrun(() => retry(() => {
        const reqUrl = `https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records/${record.id} delete`;
        return this.headers && Object.keys(this.headers).length > 0
            ? reqdata(reqUrl, this.headers)
            : reqdata(reqUrl, { auth: this.auth });
    }))));
    console.warn(del_arr, res.length, `发生记录删除cf.del`);
    return res.length;
}
function dnsObj(dnsParam, option = "") {
    let name, content, type, priority, proxied, ttl;
    if (typeof dnsParam === "string") {
        dnsParam = dnsParam.trim().replace(/ +/g, " ").split(" ");
    }
    if (Array.isArray(dnsParam)) {
        [name, content, type, priority, proxied, ttl] = dnsParam;
    }
    else {
        ({ name, content, type, priority, proxied, ttl } = dnsParam);
    }
    if (name && !name.includes("."))
        name = name + "." + this.domain;
    if (option === "set") {
        if (!content) {
            content = name;
            name = "";
        }
        if (!type) {
            if (isipv4(content))
                type = "A";
            else if (isipv6(content))
                type = "AAAA";
            else {
                type = "TXT";
                if (content[0] != '"')
                    content = `"` + content;
                if (content.slice(-1) != `"`)
                    content += `"`;
            }
        }
        else
            type = type.toUpperCase();
        option = "find";
    }
    if (option === "find") {
        const tmp = {};
        if (name)
            tmp.name = name;
        if (content)
            tmp.content = content;
        if (type)
            tmp.type = type.toUpperCase();
        if (priority || priority === 0)
            tmp.priority = priority;
        if (proxied)
            tmp.proxied = true;
        if (ttl)
            tmp.ttl = ttl;
        dnsParam = tmp;
    }
    else {
        if (!type) {
            if (isipv4(content))
                type = "A";
            else if (isipv6(content))
                type = "AAAA";
            else {
                type = "TXT";
                if (content[0] != '"')
                    content = `"` + content;
                if (content.slice(-1) != `"`)
                    content += `"`;
            }
        }
        else
            type = type.toUpperCase();
        priority = parseInt(priority) || 10;
        proxied = proxied ? true : false;
        ttl = parseInt(ttl) || 60;
        dnsParam = {
            name,
            content,
            type,
            priority,
            proxied,
            ttl,
        };
    }
    return dnsParam;
}
async function set(filter, json) {
    filter = this.dnsObj(filter, "find");
    json = this.dnsObj(json, "set");
    if (!filter.type)
        filter.type = json.type;
    if (!json.name)
        json.name = filter.name;
    console.log(filter);
    console.log(json);
    let res = await this.find(filter);
    console.log(res);
    return;
    const json_arr = res.map((v) => {
        delete v.id;
        return {
            ...v,
            ...json,
        };
    });
    console.log(json_arr);
    return;
    if (typeof filter === "object") {
        if (!filter.name && !filter.content) {
            console.warn("set必须有name或content才能安全执行");
            return 0;
        }
        else if (!filter.name && filter.content) {
            console.log(`set object，没有name只有content，沿用原名`);
        }
    }
    else if (typeof filter === "string") {
        if (content) {
            filter = { name: filter };
            console.log(`set字符串常规情况`, filter, content);
        }
        else {
            if (filter.includes(" ") && filter.includes(",")) {
                let [name, contents, ttl] = filter
                    .trim()
                    .replace(/ +/g, " ")
                    .split(" ");
                contents = contents.split(",").filter((v) => v);
                console.log(`set字符串特定情况`, contents);
                if (contents.length > 0) {
                    await this.del(name);
                    const res = await Promise.all(contents.map((content) => qrun(() => this.add({ name, content, ttl }))));
                    return res.reduce((sum, v) => sum + v, 0);
                }
            }
        }
    }
    console.log(`set常规情况`, filter);
    await this.del(filter);
    if (content)
        filter.content = content;
    return this.add(filter);
}
async function mset(arr) {
    const grouped = new Map();
    arr.forEach((item, index) => {
        const key = Array.isArray(item) ? item[0] : item.split(" ")[0];
        if (!grouped.has(key))
            grouped.set(key, []);
        grouped.get(key).push({ item, index });
    });
    let results = new Array(arr.length);
    const groupPromises = Array.from(grouped.values()).map((group) => qrun(async () => {
        for (const { item, index } of group) {
            try {
                results[index] = await this.set(item);
            }
            catch (error) {
                results[index] = { success: false, error: error.message };
            }
        }
    }));
    await Promise.all(groupPromises);
    return results;
}
async function madd(arr) {
    const grouped = new Map();
    arr.forEach((item, index) => {
        if (!grouped.has(item.name))
            grouped.set(item.name, []);
        grouped.get(item.name).push({ item, index });
    });
    let results = new Array(arr.length);
    const groupPromises = Array.from(grouped.values()).map((group) => qrun(async () => {
        for (const { item, index } of group) {
            try {
                results[index] = await this.add(item);
            }
            catch (error) {
                results[index] = { success: false, error: error.message };
            }
        }
    }));
    await Promise.all(groupPromises);
    return results;
}
async function mdel(arr) {
    const grouped = new Map();
    arr.forEach((pre, index) => {
        if (!grouped.has(pre))
            grouped.set(pre, []);
        grouped.get(pre).push({ pre, index });
    });
    let results = new Array(arr.length);
    const groupPromises = Array.from(grouped.values()).map((group) => qrun(async () => {
        for (const { pre, index } of group) {
            try {
                results[index] = await this.del(pre);
            }
            catch (error) {
                results[index] = { success: false, error: error.message };
            }
        }
    }));
    await Promise.all(groupPromises);
    return results;
}
async function getZoneId() {
    try {
        const res = await retry(async () => {
            const reqUrl = `https://api.cloudflare.com/client/v4/zones?name=${this.domain}`;
            return this.headers && Object.keys(this.headers).length > 0
                ? await req(reqUrl, {}, this.headers)
                : await req(reqUrl, { auth: this.auth });
        });
        if (res.data.success && res.data.result.length > 0) {
            return res.data.result[0].id;
        }
        else {
            throw new Error("记录未找到或权限不足");
        }
    }
    catch (error) {
        console.error("获取 Zone ID 失败:", error.message);
        return null;
    }
}
async function security(options = {}) {
    const { description = "安全规则", expression = "", action = "managed_challenge", priority = 999, } = options;
    try {
        const listResponse = await retry(async () => {
            const reqUrl = `https://api.cloudflare.com/client/v4/zones/${this.zid}/firewall/rules`;
            return this.headers && Object.keys(this.headers).length > 0
                ? await req(reqUrl, {}, this.headers)
                : await req(reqUrl, { auth: this.auth });
        });
        const existingRule = listResponse.data.result.find((rule) => rule.description === description);
        if (existingRule) {
            const filterId = existingRule.filter.id;
            await retry(async () => {
                const reqUrl = `https://api.cloudflare.com/client/v4/zones/${this.zid}/filters/${filterId} put`;
                const json = { expression, paused: false };
                return this.headers && Object.keys(this.headers).length > 0
                    ? await req(reqUrl, { json }, this.headers)
                    : await req(reqUrl, { auth: this.auth, json });
            });
            const updateRes = await retry(async () => {
                const reqUrl = `https://api.cloudflare.com/client/v4/zones/${this.zid}/firewall/rules/${existingRule.id} put`;
                const json = {
                    action,
                    priority,
                    paused: false,
                    description,
                    filter: { id: filterId },
                };
                return this.headers && Object.keys(this.headers).length > 0
                    ? await req(reqUrl, { json }, this.headers)
                    : await req(reqUrl, { auth: this.auth, json });
            });
            console.log(`✅ 安全规则 "${description}" 更新成功！`);
            return updateRes.data.result;
        }
        else {
            const requestBody = [
                { filter: { expression }, action, priority, description },
            ];
            const createRes = await retry(async () => {
                const reqUrl = `https://api.cloudflare.com/client/v4/zones/${this.zid}/firewall/rules post`;
                return this.headers && Object.keys(this.headers).length > 0
                    ? await req(reqUrl, { json: requestBody }, this.headers)
                    : await req(reqUrl, { auth: this.auth, json: requestBody });
            });
            console.log(`✅ 安全规则 "${description}" 创建成功！`);
            return createRes.data.result[0];
        }
    }
    catch (error) {
        console.error(`[!] 设置安全规则 "${description}" 时出错:`, error.message);
        throw error;
    }
}
