import { type Part } from "./canvas.js";
export interface Flier {
    x: number;
    y: number;
    vx: number;
    vy: number;
    phase: number;
}
export declare function startle(birds: Flier[], x: number, y: number, count: number): void;
export declare function flyAway(birds: Flier[], dt: number, A: number): Flier[];
export declare function bird(b: Flier, H: number, size: number, color: [number, number, number]): Part[];
