export function query(pool: any): (text: string, params?: any[]) => Promise<[Error, null] | [null, any[]]>;
