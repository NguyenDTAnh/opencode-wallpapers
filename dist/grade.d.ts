import { type RGB } from "./math.js";
export declare function haze(hdr: Float32Array, sky: Float32Array, W: number, H: number, y0: number, y1: number, far: number, near?: number, top?: number): void;
export declare function mottle(hdr: Float32Array, W: number, H: number, y0: number, y1: number, size: number, warm: RGB, cool: RGB): void;
