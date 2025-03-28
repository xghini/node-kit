import { req } from "./http/req.js";
export { cf };
async function cf(obj) {
    const auth = "Bearer " + obj.key;
    const domain = obj.domain;
    const zid = await getZoneId.bind({ auth, domain })();
    return {
        auth,
        domain,
        zid,
        getZoneId,
        add,
        madd,
        set,
        mset,
        del,
        mdel,
    };
}
let res;
async function getZoneId() {
    try {
        console.log(this);
        const res = await req(`https://api.cloudflare.com/client/v4/zones?name=${this.domain}`, { auth: this.auth });
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
        let processedStr = '';
        let inQuotes = false;
        for (let i = 0; i < str.length; i++) {
            const char = str.charAt(i);
            if (char === '"') {
                inQuotes = !inQuotes;
                processedStr += char;
            }
            else if (char === ' ') {
                processedStr += inQuotes ? '{+}' : char;
            }
            else {
                processedStr += char;
            }
        }
        processedStr = processedStr.replace(/ +/g, ' ').trim();
        const parts = processedStr.split(' ');
        pre = parts[0];
        if (parts[1] && parts[1].startsWith('"')) {
            let quoteContent = parts[1];
            let contentEndIndex = 1;
            if (!parts[1].endsWith('"') || parts[1].length <= 1) {
                for (let i = 2; i < parts.length; i++) {
                    quoteContent += ' ' + parts[i];
                    contentEndIndex = i;
                    if (parts[i].endsWith('"'))
                        break;
                }
            }
            content = '"' + quoteContent.substring(1, quoteContent.length - 1).replace(/\{\+\}/g, ' ') + '"';
            type = parts[contentEndIndex + 1] || 'A';
            priority = parts[contentEndIndex + 2] || 10;
            ttl = parts[contentEndIndex + 3] || 60;
        }
        else {
            content = parts[1] || '';
            type = parts[2] || 'A';
            priority = parts[3] || 10;
            ttl = parts[4] || 60;
        }
    }
    const host = pre + "." + this.domain;
    try {
        let res = await req(`https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records?type=${type}&name=${host}`, { auth: this.auth });
        if (res.data.result.length > 0) {
            const record = res.data.result[0];
            const recordId = record.id;
            const recordTtl = (ttl === 'auto' || isNaN(parseInt(ttl))) ? 60 : (parseInt(ttl) || 60);
            res = await req(`https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records/${recordId} put`, {
                auth: this.auth,
                json: {
                    type: type || "A",
                    name: host,
                    content,
                    proxied: false,
                    priority: parseInt(priority) || 10,
                    ttl: recordTtl,
                },
            });
            console.log(`${host}`, res.data.success ? "修改成功" : res.data.errors[0].message);
        }
        else {
            const recordTtl = (ttl === 'auto' || isNaN(parseInt(ttl))) ? 60 : (parseInt(ttl) || 60);
            await add.bind({
                auth: this.auth,
                zid: this.zid,
            })({
                type: type || "A",
                name: host,
                content,
                proxied: false,
                priority: parseInt(priority) || 10,
                ttl: recordTtl,
            });
        }
    }
    catch (error) {
        console.error(`操作 ${host} 时出错:`, error.message);
    }
}
async function madd(arr) {
    return Promise.all(arr.map((item) => this.add(item)));
}
async function add(json) {
    res = await req(`https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records post`, {
        auth: this.auth,
        json,
    });
    console.log(json.name, res.data.success ? "添加成功" : res.data.errors[0].message);
}
async function mdel(arr) {
    return Promise.all(arr.map((item) => this.del(item)));
}
async function del(pre) {
    const host = pre + "." + this.domain;
    let res = await req(`https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records?type=A&name=${host}`, { auth: this.auth });
    const recordId = res.data.result[0]?.id;
    if (!recordId) {
        console.log(`记录 ${host} 不存在，跳过删除`);
        return;
    }
    res = await res.req(`https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records/${recordId} delete`);
    console.log(`删除${host}: ${res.data.success ? "成功" : "失败"}`);
}
