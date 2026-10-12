export declare function gust(x: number, t: number): number;
export declare function sway(x: number, t: number, phase?: number, rate?: number): number;
export declare class SwayLayer {
    private readonly dir;
    private before;
    private x0;
    private y0;
    private w;
    private h;
    private reach;
    private bare;
    private layer;
    private cover;
    private weight;
    private shift;
    private top;
    private bottom;
    constructor(dir?: number);
    begin(hdr: Float32Array): void;
    end(hdr: Float32Array, W: number, H: number, reach: number, weight: (x: number, y: number) => number): void;
    seal(hdr: Float32Array, W: number): void;
    offset(x: number, y: number): number;
    draw(hdr: Float32Array, W: number, H: number, t: number): void;
}
