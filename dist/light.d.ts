import { type Part } from "./canvas.js";
import type { RGB } from "./math.js";
export declare function lightPool(hdr: Float32Array, W: number, H: number, cx: number, cy: number, rx: number, ry: number, color: RGB, lift: number, glow: number): void;
export declare function fireflyLight(hdr: Float32Array, W: number, H: number, x: number, y: number, k: number): void;
export declare function campfire(x: number, gy: number, H: number, t: number): {
    flicker: number;
    logs: Part[];
    flames: Part[][];
};
