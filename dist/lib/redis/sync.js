export { sync };
import { Redis } from "ioredis";
async function sync(targetRedisList, pattern, options = {}) {
    if (!Array.isArray(targetRedisList)) {
        if (targetRedisList instanceof Redis) {
            targetRedisList = [targetRedisList];
        }
        else {
            xerr("Need Redis clients");
            return;
        }
    }
    else if (targetRedisList.length === 0) {
        xerr("Need Redis clients");
        return;
    }
    let totalKeys = 0;
    let cursor = "0";
    do {
        const [newCursor, keys] = await this.scan(cursor, "MATCH", pattern, "COUNT", 1000);
        cursor = newCursor;
        if (keys.length) {
            const pipelines = targetRedisList.map((target) => {
                const p = target.pipeline();
                p.org = target;
                return p;
            });
            for (const key of keys) {
                const type = await this.type(key);
                const dataPromise = (async () => {
                    switch (type) {
                        case "string":
                            const value = await this.get(key);
                            return { type, data: value };
                        case "hash": {
                            let hash;
                            const fields = options.hash;
                            if (Array.isArray(fields)) {
                                const values = await this.hmget(key, fields);
                                hash = {};
                                fields.forEach((field, index) => {
                                    if (values[index] !== null) {
                                        hash[field] = values[index];
                                    }
                                });
                            }
                            else {
                                hash = await this.hgetall(key);
                            }
                            return { type, data: hash };
                        }
                        case "set": {
                            const allMembers = await this.smembers(key);
                            const fields = options.set;
                            const members = Array.isArray(fields)
                                ? allMembers.filter((member) => fields.includes(member))
                                : allMembers;
                            return { type, data: members };
                        }
                        case "zset":
                            const zrange = await this.zrange(key, 0, -1, "WITHSCORES");
                            return { type, data: zrange };
                        case "list":
                            const list = await this.lrange(key, 0, -1);
                            return { type, data: list };
                        default:
                            return { type: null, data: null };
                    }
                })();
                const ttlPromise = this.ttl(key);
                const [{ type: keyType, data }, ttl] = await Promise.all([
                    dataPromise,
                    ttlPromise,
                ]);
                if (keyType && data) {
                    pipelines.forEach((pipeline) => {
                        switch (keyType) {
                            case "string":
                                pipeline.set(key, data);
                                break;
                            case "hash":
                                if (Object.keys(data).length) {
                                    pipeline.hmset(key, data);
                                }
                                break;
                            case "set":
                                if (data.length) {
                                    pipeline.sadd(key, data);
                                }
                                break;
                            case "zset":
                                if (data.length) {
                                    const args = [key];
                                    for (let i = 0; i < data.length; i += 2) {
                                        args.push(data[i + 1]);
                                        args.push(data[i]);
                                    }
                                    pipeline.zadd(...args);
                                }
                                break;
                            case "list":
                                if (data.length) {
                                    pipeline.rpush(key, data);
                                }
                                break;
                        }
                        if (ttl > 0) {
                            pipeline.expire(key, ttl);
                        }
                    });
                }
            }
            totalKeys += keys.length;
            console.dev(`Sync ${pattern} to ${targetRedisList.length} target , total ${totalKeys} keys`);
            await Promise.all(pipelines.map(async (pipeline) => {
                await pipeline.exec();
                if (pipeline.org.status === "ready") {
                    console.dev("Sync ok", pipeline.org.options.host);
                }
                else {
                    xerr("error", pipeline.org.options.host, pipeline.org.status);
                }
            }));
        }
    } while (cursor !== "0");
}
