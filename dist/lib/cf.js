import { req } from "./http/req.js";
export { cf };
async function cf(obj) {
    const key = obj.key;
    const domain = obj.domain;
    const email = obj.email;
    let auth, headers = {};
    if (email) {
        headers = {
            "X-Auth-Email": email,
            "X-Auth-Key": key
        };
        console.dev("使用Global API Key认证");
    }
    else {
        auth = "Bearer " + key;
        console.dev("使用API Token认证");
    }
    const zid = await getZoneId.bind({ domain, auth, headers })();
    return {
        auth,
        headers,
        domain,
        zid,
        getZoneId,
        add,
        madd,
        set,
        mset,
        del,
        mdel,
        setSecurity,
    };
}
async function getZoneId() {
    try {
        console.dev("获取Zone ID，域名:", this.domain);
        let res;
        if (this.headers && Object.keys(this.headers).length > 0) {
            res = await req(`https://api.cloudflare.com/client/v4/zones?name=${this.domain}`, {}, this.headers);
        }
        else {
            res = await req(`https://api.cloudflare.com/client/v4/zones?name=${this.domain}`, { auth: this.auth });
        }
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
async function mset(arr) {
    return Promise.all(arr.map((item) => this.set(item)));
}
async function set(str) {
    let pre, content, type, priority, ttl;
    if (Array.isArray(str)) {
        [pre, content, type, priority, ttl] = str;
    }
    else {
        let processedStr = "";
        let inQuotes = false;
        for (let i = 0; i < str.length; i++) {
            const char = str.charAt(i);
            if (char === '"') {
                inQuotes = !inQuotes;
                processedStr += char;
            }
            else if (char === " ") {
                processedStr += inQuotes ? "{+}" : char;
            }
            else {
                processedStr += char;
            }
        }
        processedStr = processedStr.replace(/ +/g, " ").trim();
        const parts = processedStr.split(" ");
        pre = parts[0];
        if (parts[1] && parts[1].startsWith('"')) {
            let quoteContent = parts[1];
            let contentEndIndex = 1;
            if (!parts[1].endsWith('"') || parts[1].length <= 1) {
                for (let i = 2; i < parts.length; i++) {
                    quoteContent += " " + parts[i];
                    contentEndIndex = i;
                    if (parts[i].endsWith('"'))
                        break;
                }
            }
            content =
                '"' +
                    quoteContent
                        .substring(1, quoteContent.length - 1)
                        .replace(/\{\+\}/g, " ") +
                    '"';
            type = parts[contentEndIndex + 1] || "A";
            priority = parts[contentEndIndex + 2] || 10;
            ttl = parts[contentEndIndex + 3] || 60;
        }
        else {
            content = parts[1] || "";
            type = parts[2] || "A";
            priority = parts[3] || 10;
            ttl = parts[4] || 60;
        }
    }
    const host = pre + "." + this.domain;
    const recordTtl = ttl === "auto" || isNaN(parseInt(ttl)) ? 60 : parseInt(ttl) || 60;
    try {
        if (!this.zid) {
            throw new Error(`无法获取Zone ID，请检查域名: ${this.domain}`);
        }
        if (type === "A" && content.includes(",")) {
            console.log(`检测到多个IP地址: ${content}`);
            const ipList = content.split(",").map(ip => ip.trim()).filter(ip => ip !== "");
            let res;
            if (this.headers && Object.keys(this.headers).length > 0) {
                res = await req(`https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records?type=${type}&name=${host}`, {}, this.headers);
            }
            else {
                res = await req(`https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records?type=${type}&name=${host}`, { auth: this.auth });
            }
            if (res.data.result && res.data.result.length > 0) {
                console.log(`找到 ${res.data.result.length} 条现有记录，删除`);
                const deletePromises = res.data.result.map(record => {
                    if (this.headers && Object.keys(this.headers).length > 0) {
                        return req(`https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records/${record.id} delete`, {}, this.headers);
                    }
                    else {
                        return req(`https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records/${record.id} delete`, { auth: this.auth });
                    }
                });
                await Promise.all(deletePromises);
            }
            console.log(`添加 ${ipList.length} 条新记录`);
            const addPromises = ipList.map(ip => {
                const recordData = {
                    type: type,
                    name: host,
                    content: ip,
                    proxied: false,
                    priority: parseInt(priority) || 10,
                    ttl: recordTtl
                };
                return add.bind({
                    auth: this.auth,
                    headers: this.headers,
                    zid: this.zid,
                })(recordData);
            });
            await Promise.all(addPromises);
            return { success: true, message: `已为 ${host} 添加 ${ipList.length} 条A记录` };
        }
        else {
            let res;
            if (this.headers && Object.keys(this.headers).length > 0) {
                res = await req(`https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records?type=${type}&name=${host}`, {}, this.headers);
            }
            else {
                res = await req(`https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records?type=${type}&name=${host}`, { auth: this.auth });
            }
            if (res.data.result && res.data.result.length > 0) {
                console.log(`找到 ${res.data.result.length} 条现有记录，删除`);
                const deletePromises = res.data.result.map(record => {
                    if (this.headers && Object.keys(this.headers).length > 0) {
                        return req(`https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records/${record.id} delete`, {}, this.headers);
                    }
                    else {
                        return req(`https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records/${record.id} delete`, { auth: this.auth });
                    }
                });
                await Promise.all(deletePromises);
            }
            console.log(`添加: ${host} ${type} ${content}`);
            const result = await add.bind({
                auth: this.auth,
                headers: this.headers,
                zid: this.zid,
            })({
                type: type || "A",
                name: host,
                content,
                proxied: false,
                priority: parseInt(priority) || 10,
                ttl: recordTtl
            });
            return { success: true, message: `已更新 ${host} 的记录` };
        }
    }
    catch (error) {
        console.error(`操作 ${host} 时出错:`, error.message);
        return { success: false, error: error.message };
    }
}
async function madd(arr) {
    return Promise.all(arr.map((item) => this.add(item)));
}
async function add(json) {
    try {
        let res;
        if (this.headers && Object.keys(this.headers).length > 0) {
            res = await req(`https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records post`, { json }, this.headers);
        }
        else {
            res = await req(`https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records post`, { auth: this.auth, json });
        }
        return res.data;
    }
    catch (error) {
        console.error(`添加记录 ${json.name} 失败:`, error.message);
        throw error;
    }
}
async function mdel(arr) {
    return Promise.all(arr.map((item) => this.del(item)));
}
async function del(pre) {
    try {
        const host = pre + "." + this.domain;
        let res;
        if (this.headers && Object.keys(this.headers).length > 0) {
            res = await req(`https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records?type=A&name=${host}`, {}, this.headers);
        }
        else {
            res = await req(`https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records?type=A&name=${host}`, { auth: this.auth });
        }
        const recordId = res.data.result[0]?.id;
        if (!recordId) {
            console.log(`记录 ${host} 不存在，跳过删除`);
            return;
        }
        if (this.headers && Object.keys(this.headers).length > 0) {
            res = await req(`https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records/${recordId} delete`, {}, this.headers);
        }
        else {
            res = await req(`https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records/${recordId} delete`, { auth: this.auth });
        }
        console.log(`删除${host}: ${res.data.success ? "成功" : "失败"}`);
        return res.data;
    }
    catch (error) {
        console.error(`删除记录失败:`, error.message);
        throw error;
    }
}
async function setSecurity(options = {}) {
    try {
        const { description = "安全规则", expression = "", action = "managed_challenge", priority = 999, } = options;
        let existingRule = null;
        let listResponse;
        if (this.headers && Object.keys(this.headers).length > 0) {
            listResponse = await req(`https://api.cloudflare.com/client/v4/zones/${this.zid}/firewall/rules`, {}, this.headers);
        }
        else {
            listResponse = await req(`https://api.cloudflare.com/client/v4/zones/${this.zid}/firewall/rules`, { auth: this.auth });
        }
        if (listResponse.data.success && listResponse.data.result.length > 0) {
            existingRule = listResponse.data.result.find(rule => rule.description === description);
        }
        let response;
        if (existingRule) {
            const filterId = existingRule.filter.id;
            let filterUpdateResponse;
            if (this.headers && Object.keys(this.headers).length > 0) {
                filterUpdateResponse = await req(`https://api.cloudflare.com/client/v4/zones/${this.zid}/filters/${filterId} put`, { json: { expression: expression, paused: false } }, this.headers);
            }
            else {
                filterUpdateResponse = await req(`https://api.cloudflare.com/client/v4/zones/${this.zid}/filters/${filterId} put`, { auth: this.auth, json: { expression: expression, paused: false } });
            }
            if (!filterUpdateResponse.data.success) {
                throw new Error(`更新过滤器失败: ${JSON.stringify(filterUpdateResponse.data.errors)}`);
            }
            if (this.headers && Object.keys(this.headers).length > 0) {
                response = await req(`https://api.cloudflare.com/client/v4/zones/${this.zid}/firewall/rules/${existingRule.id} put`, {
                    json: {
                        action: action,
                        priority: priority,
                        paused: false,
                        description: description,
                        filter: {
                            id: filterId
                        }
                    }
                }, this.headers);
            }
            else {
                response = await req(`https://api.cloudflare.com/client/v4/zones/${this.zid}/firewall/rules/${existingRule.id} put`, {
                    auth: this.auth,
                    json: {
                        action: action,
                        priority: priority,
                        paused: false,
                        description: description,
                        filter: {
                            id: filterId
                        }
                    }
                });
            }
            if (response.data.success) {
                console.log(`安全规则 "${description}" 更新成功！`);
                return response.data.result;
            }
            else {
                console.error("更新安全规则失败:", response.data.errors);
                throw new Error(JSON.stringify(response.data.errors));
            }
        }
        else {
            console.log(`未找到安全规则 "${description}"，准备创建...`);
            const requestBody = [{
                    filter: {
                        expression: expression,
                        paused: false
                    },
                    action: action,
                    priority: priority,
                    paused: false,
                    description: description
                }];
            if (this.headers && Object.keys(this.headers).length > 0) {
                response = await req(`https://api.cloudflare.com/client/v4/zones/${this.zid}/firewall/rules post`, { json: requestBody }, this.headers);
            }
            else {
                response = await req(`https://api.cloudflare.com/client/v4/zones/${this.zid}/firewall/rules post`, { auth: this.auth, json: requestBody });
            }
            if (response.data.success) {
                console.log(`安全规则 "${description}" 创建成功！`);
                return response.data.result[0];
            }
            else {
                console.error("创建安全规则失败:", response.data.errors);
                throw new Error(JSON.stringify(response.data.errors));
            }
        }
    }
    catch (error) {
        console.error("设置安全规则时出错:", error.message);
        throw error;
    }
}
