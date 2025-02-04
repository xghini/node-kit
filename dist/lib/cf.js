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
            throw new Error("域名未找到或权限不足");
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
    const [pre, ip] = str.split(" ");
    const host = pre + "." + this.domain;
    res = await req(`https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records?type=A&name=${host}`, { auth: this.auth });
    if (res.data.result.length > 0) {
        res = await req(`https://api.cloudflare.com/client/v4/zones/${this.zid}/dns_records/${res.data.result[0].id} put`, {
            auth: this.auth,
            json: {
                type: "A",
                name: host,
                content: ip,
                proxied: false,
            },
        });
        console.log(`${host}`, res.data.success ? "修改成功" : res.data.errors[0].message);
    }
    else {
        console.log(`${host}`, "域名未找到或权限不足,尝试添加");
        await add.bind({
            auth: this.auth,
            zid: this.zid,
        })({
            type: "A",
            name: host,
            content: ip,
        });
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
