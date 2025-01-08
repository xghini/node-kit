export function hd_stream(server: any, stream: any, headers: any): void;
export function simulateHttp2Stream(req: any, res: any): {
    stream: EventEmitter<[never]>;
    headers: any;
};
import EventEmitter from "events";
