export type ServerExtension = {
    open: number;
    routes: any[];
    addr: Function;
    static: Function;
    _404: Function;
    router_begin: Function;
    cnn: number;
    cluster: any;
    port: number;
};
export function h2s(...argv: any[]): Promise<http.Server<typeof http.IncomingMessage, typeof http.ServerResponse> & ServerExtension>;
export function hs(...argv: any[]): Promise<import("http").Server & ServerExtension>;
export function hss(...argv: any[]): Promise<http.Server<typeof http.IncomingMessage, typeof http.ServerResponse> & ServerExtension>;
import http from "http";
