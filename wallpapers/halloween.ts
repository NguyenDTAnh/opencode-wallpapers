import { Canvas, cap, ell, type Lighting, type Part } from "../src/canvas"
import { body, chain, quadruped, stepGait, stride, gait, type Gait } from "../src/creature"
import { eggWait } from "../src/egg"
import { flyAway, startle, type Flier } from "../src/flock"
import { lightPool } from "../src/light"
import { LightMap, firelight } from "../src/lightmap"
import { TAU, clamp, fbm1, fbm2, hash, hash2, lerp, rand, smoothstep, type RGB } from "../src/math"
import { driftClouds, makeClouds, makeStars, makeStorm, paintClouds, paintSky, paintStars, paintStorm, type Cloud, type Orb, type Star } from "../src/sky"
import { touch } from "../src/touched"
import type { Activity, Settings, Time, Wallpaper } from "../src/wallpaper"
import { WeatherLayer } from "../src/weather"
import { gust } from "../src/wind"

// The scene runs slower than real time, which keeps it calm behind text.
const TIME_SCALE = 0.35
// Trick-or-treaters, the cat, bats, ghosts, the witch and the egg's rider move at a quarter of scene speed.
const CREATURE_SPEED = 0.25
// The far ridge meets the sky here, the houses stand on YARD, the iron fences stand on FENCE and the street's
// trick-or-treaters walk between WALK0 and WALK1, all in screen heights from the top.
const HORIZON = 0.6
const YARD = 0.765
const FENCE = 0.8
const WALK0 = 0.865
const WALK1 = 0.915
// A trick-or-treater's height and stride, in screen heights.
const KID = 0.075
const KID_STRIDE = 0.05
// The egg: a headless rider gallops along the street, this many creature seconds from edge to edge.
const GALLOP = 3.2
// Teeming: seconds between the witch's crossings, in scene seconds.
const WITCH_GAP: [number, number] = [70, 140]

// Everything that changes with the time of day. Objects keep one daytime color and paint() darkens it; the lights
// (windows, pumpkins, lanterns) and big surfaces have their own colors per look. Night keeps every highlight amber,
// orange, violet or teal: the text on top is white.
interface Look {
  style: "front" | "rim"
  light: RGB
  sky: [number, RGB][]
  // The sun or moon, its x in screen heights from the hill's crest.
  orb: Orb
  stars: number
  clouds: [top: RGB, bottom: RGB]
  ridge: [far: RGB, near: RGB]
  hill: RGB
  meadow: RGB
  street: RGB
  walls: RGB[]
  roof: RGB
  glass: RGB
  window: RGB
  // Share of windows lit, and how bright pumpkins, lanterns and windows glow.
  lit: number
  glow: number
  fog: RGB
  fogAlpha: number
  ghost: RGB
  skin: RGB
  tint: RGB
  night: boolean
}

const LOOKS: Record<Time, Look> = {
  // An amber autumn afternoon: a hazy sky going gold toward the horizon, orange trees and pumpkins in the sun.
  day: {
    style: "front",
    light: [1, 0.85, 0.6],
    sky: [
      [0, [0.3, 0.38, 0.52]],
      [0.32, [0.6, 0.56, 0.52]],
      [HORIZON, [0.98, 0.7, 0.38]],
    ],
    orb: { x: 0.12, y: 0.15, r: 0.045, core: [3.2, 2.2, 1], glow: [1, 0.66, 0.3], near: 0.4, wide: 0.22 },
    stars: 0,
    clouds: [
      [1, 0.86, 0.68],
      [0.62, 0.5, 0.46],
    ],
    ridge: [
      [0.66, 0.52, 0.44],
      [0.5, 0.36, 0.26],
    ],
    hill: [0.46, 0.33, 0.14],
    meadow: [0.5, 0.38, 0.17],
    street: [0.3, 0.26, 0.24],
    walls: [
      [0.42, 0.34, 0.5],
      [0.34, 0.4, 0.3],
      [0.62, 0.44, 0.24],
      [0.3, 0.33, 0.42],
      [0.52, 0.3, 0.26],
    ],
    roof: [0.17, 0.13, 0.15],
    glass: [0.1, 0.09, 0.12],
    window: [0.95, 0.62, 0.25],
    lit: 0.12,
    glow: 0.45,
    fog: [0.9, 0.74, 0.55],
    fogAlpha: 0.22,
    ghost: [0.75, 0.95, 0.85],
    skin: [0.92, 0.43, 0.06],
    tint: [1, 1, 1],
    night: false,
  },
  // A blazing orange sun low over the fields, the sky going purple overhead and the town in silhouette.
  sunset: {
    style: "rim",
    light: [1.3, 0.55, 0.16],
    sky: [
      [0, [0.08, 0.025, 0.14]],
      [0.25, [0.3, 0.07, 0.26]],
      [0.45, [0.85, 0.28, 0.18]],
      [HORIZON, [1.3, 0.62, 0.16]],
    ],
    orb: { x: 0.31, y: 0.49, r: 0.07, core: [3, 1.4, 0.38], glow: [1, 0.45, 0.12], near: 0.5, wide: 0.35 },
    stars: 12,
    clouds: [
      [0.1, 0.03, 0.1],
      [0.9, 0.35, 0.18],
    ],
    ridge: [
      [0.34, 0.1, 0.18],
      [0.16, 0.05, 0.11],
    ],
    hill: [0.085, 0.03, 0.065],
    meadow: [0.11, 0.04, 0.075],
    street: [0.09, 0.04, 0.07],
    walls: [
      [0.13, 0.05, 0.12],
      [0.1, 0.05, 0.1],
      [0.16, 0.07, 0.1],
      [0.09, 0.05, 0.12],
      [0.14, 0.05, 0.09],
    ],
    roof: [0.05, 0.02, 0.05],
    glass: [0.04, 0.02, 0.04],
    window: [1.5, 0.7, 0.2],
    lit: 0.5,
    glow: 0.9,
    fog: [0.55, 0.22, 0.28],
    fogAlpha: 0.28,
    ghost: [0.4, 1, 0.75],
    skin: [0.55, 0.18, 0.03],
    tint: [0.3, 0.13, 0.2],
    night: false,
  },
  // Deep violet and indigo under a huge gold-orange moon, the town lit by windows, pumpkins and lanterns.
  night: {
    style: "rim",
    light: [1, 0.6, 0.22],
    sky: [
      [0, [0.012, 0.006, 0.04]],
      [0.3, [0.04, 0.018, 0.12]],
      [HORIZON, [0.13, 0.055, 0.26]],
    ],
    orb: { x: 0.08, y: 0.24, r: 0.12, core: [1.7, 0.66, 0.15], glow: [0.75, 0.26, 0.06], near: 0.4, wide: 0.2, moon: true },
    stars: 90,
    clouds: [
      [0.02, 0.012, 0.06],
      [0.1, 0.05, 0.2],
    ],
    ridge: [
      [0.07, 0.035, 0.15],
      [0.035, 0.016, 0.08],
    ],
    hill: [0.026, 0.012, 0.05],
    meadow: [0.032, 0.016, 0.065],
    street: [0.03, 0.018, 0.06],
    walls: [
      [0.07, 0.04, 0.13],
      [0.05, 0.05, 0.11],
      [0.09, 0.05, 0.1],
      [0.05, 0.04, 0.12],
      [0.08, 0.035, 0.09],
    ],
    roof: [0.02, 0.01, 0.04],
    glass: [0.02, 0.012, 0.04],
    window: [1.6, 0.78, 0.22],
    lit: 0.75,
    glow: 1.25,
    fog: [0.15, 0.08, 0.3],
    fogAlpha: 0.4,
    ghost: [0.22, 1.1, 0.78],
    skin: [0.32, 0.1, 0.02],
    tint: [0.1, 0.06, 0.18],
    night: true,
  },
}

const DAYLIGHT = (() => {
  const l = Math.hypot(0.55, 0.6, 0.6)
  return [-0.55 / l, -0.6 / l, 0.6 / l] as const
})()

// A carved pumpkin's candlelight, a lantern's colors, and a ghost's eyes.
const CANDLE: RGB = [2.3, 1.05, 0.22]
const LANTERNS: RGB[] = [
  [1.7, 0.62, 0.12],
  [1, 0.28, 1.3],
  [0.45, 1.25, 0.3],
]
const LEAVES: RGB[] = [
  [0.95, 0.4, 0.06],
  [0.8, 0.18, 0.06],
  [0.95, 0.65, 0.12],
  [0.55, 0.22, 0.08],
]
// Costumes: a sheet ghost, a witch, a pumpkin and a little devil.
const COSTUMES = ["ghost", "witch", "pumpkin", "devil"] as const
type Costume = (typeof COSTUMES)[number]

// A pumpkin standing at (x, y) in pixels, radius r; carved ones glow from inside and flicker.
interface Pumpkin {
  x: number
  y: number
  r: number
  carved: boolean
  seed: number
  flare: number
}

interface Lantern {
  x: number
  y: number
  r: number
  color: RGB
  seed: number
}

// A lit window whose candle flickers: its corners in pixels.
interface Candle {
  pts: [number, number][]
  seed: number
}

interface Bat {
  ax: number
  ay: number
  rx: number
  ry: number
  w: number
  phase: number
  size: number
}

interface Ghost {
  x: number
  y: number
  x0: number
  x1: number
  dir: number
  phase: number
}

interface Kid {
  x: number
  y: number
  dir: number
  speed: number
  costume: Costume
  phase: number
}

interface Leaf {
  x: number
  y: number
  fall: number
  spin: number
  rate: number
  color: RGB
  size: number
}

class Halloween extends Canvas {
  private time = 0
  private creatureTime = 0
  private readonly activity: Activity
  private readonly look: Look
  private readonly weather: WeatherLayer
  private lighting: Lighting = { style: "front", dir: DAYLIGHT }
  private light: RGB = [1, 1, 1]
  private readonly lights = new LightMap()
  private stars: Star[]
  private shown: Star[] = []
  private clouds: Cloud[]
  private storm = makeStorm()
  // Scale for narrow screens, the hill's crest, and the orb in screen heights.
  private k = 1
  private crest = 0.2
  private orb: Orb
  // Pixels the hill, tree, town and fences cover, which clouds and stars stay behind.
  private fore = new Uint8Array(0)
  private fog = new Float32Array(0)
  private fogY0 = 0
  private fogRows = 0
  private pumpkins: Pumpkin[] = []
  private lanterns: Lantern[] = []
  private candles: Candle[] = []
  private bats: Bat[] = []
  private burst: Flier[] = []
  private ghosts: Ghost[] = []
  private kids: Kid[] = []
  private leaves: Leaf[] = []
  private cat = { x: 0.3, y: 0.7, blink: 0 }
  private scarecrow = { x: 0.4, y: 0.7 }
  private flare = 0
  private witch = { t: -1, wait: rand(20, 50), dir: 1, y: 0.2 }
  private rider = { wait: eggWait() * TIME_SCALE, t: -1, dir: 1, gait: gait() as Gait }

