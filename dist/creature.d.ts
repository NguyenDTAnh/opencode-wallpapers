import { type Part } from "./canvas.js";
import { type RGB } from "./math.js";
export interface Gait {
    phase: number;
    go: number;
    turn: number;
    lag: number;
    lagV: number;
}
export declare function gait(face?: number, phase?: number): Gait;
export declare function stepGait(g: Gait, strides: number, dt: number, face: number, rate?: number): void;
export declare function view(turn: number): [along: number, across: number];
export declare function stride(phase: number, offset?: number, duty?: number): [reach: number, lift: number];
export declare function bob(phase: number, duty?: number): number;
export declare function joint(ax: number, ay: number, bx: number, by: number, a: number, b: number, bend: number): [number, number];
export declare function limb(P: (u: number, v: number) => [number, number], ax: number, ay: number, bx: number, by: number, a: number, b: number, bend: number, r0: number, r1: number, r2: number, color: RGB): Part[];
export type Body = ((u: number, v: number, w?: number) => [number, number]) & {
    S: number;
    along: number;
    across: number;
    len: (u: number, w: number) => number;
};
export declare function body(x: number, y: number, S: number, turn: number): Body;
export declare function quadruped(P: Body, g: Gait, far: boolean, o: {
    fore: number;
    hind: number;
    top: number;
    w: number;
    a: number;
    b: number;
    reach: number;
    lift: number;
    r: [number, number, number];
    color: RGB;
    paw?: [number, RGB];
}): Part[];
export declare function chain(path: (t: number) => [number, number], n: number, r0: number, r1: number, color: RGB): Part[];
