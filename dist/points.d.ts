export declare const POINT_STRIDE = 10;
export declare class Points {
    on: boolean;
    count: number;
    data: Float32Array<ArrayBuffer>;
    private next;
    private pending;
    add(hdr: Float32Array, W: number, H: number, x: number, y: number, r: number, g: number, b: number, size?: number, glide?: boolean): void;
    resolve(hdr: Float32Array, W: number, scale: Float32Array, exposure: number): void;
}
export declare function splat(hdr: Float32Array, W: number, H: number, x: number, y: number, r: number, g: number, b: number): void;
