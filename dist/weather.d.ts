import type { Time, Weather } from "./wallpaper.js";
import { type RGB } from "./math.js";
export declare class WeatherLayer {
    private readonly horizon;
    readonly covered: boolean;
    readonly scud: [top: RGB, bottom: RGB] | undefined;
    private readonly palette;
    private readonly kind;
    private time;
    private aspect;
    private readonly drops;
    private readonly flakes;
    private readonly splashes;
    private nextSplash;
    private fogRows;
    private rainCount;
    private snowCount;
    constructor(weather: Weather, time: Time, horizon: number, light?: boolean);
    step(dt: number): void;
    cover(hdr: Float32Array, W: number, H: number): void;
    draw(hdr: Float32Array, W: number, H: number): void;
}