  constructor(settings: Settings) {
    super()
    this.activity = settings.activity
    this.look = LOOKS[settings.time]
    this.orb = this.look.orb
    this.weather = new WeatherLayer(settings.weather ?? "clear", settings.time, HORIZON)
    this.stars = makeStars(this.look.stars, 0.5)
    this.clouds = makeClouds(4, settings.time === "sunset" ? "stratus" : "wisp", 0.06, 0.3)
    const n = { calm: 7, lively: 10, teeming: 14 }[settings.activity]
    this.leaves = Array.from({ length: n }, () => this.leaf(Math.random() * 2, rand(0.05, 0.9)))
    if (settings.activity === "calm") return
    const bats = settings.activity === "teeming" ? 6 : 3
    this.bats = Array.from({ length: bats }, (_, i) => ({ ax: 0, ay: 0, rx: rand(0.05, 0.1), ry: rand(0.02, 0.05), w: rand(0.9, 1.4), phase: rand(0, TAU), size: rand(0.018, 0.026) + (i === 0 ? 0.006 : 0) }))
    const ghosts = settings.activity === "teeming" ? 2 : 1
    this.ghosts = Array.from({ length: ghosts }, (_, i) => ({ x: 0, y: 0, x0: 0, x1: 0, dir: i ? -1 : 1, phase: rand(0, TAU) }))
    if (settings.activity !== "teeming") return
    this.kids = COSTUMES.map((costume, i) => ({ x: i * 0.12 + (i > 1 ? 0.9 : 0), y: lerp(WALK0, WALK1, hash(i * 3.1)), dir: i > 1 ? -1 : 1, speed: rand(0.2, 0.24), costume, phase: rand(0, 1) }))
  }

  step(dt: number) {
    dt = clamp(dt, 0, 0.1) * TIME_SCALE
    this.time += dt
    const cdt = dt * CREATURE_SPEED
    this.creatureTime += cdt
    this.stepGloom(dt)
    this.weather.step(dt)
    driftClouds(this.clouds, this.A, dt * 0.4)
    if (this.gloom > 0) driftClouds(this.storm, this.A, dt)
    this.flare = Math.max(0, this.flare - dt * 0.25)
    for (const p of this.pumpkins) p.flare = Math.max(0, p.flare - dt * 0.35)
    this.burst = flyAway(this.burst, dt, this.A)
    this.stepLeaves(dt)
    this.stepGhosts(cdt)
    this.stepKids(cdt)
    this.stepWitch(dt, cdt)
    this.stepRider(dt, cdt)
    this.cat.blink = (this.cat.blink + dt) % 9
  }

  render() {
    this.restore()
    const { W, H, look, hdr } = this
    if (!this.weather.covered) paintStars(hdr, W, H, this.shown, this.time, 0.5, look.night ? 0.8 : 0.4, this.points)
    const [top, bottom] = this.weather.scud ?? look.clouds
    paintClouds(hdr, W, H, this.clouds, top, bottom, look.night ? 0.75 : 0.55, this.weather.covered ? undefined : this.orb)
    if (this.gloom > 0) paintStorm(hdr, W, H, this.storm, [0.16, 0.1, 0.2], [0.04, 0.02, 0.06], this.gloom)
    this.unsky(0, 0, W - 1, Math.ceil(HORIZON * H))
    if (this.witch.t >= 0) this.drawWitch()
    for (const b of this.bats) this.drawBatAt(b)
    for (const g of this.ghosts) this.drawGhost(g)
    creep(hdr, W, H, this.fog, this.fogY0, this.fogRows, this.time * 1.6, this.time * 1.1, look.fog, look.fogAlpha)
    touch(hdr, 0, this.fogY0, W - 1, this.fogY0 + this.fogRows - 1)
    this.lights.clear(W, H)
    this.drawLights()
    if (this.activity !== "calm") this.drawCat()
    if (this.activity === "teeming") this.drawArm(1, smoothstep(0, 1, Math.sin((this.time / 22) * TAU) * 2 - 1))
    for (const kid of [...this.kids].sort((a, b) => a.y - b.y)) this.drawKid(kid)
    if (this.rider.t >= 0) this.drawRider()
    this.lights.apply(hdr)
    this.drawLeaves()
    for (const b of this.burst) this.drawBat(b.x, b.y, 0.02, b.phase, Math.sign(b.vx))
    this.weather.draw(hdr, W, H)
    this.finish()
  }

  // A witch on her broomstick crosses the moon, and every jack-o'-lantern flares.
  protected override visit() {
    for (const p of this.pumpkins) p.flare = Math.max(p.flare, 0.8)
    if (this.witch.t < 0) this.startWitch()
  }

  // A click near a jack-o'-lantern makes it blaze up; anywhere else, a flurry of bats bursts out.
  poke(x: number, y: number) {
    const H = this.H
    const near = this.pumpkins.filter((p) => p.carved).sort((a, b) => Math.hypot(a.x / H - x, a.y / H - y) - Math.hypot(b.x / H - x, b.y / H - y))[0]
    if (near && Math.hypot(near.x / H - x, near.y / H - y) < 0.07) {
      near.flare = 1.6
      return
    }
    if (this.burst.length < 24) startle(this.burst, x, y, 6)
  }

  protected override layout() {
    const { W, H, A, look, hdr } = this
    const k = (this.k = clamp(A / 1.7, 0.58, 1))
    this.crest = 0.2 * k
    this.orb = { ...look.orb, x: (this.crest + look.orb.x * k) / A }
    // Under a cloud deck the hidden sun or moon only faintly rims things.
    const veil = this.weather.covered ? 0.3 : 1
    this.light = [look.light[0] * veil, look.light[1] * veil, look.light[2] * veil]
    this.lighting = look.style === "front" ? { style: "front", dir: DAYLIGHT } : { style: "rim", color: this.light, x: this.orb.x * W, y: this.orb.y * H }
    this.pumpkins = []
    this.lanterns = []
    this.candles = []
    paintSky(hdr, W, H, look.sky, this.orb, this.px)
    this.weather.cover(hdr, W, H)
    const sky = hdr.slice()
    this.paintLand()
    this.paintGrove()
    this.paintTown()
    this.paintTree()
    this.paintPatch()
    this.paintStreet()
    this.paintFallen()
    this.paintFences()
    this.paintCorners()
    for (const p of this.pumpkins) this.drawPumpkin(p, 1)
    for (const l of this.lanterns) this.drawLantern(l, 1)
    if (this.px !== 1) return
    // Real-size pass: what render() needs.
    this.fore = new Uint8Array(W * H)
    for (let i = 0; i < W * H; i++) if (hdr[i * 3] !== sky[i * 3] || hdr[i * 3 + 1] !== sky[i * 3 + 1] || hdr[i * 3 + 2] !== sky[i * 3 + 2]) this.fore[i] = 1
    this.shown = this.stars.filter((s) => {
      const i = Math.floor(s.y * H) * W + Math.floor(s.x * W)
      return !this.fore[i] && Math.hypot(s.x * W - this.orb.x * W, s.y * H - this.orb.y * H) > this.orb.r * H * 1.6
    })
    this.fogY0 = Math.floor(0.58 * H)
    this.fogRows = Math.ceil(0.3 * H)
    this.fog = makeFog(W, H, this.fogY0, this.fogRows)
    this.placeCreatures()
  }

  private paint(c: RGB, k = 1): RGB {
    const t = this.look.tint
    return [c[0] * t[0] * k, c[1] * t[1] * k, c[2] * t[2] * k]
  }

  // The hill's surface at x, in screen heights.
  private hillY(x: number) {
    const k = this.k
    return YARD + 0.01 - 0.35 * Math.exp(-(((x - this.crest) / (0.36 * k)) ** 2)) + (fbm1(x * 4, 3) - 0.5) * 0.02
  }

