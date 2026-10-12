import { type RGB } from "./math.js";
import type { Time } from "./wallpaper.js";
export interface Shade {
    tint: RGB;
    contact: number;
    cast: number;
    length: number;
    x: number;
    y: number;
    radiate: boolean;
}
export declare function sunShade(time: Time, orb: {
    x: number;
    y: number;
}, covered?: boolean): Shade;
export declare function groundShadow(hdr: Float32Array, W: number, H: number, shade: Shade, x: number, y: number, w: number, h: number, tip?: number, lift?: number): void;
export declare function keepShadows(hdr: Float32Array): void;
export declare function clearShadows(hdr: Float32Array): void;
export declare function fillShadow(hdr: Float32Array, W: number, H: number, ax: number, ay: number, bx: number, by: number, r0: number, r1: number, tr: number, tg: number, tb: number, a: number, fade: number, soft: number): void;
