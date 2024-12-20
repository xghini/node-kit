export function gzip(data: Buffer | string): Promise<Buffer>;
export function gunzip(compressed: Buffer): Promise<Buffer>;
export function deflate(data: Buffer | string): Promise<Buffer>;
export function inflate(compressed: Buffer): Promise<Buffer>;
export function br_compress(data: Buffer | string): Promise<Buffer>;
export function br_decompress(compressed: Buffer): Promise<Buffer>;
export function zstd_compress(data: any, compressionLevel?: number): Promise<any>;
export function zstd_decompress(data: any): Promise<any>;
