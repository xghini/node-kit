export function insert(pg: object, table: string, data: object | object[], options?: {
    onconflict?: string | any[];
}): Promise<[Error, null] | [null, any]>;