  // The far ridge with a few distant cottages, the meadow below it, and the hill on the left.
  private paintLand() {
    const { W, H, look, hdr } = this
    const [far, near] = look.ridge
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / H
      const r1 = HORIZON - 0.035 - (fbm1(u * 2.2, 11) - 0.5) * 0.07
      const r2 = HORIZON + 0.005 - (fbm1(u * 3.1, 5) - 0.5) * 0.04
      const hill = this.hillY(u)
      for (let y = Math.max(0, Math.floor(Math.min(r1, hill) * H) - 1); y < H; y++) {
        const v = (y + 0.5) / H
        const o = (y * W + x) * 3
        const a1 = clamp((v - r1) * H / this.px + 0.5, 0, 1)
        const a2 = clamp((v - r2) * H / this.px + 0.5, 0, 1)
        const a3 = clamp((v - hill) * H / this.px + 0.5, 0, 1)
        if (a1 > 0) for (let c = 0; c < 3; c++) hdr[o + c] += (far[c] - hdr[o + c]) * a1
        const m = look.meadow
        const shade = 0.85 + 0.25 * smoothstep(r2, YARD, v) + (fbm2(u * 6, v * 30, 2) - 0.5) * 0.12
        if (a2 > 0) for (let c = 0; c < 3; c++) hdr[o + c] += (lerp(near[c], m[c], smoothstep(r2, r2 + 0.06, v)) * shade - hdr[o + c]) * a2
        if (a3 <= 0) continue
        // The hill catches the light on its sunward face, with tufts of dry grass.
        const grain = 0.9 + 0.2 * fbm2(u * 9, v * 40, 2)
        const face = look.style === "front" ? 1 + 0.18 * clamp((this.crest - u) * 4, -1, 1) : 1
        const rim = look.style === "rim" ? Math.exp(-((v - hill) * H) / (2 * this.px)) * (look.night ? 0.12 : 0.2) : 0
        for (let c = 0; c < 3; c++) hdr[o + c] += (look.hill[c] * grain * face + this.light[c] * rim - hdr[o + c]) * a3
      }
    }
    // Distant cottages on the ridge, their windows lit after dark.
    const k = this.k
    for (const [i, x] of [0.72 * k, 0.8 * k, this.A - 0.76 * k, this.A - 0.84 * k].entries()) {
      const y = HORIZON - 0.02 - (fbm1(x * 2.2, 11) - 0.5) * 0.07 + 0.006
      const w = 0.016 + 0.006 * hash(i * 3.3)
      const h = 0.012 + 0.004 * hash(i * 1.7)
      const c = [far[0] * 0.8, far[1] * 0.8, far[2] * 0.85] as RGB
      this.polygon([[(x - w) * H, y * H], [(x + w) * H, y * H], [(x + w) * H, (y - h) * H], [x * H, (y - h - w) * H], [(x - w) * H, (y - h) * H]], c)
      if (look.lit > 0.3) this.disc(x * H, (y - h * 0.5) * H, Math.max(0.0025 * H, 0.6 * this.px), look.window[0] * 0.6, look.window[1] * 0.6, look.window[2] * 0.6, 1)
    }
  }

  // Round autumn trees in orange and red behind the town and on the hill's far side.
  private paintGrove() {
    const { A, H } = this
    const k = this.k
    const spots: [number, number, number][] = [
      [A - 0.28 * k, YARD, 0.075],
      [A + 0.01, YARD, 0.09],
      [A - 0.78 * k, YARD + 0.005, 0.055],
      [0.0, this.hillY(0) + 0.01, 0.06],
    ]
    const bark = this.paint([0.22, 0.14, 0.1])
    for (const [i, [x, y, r]] of spots.entries()) {
      const cy = y - r * 2.1
      this.shape([cap(x * H, y * H, (x + 0.004) * H, cy * H, r * 0.14 * H, r * 0.08 * H, bark)], this.lighting, 0.5)
      const parts: Part[] = []
      for (let j = 0; j < 9; j++) {
        const a = (j / 9) * TAU + hash(i * 7 + j) * 0.6
        const d = j === 0 ? 0 : r * (0.45 + 0.25 * hash(i * 3 + j * 1.7))
        const c = LEAVES[(i + j) % 3]
        parts.push(ell((x + Math.cos(a) * d) * H, (cy + Math.sin(a) * d * 0.8) * H, r * (0.5 + 0.15 * hash(j + i)) * H, r * (0.45 + 0.1 * hash(j * 2 + i)) * H, 0, this.paint([c[0] * 0.85, c[1] * 0.85, c[2] * 0.85])))
      }
      this.shape(parts, this.lighting, this.look.style === "rim" ? 0.45 : 0.8)
    }
  }

  // The town on the right: crooked gabled houses either side of a church with a tall spire, its windows glowing.
  private paintTown() {
    const { A } = this
    const k = this.k
    const anchors: [number, number][] = []
    const houses = [
      { x: A - 0.065 * k, w: 0.11 * k, h: 0.2, roof: 0.12, lean: 0.008, color: 0, side: -1 },
      { x: A - 0.2 * k, w: 0.1 * k, h: 0.15, roof: 0.1, lean: -0.01, color: 1, side: -1 },
      { x: A - 0.66 * k, w: 0.095 * k, h: 0.125, roof: 0.11, lean: 0.012, color: 2, side: 1 },
    ]
    this.paintChurch(A - 0.44 * k, anchors)
    for (const [i, h] of houses.entries()) anchors.push(...this.paintHouse(h.x, YARD, h.w, h.h, h.roof, h.lean, h.color, h.side, i))
    // Strings of lanterns between the eaves.
    anchors.sort((a, b) => a[0] - b[0])
    for (let i = 0; i + 1 < anchors.length; i++) {
      const [ax, ay] = anchors[i]
      const [bx, by] = anchors[i + 1]
      if (bx - ax > 0.3 || bx - ax < 0.03) continue
      this.paintString(ax, ay, bx, by, 0.035, i)
    }
  }

  // A crooked house: its gable end toward us, a side wall receding behind it, a steep roof, a chimney, lit windows, a
  // door and a jack-o'-lantern on the step. Returns its eave corners, for strings of lanterns.
  private paintHouse(x: number, by: number, w: number, h: number, roofH: number, lean: number, color: number, side: number, seed: number): [number, number][] {
    const { H, look } = this
    const P = (u: number, v: number): [number, number] => [(x + u + lean * (v / h)) * H, (by - v) * H]
    const wall = look.walls[color % look.walls.length]
    const front = look.style === "front" ? wall : wall
    const sideK = look.style === "front" ? (side > 0 ? 0.72 : 0.92) : 0.6
    const d = w * 0.45
    const sx = side * w * 0.5
    const lift = d * 0.3
    const roof = look.roof
    const apex: [number, number] = [(x + lean * 1.25 + side * 0.004) * H, (by - h - roofH) * H]
    // The side wall and the roof's side, receding.
    this.polygon([P(sx, 0), [P(sx, 0)[0] + side * d * H, P(sx, 0)[1] - lift * H], [P(sx, h)[0] + side * d * H, P(sx, h)[1] - lift * H], P(sx, h)], [wall[0] * sideK, wall[1] * sideK, wall[2] * sideK])
    const eave = P(sx + side * 0.012, h - 0.012)
    this.polygon([apex, [apex[0] + side * d * H, apex[1] - lift * H], [eave[0] + side * d * H, eave[1] - lift * H], eave], roof)
    // A crooked chimney on the roof's side.
    const cx = lerp(apex[0], eave[0], 0.45) + side * d * H * 0.5
    const cy = lerp(apex[1], eave[1], 0.45) - lift * H * 0.5
    const cw = 0.012 * H
    this.polygon([[cx - cw, cy + cw], [cx + cw, cy + cw], [cx + cw + 0.004 * H, cy - 0.05 * H], [cx - cw + 0.004 * H, cy - 0.05 * H]], [wall[0] * 0.7, wall[1] * 0.6, wall[2] * 0.6])
    this.polygon([[cx - cw * 1.4 + 0.004 * H, cy - 0.05 * H], [cx + cw * 1.4 + 0.004 * H, cy - 0.05 * H], [cx + cw * 1.4 + 0.004 * H, cy - 0.058 * H], [cx - cw * 1.4 + 0.004 * H, cy - 0.058 * H]], roof)
    // The front wall and gable.
    this.polygon([P(-w / 2, 0), P(w / 2, 0), P(w / 2, h), apex, P(-w / 2, h)], front)
    // Roof edges overhanging the gable.
    const over = 0.014
    const left = P(-w / 2 - over, h - 0.016)
    const right = P(w / 2 + over, h - 0.016)
    this.edge(left, apex, 0.008, roof)
    this.edge(apex, right, 0.008, roof)
    if (look.style === "rim") this.rimEdges([P(-w / 2, 0), P(-w / 2, h), apex, P(w / 2, h), P(w / 2, 0)])
    // Windows: two rows, a round one in the gable, and a door.
    const rows = h > 0.16 ? 2 : 1
    const cols = w > 0.1 ? 2 : 2
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const u = (c - (cols - 1) / 2) * w * 0.45
        const v = rows === 1 ? h - 0.03 : h - 0.035 - r * 0.07
        this.paintWindow(P, u, v, 0.016, 0.026, seed * 7 + r * 3 + c)
      }
    const g = P(0, h + roofH * 0.38)
    const lit = hash(seed * 5.1) < look.lit + 0.25
    const gc = lit ? look.window : look.glass
    this.disc(g[0], g[1], 0.011 * H, roof[0], roof[1], roof[2], 1)
    this.disc(g[0], g[1], 0.008 * H, gc[0], gc[1], gc[2], 1)
    const du = 0
    const door = [P(du - 0.013, 0), P(du + 0.013, 0), P(du + 0.013, 0.04), P(du, 0.048), P(du - 0.013, 0.04)]
    this.polygon(door, this.paint([0.2, 0.1, 0.08]))
    // A step and a jack-o'-lantern by the door.
    this.polygon([P(du - 0.022, 0), P(du + 0.022, 0), P(du + 0.024, -0.008), P(du - 0.024, -0.008)], this.paint([0.36, 0.33, 0.33]))
    this.pumpkins.push({ x: P(du + 0.034, 0)[0], y: (by + 0.004) * H, r: 0.011 * H, carved: true, seed: seed * 13 + 1, flare: 0 })
    if (seed !== 1) this.pumpkins.push({ x: P(du - 0.03, 0)[0], y: (by + 0.006) * H, r: 0.008 * H, carved: seed === 0, seed: seed * 13 + 2, flare: 0 })
    return [left, right]
  }

  // A window at (u, v) on a facade mapped by P: a dark frame, glass or candlelight, and a cross of muntins.
  private paintWindow(P: (u: number, v: number) => [number, number], u: number, v: number, w: number, h: number, seed: number) {
    const look = this.look
    const frame = look.roof
    this.polygon([P(u - w - 0.003, v - h - 0.003), P(u + w + 0.003, v - h - 0.003), P(u + w + 0.003, v + 0.003), P(u - w - 0.003, v + 0.003)], frame)
    const lit = hash(seed * 1.37 + 0.2) < look.lit
    const pts = [P(u - w, v - h), P(u + w, v - h), P(u + w, v), P(u - w, v)]
    const glow = lit ? look.window : look.glass
    const k = lit ? 0.75 + 0.35 * hash(seed * 3.1) : 1
    this.polygon(pts, [glow[0] * k, glow[1] * k, glow[2] * k])
    if (lit && hash(seed * 7.7) < 0.45) this.candles.push({ pts, seed })
    if (this.cells) return
    this.edge(P(u, v - h), P(u, v), 0.0015, frame)
    this.edge(P(u - w, v - h * 0.5), P(u + w, v - h * 0.5), 0.0015, frame)
  }

  // The church: a long nave with tall pointed windows, and a tower with a glowing clock and a crooked spire.
  private paintChurch(x: number, anchors: [number, number][]) {
    const { H, look } = this
    const k = this.k
    const stone: RGB = look.walls[3]
    const roof = look.roof
    const tw = 0.034 * k + 0.012
    const top = YARD - 0.36
    // The nave, to the right of the tower.
    const n0 = x + tw * 0.8
    const n1 = x + 0.145 * k
    const nh = 0.13
    this.polygon([[n0 * H, YARD * H], [n1 * H, YARD * H], [n1 * H, (YARD - nh) * H], [n0 * H, (YARD - nh) * H]], [stone[0] * 0.92, stone[1] * 0.92, stone[2] * 0.95])
    this.polygon([[(n0 - 0.01) * H, (YARD - nh + 0.004) * H], [(n1 + 0.012) * H, (YARD - nh + 0.004) * H], [(n1 - 0.02) * H, (YARD - nh - 0.07) * H], [(n0 + 0.01) * H, (YARD - nh - 0.075) * H]], roof)
    for (let i = 0; i < 3; i++) {
      const wx = lerp(n0 + 0.028 * k, n1 - 0.028 * k, i / 2)
      const glass: RGB = look.lit > 0.3 ? [LANTERNS[i][0] * 0.55, LANTERNS[i][1] * 0.55, LANTERNS[i][2] * 0.55] : look.glass
      this.polygon([[(wx - 0.011) * H, (YARD - 0.025) * H], [(wx + 0.011) * H, (YARD - 0.025) * H], [(wx + 0.011) * H, (YARD - 0.085) * H], [wx * H, (YARD - 0.1) * H], [(wx - 0.011) * H, (YARD - 0.085) * H]], roof)
      this.polygon([[(wx - 0.007) * H, (YARD - 0.028) * H], [(wx + 0.007) * H, (YARD - 0.028) * H], [(wx + 0.007) * H, (YARD - 0.083) * H], [wx * H, (YARD - 0.094) * H], [(wx - 0.007) * H, (YARD - 0.083) * H]], glass)
    }
    if (look.style === "rim") this.rimEdges([[n0 * H, (YARD - nh) * H], [n1 * H, (YARD - nh) * H]])
    // The tower, leaning a touch.
    const lean = -0.006
    const T = (u: number, y: number): [number, number] => [(x + u + lean * ((YARD - y) / 0.36)) * H, y * H]
    this.polygon([T(-tw, YARD), T(tw, YARD), T(tw, top), T(-tw, top)], stone)
    this.polygon([T(tw, YARD), T(tw + 0.016, YARD - 0.006), T(tw + 0.016, top - 0.006), T(tw, top)], [stone[0] * 0.65, stone[1] * 0.65, stone[2] * 0.7])
    // Belfry openings, a clock face and a ledge.
    for (const s of [-1, 1]) this.polygon([T(s * tw * 0.45 - 0.008, top + 0.07), T(s * tw * 0.45 + 0.008, top + 0.07), T(s * tw * 0.45 + 0.008, top + 0.03), T(s * tw * 0.45, top + 0.02), T(s * tw * 0.45 - 0.008, top + 0.03)], [roof[0] * 0.6, roof[1] * 0.6, roof[2] * 0.6])
    this.polygon([T(-tw - 0.006, top + 0.008), T(tw + 0.006, top + 0.008), T(tw + 0.006, top - 0.002), T(-tw - 0.006, top - 0.002)], roof)
    const [cx, cy] = T(0, top + 0.13)
    const clock = look.lit > 0.3 ? look.window : this.paint([0.85, 0.8, 0.62])
    this.disc(cx, cy, 0.022 * H, roof[0], roof[1], roof[2], 1)
    this.disc(cx, cy, 0.017 * H, clock[0] * 0.8, clock[1] * 0.8, clock[2] * 0.8, 1)
    this.edge([cx, cy], [cx, cy - 0.012 * H], 0.0018, roof)
    this.edge([cx, cy], [cx + 0.008 * H, cy + 0.003 * H], 0.0018, roof)
    for (let i = 0; i < 2; i++) this.paintWindow((u, v) => T(u, YARD - v), 0, 0.12 + i * 0.075, 0.008, 0.03, 90 + i)
    // The spire, steep and crooked, with a little finial.
    const sh = 0.24
    const tip: [number, number] = [T(0, top)[0] + 0.018 * H, (top - sh) * H]
    this.polygon([T(-tw - 0.008, top), T(tw + 0.008, top), [T(tw * 0.3, top - sh * 0.5)[0] + 0.012 * H, (top - sh * 0.5) * H], tip, [T(-tw * 0.3, top - sh * 0.5)[0] + 0.006 * H, (top - sh * 0.5) * H]], roof)
    this.edge(tip, [tip[0] + 0.002 * H, tip[1] - 0.025 * H], 0.0022, roof)
    this.disc(tip[0] + 0.002 * H, tip[1] - 0.027 * H, 0.004 * H, roof[0], roof[1], roof[2], 1)
    if (look.style === "rim") this.rimEdges([T(-tw, YARD), T(-tw, top), T(-tw - 0.008, top), tip, T(tw + 0.008, top)])
    anchors.push([n1 * H, (YARD - nh) * H], T(-tw, top + 0.1))
    // Leaning headstones in the churchyard.
    const grave = this.paint([0.5, 0.48, 0.5], look.night ? 2.5 : 1)
    for (let i = 0; i < 5; i++) {
      const gx = x - 0.07 * k + i * 0.045 * k + (hash(i * 2.3) - 0.5) * 0.012
      const gy = YARD + 0.014 + hash(i * 5.1) * 0.012
      const gh = 0.02 + 0.008 * hash(i * 3.7)
      const gw = 0.008 + 0.003 * hash(i * 1.1)
      const tilt = (hash(i * 7.9) - 0.5) * 0.012
      this.shape([cap(gx * H, gy * H, (gx + tilt) * H, (gy - gh + gw) * H, gw * H, gw * H, grave)], this.lighting, 0.6)
      this.polygon([[(gx - gw) * H, gy * H], [(gx + gw) * H, gy * H], [(gx + gw + tilt * 0.5) * H, (gy - gh * 0.5) * H], [(gx - gw + tilt * 0.5) * H, (gy - gh * 0.5) * H]], grave)
    }
    this.pumpkins.push({ x: T(-tw - 0.012, YARD)[0], y: (YARD + 0.004) * H, r: 0.012 * H, carved: true, seed: 71, flare: 0 })
  }

  // A sagging string of paper lanterns from a to b (pixels), sag in screen heights.
  private paintString(ax: number, ay: number, bx: number, by: number, sag: number, seed: number) {
    const H = this.H
    const at = (t: number): [number, number] => [lerp(ax, bx, t), lerp(ay, by, t) + 4 * t * (1 - t) * sag * H]
    const line: Part[] = []
    for (let i = 0; i < 12; i++) line.push(cap(...at(i / 12), ...at((i + 1) / 12), this.thick(0.0012, 0.5), this.thick(0.0012, 0.5), this.paint([0.08, 0.06, 0.06])))
    this.shape(line, this.lighting, 0)
    const n = Math.max(3, Math.round(Math.hypot(bx - ax, by - ay) / (0.028 * H)))
    for (let i = 1; i < n; i++) {
      const [x, y] = at(i / n)
      this.lanterns.push({ x, y: y + 0.008 * H, r: 0.0075 * H, color: LANTERNS[(i + seed) % LANTERNS.length], seed: seed * 17 + i })
    }
  }

  // The gnarled bare tree on the hill's crest, its branches twisting up against the sky.
  private paintTree() {
    const { H } = this
    const x = this.crest + 0.015
    const y = this.hillY(x) + 0.008
    const bark = this.paint([0.2, 0.13, 0.1])
    const groups: Part[][] = []
    const grow = (px: number, py: number, angle: number, len: number, r: number, depth: number, seed: number, parts: Part[]) => {
      let ax = px
      let ay = py
      let a = angle
      for (let s = 0; s < 3; s++) {
        a += (hash(seed * 3.1 + s) - 0.5) * 0.9
        const bx = ax + Math.cos(a) * (len / 3)
        const by = ay + Math.sin(a) * (len / 3)
        const r1 = r * (1 - 0.18 * (s + 1))
        parts.push(cap(ax * H, ay * H, bx * H, by * H, Math.max(r * (1 - 0.18 * s) * H, this.cells ? 0.7 * this.px : 0.3 * this.px), Math.max(r1 * H, this.cells ? 0.7 * this.px : 0.3 * this.px), bark))
        ax = bx
        ay = by
      }
      if (depth === 0) return
      const kids = depth > 2 ? 3 : 2
      for (let i = 0; i < kids; i++) {
        const spread = (i - (kids - 1) / 2) * (0.55 + 0.25 * hash(seed + i * 7.7)) + (hash(seed * 1.9 + i) - 0.5) * 0.4
        // Branches droop and curl the further out they reach.
        const droop = depth <= 2 ? Math.sign(Math.cos(a + spread)) * 0.35 : 0
        grow(ax, ay, a + spread + droop, len * (0.62 + 0.12 * hash(seed * 4.3 + i)), r * 0.62, depth - 1, seed * 3 + i + 1, depth >= 4 ? (groups[groups.push([]) - 1] as Part[]) : parts)
      }
    }
    const trunk: Part[] = []
    groups.push(trunk)
    // A thick twisted trunk with roots, splitting low into big limbs.
    trunk.push(cap((x - 0.03) * H, (y + 0.004) * H, x * H, (y - 0.02) * H, 0.008 * H, 0.014 * H, bark), cap((x + 0.034) * H, (y + 0.006) * H, x * H, (y - 0.02) * H, 0.007 * H, 0.014 * H, bark))
    trunk.push(cap(x * H, y * H, (x - 0.008) * H, (y - 0.08) * H, 0.018 * H, 0.014 * H, bark), cap((x - 0.008) * H, (y - 0.08) * H, (x + 0.004) * H, (y - 0.12) * H, 0.014 * H, 0.011 * H, bark))
    grow(x + 0.004, y - 0.12, -Math.PI / 2 - 0.75, 0.13, 0.009, 4, 3, trunk)
    grow(x + 0.004, y - 0.12, -Math.PI / 2 + 0.6, 0.14, 0.009, 4, 11, trunk)
    grow(x - 0.006, y - 0.07, -Math.PI / 2 - 1.3, 0.1, 0.007, 3, 23, trunk)
    grow(x - 0.002, y - 0.1, -Math.PI / 2 + 1.2, 0.09, 0.006, 3, 31, trunk)
    for (const g of groups) if (g.length) this.shape(g, this.lighting, 0.6)
  }

  // Pumpkins on vines down the hill's lower slope, a few carved, and the scarecrow keeping watch.
  private paintPatch() {
    const { H, look } = this
    const k = this.k
    const vine = this.paint([0.24, 0.3, 0.1])
    const leaf = this.paint([0.3, 0.36, 0.12])
    const spots: [number, number][] = []
    for (let i = 0; i < 16; i++) {
      const x = lerp(0.06, 0.58, hash(i * 2.71)) * k
      const y = Math.max(this.hillY(x) + 0.02, lerp(0.66, 0.79, hash(i * 1.93)))
      if (y > FENCE - 0.012 || spots.some(([sx, sy]) => Math.hypot(sx - x, (sy - y) * 2) < 0.04)) continue
      spots.push([x, y])
    }
    spots.sort((a, b) => a[1] - b[1])
    for (const [i, [x, y]] of spots.entries()) {
      const r = (0.011 + 0.008 * hash(i * 5.3)) * (0.8 + 0.4 * smoothstep(0.66, 0.79, y))
      // A curling vine and a leaf or two beside each pumpkin.
      const a = hash(i * 9.1) * TAU
      this.shape([cap(x * H, y * H, (x + Math.cos(a) * 0.03) * H, (y + Math.sin(a) * 0.008) * H, this.thick(0.0015, 0.6), this.thick(0.0012, 0.5), vine)], this.lighting, 0.3)
      this.shape([ell((x + Math.cos(a) * 0.03) * H, (y + Math.sin(a) * 0.008 - 0.004) * H, 0.009 * H, 0.005 * H, a, leaf)], this.lighting, 0.6)
      this.pumpkins.push({ x: x * H, y: y * H, r: r * H, carved: hash(i * 4.4) < (look.night ? 0.45 : 0.3), seed: 200 + i, flare: 0 })
    }
    const sx = 0.42 * k
    this.scarecrow = { x: sx, y: Math.max(this.hillY(sx) + 0.03, 0.7) }
    this.drawScarecrow()
  }

  // The street: worn cobbles under the fences, a curb, and a strip of grass along the bottom.
  private paintStreet() {
    const { W, H, look, hdr, px } = this
    const s = look.street
    const cell = this.cells ? 2.4 : 1.4
    for (let y = Math.floor(FENCE * H); y < H; y++) {
      const v = (y + 0.5) / H
      const depth = smoothstep(FENCE, 1, v)
      for (let x = 0; x < W; x++) {
        const u = (x + 0.5) / H
        const o = (y * W + x) * 3
        // Cobbles in staggered rows, growing toward the viewer.
        const row = (v - FENCE) / (0.012 + 0.012 * depth)
        const ri = Math.floor(row)
        const col = (u * 30) / (1 + depth) + (ri % 2) * 0.5
        const ci = Math.floor(col)
        const fx = col - ci
        const fy = row - ri
        const gap = this.cells ? 1 : Math.min(1, smoothstep(0, 0.12, fx) * smoothstep(1, 0.88, fx) * smoothstep(0, 0.16, fy) * smoothstep(1, 0.84, fy) * 0.4 + 0.6)
        const tone = (0.82 + 0.3 * hash2(ci, ri)) * gap * (0.9 + 0.12 * hash2(Math.floor(x / px / cell), Math.floor(y / px / cell)))
        const curb = smoothstep(0.004, 0, Math.abs(v - (FENCE + 0.008)))
        const grass = smoothstep(0.952, 0.958, v)
        const shade = lerp(1, 1.25, depth)
        for (let c = 0; c < 3; c++) {
          const base = s[c] * tone * shade
          hdr[o + c] = lerp(lerp(base, s[c] * 1.5, curb), look.meadow[c] * (0.8 + 0.3 * fbm2(u * 20, v * 50, 2)), grass)
        }
      }
    }
  }

  // Fallen leaves drifted against the curb and in the grass, toward the sides.
  private paintFallen() {
    const { A, H } = this
    const k = this.k
    const r = this.thick(0.005, 1)
    for (let i = 0; i < 36; i++) {
      const side = i % 2 ? 1 : -1
      const d = hash(i * 3.3) ** 1.5 * 0.55 * k
      const x = side < 0 ? d : A - d
      const y = hash(i * 1.7) < 0.4 ? FENCE + 0.006 + hash(i * 5.9) * 0.008 : 0.958 + hash(i * 7.1) * 0.04
      const c = this.paint(LEAVES[i % LEAVES.length], 0.8)
      this.ellipse(x * H, y * H, r * 1.4, r * 0.8, c[0], c[1], c[2], 0.9)
    }
  }

  // Iron fences with spear-tipped bars and stone pillars, in front of the pumpkin patch and the houses, with lanterns
  // strung between tall posts over the patch.
  private paintFences() {
    const { A, H } = this
    const k = this.k
    this.paintFence(-0.02, 0.62 * k, 0.05)
    this.paintFence(A - 0.76 * k, A + 0.02, 0.045)
    const posts = [0.04 * k, 0.24 * k, 0.44 * k, 0.64 * k]
    const wood = this.paint([0.16, 0.11, 0.09])
    for (const x of posts) this.shape([cap(x * H, FENCE * H, x * H, (FENCE - 0.15) * H, this.thick(0.0028, 0.8), this.thick(0.0022, 0.7), wood)], this.lighting, 0.5)
    for (let i = 0; i + 1 < posts.length; i++) this.paintString(posts[i] * H, (FENCE - 0.145) * H, posts[i + 1] * H, (FENCE - 0.145) * H, 0.035, i + 5)
  }

  private paintFence(x0: number, x1: number, h: number) {
    const { H, look } = this
    const iron = this.paint([0.06, 0.05, 0.07])
    const bar = this.thick(0.0016, 0.55)
    const parts: Part[] = []
    const top = FENCE - h
    parts.push(cap(x0 * H, (top + 0.008) * H, x1 * H, (top + 0.008) * H, bar, bar, iron), cap(x0 * H, (FENCE - 0.008) * H, x1 * H, (FENCE - 0.008) * H, bar, bar, iron))
    const step = this.cells ? 0.026 : 0.018
    for (let x = x0 + step / 2; x < x1; x += step) parts.push(cap(x * H, FENCE * H, x * H, top * H, bar, bar, iron))
    this.shape(parts, this.lighting, 0.4)
    for (let x = x0 + step / 2; x < x1; x += step) this.polygon([[x * H - bar * 1.8, top * H], [x * H + bar * 1.8, top * H], [x * H, (top - 0.009) * H]], iron)
    // Stone pillars, each with a jack-o'-lantern on top.
    const stone = this.paint([0.42, 0.38, 0.4])
    const span = x1 - x0
    const n = Math.max(1, Math.round(span / 0.2))
    for (let i = 0; i <= n; i++) {
      const x = x0 + (span * i) / n
      if (x < 0.02 || x > this.A - 0.02) continue
      this.polygon([[(x - 0.011) * H, FENCE * H], [(x + 0.011) * H, FENCE * H], [(x + 0.011) * H, (top - 0.004) * H], [(x - 0.011) * H, (top - 0.004) * H]], stone)
      this.polygon([[(x - 0.014) * H, (top - 0.004) * H], [(x + 0.014) * H, (top - 0.004) * H], [(x + 0.014) * H, (top - 0.011) * H], [(x - 0.014) * H, (top - 0.011) * H]], [stone[0] * 0.8, stone[1] * 0.8, stone[2] * 0.8])
      if (look.style === "rim") this.rimEdges([[(x - 0.014) * H, (top - 0.011) * H], [(x + 0.014) * H, (top - 0.011) * H]])
      this.pumpkins.push({ x: x * H, y: (top - 0.011) * H, r: 0.0105 * H, carved: true, seed: 300 + i + Math.round(x * 50), flare: 0 })
    }
  }

  // Big jack-o'-lanterns grinning from both bottom corners, and a few small ones along the curb.
  private paintCorners() {
    const { A, H } = this
    const k = this.k
    const spots: [number, number, number][] = [
      [0.07 * k, 0.985, 0.04],
      [0.155 * k, 0.99, 0.028],
      [0.02 * k, 0.94, 0.02],
      [A - 0.08 * k, 0.985, 0.042],
      [A - 0.17 * k, 0.99, 0.026],
      [A - 0.025 * k, 0.945, 0.022],
    ]
    for (const [i, [x, y, r]] of spots.entries()) this.pumpkins.push({ x: x * H, y: y * H, r: r * H, carved: i !== 2, seed: 400 + i, flare: 0 })
    for (const [i, x] of [0.68 * k, A - 0.74 * k].entries()) this.pumpkins.push({ x: x * H, y: (FENCE + 0.016) * H, r: 0.009 * H, carved: true, seed: 450 + i, flare: 0 })
  }

  // A pumpkin: a ribbed body with a stem, its face glowing with candlelight scaled by light.
  private drawPumpkin(p: Pumpkin, light: number) {
    const look = this.look
    const { x, y, r } = p
    const cy = y - r * 0.85
    const skin: RGB = look.night || look.style === "rim" ? look.skin : this.paint(look.skin)
    if (light === 1) {
      this.shape([ell(x, cy, r * 1.22, r * 0.86, 0, skin, 4)], this.lighting, 0.7)
      this.shape([cap(x, cy - r * 0.75, x + r * 0.18, cy - r * 1.15, Math.max(r * 0.16, 0.5 * this.px), Math.max(r * 0.11, 0.4 * this.px), this.paint([0.3, 0.32, 0.1]))], this.lighting, 0.4)
    }
    if (!p.carved) return
    const g = look.glow * light
    const c: RGB = [CANDLE[0] * g, CANDLE[1] * g, CANDLE[2] * g]
    const rx = r * 1.22
    const ry = r * 0.86
    if (rx < 3.2 * this.px) {
      this.ellipse(x, cy + ry * 0.05, rx * 0.62, Math.max(ry * 0.32, 0.55 * this.px), c[0], c[1], c[2], 0.9)
      return
    }
    for (const s of [-1, 1]) this.polygon([[x + s * rx * 0.52, cy - ry * 0.02], [x + s * rx * 0.14, cy - ry * 0.02], [x + s * rx * 0.34, cy - ry * 0.48]], c)
    this.polygon([[x - rx * 0.08, cy + ry * 0.16], [x + rx * 0.08, cy + ry * 0.16], [x, cy + ry * 0.02]], c)
    const mouth: [number, number][] = []
    for (let i = 0; i <= 8; i++) {
      const u = -0.62 + (1.24 * i) / 8
      mouth.push([x + u * rx, cy + (0.26 + 0.36 * (1 - u * u / 0.4)) * ry * 0.85])
    }
    for (let i = 8; i >= 0; i--) {
      const u = -0.62 + (1.24 * i) / 8
      mouth.push([x + u * rx, cy + (0.24 + 0.12 * (1 - (u * u) / 0.4) + (i % 4 === 2 ? 0.14 : 0)) * ry])
    }
    this.polygon(mouth, c)
  }

  private drawLantern(l: Lantern, light: number) {
    const look = this.look
    const H = this.H
    const g = (look.lit > 0.3 ? look.glow : 0.35) * light
    const c = l.color
    this.shape([cap(l.x, l.y - l.r * 1.4, l.x, l.y - l.r * 0.9, Math.max(0.002 * H, 0.4 * this.px), Math.max(0.002 * H, 0.4 * this.px), this.paint([0.1, 0.08, 0.08]))], this.lighting, 0)
    this.ellipse(l.x, l.y, l.r * 0.9, l.r, c[0] * g * 0.7, c[1] * g * 0.7, c[2] * g * 0.7, 1)
    if (light === 1 && look.style === "front") this.shape([ell(l.x, l.y, l.r * 0.9, l.r, 0, [c[0] * 0.5, c[1] * 0.5, c[2] * 0.5])], this.lighting, 0.5)
  }

  // The scarecrow on its post in the patch: a patched coat, straw at the cuffs, a jack-o'-lantern head and a floppy
  // pointed hat. In teeming its right arm is drawn each frame, to wave.
  private drawScarecrow() {
    const { H } = this
    const { x, y } = this.scarecrow
    const wood = this.paint([0.3, 0.2, 0.12])
    const coat = this.paint([0.42, 0.22, 0.46])
    const straw = this.paint([0.85, 0.66, 0.25])
    const S = 0.13
    this.shape([cap(x * H, y * H, x * H, (y - S * 0.95) * H, this.thick(0.0025, 0.8), this.thick(0.0025, 0.8), wood)], this.lighting, 0.5)
    this.drawArm(-1, 0)
    if (this.activity !== "teeming") this.drawArm(1, 0)
    this.shape([cap(x * H, (y - S * 0.42) * H, x * H, (y - S * 0.7) * H, 0.018 * H, 0.015 * H, coat), ell(x * H, (y - S * 0.4) * H, 0.021 * H, 0.012 * H, 0, coat)], this.lighting, 0.7)
    this.shape([ell((x + 0.006) * H, (y - S * 0.5) * H, 0.006 * H, 0.006 * H, 0.3, this.paint([0.85, 0.45, 0.12]))], this.lighting, 0.4)
    for (const s of [-1, 1]) this.shape([cap((x + s * 0.008) * H, (y - S * 0.36) * H, (x + s * 0.012) * H, (y - S * 0.27) * H, 0.003 * H, 0.0015 * H, straw)], this.lighting, 0.3)
    this.pumpkins.push({ x: x * H, y: (y - S * 0.7) * H, r: 0.015 * H, carved: true, seed: 500, flare: 0 })
    const hat = this.paint([0.14, 0.1, 0.12])
    const hy = (y - S * 0.7 - 0.024) * H
    this.ellipse(x * H, hy, 0.025 * H, 0.0045 * H, hat[0], hat[1], hat[2], 1)
    this.polygon([[(x - 0.012) * H, hy], [(x + 0.012) * H, hy], [(x + 0.016) * H, hy - 0.026 * H], [(x + 0.027) * H, hy - 0.02 * H]], hat)
  }

  // One of the scarecrow's straw-stuffed arms along its crossbar, raised by wave (0 to 1) and waggling.
  private drawArm(side: number, wave: number) {
    const { H } = this
    const { x, y } = this.scarecrow
    const coat = this.paint([0.42, 0.22, 0.46])
    const straw = this.paint([0.85, 0.66, 0.25])
    const sy = y - 0.13 * 0.64
    const a = side > 0 ? -wave * (1.15 + 0.3 * Math.sin(this.time * 5)) : Math.PI
    const L = 0.05
    const ex = x + Math.cos(a) * L
    const ey = sy + Math.sin(a) * L * (side > 0 ? 1 : 0) + 0.004
    this.shape([cap(x * H, sy * H, ex * H, ey * H, 0.0065 * H, 0.0055 * H, coat)], this.lighting, 0.6)
    this.shape([cap(ex * H, ey * H, (ex + Math.cos(a) * 0.013) * H, (ey + Math.sin(a) * 0.013 + 0.004) * H, 0.0045 * H, 0.002 * H, straw)], this.lighting, 0.3)
  }

  // Bats loop around the moon, the tree and the spire; ghosts haunt the hill and the churchyard; the cat sits on the
  // patch's fence.
  private placeCreatures() {
    const { A } = this
    const k = this.k
    const anchors: [number, number][] = [
      [this.orb.x * A, this.orb.y],
      [A - 0.36 * k, 0.16],
      [this.crest + 0.08, 0.3],
      [A - 0.14 * k, 0.3],
      [this.orb.x * A + 0.15, 0.12],
      [A - 0.5 * k, 0.26],
    ]
    for (const [i, b] of this.bats.entries()) [b.ax, b.ay] = anchors[i % anchors.length]
    for (const [i, g] of this.ghosts.entries()) {
      const [x0, x1] = i === 0 ? [0.08 * k, 0.5 * k] : [A - 0.62 * k, A - 0.1 * k]
      g.x0 = x0
      g.x1 = x1
      if (g.x === 0) g.x = lerp(x0, x1, hash(i * 3.7 + 1))
      g.y = i === 0 ? 0.56 : 0.6
    }
    this.cat.x = 0.33 * k
    this.cat.y = FENCE - 0.05 - 0.011
  }

  private leaf(x: number, y: number): Leaf {
    return { x, y, fall: rand(0.008, 0.02), spin: rand(0, TAU), rate: rand(1, 2.5), color: LEAVES[Math.floor(Math.random() * LEAVES.length)], size: rand(0.005, 0.008) }
  }

  // Leaves tumble down and drift across, blown along by the gusts; spent ones come back from the tree or the left edge.
  private stepLeaves(dt: number) {
    for (const [i, l] of this.leaves.entries()) {
      const g = gust(l.x, this.time)
      l.x += (0.012 + 0.16 * g) * dt
      l.y += (l.fall + Math.sin(this.time * 0.9 + l.spin) * 0.01 - g * 0.01) * dt
      l.spin += l.rate * (1 + 2 * g) * dt
      if (l.x < this.A + 0.05 && l.y < 1.02) continue
      Object.assign(l, i % 2 ? this.leaf(this.crest + rand(-0.12, 0.14), rand(0.15, 0.32)) : this.leaf(-0.04, rand(0.05, 0.85)))
    }
  }

  private drawLeaves() {
    const H = this.H
    const r = this.thick(0.006, 1.1)
    const k = this.look.night ? 2.4 : this.look.style === "rim" ? 1.8 : 1
    for (const l of this.leaves) {
      const flip = Math.cos(l.spin)
      const c = this.paint(l.color, k)
      this.shape([ell(l.x * H, l.y * H, Math.max(r * (l.size / 0.006), 1), Math.max(r * 0.55 * Math.abs(flip) + 0.3, this.cells ? 0.7 : 0.4), l.spin * 0.6, c)], this.lighting, 0.3)
    }
  }

  private stepGhosts(cdt: number) {
    for (const g of this.ghosts) {
      g.phase += cdt
      g.x += g.dir * 0.05 * cdt
      if (g.x > g.x1) g.dir = -1
      if (g.x < g.x0) g.dir = 1
    }
  }

  // A sheet of ghostly light: a round head, a body trailing into a wavy hem, hollow eyes and an O of a mouth; it fades
  // in and out as it haunts.
  private drawGhost(g: Ghost) {
    const { H, look } = this
    const fade = smoothstep(-0.2, 0.6, Math.sin(g.phase * 0.35))
    if (fade <= 0.01) return
    const x = g.x * H
    const y = (g.y + Math.sin(g.phase * 1.3) * 0.012) * H
    const s = 0.04 * H
    const c = look.ghost
    const a = (look.night ? 0.55 : 0.45) * fade
    const lean = -g.dir * 0.25
    const pts: [number, number][] = []
    for (let i = 0; i <= 10; i++) {
      const t = i / 10
      const ang = Math.PI + t * Math.PI
      pts.push([x + Math.cos(ang) * s * 0.5, y - s * 0.5 + Math.sin(ang) * s * 0.5])
    }
    for (let i = 0; i <= 8; i++) {
      const t = i / 8
      const hx = x + s * 0.5 - t * s + lean * s
      pts.push([hx, y + s * (0.55 + 0.1 * Math.sin(t * TAU * 1.5 + g.phase * 6))])
    }
    if (look.night) lightPool(this.hdr, this.W, H, x, y, s * 1.6, s * 1.6, c, 0, 0.05 * fade)
    this.polygon(pts, c, a)
    const eye = this.paint([0.05, 0.03, 0.08])
    const e: RGB = look.night ? [0.01, 0.06, 0.06] : eye
    for (const sx of [-1, 1]) this.ellipse(x + sx * s * 0.17, y - s * 0.5, Math.max(s * 0.07, 0.7), Math.max(s * 0.11, 0.9), e[0], e[1], e[2], fade * 0.9)
    this.ellipse(x, y - s * 0.22, Math.max(s * 0.07, 0.6), Math.max(s * 0.09, 0.7), e[0], e[1], e[2], fade * 0.8)
  }

  private drawBatAt(b: Bat) {
    const t = this.creatureTime * b.w * 2.4 + b.phase
    const x = b.ax + b.rx * Math.sin(t)
    const y = b.ay + b.ry * Math.sin(2 * t + b.phase)
    this.drawBat(x, y, b.size, this.time * 22 + b.phase * 5, Math.cos(t) >= 0 ? 1 : -1)
  }

  // A bat: a small furry body with ears and two scalloped wings beating.
  private drawBat(bx: number, by: number, size: number, phase: number, dir: number) {
    const H = this.H
    const x = bx * H
    const y = by * H
    const s = size * H
    const flap = Math.sin(phase)
    const color = this.paint([0.08, 0.05, 0.09])
    for (const side of [-1, 1]) {
      const w = (u: number, v: number): [number, number] => [x + side * u * s, y + (v - flap * u * 0.7) * s]
      this.polygon([w(0.08, -0.1), w(0.5, -0.32), w(1, -0.22), w(0.82, 0.06), w(0.62, -0.02), w(0.42, 0.12), w(0.22, 0.04), w(0.08, 0.14)], color)
    }
    this.shape([ell(x, y, Math.max(s * 0.14, 0.8), Math.max(s * 0.2, 1), 0, color), ell(x + dir * s * 0.04, y - s * 0.2, Math.max(s * 0.1, 0.7), Math.max(s * 0.09, 0.7), 0, color)], this.lighting, 0.3)
    for (const side of [-1, 1]) this.polygon([[x + side * s * 0.02 + dir * s * 0.04, y - s * 0.24], [x + side * s * 0.1 + dir * s * 0.04, y - s * 0.24], [x + side * s * 0.08 + dir * s * 0.04, y - s * 0.38]], color)
  }

  // Every carved pumpkin, lantern and candlelit window flickers, dimmed after an error; their light pools on the
  // ground and anything passing.
  private drawLights() {
    const { H, look } = this
    const dim = 1 - 0.55 * this.gloom
    const night = look.night ? 1 : look.style === "rim" ? 0.7 : 0.25
    for (const p of this.pumpkins) {
      if (!p.carved) continue
      const f = (firelight(this.time * 2.2, p.seed) + p.flare) * dim
      this.drawPumpkin(p, f)
      const r = p.r * (5 + 3 * p.flare)
      this.lights.pool(p.x, p.y - p.r, r, r * 0.7, [1, 0.45, 0.1], (1.6 + 2 * p.flare) * night * f, 0.012 * (night + p.flare) * f)
    }
    for (const l of this.lanterns) {
      const f = (0.88 + 0.12 * Math.sin(this.time * 1.3 + l.seed * 2.1)) * dim
      this.drawLantern(l, f)
      if (look.lit > 0.3) this.lights.pool(l.x, l.y, 0.035 * H, 0.03 * H, l.color, 0.6 * night * f, 0.006 * night * f)
    }
    for (const c of this.candles) {
      const f = firelight(this.time * 1.8, c.seed) * dim
      const w = look.window
      const k = 0.75 + 0.35 * hash(c.seed * 3.1)
      this.polygon(c.pts, [w[0] * f * k, w[1] * f * k, w[2] * f * k])
    }
  }

  // The black cat on the fence: sitting tall, its tail curling and swishing, its eyes glowing after dark.
  private drawCat() {
    const { H, look } = this
    const x = this.cat.x * H
    const y = this.cat.y * H
    const s = 0.04 * H
    const color = this.paint([0.05, 0.04, 0.06])
    const swish = Math.sin(this.time * 0.9) * 0.35
    const tail = chain((t) => [x - s * 0.25 - Math.sin(t * 2.2 + swish) * s * 0.45 * t, y - s * 0.05 + t * s * 0.15 - Math.sin(t * Math.PI) * s * 0.55 * (1 + swish)], 6, s * 0.07, s * 0.05, color)
    this.shape([ell(x, y - s * 0.28, s * 0.22, s * 0.3, 0.15, color), ell(x + s * 0.06, y - s * 0.62, s * 0.14, s * 0.12, 0, color), ...tail], this.lighting, 0.4)
    for (const e of [-1, 1]) this.polygon([[x + s * 0.06 + e * s * 0.13, y - s * 0.66], [x + s * 0.06 + e * s * 0.03, y - s * 0.7], [x + s * 0.06 + e * s * 0.12, y - s * 0.84]], color)
    if (this.cat.blink < 0.15) return
    const glow: RGB = look.night || look.style === "rim" ? [1.2, 1.3, 0.2] : [0.6, 0.65, 0.15]
    for (const e of [-1, 1]) this.disc(x + s * 0.06 + e * s * 0.055, y - s * 0.63, Math.max(s * 0.035, 0.6), glow[0], glow[1], glow[2], 1)
  }

  private stepKids(cdt: number) {
    for (const kid of this.kids) {
      const d = kid.speed * cdt
      kid.x += kid.dir * d
      kid.phase += d / KID_STRIDE
      if (kid.dir > 0 && kid.x > this.A + 0.12) kid.x = -0.12
      if (kid.dir < 0 && kid.x < -0.12) kid.x = this.A + 0.12
    }
  }

  // A trick-or-treater in costume, walking with a pumpkin bucket swinging from one hand.
  private drawKid(kid: Kid) {
    const { H, look } = this
    const S = KID * H * (0.9 + 0.2 * smoothstep(WALK0, WALK1, kid.y))
    const x = kid.x * H
    const y = kid.y * H
    const d = kid.dir
    const [rl, ll] = stride(kid.phase, 0)
    const [rr, lr] = stride(kid.phase, 0.5)
    const bob = Math.abs(Math.sin(kid.phase * Math.PI)) * 0.02 * S
    const legs = this.paint([0.12, 0.1, 0.14])
    const hip = y - S * 0.32 - bob
    this.shape([cap(x, hip, x + d * rl * 0.09 * S, y - ll * 0.05 * S, 0.05 * S, 0.045 * S, legs), cap(x, hip, x + d * rr * 0.09 * S, y - lr * 0.05 * S, 0.05 * S, 0.045 * S, legs)], this.lighting, 0.6)
    const skin = this.paint([0.9, 0.66, 0.5])
    const head: [number, number] = [x + d * 0.02 * S, y - S * 0.82 - bob]
    const costume = kid.costume
    if (costume === "ghost") {
      const sheet = this.paint([0.86, 0.86, 0.9], look.night ? 2.2 : 1)
      const pts: [number, number][] = [[head[0] - 0.14 * S, head[1]], [head[0] - 0.24 * S, y - S * 0.2 - bob], [head[0] + 0.24 * S, y - S * 0.2 - bob], [head[0] + 0.14 * S, head[1]]]
      this.polygon(pts, sheet)
      this.shape([ell(head[0], head[1], 0.15 * S, 0.15 * S, 0, sheet)], this.lighting, 0.7)
      for (const e of [-1, 1]) this.disc(head[0] + e * 0.05 * S + d * 0.03 * S, head[1] - 0.01 * S, Math.max(0.03 * S, 0.5), 0.02, 0.02, 0.03, 1)
    }
    if (costume === "witch") {
      const dress = this.paint([0.24, 0.1, 0.3])
      this.polygon([[x - 0.06 * S, y - S * 0.64 - bob], [x + 0.06 * S, y - S * 0.64 - bob], [x + 0.2 * S, y - S * 0.25 - bob], [x - 0.2 * S, y - S * 0.25 - bob]], dress)
      this.shape([ell(head[0], head[1], 0.12 * S, 0.12 * S, 0, this.paint([0.55, 0.75, 0.35]))], this.lighting, 0.6)
      const hat = this.paint([0.1, 0.06, 0.12])
      this.ellipse(head[0], head[1] - 0.08 * S, 0.22 * S, Math.max(0.03 * S, 0.6), hat[0], hat[1], hat[2], 1)
      this.polygon([[head[0] - 0.11 * S, head[1] - 0.08 * S], [head[0] + 0.11 * S, head[1] - 0.08 * S], [head[0] - d * 0.08 * S, head[1] - 0.42 * S]], hat)
    }
    if (costume === "pumpkin") {
      const orange: RGB = look.style === "front" ? this.paint([0.95, 0.45, 0.06]) : look.skin
      this.shape([ell(x, y - S * 0.48 - bob, 0.22 * S, 0.2 * S, 0, orange, 3)], this.lighting, 0.7)
      this.shape([ell(head[0], head[1], 0.12 * S, 0.12 * S, 0, skin), cap(head[0], head[1] - 0.12 * S, head[0] + 0.02 * S, head[1] - 0.2 * S, 0.035 * S, 0.025 * S, this.paint([0.25, 0.4, 0.1]))], this.lighting, 0.6)
    }
    if (costume === "devil") {
      const red = this.paint([0.8, 0.1, 0.08])
      this.shape([cap(x, y - S * 0.3 - bob, x, y - S * 0.62 - bob, 0.14 * S, 0.12 * S, red), ell(head[0], head[1], 0.12 * S, 0.12 * S, 0, red)], this.lighting, 0.7)
      for (const e of [-1, 1]) this.polygon([[head[0] + e * 0.1 * S, head[1] - 0.06 * S], [head[0] + e * 0.03 * S, head[1] - 0.1 * S], [head[0] + e * 0.12 * S, head[1] - 0.22 * S]], red)
      this.shape(chain((t) => [x - d * (0.12 + 0.2 * t) * S, y - S * (0.34 - 0.18 * t + 0.12 * Math.sin(t * 3 + kid.phase * 2))], 4, 0.025 * S, 0.02 * S, red), this.lighting, 0.3)
    }
    // The bucket swings from the forward hand.
    const swing = Math.sin(kid.phase * Math.PI * 2) * 0.25
    const hx = x + d * 0.17 * S
    const hy = y - S * 0.46 - bob
    const bx = hx + Math.sin(swing) * 0.12 * S
    const byy = hy + Math.cos(swing) * 0.12 * S
    const arm = costume === "ghost" ? this.paint([0.86, 0.86, 0.9], look.night ? 2.2 : 1) : costume === "devil" ? this.paint([0.8, 0.1, 0.08]) : costume === "witch" ? this.paint([0.24, 0.1, 0.3]) : skin
    this.shape([cap(x + d * 0.04 * S, y - S * 0.62 - bob, hx, hy, 0.04 * S, 0.035 * S, arm)], this.lighting, 0.5)
    const bucket: RGB = look.style === "front" ? this.paint([0.98, 0.5, 0.06]) : look.skin
    this.shape([ell(bx, byy + 0.06 * S, 0.1 * S, 0.08 * S, 0, bucket, 3)], this.lighting, 0.6)
    if (look.style === "rim") {
      const g = look.glow
      this.ellipse(bx, byy + 0.065 * S, 0.06 * S, Math.max(0.025 * S, 0.5), CANDLE[0] * g * 0.7, CANDLE[1] * g * 0.7, CANDLE[2] * g * 0.7, 1)
      this.lights.pool(bx, byy, 0.05 * H, 0.035 * H, [1, 0.45, 0.1], 1.2, 0.006)
    }
  }

  private startWitch() {
    const w = this.witch
    w.t = 0
    w.dir = Math.random() < 0.5 ? 1 : -1
    w.y = this.orb.y
  }

  private stepWitch(dt: number, cdt: number) {
    const w = this.witch
    if (w.t < 0) {
      if (this.activity !== "teeming") return
      w.wait -= dt
      if (w.wait > 0) return
      w.wait = rand(...WITCH_GAP)
      this.startWitch()
      return
    }
    w.t += cdt * 0.32
    if (w.t > 1) w.t = -1
  }

  // The witch's place on her crossing: from one edge to the other, swooping through the moon's disc.
  private witchAt(t: number): [number, number] {
    const w = this.witch
    const A = this.A
    const mx = this.orb.x * A
    const x = w.dir > 0 ? lerp(-0.15, A + 0.15, t) : lerp(A + 0.15, -0.15, t)
    const reach = Math.max(mx + 0.15, A - mx + 0.15)
    return [x, w.y + 0.06 * ((x - mx) / reach) * w.dir - 0.05 * Math.exp(-(((x - mx) / 0.25) ** 2)) + 0.05 + Math.sin(t * 9) * 0.006]
  }

  // A witch riding side-on: a broomstick with its bristles, a cape billowing behind, a pointed hat.
  private drawWitch() {
    const H = this.H
    const [wx, wy] = this.witchAt(this.witch.t)
    const x = wx * H
    const y = wy * H
    const s = 0.05 * H
    const d = this.witch.dir
    const dark = this.paint([0.09, 0.06, 0.1])
    const broom = this.paint([0.3, 0.2, 0.1])
    const bristle = this.paint([0.55, 0.4, 0.18])
    const flap = Math.sin(this.time * 7) * 0.12
    this.polygon([[x - d * s * 0.95, y + s * 0.1], [x - d * s * 1.55, y - s * 0.12], [x - d * s * 1.7, y + s * 0.2], [x - d * s * 1.5, y + s * 0.42]], bristle)
    this.shape([cap(x - d * s * 1.05, y + s * 0.12, x + d * s * 1.05, y - s * 0.06, Math.max(s * 0.05, 0.6), Math.max(s * 0.04, 0.6), broom)], this.lighting, 0.5)
    this.polygon([[x - d * s * 0.05, y - s * 0.55], [x - d * s * 1.05, y - s * (0.2 + flap)], [x - d * s * 0.85, y + s * (0.05 - flap)], [x - d * s * 0.2, y + s * 0.02]], dark)
    this.shape([ell(x, y - s * 0.22, s * 0.2, s * 0.3, d * 0.3, dark), ell(x + d * s * 0.14, y - s * 0.62, s * 0.12, s * 0.12, 0, dark), cap(x + d * s * 0.08, y - s * 0.42, x + d * s * 0.55, y - s * 0.02, s * 0.06, s * 0.05, dark), cap(x + d * s * 0.05, y - s * 0.05, x + d * s * 0.35, y + s * 0.32, s * 0.07, s * 0.05, dark)], this.lighting, 0.5)
    this.ellipse(x + d * s * 0.14, y - s * 0.7, s * 0.3, Math.max(s * 0.05, 0.7), dark[0], dark[1], dark[2], 1)
    this.polygon([[x + d * s * 0.0, y - s * 0.72], [x + d * s * 0.3, y - s * 0.72], [x - d * s * 0.3, y - s * 1.25]], dark)
  }

  private stepRider(dt: number, cdt: number) {
    const r = this.rider
    if (r.t < 0) {
      r.wait -= dt
      if (r.wait > 0) return
      r.t = 0
      r.dir = Math.random() < 0.5 ? 1 : -1
      r.gait = gait(r.dir)
      return
    }
    r.t += cdt
    stepGait(r.gait, (((this.A + 0.6) / GALLOP) * cdt) / 0.09, cdt, r.dir)
    if (r.t < GALLOP) return
    r.t = -1
    r.wait = eggWait(true) * TIME_SCALE
  }

  // The egg: a headless rider in a billowing cape gallops a black horse along the street, holding a blazing
  // jack-o'-lantern high.
  private drawRider() {
    const { H, look } = this
    const r = this.rider
    const p = r.t / GALLOP
    const x = (r.dir > 0 ? lerp(-0.3, this.A + 0.3, p) : lerp(this.A + 0.3, -0.3, p)) * H
    const y = 0.94 * H
    const S = 0.13 * H
    const g = r.gait
    const P = body(x, y, S, g.turn)
    const dark = this.paint([0.06, 0.04, 0.07])
    const coat = this.paint([0.12, 0.05, 0.14])
    const rise = Math.abs(Math.sin(g.phase * Math.PI * 2)) * 0.035
    const legs = { fore: 0.27, hind: 0.27, top: 0.52 - rise, w: 0.07, a: 0.26, b: 0.26, reach: 0.2, lift: 0.14, r: [0.09, 0.045, 0.035] as [number, number, number], color: dark, paw: [0.045, dark] as [number, RGB] }
    const nod = Math.sin(g.phase * Math.PI * 2) * 0.03
    const mane = (t: number) => P(0.36 - 0.12 * t, -0.95 + 0.25 * t - rise + nod * (1 - t))
    const tail = (t: number) => P(-0.4 - 0.32 * t, -0.68 - rise + 0.12 * t - 0.06 * Math.sin(t * 3 + g.phase * 5))
    this.shape(quadruped(P, g, true, legs), this.lighting, 0.5)
    this.shape(
      [
        ...quadruped(P, g, false, legs),
        ell(...P(0, -0.62 - rise), P.len(0.32, 0.12), 0.15 * S, 0, dark),
        ell(...P(0.22, -0.64 - rise), P.len(0.14, 0.12), 0.15 * S, 0, dark),
        ell(...P(-0.24, -0.64 - rise), P.len(0.15, 0.12), 0.16 * S, 0, dark),
        cap(...P(0.3, -0.7 - rise), ...P(0.42, -0.96 - rise + nod), 0.11 * S, 0.06 * S, dark),
        cap(...P(0.42, -0.96 - rise + nod), ...P(0.6, -0.84 - rise + nod), 0.065 * S, 0.04 * S, dark),
        ell(...P(0.4, -1.02 - rise + nod), 0.02 * S, 0.04 * S, 0, dark),
        ...chain(mane, 3, 0.04 * S, 0.03 * S, dark),
        ...chain(tail, 4, 0.05 * S, 0.025 * S, dark),
      ],
      this.lighting,
      0.5,
    )
    // The rider: a long cape streaming back, a high empty collar, one arm on the reins and one raising the lantern.
    const flap = Math.sin(this.time * 9) * 0.05
    this.polygon([P(0.02, -1.22 - rise), P(-0.6, -1.08 - rise + flap), P(-0.7, -0.84 - rise - flap), P(-0.06, -0.78 - rise)], coat)
    this.shape(
      [
        cap(...P(-0.02, -0.8 - rise), ...P(0.02, -1.18 - rise), 0.075 * S, 0.07 * S, dark),
        cap(...P(0, -0.78 - rise), ...P(0.12, -0.64 - rise), 0.05 * S, 0.04 * S, dark),
        cap(...P(0.12, -0.64 - rise), ...P(0.12, -0.5 - rise), 0.04 * S, 0.035 * S, dark),
        cap(...P(0.02, -1.12 - rise), ...P(0.2, -0.95 - rise), 0.035 * S, 0.03 * S, dark),
        cap(...P(0.02, -1.14 - rise), ...P(0.16, -1.42 - rise), 0.035 * S, 0.03 * S, dark),
        ell(...P(0.02, -1.2 - rise), 0.07 * S, 0.03 * S, 0, coat),
      ],
      this.lighting,
      0.5,
    )
    const [lx, ly] = P(0.17, -1.44 - rise)
    const f = firelight(this.time * 4, 9) * (look.night ? 1.4 : 1)
    const lantern = { x: lx, y: ly + 0.1 * S, r: 0.08 * S, carved: true, seed: 9, flare: 0 }
    this.drawPumpkin(lantern, 1)
    this.drawPumpkin(lantern, f * 1.5)
    this.lights.pool(lx, ly, 0.2 * H, 0.16 * H, [1, 0.42, 0.08], 3 * f, 0.02 * f)
  }

  // Restores the hill, tree, town and fences over clouds and storm drawn in front of them, within the box.
  private unsky(x0: number, y0: number, x1: number, y1: number) {
    restoreFore(this.hdr, this.background, this.fore, this.W, x0, y0, x1, Math.min(this.H - 1, y1))
  }

  // A thick straight line from a to b (pixels), radius in screen heights.
  private edge(a: [number, number], b: [number, number], radius: number, color: RGB) {
    const r = this.thick(radius, 0.5)
    this.shape([cap(a[0], a[1], b[0], b[1], r, r, color)], this.lighting, 0)
  }

  // A thin line of rim light along an outline (pixels) facing the sun or moon.
  private rimEdges(pts: [number, number][]) {
    const look = this.look
    const r = this.thick(0.0012, 0.45)
    const lx = this.orb.x * this.W
    const parts: Part[] = []
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, ay] = pts[i]
      const [bx, by] = pts[i + 1]
      const mx = (ax + bx) / 2
      const facing = clamp(((lx - mx) / this.H) * 2, -1, 1)
      if (facing <= 0.05 && Math.abs(ay - by) > Math.abs(ax - bx)) continue
      parts.push(cap(ax, ay, bx, by, r, r, this.light))
    }
    if (!parts.length) return
    const k = look.night ? 0.12 : 0.22
    const c: RGB = [this.light[0] * k, this.light[1] * k, this.light[2] * k]
    this.shape(parts.map((p) => ({ ...p, color: c })), this.lighting, 0)
  }
}

