import { type RGB } from "./math.js";
import type { Points } from "./points.js";
export interface Orb {
    x: number;
    y: number;
    r: number;
    core: RGB;
    glow: RGB;
    near: number;
    wide: number;
    moon?: boolean;
}
export declare const STAR_TINTS: RGB[];
export interface Star {
    x: number;
    y: number;
    b: number;
    phase: number;
    tint: RGB;
}
export declare function paintSky(hdr: Float32Array, W: number, H: number, stops: [number, RGB][], orb: Orb, px?: number): void;
export declare function makeStars(count: number, top: number): Star[];
export declare function paintStars(hdr: Float32Array, W: number, H: number, stars: Star[], time: number, top: number, brightness: number, points?: Points): void;
export type CloudKind = "cumulus" | "towering" | "cirrus" | "wisp" | "stratus" | "ash";
export interface Cloud {
    x: number;
    y: number;
    speed: number;
    kind: CloudKind | "shadow";
    w: number;
    parts: {
        x: number;
        y: number;
        r: number;
        s: number;
        t: number;
    }[];
    base: number;
    seed: number;
    sprite?: Sprite;
}
interface Sprite {
    H: number;
    w: number;
    h: number;
    x0: number;
    y0: number;
    cy: number;
    thin: number;
    a: Float32Array;
    nx: Float32Array;
    ny: Float32Array;
    nz: Float32Array;
    d: Float32Array;
    e: Float32Array;
}
export declare function makeClouds(count: number, kind: CloudKind, y0: number, y1: number): Cloud[];
export declare function makeShadows(count: number, y0: number, y1: number): Cloud[];
export declare function driftClouds(clouds: Cloud[], A: number, dt: number): void;
export declare function makeStorm(): Cloud[];
export declare function paintStorm(hdr: Float32Array, W: number, H: number, clouds: Cloud[], top: RGB, bottom: RGB, gloom: number): void;
export declare function paintClouds(hdr: Float32Array, W: number, H: number, clouds: Cloud[], top: RGB, bottom: RGB, alpha: number, orb?: Orb): void;
export declare function paintShadows(hdr: Float32Array, W: number, H: number, shadows: Cloud[], ground: number, orb?: Orb): void;
export declare function paintHaze(hdr: Float32Array, W: number, H: number, y0: number, y1: number, color: RGB, alpha: number): void;
export {};
