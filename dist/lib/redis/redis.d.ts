export function newRedis(a: any, b: any, c: any): Redis;
export function newRedisCluster(config?: {
    port: number;
    host: string;
}[]): import("ioredis").Cluster;
import Redis from "ioredis";
