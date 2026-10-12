import { type RGB } from "./math.js";
export declare class LightMap {
    cell: number;
    cols: number;
    rows: number;
    private W;
    private H;
    private lift;
    private glow;
    private lit;
    private dim;
    private box;
    clear(W: number, H: number): void;
    node(i: number, j: number, color: RGB, lift: number, glow: number): void;
    pool(cx: number, cy: number, rx: number, ry: number, color: RGB, lift: number, glow: number): void;
    apply(hdr: Float32Array): void;
}
export declare function firelight(t: number, seed: number): number;