// A band of ground fog, rows high from y0, tiled seamlessly across the width: thicker in long low drifts.
function makeFog(W: number, H: number, y0: number, rows: number) {
  const tex = new Float32Array(W * rows)
  for (let j = 0; j < rows; j++) {
    const v = (y0 + j + 0.5) / H
    const band = smoothstep(0.6, 0.72, v) * (1 - smoothstep(0.78, 0.88, v))
    for (let x = 0; x < W; x++) {
      const n = (sx: number) => fbm2((sx / H) * 2.2, v * 16, 3)
      // Blending with the same noise one width over makes the pattern repeat without a seam.
      const t = x / W
      tex[j * W + x] = band * (n(x) * (1 - t) + n(x - W) * t)
    }
  }
  return tex
}

// Mixes the fog band toward color, its two layers sliding past each other at off1 and off2 pixels.
function creep(hdr: Float32Array, W: number, H: number, tex: Float32Array, y0: number, rows: number, off1: number, off2: number, color: RGB, alpha: number) {
  const i1 = Math.floor(off1)
  const f1 = off1 - i1
  const i2 = Math.floor(off2)
  const f2 = off2 - i2
  for (let j = 0; j < rows; j++) {
    const y = y0 + j
    if (y >= H) break
    const row = j * W
    for (let x = 0; x < W; x++) {
      const a0 = (((x + i1) % W) + W) % W
      const a = tex[row + a0] * (1 - f1) + tex[row + ((a0 + 1) % W)] * f1
      const b0 = (((x - i2) % W) + W) % W
      const b = tex[row + b0] * (1 - f2) + tex[row + ((b0 + W - 1) % W)] * f2
      const d = Math.min(0.9, alpha * smoothstep(0.25, 0.75, (a + b) * 0.5) * 2.2)
      if (d <= 0.003) continue
      const o = (y * W + x) * 3
      hdr[o] += (color[0] - hdr[o]) * d
      hdr[o + 1] += (color[1] - hdr[o + 1]) * d
      hdr[o + 2] += (color[2] - hdr[o + 2]) * d
    }
  }
}

