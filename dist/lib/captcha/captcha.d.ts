export function captcha(options?: {}): {
    svg: string;
    code: string;
};
export function captcha2(options: any): Promise<{
    png: Buffer<ArrayBufferLike>;
    code: string;
}>;