// Copies the background back over the pixels marked in fore, inside the box.
function restoreFore(hdr: Float32Array, background: Float32Array, fore: Uint8Array, W: number, x0: number, y0: number, x1: number, y1: number) {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const i = y * W + x
      if (!fore[i]) continue
      hdr[i * 3] = background[i * 3]
      hdr[i * 3 + 1] = background[i * 3 + 1]
      hdr[i * 3 + 2] = background[i * 3 + 2]
    }
}

export const halloween: Wallpaper = {
  id: "halloween",
  name: "Halloween",
  description: "A crooked little town where it's always Halloween, with glowing jack-o'-lanterns, a gnarled tree on the hill and a huge moon, and a witch flying by now and then",
  activity: {
    calm: "Jack-o'-lanterns and lanterns flicker, leaves drift and fog creeps through the town",
    lively: "Adds bats fluttering about, ghosts drifting slowly and a black cat on the fence",
    teeming: "Adds trick-or-treaters walking the street, a witch crossing the moon and the scarecrow waving",
  },
  scrim: {
    day: [
      [46, 40, 50],
      [56, 42, 32],
      [36, 28, 24],
    ],
    sunset: [
      [24, 8, 30],
      [46, 16, 22],
      [14, 6, 12],
    ],
    night: [
      [4, 2, 14],
      [8, 4, 22],
      [5, 3, 12],
    ],
  },
  create: (settings) => new Halloween(settings),
}
