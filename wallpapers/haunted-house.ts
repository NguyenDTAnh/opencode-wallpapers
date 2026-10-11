import { Canvas, cap, ell, type Lighting, type Part } from "../src/canvas"
import { stride } from "../src/creature"
import { eggWait } from "../src/egg"
import { flyAway, startle, type Flier } from "../src/flock"
import { lightPool } from "../src/light"
import { LightMap, firelight } from "../src/lightmap"
import { TAU, clamp, fbm1, fbm2, hash, lerp, rand, smoothstep, type RGB } from "../src/math"
import { driftClouds, makeClouds, makeStars, makeStorm, paintClouds, paintSky, paintStars, paintStorm, type Cloud, type Orb, type Star } from "../src/sky"
import { touch } from "../src/touched"
import type { Activity, Settings, Time, Wallpaper } from "../src/wallpaper"
import { WeatherLayer } from "../src/weather"
import { gust } from "../src/wind"

// The scene runs slower than real time, which keeps it calm behind text.
const TIME_SCALE = 0.35
// The zombie, ghoul, ghosts, bats and witch move at a quarter of scene speed.
const CREATURE_SPEED = 0.25
// The far ridge meets the sky at HORIZON; the graveyard's back fence stands on FENCE and the zombie shuffles between
// WALK0 and WALK1, in screen heights from the top.
const HORIZON = 0.62
const FENCE = 0.745
const WALK0 = 0.84
const WALK1 = 0.9
// The zombie's height and stride, in screen heights.
const ZOMBIE = 0.12
const ZOMBIE_STRIDE = 0.05
// Teeming: scene seconds between the witch's crossings, and how long the light takes to pass from room to room.
const WITCH_GAP: [number, number] = [70, 140]
const ROOM = 5
// The egg: zombies climb out of their graves and dance for this many scene seconds.
const DANCE = 45

// Everything that changes with the time of day. Objects keep one daytime color and paint() darkens it; the lights
// (windows, candle, pumpkins, lantern) and the big surfaces have their own colors per look. Night keeps every
// highlight amber, orange, violet or teal: the text on top is white.
interface Look {
  style: "front" | "rim"
  light: RGB
  sky: [number, RGB][]
  // The sun or moon, its x in screen heights from the house's middle.
  orb: Orb
  stars: number
  clouds: [top: RGB, bottom: RGB]
  cloudKind: "stratus" | "wisp"
  ridge: [far: RGB, near: RGB]
  grass: RGB
  dirt: RGB
  walls: RGB
  trim: RGB
  roof: RGB
  stone: RGB
  glass: RGB
  window: RGB
  // How bright windows, pumpkins, the candle and the lantern glow.
  glow: number
  fog: RGB
  fogAlpha: number
  ghost: RGB
  zombie: RGB
  skin: RGB
  tint: RGB
  night: boolean
}

const LOOKS: Record<Time, Look> = {
  // A grim overcast afternoon: a low sickly green-gray sky with a pale sun behind it, the house gray and peeling.
  day: {
    style: "front",
    light: [0.9, 0.95, 0.8],
    sky: [
      [0, [0.3, 0.34, 0.33]],
      [0.35, [0.47, 0.52, 0.45]],
      [HORIZON, [0.66, 0.7, 0.56]],
    ],
    orb: { x: -0.08, y: 0.2, r: 0.05, core: [1.05, 1.1, 0.88], glow: [0.4, 0.45, 0.32], near: 0.22, wide: 0.12 },
    stars: 0,
    clouds: [
      [0.62, 0.66, 0.56],
      [0.34, 0.38, 0.34],
    ],
    cloudKind: "stratus",
    ridge: [
      [0.46, 0.5, 0.43],
      [0.33, 0.37, 0.3],
    ],
    grass: [0.27, 0.31, 0.2],
    dirt: [0.3, 0.26, 0.2],
    walls: [0.4, 0.4, 0.38],
    trim: [0.24, 0.24, 0.24],
    roof: [0.14, 0.14, 0.15],
    stone: [0.34, 0.36, 0.33],
    glass: [0.08, 0.09, 0.09],
    window: [0.95, 0.75, 0.35],
    glow: 0.5,
    fog: [0.5, 0.56, 0.48],
    fogAlpha: 0.24,
    ghost: [0.7, 0.95, 0.82],
    zombie: [0.45, 0.58, 0.36],
    skin: [0.82, 0.4, 0.07],
    tint: [0.85, 0.9, 0.85],
    night: false,
  },
  // A blood-orange sun sinking behind the house, the sky going purple overhead and everything in silhouette.
  sunset: {
    style: "rim",
    light: [1.4, 0.4, 0.12],
    sky: [
      [0, [0.07, 0.02, 0.12]],
      [0.25, [0.28, 0.05, 0.2]],
      [0.45, [0.85, 0.18, 0.1]],
      [HORIZON, [1.3, 0.42, 0.1]],
    ],
    orb: { x: -0.29, y: 0.52, r: 0.09, core: [2.6, 0.55, 0.12], glow: [1, 0.26, 0.07], near: 0.55, wide: 0.35 },
    stars: 10,
    clouds: [
      [0.08, 0.02, 0.08],
      [0.9, 0.25, 0.12],
    ],
    cloudKind: "stratus",
    ridge: [
      [0.3, 0.07, 0.14],
      [0.14, 0.035, 0.09],
    ],
    grass: [0.07, 0.025, 0.05],
    dirt: [0.09, 0.03, 0.05],
    walls: [0.08, 0.03, 0.07],
    trim: [0.05, 0.02, 0.05],
    roof: [0.035, 0.012, 0.035],
    stone: [0.14, 0.05, 0.1],
    glass: [0.03, 0.01, 0.03],
    window: [1.5, 0.62, 0.16],
    glow: 0.95,
    fog: [0.45, 0.13, 0.2],
    fogAlpha: 0.32,
    ghost: [0.4, 1, 0.72],
    zombie: [0.45, 0.58, 0.36],
    skin: [0.5, 0.15, 0.03],
    tint: [0.28, 0.1, 0.18],
    night: false,
  },
  // Deep violet and indigo under a huge gold-orange moon behind the turret, the windows and pumpkins glowing.
  night: {
    style: "rim",
    light: [1, 0.58, 0.2],
    sky: [
      [0, [0.01, 0.006, 0.04]],
      [0.3, [0.04, 0.018, 0.12]],
      [HORIZON, [0.12, 0.05, 0.24]],
    ],
    orb: { x: -0.04, y: 0.22, r: 0.13, core: [1.7, 0.66, 0.15], glow: [0.75, 0.26, 0.06], near: 0.4, wide: 0.2, moon: true },
    stars: 90,
    clouds: [
      [0.02, 0.012, 0.06],
      [0.1, 0.05, 0.2],
    ],
    cloudKind: "wisp",
    ridge: [
      [0.065, 0.032, 0.14],
      [0.032, 0.015, 0.075],
    ],
    grass: [0.026, 0.02, 0.055],
    dirt: [0.035, 0.02, 0.05],
    walls: [0.05, 0.035, 0.1],
    trim: [0.03, 0.02, 0.07],
    roof: [0.018, 0.01, 0.04],
    stone: [0.09, 0.07, 0.18],
    glass: [0.02, 0.012, 0.04],
    window: [1.6, 0.76, 0.2],
    glow: 1.25,
    fog: [0.14, 0.08, 0.3],
    fogAlpha: 0.42,
    ghost: [0.22, 1.1, 0.78],
    zombie: [0.25, 0.55, 0.3],
    skin: [0.32, 0.1, 0.02],
    tint: [0.1, 0.06, 0.18],
    night: true,
  },
}

const DAYLIGHT = (() => {
  const l = Math.hypot(0.4, 0.7, 0.6)
  return [-0.4 / l, -0.7 / l, 0.6 / l] as const
})()

// Candlelight, the lightning's color, and the dead leaves.
const CANDLE: RGB = [2.3, 1.05, 0.22]
const BOLT: RGB = [0.75, 0.6, 1.6]
const LEAVES: RGB[] = [
  [0.6, 0.32, 0.08],
  [0.5, 0.2, 0.08],
  [0.55, 0.45, 0.15],
  [0.35, 0.2, 0.1],
]

type Point = [number, number]

// A pumpkin standing at (x, y) in pixels, radius r; carved ones glow from inside and flicker.
interface Pumpkin {
  x: number
  y: number
  r: number
  seed: number
  flare: number
}

// A window of the house: its glass corners in pixels, its middle and size, what state it is in, and its place in the
// order the wandering light passes through the rooms (-1 for boarded windows it skips).
interface Window {
  pts: Point[]
  x: number
  y: number
  w: number
  h: number
  kind: "glow" | "dark" | "boarded" | "candle"
  room: number
  seed: number
  flash: number
}

// A gravestone: where it stands in screen heights, its size, lean and shape.
interface Stone {
  x: number
  y: number
  s: number
  tilt: number
  kind: number
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

interface Leaf {
  x: number
  y: number
  fall: number
  spin: number
  rate: number
  color: RGB
}

class HauntedHouse extends Canvas {
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
  // Scale for narrow screens, the house's middle and the ground it stands on, and the orb, in screen heights.
  private k = 1
  private hx = 1.4
  private hy = 0.6
  private orb: Orb
  // Pixels the house, tree and graveyard cover, which clouds and stars stay behind.
  private fore = new Uint8Array(0)
  private fog = new Float32Array(0)
  private fogY0 = 0
  private fogRows = 0
  private pumpkins: Pumpkin[] = []
  private windows: Window[] = []
  private rooms = 0
  private stones: Stone[] = []
  private lantern = { x: 0, y: 0, len: 0.05 }
  private swing = { x: 0, y: 0, len: 0.12 }
  private grave = { x: 0.3, y: 0.92 }
  private bats: Bat[] = []
  // Bats streaming out of the turret's top window, and those a click sends up.
  private stream: Flier[] = []
  private streamWait = 0
  private burst: Flier[] = []
  private ghosts: Ghost[] = []
  private leaves: Leaf[] = []
  private ghoul = { stone: -1, t: -1, wait: rand(6, 16), dur: 9 }
  private hand = { t: -1, wait: rand(10, 25) }
  private zombie = { x: 0.5, y: 0.87, dir: 1, phase: 0 }
  private flash = { t: -1, wait: 0, x: 0.5 }
  private witch = { t: -1, wait: rand(20, 50), dir: 1, y: 0.2 }
  private dance = { wait: eggWait() * TIME_SCALE, t: -1 }

  constructor(settings: Settings) {
    super()
    this.activity = settings.activity
    this.look = LOOKS[settings.time]
    this.orb = this.look.orb
    this.weather = new WeatherLayer(settings.weather ?? "clear", settings.time, HORIZON)
    this.stars = makeStars(this.look.stars, 0.5)
    this.clouds = makeClouds(settings.time === "day" ? 7 : 4, this.look.cloudKind, 0.05, 0.32)
    const n = { calm: 6, lively: 9, teeming: 12 }[settings.activity]
    this.leaves = Array.from({ length: n }, () => this.leaf(Math.random() * 2, rand(0.05, 0.95)))
    const bats = { calm: 2, lively: 4, teeming: 6 }[settings.activity]
    this.bats = Array.from({ length: bats }, (_, i) => ({ ax: 0, ay: 0, rx: rand(0.05, 0.1), ry: rand(0.02, 0.05), w: rand(0.9, 1.4), phase: rand(0, TAU), size: rand(0.018, 0.026) + (i === 0 ? 0.006 : 0) }))
    this.flash.wait = rand(2, 6)
    if (settings.activity === "calm") return
    const ghosts = settings.activity === "teeming" ? 2 : 1
    this.ghosts = Array.from({ length: ghosts }, (_, i) => ({ x: 0, y: 0, x0: 0, x1: 0, dir: i ? -1 : 1, phase: rand(0, TAU) }))
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
    for (const p of this.pumpkins) p.flare = Math.max(0, p.flare - dt * 0.35)
    for (const w of this.windows) w.flash = Math.max(0, w.flash - dt * 0.2)
    this.burst = flyAway(this.burst, dt, this.A)
    this.stepStream(dt)
    this.stepLeaves(dt)
    this.stepGhosts(cdt)
    this.stepGhoul(dt)
    this.stepHand(dt)
    this.stepZombie(cdt)
    this.stepLightning(dt)
    this.stepWitch(dt, cdt)
    this.stepDance(dt)
  }

  render() {
    this.restore()
    const { W, H, look, hdr } = this
    if (!this.weather.covered) paintStars(hdr, W, H, this.shown, this.time, 0.5, look.night ? 0.8 : 0.4, this.points)
    const [top, bottom] = this.weather.scud ?? look.clouds
    paintClouds(hdr, W, H, this.clouds, top, bottom, look.night ? 0.75 : 0.6, this.weather.covered ? undefined : this.orb)
    if (this.gloom > 0) paintStorm(hdr, W, H, this.storm, [0.16, 0.1, 0.22], [0.04, 0.02, 0.06], this.gloom)
    if (this.flash.t >= 0) this.drawLightning()
    this.unsky(0, 0, W - 1, Math.ceil(HORIZON * H))
    if (this.witch.t >= 0) this.drawWitch()
    for (const b of this.bats) this.drawBatAt(b)
    for (const b of this.stream) this.drawBat(b.x, b.y, 0.016, b.phase, Math.sign(b.vx))
    this.lights.clear(W, H)
    this.drawWindows()
    for (const g of this.ghosts) this.drawGhost(g)
    this.drawSwing()
    creep(hdr, W, H, this.fog, this.fogY0, this.fogRows, this.time * 1.6, this.time * 1.1, look.fog, look.fogAlpha)
    touch(hdr, 0, this.fogY0, W - 1, this.fogY0 + this.fogRows - 1)
    this.drawPumpkins()
    if (this.ghoul.t >= 0) this.drawGhoul()
    if (this.hand.t >= 0) this.drawHand(this.grave.x, this.grave.y, this.hand.t)
    if (this.activity === "teeming") this.drawZombie(this.zombie.x, this.zombie.y, this.zombie.dir, this.zombie.phase, 0, 1)
    if (this.dance.t >= 0) this.drawDance()
    this.lights.apply(hdr)
    this.drawLeaves()
    for (const b of this.burst) this.drawBat(b.x, b.y, 0.02, b.phase, Math.sign(b.vx))
    this.weather.draw(hdr, W, H)
    this.finish()
  }

  // The witch flies past across the moon, and every window and pumpkin flares.
  protected override visit() {
    for (const w of this.windows) if (w.kind !== "boarded") w.flash = Math.max(w.flash, 0.6)
    for (const p of this.pumpkins) p.flare = Math.max(p.flare, 0.8)
    if (this.witch.t < 0) this.startWitch()
  }

  // A click on a window flashes it with a silhouette standing inside; by a gravestone, a ghoul pops up behind it;
  // anywhere else, bats burst out.
  poke(x: number, y: number) {
    const H = this.H
    const win = this.windows.find((w) => w.kind !== "boarded" && Math.abs(w.x / H - x) < w.w / H + 0.02 && Math.abs(w.y / H - y) < w.h / H + 0.02)
    if (win) {
      win.flash = 1.4
      return
    }
    const stone = this.stones.findIndex((s) => Math.abs(s.x - x) < s.s * 0.8 + 0.02 && y > s.y - s.s * 2.4 && y < s.y + 0.02)
    if (stone >= 0 && this.ghoul.t < 0) {
      Object.assign(this.ghoul, { stone, t: 0, dur: 6 })
      return
    }
    if (this.burst.length < 24) startle(this.burst, x, y, 6)
  }

  protected override layout() {
    const { W, H, A, look, hdr } = this
    const k = (this.k = clamp(A / 1.7, 0.58, 1))
    this.hx = A - 0.3 * k
    this.hy = this.riseY(this.hx)
    this.orb = { ...look.orb, x: (this.hx + look.orb.x * k) / A }
    // Under a cloud deck the hidden sun or moon only faintly rims things.
    const veil = this.weather.covered ? 0.3 : 1
    this.light = [look.light[0] * veil, look.light[1] * veil, look.light[2] * veil]
    this.lighting = look.style === "front" ? { style: "front", dir: DAYLIGHT } : { style: "rim", color: this.light, x: this.orb.x * W, y: this.orb.y * H }
    this.pumpkins = []
    this.windows = []
    // The moon's own texture is drawn as a few soft dark seas; the shared one streaks at this size.
    paintSky(hdr, W, H, look.sky, { ...this.orb, moon: false }, this.px)
    if (this.orb.moon) {
      const R = this.orb.r * H
      const mx = this.orb.x * W
      const my = this.orb.y * H
      const c = this.orb.core
      for (const [u, v, r] of [
        [-0.3, -0.25, 0.32],
        [0.15, -0.35, 0.22],
        [0.25, 0.1, 0.28],
        [-0.2, 0.3, 0.2],
        [0.45, 0.45, 0.14],
      ]) this.ellipse(mx + u * R, my + v * R, r * R, r * R * 0.85, c[0] * 0.72, c[1] * 0.62, c[2] * 0.6, 0.55)
    }
    this.weather.cover(hdr, W, H)
    const sky = hdr.slice()
    this.paintLand()
    this.paintHouse()
    this.paintTree()
    this.paintFences()
    this.paintCrypt()
    this.paintGraves()
    for (const p of this.pumpkins) this.drawPumpkin(p, 1, true)
    if (this.px !== 1) return
    // Real-size pass: what render() needs.
    this.fore = new Uint8Array(W * H)
    for (let i = 0; i < W * H; i++) if (hdr[i * 3] !== sky[i * 3] || hdr[i * 3 + 1] !== sky[i * 3 + 1] || hdr[i * 3 + 2] !== sky[i * 3 + 2]) this.fore[i] = 1
    this.shown = this.stars.filter((s) => {
      const i = Math.floor(s.y * H) * W + Math.floor(s.x * W)
      return !this.fore[i] && Math.hypot(s.x * W - this.orb.x * W, s.y * H - this.orb.y * H) > this.orb.r * H * 1.6
    })
    this.fogY0 = Math.floor(0.58 * H)
    this.fogRows = Math.ceil(0.4 * H)
    this.fog = makeFog(W, H, this.fogY0, this.fogRows)
    this.placeCreatures()
  }

  private paint(c: RGB, k = 1): RGB {
    const t = this.look.tint
    return [c[0] * t[0] * k, c[1] * t[1] * k, c[2] * t[2] * k]
  }

  // The rise the house stands on, its top at x, in screen heights.
  private riseY(x: number) {
    const k = this.k
    return HORIZON + 0.06 - 0.1 * Math.exp(-(((x - (this.A - 0.26 * k)) / (0.42 * k)) ** 2)) + (fbm1(x * 3, 7) - 0.5) * 0.012
  }

  // The far ridge with a few dead trees, the rise under the house, and the graveyard's rough grass.
  private paintLand() {
    const { W, H, look, hdr, px } = this
    const [far, near] = look.ridge
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / H
      const r1 = HORIZON - 0.03 - (fbm1(u * 2.2, 11) - 0.5) * 0.06
      const rise = this.riseY(u)
      for (let y = Math.max(0, Math.floor(Math.min(r1, rise) * H) - 1); y < H; y++) {
        const v = (y + 0.5) / H
        const o = (y * W + x) * 3
        const a1 = clamp(((v - r1) * H) / px + 0.5, 0, 1)
        const a2 = clamp(((v - rise) * H) / px + 0.5, 0, 1)
        if (a1 > 0) for (let c = 0; c < 3; c++) hdr[o + c] += (far[c] - hdr[o + c]) * a1
        if (a2 <= 0) continue
        // Grass darkening toward the viewer, with bare patches of dirt and a lit edge along the rise's crest.
        const depth = smoothstep(rise, 1, v)
        const patch = smoothstep(0.55, 0.75, fbm2(u * 7, v * 22, 3))
        const tuft = 0.88 + 0.24 * fbm2(u * 14, v * 50, 2)
        const rim = look.style === "rim" ? Math.exp(-((v - rise) * H) / (2 * px)) * (look.night ? 0.1 : 0.18) : 0
        for (let c = 0; c < 3; c++) {
          const ground = lerp(near[c], lerp(look.grass[c], look.dirt[c], patch * 0.6), smoothstep(0, 0.08, v - rise)) * tuft * (1 - 0.25 * depth)
          hdr[o + c] += (ground + this.light[c] * rim - hdr[o + c]) * a2
        }
      }
    }
    // Bare trees on the far ridge, away from the middle.
    const k = this.k
    for (const [i, x] of [0.5 * k, 0.62 * k, this.A - 0.86 * k].entries()) {
      const y = HORIZON - 0.03 - (fbm1(x * 2.2, 11) - 0.5) * 0.06 + 0.004
      const h = 0.04 + 0.015 * hash(i * 3.1)
      const c: RGB = [far[0] * 0.75, far[1] * 0.75, far[2] * 0.8]
      const r = this.thick(0.0018, 0.6)
      const parts: Part[] = [cap(x * H, y * H, x * H, (y - h) * H, r * 1.4, r, c)]
      for (let j = 0; j < 4; j++) {
        const a = -Math.PI / 2 + (j - 1.5) * 0.55
        const by = y - h * (0.45 + 0.15 * j)
        parts.push(cap(x * H, by * H, (x + Math.cos(a) * h * 0.4) * H, (by + Math.sin(a) * h * 0.4) * H, r, r * 0.7, c))
      }
      this.shape(parts, this.lighting, 0)
    }
  }

  // The haunted house: a crooked Victorian pile on the rise, its turret on the left, a front gable over a bay, a
  // sagging main roof with a leaning chimney, a creaky porch with jack-o'-lanterns, and windows boarded, broken,
  // dark or glowing.
  private paintHouse() {
    const { H, look } = this
    const k = this.k
    const hx = this.hx
    const gy = this.hy + 0.012
    const X = (u: number) => (hx + u * k) * H
    const Y = (v: number) => (gy - v) * H
    // Everything leans a little to the right the higher it goes.
    const L = (u: number, v: number): Point => [X(u) + v * 0.035 * H, Y(v)]
    const walls = look.walls
    const side: RGB = [walls[0] * 0.62, walls[1] * 0.62, walls[2] * 0.66]
    const roof = look.roof
    const trim = look.trim
    // The main block's receding side wall and roof.
    this.polygon([L(0.16, 0), L(0.22, 0.02), L(0.22, 0.2), L(0.16, 0.19)], side)
    this.polygon([L(0.1, 0.3), L(0.17, 0.32), L(0.235, 0.2), L(0.17, 0.185)], roof)
    // A leaning chimney with a broken cap.
    this.polygon([L(0.115, 0.26), L(0.145, 0.26), L(0.16, 0.38), L(0.13, 0.385)], [walls[0] * 0.5, walls[1] * 0.42, walls[2] * 0.42])
    this.polygon([L(0.122, 0.38), L(0.168, 0.375), L(0.168, 0.395), L(0.125, 0.4)], roof)
    // The front wall, two storeys, and the main roof sagging in the middle.
    this.polygon([L(-0.12, 0), L(0.16, 0), L(0.16, 0.19), L(-0.12, 0.19)], walls)
    const ridge: Point[] = []
    for (let i = 0; i <= 8; i++) {
      const t = i / 8
      ridge.push(L(lerp(-0.1, 0.12, t), 0.3 - 0.025 * Math.sin(t * Math.PI)))
    }
    this.polygon([L(-0.14, 0.18), ...ridge, L(0.185, 0.18)], roof)
    // The front gable over the bay, steep and crooked, with an attic window.
    this.polygon([L(-0.06, 0.18), L(0.08, 0.18), L(0.012, 0.34)], walls)
    this.edge(L(-0.075, 0.172), L(0.012, 0.345), 0.007, roof)
    this.edge(L(0.012, 0.345), L(0.095, 0.172), 0.007, roof)
    // The turret: a round tower on the left corner under a tall crooked cone.
    const T = (u: number, v: number): Point => [X(-0.15 + u) + v * 0.02 * H, Y(v)]
    const tw = 0.042
    this.polygon([T(-tw, 0), T(tw, 0), T(tw, 0.27), T(-tw, 0.27)], walls)
    this.polygon([T(tw * 0.35, 0), T(tw, 0), T(tw, 0.27), T(tw * 0.35, 0.27)], [walls[0] * 0.75, walls[1] * 0.75, walls[2] * 0.78])
    this.polygon([T(-tw - 0.012, 0.265), T(tw + 0.012, 0.265), T(tw + 0.008, 0.285), T(-tw - 0.008, 0.285)], trim)
    const tip: Point = [T(0, 0.43)[0] + 0.022 * H, Y(0.43)]
    this.polygon([T(-tw - 0.01, 0.282), T(tw + 0.01, 0.282), [T(tw * 0.4, 0.36)[0] + 0.01 * H, Y(0.36)], tip, [T(-tw * 0.3, 0.36)[0] + 0.004 * H, Y(0.36)]], roof)
    this.edge(tip, [tip[0] + 0.004 * H, tip[1] - 0.03 * H], 0.0022, roof)
    // Trim: eaves boards and a band between the storeys.
    this.edge(L(-0.12, 0.1), L(0.16, 0.1), 0.004, trim)
    this.edge(L(-0.14, 0.182), L(0.185, 0.182), 0.005, trim)
    if (look.style === "rim") this.rimEdges([T(-tw, 0), T(-tw, 0.27), T(-tw - 0.01, 0.282), tip, ...ridge, L(0.185, 0.18)])
    // Windows: ground floor behind the porch, the upper floor, the attic and the turret.
    const plan: [number, number, number, number, Window["kind"]][] = [
      [-0.09, 0.03, 0.016, 0.03, "glow"],
      [0.07, 0.03, 0.016, 0.03, "dark"],
      [0.12, 0.03, 0.014, 0.03, "boarded"],
      [-0.08, 0.125, 0.016, 0.034, "dark"],
      [-0.02, 0.125, 0.016, 0.034, "candle"],
      [0.05, 0.125, 0.016, 0.034, "boarded"],
      [0.115, 0.125, 0.015, 0.034, "glow"],
      [0.012, 0.23, 0.014, 0.03, "dark"],
    ]
    const turret: [number, number][] = [
      [0.045, 0.026],
      [0.14, 0.03],
      [0.22, 0.026],
    ]
    for (const [i, [u, v, w, h, kind]] of plan.entries()) this.paintWindow(L(u, v), L(u, v + h), w * k * H, h * H, kind, i)
    for (const [i, [v, h]] of turret.entries()) this.paintWindow(T(0, v), T(0, v + h), 0.011 * k * H, h * H, i === 2 ? "glow" : "dark", 20 + i)
    // The rooms the wandering light passes through: windows on the same floor in order, then up the turret.
    const order = this.windows.filter((w) => w.kind !== "boarded").sort((a, b) => b.y - a.y || a.x - b.x)
    for (const [i, w] of order.entries()) w.room = i
    this.rooms = order.length
    // The porch: a sagging roof on thin posts, the floor and a few steps, a door with a lit fanlight.
    const door = L(0.015, 0)
    this.polygon([L(0.0, 0), L(0.03, 0), L(0.03, 0.055), L(0.0, 0.055)], this.paint([0.16, 0.1, 0.08]))
    this.disc(...L(0.015, 0.062), 0.012 * k * H, look.window[0] * look.glow * 0.4, look.window[1] * look.glow * 0.4, look.window[2] * look.glow * 0.4, 1)
    const posts: Part[] = []
    for (const u of [-0.11, -0.04, 0.06, 0.15]) posts.push(cap(...L(u, 0), ...L(u, 0.07), this.thick(0.0022, 0.7), this.thick(0.0022, 0.7), trim))
    this.shape(posts, this.lighting, 0.4)
    const porch: Point[] = []
    for (let i = 0; i <= 6; i++) porch.push(L(lerp(-0.13, 0.165, i / 6), 0.072 - 0.008 * Math.sin((i / 6) * Math.PI) - (i === 6 ? 0.006 : 0)))
    this.polygon([...porch, L(0.17, 0.058), L(-0.135, 0.06)], roof)
    this.polygon([L(-0.13, 0.008), L(0.17, 0.008), L(0.17, -0.004), L(-0.13, -0.004)], trim)
    for (let s = 0; s < 3; s++) this.polygon([L(-0.012 - s * 0.006, -0.004 - s * 0.009), L(0.042 + s * 0.006, -0.004 - s * 0.009), L(0.042 + s * 0.006, -0.013 - s * 0.009), L(-0.012 - s * 0.006, -0.013 - s * 0.009)], [trim[0] * 1.3, trim[1] * 1.3, trim[2] * 1.3])
    // Railings, with a gap where one has fallen.
    const rail: Part[] = []
    const rr = this.thick(0.0012, 0.5)
    rail.push(cap(...L(-0.13, 0.03), ...L(-0.02, 0.03), rr, rr, trim), cap(...L(0.07, 0.03), ...L(0.165, 0.025), rr, rr, trim))
    for (let u = -0.12; u < 0.165; u += this.cells ? 0.024 : 0.016) if (u < -0.02 || u > 0.075) rail.push(cap(...L(u, 0.008), ...L(u, 0.03), rr, rr, trim))
    this.shape(rail, this.lighting, 0)
    // Jack-o'-lanterns on the steps and the porch rail.
    this.pumpkins.push({ x: L(-0.03, 0)[0], y: Y(-0.012), r: 0.012 * H, seed: 1, flare: 0 })
    this.pumpkins.push({ x: L(0.06, 0)[0], y: Y(-0.02), r: 0.014 * H, seed: 2, flare: 0 })
    this.pumpkins.push({ x: L(-0.1, 0.03)[0], y: Y(0.03), r: 0.009 * H, seed: 3, flare: 0 })
    this.pumpkins.push({ x: door[0] - 0.05 * k * H, y: Y(-0.03), r: 0.01 * H, seed: 4, flare: 0 })
  }

  // A window from its bottom middle a to top middle b (pixels), half-width w: a frame and glass, and planks nailed
  // across if boarded.
  private paintWindow(a: Point, b: Point, w: number, h: number, kind: Window["kind"], seed: number) {
    const look = this.look
    const frame = look.trim
    const dx = b[0] - a[0]
    const f = 0.004 * this.H
    this.polygon([[a[0] - w - f, a[1] + f], [a[0] + w + f, a[1] + f], [b[0] + w + f, b[1] - f], [b[0] - w - f, b[1] - f]], frame)
    const pts: Point[] = [
      [a[0] - w, a[1]],
      [a[0] + w, a[1]],
      [b[0] + w, b[1]],
      [b[0] - w, b[1]],
    ]
    const lit = kind === "glow" || kind === "candle"
    const g = lit ? look.window : look.glass
    const k = lit ? look.glow * (kind === "candle" ? 0.5 : 0.7) : 1
    this.polygon(pts, [g[0] * k, g[1] * k, g[2] * k])
    // A broken pane: a jagged hole of darkness in the dark glass.
    if (kind === "dark" && hash(seed * 3.3) < 0.6) this.polygon([[a[0] - w * 0.2, a[1] - h * 0.55], [a[0] + w * 0.7, a[1] - h * 0.9], [a[0] + w * 0.3, a[1] - h * 0.6], [a[0] + w * 0.8, a[1] - h * 0.3]], [g[0] * 0.3, g[1] * 0.3, g[2] * 0.3])
    this.windows.push({ pts, x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, w, h, kind, room: -1, seed, flash: 0 })
    if (kind !== "boarded") return
    const wood = this.paint([0.42, 0.34, 0.24])
    const r = this.thick(0.0035, 0.8)
    this.shape([cap(a[0] - w * 1.3, a[1] - h * 0.2, b[0] + w * 1.3, b[1] + h * 0.25, r, r, wood), cap(a[0] - w * 1.2, b[1] + h * 0.3, a[0] + w * 1.3 + dx, a[1] - h * 0.35, r, r, wood)], this.lighting, 0.5)
  }

  // The dead tree on the left with a swing hanging from its long low limb and a lantern from another.
  private paintTree() {
    const { H } = this
    const k = this.k
    const x = 0.16 * k
    const y = 0.76
    const bark = this.paint([0.2, 0.16, 0.13])
    const groups: Part[][] = []
    const min = this.cells ? 0.7 * this.px : 0.3 * this.px
    const grow = (px: number, py: number, angle: number, len: number, r: number, depth: number, seed: number, parts: Part[]) => {
      let ax = px
      let ay = py
      let a = angle
      for (let s = 0; s < 3; s++) {
        a += (hash(seed * 3.1 + s) - 0.5) * 0.9
        const bx = ax + Math.cos(a) * (len / 3)
        const by = ay + Math.sin(a) * (len / 3)
        parts.push(cap(ax * H, ay * H, bx * H, by * H, Math.max(r * (1 - 0.18 * s) * H, min), Math.max(r * (1 - 0.18 * (s + 1)) * H, min), bark))
        ax = bx
        ay = by
      }
      if (depth === 0) return
      const kids = depth > 2 ? 3 : 2
      for (let i = 0; i < kids; i++) {
        const spread = (i - (kids - 1) / 2) * (0.55 + 0.25 * hash(seed + i * 7.7)) + (hash(seed * 1.9 + i) - 0.5) * 0.4
        const droop = depth <= 2 ? Math.sign(Math.cos(a + spread)) * 0.35 : 0
        grow(ax, ay, a + spread + droop, len * (0.62 + 0.12 * hash(seed * 4.3 + i)), r * 0.62, depth - 1, seed * 3 + i + 1, depth >= 4 ? (groups[groups.push([]) - 1] as Part[]) : parts)
      }
    }
    const trunk: Part[] = []
    groups.push(trunk)
    trunk.push(cap((x - 0.035) * H, (y + 0.004) * H, x * H, (y - 0.02) * H, 0.008 * H, 0.015 * H, bark), cap((x + 0.038) * H, (y + 0.006) * H, x * H, (y - 0.02) * H, 0.007 * H, 0.015 * H, bark))
    trunk.push(cap(x * H, y * H, (x - 0.01) * H, (y - 0.1) * H, 0.02 * H, 0.016 * H, bark), cap((x - 0.01) * H, (y - 0.1) * H, (x + 0.004) * H, (y - 0.17) * H, 0.016 * H, 0.012 * H, bark))
    // The swing's limb reaches out level to the right; the lantern's to the left.
    const limb = [x - 0.008, y - 0.15]
    const end = [x + 0.17 * Math.max(k, 0.75), y - 0.16]
    trunk.push(cap(limb[0] * H, limb[1] * H, ((limb[0] + end[0]) / 2) * H, (end[1] - 0.012) * H, 0.009 * H, 0.007 * H, bark), cap(((limb[0] + end[0]) / 2) * H, (end[1] - 0.012) * H, end[0] * H, end[1] * H, 0.007 * H, 0.004 * H, bark))
    this.swing = { x: lerp(limb[0], end[0], 0.62), y: end[1] - 0.006, len: 0.13 }
    trunk.push(cap((x - 0.006) * H, (y - 0.12) * H, (x - 0.09) * H, (y - 0.17) * H, 0.007 * H, 0.004 * H, bark))
    this.lantern = { x: x - 0.075, y: y - 0.162, len: 0.035 }
    grow(x + 0.004, y - 0.17, -Math.PI / 2 - 0.6, 0.15, 0.01, 4, 3, trunk)
    grow(x + 0.004, y - 0.17, -Math.PI / 2 + 0.45, 0.16, 0.01, 4, 11, trunk)
    grow(x - 0.008, y - 0.13, -Math.PI / 2 - 1.2, 0.1, 0.007, 3, 23, trunk)
    for (const g of groups) if (g.length) this.shape(g, this.lighting, 0.6)
  }

  // The graveyard's iron fence: along the back on the right with a gate ajar on the path up to the house, and on
  // the left behind the tree.
  private paintFences() {
    const { A } = this
    const k = this.k
    const gate = this.hx - 0.02 * k
    this.paintFence(A - 0.72 * k, gate - 0.035, 0.045)
    this.paintFence(gate + 0.035, A + 0.02, 0.045)
    this.paintFence(-0.02, 0.36 * k, 0.04)
    // The gate's two leaves, one swung half open, and the path up to the steps.
    const { H, look } = this
    const iron = this.paint([0.06, 0.05, 0.07])
    const r = this.thick(0.0016, 0.55)
    const parts: Part[] = []
    const top = FENCE - 0.06
    for (const [x0, x1, y1] of [
      [gate - 0.035, gate - 0.002, 0],
      [gate + 0.035, gate + 0.012, 0.012],
    ]) {
      parts.push(cap(x0 * H, FENCE * H, x1 * H, (FENCE + y1) * H, r, r, iron), cap(x0 * H, top * H, x1 * H, (top + y1 * 1.2) * H, r, r, iron))
      for (let i = 0; i <= 4; i++) {
        const xx = lerp(x0, x1, i / 4)
        const yy = lerp(0, y1, i / 4)
        parts.push(cap(xx * H, (FENCE + yy) * H, xx * H, (top - 0.01 + yy * 1.1 + Math.sin((i / 4) * Math.PI) * -0.006) * H, r, r, iron))
      }
    }
    this.shape(parts, this.lighting, 0.4)
    const path = this.paint(look.dirt, look.night ? 2 : 1.3)
    this.polygon([[(gate - 0.045) * H, (FENCE + 0.006) * H], [(gate + 0.045) * H, (FENCE + 0.006) * H], [(this.hx + 0.04 * k) * H, (this.hy + 0.004) * H], [(this.hx - 0.005 * k) * H, (this.hy + 0.004) * H]], path, 0.4)
  }

  private paintFence(x0: number, x1: number, h: number) {
    const { H } = this
    const iron = this.paint([0.06, 0.05, 0.07])
    const bar = this.thick(0.0016, 0.55)
    const parts: Part[] = []
    const top = FENCE - h
    parts.push(cap(x0 * H, (top + 0.008) * H, x1 * H, (top + 0.008) * H, bar, bar, iron), cap(x0 * H, (FENCE - 0.008) * H, x1 * H, (FENCE - 0.008) * H, bar, bar, iron))
    const step = this.cells ? 0.026 : 0.018
    for (let x = x0 + step / 2; x < x1; x += step) parts.push(cap(x * H, FENCE * H, x * H, top * H, bar, bar, iron))
    this.shape(parts, this.lighting, 0.4)
    for (let x = x0 + step / 2; x < x1; x += step) this.polygon([[x * H - bar * 1.8, top * H], [x * H + bar * 1.8, top * H], [x * H, (top - 0.009) * H]], iron)
    const post = this.paint([0.08, 0.07, 0.09])
    for (const x of [x0, x1]) if (x > 0 && x < this.A) this.polygon([[(x - 0.005) * H, FENCE * H], [(x + 0.005) * H, FENCE * H], [(x + 0.005) * H, (top - 0.012) * H], [(x - 0.005) * H, (top - 0.012) * H]], post)
  }

  // A stone crypt in the graveyard: steps, two columns, a pediment and a heavy iron door.
  private paintCrypt() {
    const { H, look } = this
    const k = this.k
    const x = 0.44 * k
    const y = 0.775
    const w = 0.055
    const stone = look.stone
    const dark: RGB = [stone[0] * 0.6, stone[1] * 0.6, stone[2] * 0.65]
    this.polygon([[(x + w) * H, y * H], [(x + w + 0.025) * H, (y - 0.01) * H], [(x + w + 0.025) * H, (y - 0.095) * H], [(x + w) * H, (y - 0.085) * H]], dark)
    this.polygon([[(x - w) * H, y * H], [(x + w) * H, y * H], [(x + w) * H, (y - 0.085) * H], [(x - w) * H, (y - 0.085) * H]], stone)
    this.polygon([[(x - w - 0.008) * H, (y - 0.083) * H], [(x + w + 0.008) * H, (y - 0.083) * H], [x * H, (y - 0.125) * H]], [stone[0] * 0.85, stone[1] * 0.85, stone[2] * 0.88])
    this.polygon([[(x - w * 0.55) * H, (y - 0.096) * H], [(x + w * 0.55) * H, (y - 0.096) * H], [x * H, (y - 0.116) * H]], dark)
    for (const s of [-1, 1]) this.polygon([[(x + s * w * 0.7 - 0.006) * H, y * H], [(x + s * w * 0.7 + 0.006) * H, y * H], [(x + s * w * 0.7 + 0.006) * H, (y - 0.08) * H], [(x + s * w * 0.7 - 0.006) * H, (y - 0.08) * H]], [stone[0] * 1.15, stone[1] * 1.15, stone[2] * 1.15])
    this.polygon([[(x - 0.022) * H, y * H], [(x + 0.022) * H, y * H], [(x + 0.022) * H, (y - 0.058) * H], [x * H, (y - 0.066) * H], [(x - 0.022) * H, (y - 0.058) * H]], this.paint([0.08, 0.08, 0.09]))
    this.polygon([[(x - w - 0.01) * H, (y + 0.008) * H], [(x + w + 0.01) * H, (y + 0.008) * H], [(x + w + 0.01) * H, y * H], [(x - w - 0.01) * H, y * H]], dark)
    if (look.style === "rim") this.rimEdges([[(x - w - 0.008) * H, (y - 0.083) * H], [x * H, (y - 0.125) * H], [(x + w + 0.008) * H, (y - 0.083) * H]])
  }

  // Tilted gravestones spreading through the graveyard, thicker toward the sides, with mounds; an open grave with a
  // spade in its heap; and the grave the hand claws out of.
  private paintGraves() {
    const { A, H, look } = this
    const k = this.k
    const stones: Stone[] = []
    for (let i = 0; stones.length < 26 && i < 400; i++) {
      const y = lerp(FENCE + 0.02, 0.97, hash(i * 1.93) ** 0.8)
      const x = hash(i * 2.71) * A
      const edge = Math.min(x, A - x) / k
      // The middle stays open, more so higher up where text sits.
      if (edge > 0.5 && (y < 0.9 || hash(i * 5.7) < 0.85)) continue
      if (Math.abs(x - 0.44 * k) < 0.09 && y < 0.81) continue
      if (Math.abs(x - 0.16 * k) < 0.05 && y < 0.79) continue
      const s = 0.016 + 0.022 * smoothstep(FENCE, 1, y)
      if (stones.some((o) => Math.abs(o.x - x) < (o.s + s) * 1.1 && Math.abs(o.y - y) < 0.035)) continue
      stones.push({ x, y, s, tilt: (hash(i * 7.9) - 0.5) * 0.5, kind: Math.floor(hash(i * 3.3) * 4) })
    }
    stones.sort((a, b) => a.y - b.y)
    this.stones = stones
    const mound = this.paint(look.dirt, 0.8)
    for (const s of stones) {
      if (hash(s.x * 13.1) < 0.6) this.ellipse(s.x * H, (s.y + s.s * 0.5) * H, s.s * 1.6 * H, s.s * 0.45 * H, mound[0], mound[1], mound[2], 0.6)
      this.drawStone(s)
    }
    // The open grave, near the bottom right: a dark pit, a heap of earth and a spade.
    const ox = A - 0.2 * k
    const oy = 0.935
    const pit = this.paint([0.03, 0.02, 0.02])
    this.ellipse((ox + 0.06) * H, (oy - 0.005) * H, 0.035 * H, 0.016 * H, mound[0] * 1.2, mound[1] * 1.2, mound[2] * 1.2, 1)
    this.polygon([[(ox - 0.045) * H, (oy - 0.012) * H], [(ox + 0.04) * H, (oy - 0.012) * H], [(ox + 0.05) * H, (oy + 0.014) * H], [(ox - 0.055) * H, (oy + 0.014) * H]], pit)
    this.edge([(ox - 0.055) * H, (oy + 0.014) * H], [(ox + 0.05) * H, (oy + 0.014) * H], 0.002, mound)
    this.shape([cap((ox + 0.07) * H, (oy - 0.012) * H, (ox + 0.082) * H, (oy - 0.06) * H, this.thick(0.0018, 0.6), this.thick(0.0018, 0.6), this.paint([0.32, 0.22, 0.14])), ell((ox + 0.068) * H, (oy - 0.008) * H, 0.006 * H, 0.009 * H, 0.2, this.paint([0.4, 0.4, 0.42]))], this.lighting, 0.5)
    // The restless grave near the bottom left, freshly heaped.
    this.grave = { x: 0.26 * k, y: 0.93 }
    this.ellipse(this.grave.x * H, this.grave.y * H, 0.045 * H, 0.012 * H, mound[0] * 1.1, mound[1] * 1.1, mound[2] * 1.1, 1)
    this.drawStone({ x: this.grave.x - 0.045, y: this.grave.y, s: 0.03, tilt: -0.2, kind: 1 })
  }

  // A gravestone standing at (x, y) in screen heights: a rounded or pointed slab, an obelisk or a cross-topped
  // marker, mossy at the foot.
  private drawStone(s: Stone) {
    const { H, look } = this
    const x = s.x * H
    const y = s.y * H
    const w = s.s * 0.6 * H
    const h = s.s * 1.9 * H
    const t = s.tilt
    const R = (u: number, v: number): Point => [x + u * w + v * h * t * 0.3, y - v * h]
    const c = look.stone
    const shade: RGB = [c[0] * 0.65, c[1] * 0.65, c[2] * 0.7]
    if (s.kind === 2) {
      this.polygon([R(-0.6, 0), R(0.6, 0), R(0.6, 0.12), R(-0.6, 0.12)], shade)
      this.polygon([R(-0.38, 0.1), R(0.38, 0.1), R(0.26, 1.05), R(0, 1.25), R(-0.26, 1.05)], c)
    }
    if (s.kind !== 2) {
      const top = s.kind === 1 ? [R(1, 0.78), R(0, 1.05), R(-1, 0.78)] : [R(1, 0.75), R(0.7, 0.95), R(0, 1.03), R(-0.7, 0.95), R(-1, 0.75)]
      this.polygon([R(-1.05, 0), R(1.05, 0), R(1.05, 0.06), R(1, 0.07), ...top, R(-1, 0.07), R(-1.05, 0.06)], c)
      this.polygon([R(0.55, 0), R(1.05, 0), R(1, 0.7), R(0.6, 0.7)], [c[0] * 0.85, c[1] * 0.85, c[2] * 0.88])
      if (s.kind === 3 && w > 2.5 * this.px) this.polygon([R(-0.4, 0.5), R(0.4, 0.5), R(0.4, 0.58), R(-0.4, 0.58)], shade)
    }
    if (look.style === "rim") {
      const r = this.thick(0.0011, 0.45)
      const k = look.night ? 0.12 : 0.2
      const l: RGB = [this.light[0] * k, this.light[1] * k, this.light[2] * k]
      this.shape([cap(...R(-1, 0.1), ...R(-1, 0.8), r, r, l), cap(...R(-1, 0.8), ...R(0, 1.04), r, r, l)], this.lighting, 0)
    }
  }

  // A pumpkin: a ribbed body with a stem (unless only its candlelight is redrawn), its face glowing scaled by light.
  private drawPumpkin(p: Pumpkin, light: number, body: boolean) {
    const look = this.look
    const x = p.x
    const r = p.r
    const cy = p.y - r * 0.85
    const rx = r * 1.22
    const ry = r * 0.86
    if (body) {
      this.shape([ell(x, cy, rx, ry, 0, look.style === "rim" ? look.skin : this.paint(look.skin), 4)], this.lighting, 0.7)
      this.shape([cap(x, cy - r * 0.75, x + r * 0.18, cy - r * 1.15, Math.max(r * 0.16, 0.5 * this.px), Math.max(r * 0.11, 0.4 * this.px), this.paint([0.3, 0.32, 0.1]))], this.lighting, 0.4)
    }
    const g = look.glow * light
    const c: RGB = [CANDLE[0] * g, CANDLE[1] * g, CANDLE[2] * g]
    if (rx < 3.2 * this.px) {
      this.ellipse(x, cy + ry * 0.05, rx * 0.62, Math.max(ry * 0.32, 0.55 * this.px), c[0], c[1], c[2], 0.9)
      return
    }
    for (const s of [-1, 1]) this.polygon([[x + s * rx * 0.52, cy - ry * 0.02], [x + s * rx * 0.14, cy - ry * 0.02], [x + s * rx * 0.34, cy - ry * 0.48]], c)
    this.polygon([[x - rx * 0.08, cy + ry * 0.16], [x + rx * 0.08, cy + ry * 0.16], [x, cy + ry * 0.02]], c)
    const mouth: Point[] = []
    for (let i = 0; i <= 8; i++) {
      const u = -0.62 + (1.24 * i) / 8
      mouth.push([x + u * rx, cy + (0.26 + 0.36 * (1 - (u * u) / 0.4)) * ry * 0.85])
    }
    for (let i = 8; i >= 0; i--) {
      const u = -0.62 + (1.24 * i) / 8
      mouth.push([x + u * rx, cy + (0.24 + 0.12 * (1 - (u * u) / 0.4) + (i % 4 === 2 ? 0.14 : 0)) * ry])
    }
    this.polygon(mouth, c)
  }

  // Bats loop around the turret, the moon and the tree; ghosts haunt the house's front and the graves on the left.
  private placeCreatures() {
    const { A } = this
    const k = this.k
    const anchors: Point[] = [
      [this.hx - 0.12 * k, 0.16],
      [this.orb.x * A + 0.12, 0.12],
      [0.2 * k, 0.4],
      [this.hx + 0.1 * k, 0.24],
      [this.orb.x * A - 0.2, 0.2],
      [0.35 * k, 0.3],
    ]
    for (const [i, b] of this.bats.entries()) [b.ax, b.ay] = anchors[i % anchors.length]
    for (const [i, g] of this.ghosts.entries()) {
      const [x0, x1] = i === 0 ? [this.hx - 0.14 * k, this.hx + 0.14 * k] : [0.05 * k, 0.5 * k]
      g.x0 = x0
      g.x1 = x1
      if (g.x === 0) g.x = lerp(x0, x1, hash(i * 3.7 + 1))
      g.y = i === 0 ? this.hy - 0.13 : 0.8
    }
    const z = this.zombie
    if (z.x === 0.5) Object.assign(z, { x: A * 0.3, y: lerp(WALK0, WALK1, 0.5) })
  }

  // Lights in the windows: steady glows, the flickering candle, and in teeming a light carried from room to room;
  // clicked windows flash with a figure standing in them. Lit windows spill a little light below them.
  private drawWindows() {
    const { H, look } = this
    const dim = 1 - 0.6 * this.gloom * (0.6 + 0.4 * Math.sin(this.time * 9))
    const wander = this.activity === "teeming" ? (this.time / ROOM) % (this.rooms + 2) : -10
    for (const w of this.windows) {
      if (w.kind === "boarded") continue
      const pass = Math.exp(-(((wander - w.room) / 0.6) ** 2))
      const base = w.kind === "glow" ? 0.7 * firelight(this.time * 0.8, w.seed) : w.kind === "candle" ? 0.5 * firelight(this.time * 2, w.seed) : 0
      const k = (base + 0.85 * pass + w.flash) * dim * look.glow
      if (k <= 0.01 && w.kind === "dark") continue
      const g = look.window
      this.polygon(w.pts, [lerp(look.glass[0], g[0] * k, Math.min(1, k * 2)), lerp(look.glass[1], g[1] * k, Math.min(1, k * 2)), lerp(look.glass[2], g[2] * k, Math.min(1, k * 2))])
      if (w.kind === "candle") this.drawCandle(w, dim)
      if (w.flash > 0.05) this.drawFigure(w)
      if (look.style === "rim" || k > 0.4) this.lights.pool(w.x, w.y + w.h, w.w * 4, w.h * 1.5, [1, 0.55, 0.15], 1.2 * k, 0.006 * k)
    }
    // The lantern hanging from the tree, swaying a little.
    const sway = Math.sin(this.time * 0.7) * 0.15 + gust(this.lantern.x, this.time) * 0.25
    const lx = (this.lantern.x + Math.sin(sway) * this.lantern.len) * H
    const ly = (this.lantern.y + Math.cos(sway) * this.lantern.len) * H
    this.shape([cap(this.lantern.x * H, this.lantern.y * H, lx, ly - 0.008 * H, this.thick(0.0008, 0.45), this.thick(0.0008, 0.45), this.paint([0.1, 0.08, 0.06]))], this.lighting, 0)
    const f = firelight(this.time * 2.4, 77) * dim
    const frame = this.paint([0.12, 0.1, 0.08])
    this.polygon([[lx - 0.007 * H, ly - 0.012 * H], [lx + 0.007 * H, ly - 0.012 * H], [lx + 0.006 * H, ly + 0.01 * H], [lx - 0.006 * H, ly + 0.01 * H]], frame)
    const lg = look.glow * f * (look.style === "front" ? 0.6 : 1)
    this.ellipse(lx, ly, 0.0045 * H, 0.008 * H, CANDLE[0] * lg, CANDLE[1] * lg, CANDLE[2] * lg, 1)
    this.lights.pool(lx, ly, 0.08 * H, 0.07 * H, [1, 0.5, 0.12], 2 * f * (look.style === "front" ? 0.3 : 1), 0.012 * f)
  }

  // A candle on the sill: a little flame bending in drafts.
  private drawCandle(w: Window, dim: number) {
    const H = this.H
    const x = w.x
    const y = w.y + w.h * 0.45
    const f = firelight(this.time * 3, w.seed + 5) * dim
    this.polygon([[x - 0.003 * H, y], [x + 0.003 * H, y], [x + 0.003 * H, y - 0.01 * H], [x - 0.003 * H, y - 0.01 * H]], this.paint([0.9, 0.85, 0.7], this.look.night ? 2 : 1))
    const lean = Math.sin(this.time * 1.7 + w.seed) * 0.002 * H
    this.ellipse(x + lean, y - 0.016 * H, 0.0028 * H, 0.0065 * H * f, CANDLE[0] * 1.3 * f, CANDLE[1] * 1.3 * f, CANDLE[2] * f, 1)
    this.lights.pool(x, y - 0.015 * H, 0.05 * H, 0.04 * H, [1, 0.5, 0.12], 1.5 * f, 0.01 * f)
  }

  // A dark figure standing in a flashing window, head and shoulders against the light.
  private drawFigure(w: Window) {
    const k = smoothstep(0.05, 0.4, w.flash)
    const c = this.paint([0.02, 0.015, 0.03])
    const x = w.x
    const y = w.y + w.h * 0.5
    this.polygon([[x - w.w * 0.75, y], [x + w.w * 0.75, y], [x + w.w * 0.5, y - w.h * 0.45], [x - w.w * 0.5, y - w.h * 0.45]], c, k)
    this.ellipse(x, y - w.h * 0.62, w.w * 0.34, w.h * 0.2, c[0], c[1], c[2], k)
  }

  // The swing hanging from the tree: two ropes and a plank, swaying slowly and harder in the gusts.
  private drawSwing() {
    const H = this.H
    const s = this.swing
    const a = Math.sin(this.time * 0.75) * (0.16 + 0.2 * gust(s.x, this.time)) + 0.03
    const rope = this.paint([0.36, 0.3, 0.22])
    const r = this.thick(0.0008, 0.45)
    const parts: Part[] = []
    const ends: Point[] = []
    for (const o of [-0.016, 0.016]) {
      const ex = s.x + o + Math.sin(a) * s.len
      const ey = s.y + Math.cos(a) * s.len
      parts.push(cap((s.x + o) * H, s.y * H, ex * H, ey * H, r, r, rope))
      ends.push([ex * H, ey * H])
    }
    this.shape(parts, this.lighting, 0)
    this.shape([cap(ends[0][0] - 0.004 * H, ends[0][1], ends[1][0] + 0.004 * H, ends[1][1], this.thick(0.0025, 0.7), this.thick(0.0025, 0.7), this.paint([0.36, 0.26, 0.16]))], this.lighting, 0.5)
  }

  // Every jack-o'-lantern flickers, dimmed and guttering after an error; their light pools on the porch and steps.
  private drawPumpkins() {
    const look = this.look
    const dim = 1 - 0.6 * this.gloom * (0.6 + 0.4 * Math.sin(this.time * 7))
    const night = look.night ? 1 : look.style === "rim" ? 0.7 : 0.25
    for (const p of this.pumpkins) {
      const f = (firelight(this.time * 2.2, p.seed) + p.flare) * dim
      this.drawPumpkin(p, f, false)
      const r = p.r * (5 + 3 * p.flare)
      this.lights.pool(p.x, p.y - p.r, r, r * 0.7, [1, 0.45, 0.1], (1.6 + 2 * p.flare) * night * f, 0.012 * (night + p.flare) * f)
    }
  }

  private leaf(x: number, y: number): Leaf {
    return { x, y, fall: rand(0.008, 0.02), spin: rand(0, TAU), rate: rand(1, 2.5), color: LEAVES[Math.floor(Math.random() * LEAVES.length)] }
  }

  // Dead leaves tumble down and drift across on the gusts; spent ones come back from the tree or the left edge.
  private stepLeaves(dt: number) {
    for (const [i, l] of this.leaves.entries()) {
      const g = gust(l.x, this.time)
      l.x += (0.012 + 0.16 * g) * dt
      l.y += (l.fall + Math.sin(this.time * 0.9 + l.spin) * 0.01 - g * 0.01) * dt
      l.spin += l.rate * (1 + 2 * g) * dt
      if (l.x < this.A + 0.05 && l.y < 1.02) continue
      Object.assign(l, i % 2 ? this.leaf(0.16 * this.k + rand(-0.1, 0.15), rand(0.45, 0.6)) : this.leaf(-0.04, rand(0.05, 0.9)))
    }
  }

  private drawLeaves() {
    const H = this.H
    const r = this.thick(0.006, 1.1)
    const k = this.look.night ? 2.4 : this.look.style === "rim" ? 1.8 : 1
    for (const l of this.leaves) {
      const c = this.paint(l.color, k)
      this.shape([ell(l.x * H, l.y * H, r, Math.max(r * 0.55 * Math.abs(Math.cos(l.spin)) + 0.3, this.cells ? 0.7 : 0.4), l.spin * 0.6, c)], this.lighting, 0.3)
    }
  }

  // Lively and teeming: now and then bats pour out of the turret's top window and scatter over the sky.
  private stepStream(dt: number) {
    this.stream = flyAway(this.stream, dt, this.A)
    if (this.activity === "calm") return
    this.streamWait -= dt
    if (this.streamWait > 0) return
    const n = this.activity === "teeming" ? 7 : 4
    this.streamWait = rand(25, 50)
    const w = this.windows.find((o) => o.seed === 22)
    if (!w) return
    for (let i = 0; i < n; i++) this.stream.push({ x: w.x / this.H + rand(-0.01, 0.01), y: w.y / this.H - i * 0.012, vx: rand(-0.16, 0.02) - i * 0.01, vy: -rand(0.06, 0.14), phase: rand(0, TAU) })
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
    const lean = -g.dir * 0.25
    const pts: Point[] = []
    for (let i = 0; i <= 10; i++) {
      const ang = Math.PI + (i / 10) * Math.PI
      pts.push([x + Math.cos(ang) * s * 0.5, y - s * 0.5 + Math.sin(ang) * s * 0.5])
    }
    for (let i = 0; i <= 8; i++) {
      const t = i / 8
      pts.push([x + s * 0.5 - t * s + lean * s, y + s * (0.55 + 0.1 * Math.sin(t * TAU * 1.5 + g.phase * 6))])
    }
    if (look.night) lightPool(this.hdr, this.W, H, x, y, s * 1.6, s * 1.6, c, 0, 0.05 * fade)
    this.polygon(pts, c, (look.night ? 0.55 : 0.45) * fade)
    const e: RGB = look.night ? [0.01, 0.06, 0.06] : this.paint([0.05, 0.03, 0.08])
    for (const sx of [-1, 1]) this.ellipse(x + sx * s * 0.17, y - s * 0.5, Math.max(s * 0.07, 0.7), Math.max(s * 0.11, 0.9), e[0], e[1], e[2], fade * 0.9)
    this.ellipse(x, y - s * 0.22, Math.max(s * 0.07, 0.6), Math.max(s * 0.09, 0.7), e[0], e[1], e[2], fade * 0.8)
  }

  private drawBatAt(b: Bat) {
    const t = this.creatureTime * b.w * 2.4 + b.phase
    this.drawBat(b.ax + b.rx * Math.sin(t), b.ay + b.ry * Math.sin(2 * t + b.phase), b.size, this.time * 22 + b.phase * 5, Math.cos(t) >= 0 ? 1 : -1)
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
      const w = (u: number, v: number): Point => [x + side * u * s, y + (v - flap * u * 0.7) * s]
      this.polygon([w(0.08, -0.1), w(0.5, -0.32), w(1, -0.22), w(0.82, 0.06), w(0.62, -0.02), w(0.42, 0.12), w(0.22, 0.04), w(0.08, 0.14)], color)
    }
    this.shape([ell(x, y, Math.max(s * 0.14, 0.8), Math.max(s * 0.2, 1), 0, color), ell(x + dir * s * 0.04, y - s * 0.2, Math.max(s * 0.1, 0.7), Math.max(s * 0.09, 0.7), 0, color)], this.lighting, 0.3)
    for (const side of [-1, 1]) this.polygon([[x + side * s * 0.02 + dir * s * 0.04, y - s * 0.24], [x + side * s * 0.1 + dir * s * 0.04, y - s * 0.24], [x + side * s * 0.08 + dir * s * 0.04, y - s * 0.38]], color)
  }

  // Lively and teeming: now and then a ghoul peeks out from behind a gravestone toward the sides, then sinks back.
  private stepGhoul(dt: number) {
    const g = this.ghoul
    if (g.t >= 0) {
      g.t += dt
      if (g.t > g.dur) g.t = -1
      return
    }
    if (this.activity === "calm" || !this.stones.length) return
    g.wait -= dt
    if (g.wait > 0) return
    g.wait = rand(14, 30)
    const sides = this.stones.map((s, i) => [s, i] as const).filter(([s]) => Math.min(s.x, this.A - s.x) < 0.5 * this.k && s.s > 0.022)
    if (!sides.length) return
    Object.assign(g, { stone: sides[Math.floor(Math.random() * sides.length)][1], t: 0, dur: 9 })
  }

  // The ghoul: a gaunt head with glowing eyes rising behind its stone, bony fingers curled over the top. The stone is
  // drawn again over it.
  private drawGhoul() {
    const g = this.ghoul
    const s = this.stones[g.stone]
    if (!s) return
    const { H, look } = this
    const up = smoothstep(0, 1.2, g.t) * (1 - smoothstep(g.dur - 1.2, g.dur, g.t))
    const x = (s.x + s.s * 0.5) * H
    const top = (s.y - s.s * 1.95) * H
    const size = s.s * H
    const y = top + size * (0.9 - 1.3 * up)
    const skin = look.night ? ([0.12, 0.3, 0.2] as RGB) : this.paint([0.55, 0.62, 0.5])
    const turn = Math.sin(g.t * 1.3) * 0.25
    this.shape([ell(x + turn * size * 0.3, y, size * 0.48, size * 0.56, 0, skin), ell(x + turn * size * 0.3, y + size * 0.42, size * 0.26, size * 0.22, 0, skin)], this.lighting, 0.6)
    const eye: RGB = look.style === "front" ? [0.6, 0.75, 0.1] : [1.3, 1.1, 0.15]
    for (const e of [-1, 1]) this.disc(x + turn * size * 0.45 + e * size * 0.18, y - size * 0.04, Math.max(size * 0.09, 0.6), eye[0] * up, eye[1] * up, eye[2] * up, 1)
    this.drawStone(s)
    // Fingers over the stone's top, once it has risen.
    if (up < 0.5) return
    const fx = s.x * H + s.tilt * 0.3 * s.s * 1.9 * H
    const fingers: Part[] = []
    for (let i = 0; i < 3; i++) fingers.push(cap(fx - size * 0.2 + i * size * 0.16, top - size * 0.02, fx - size * 0.18 + i * size * 0.16, top + size * 0.18, Math.max(size * 0.05, 0.5), Math.max(size * 0.04, 0.45), skin))
    this.shape(fingers, this.lighting, 0.4)
  }

  // Teeming: now and then a hand claws its way up out of the restless grave, grasps at the air, and sinks back.
  private stepHand(dt: number) {
    const h = this.hand
    if (h.t >= 0) {
      h.t += dt
      if (h.t > 12) h.t = -1
      return
    }
    if (this.activity !== "teeming") return
    h.wait -= dt
    if (h.wait > 0) return
    h.wait = rand(20, 40)
    h.t = 0
  }

  // A rotting hand and forearm up out of the earth at (x, y), its fingers clawing, over time t.
  private drawHand(gx: number, gy: number, t: number) {
    const { H, look } = this
    const up = smoothstep(0, 2.5, t) * (1 - smoothstep(10, 12, t))
    if (up <= 0.01) return
    const skin = look.night ? ([0.14, 0.32, 0.18] as RGB) : this.paint(look.zombie)
    const x = gx * H
    const y = gy * H
    const reach = 0.05 * up * H
    const wave = Math.sin(t * 2.2) * 0.2
    const wx = x + Math.sin(wave) * reach * 0.3
    const wy = y - reach
    const claw = 0.5 + 0.5 * Math.sin(t * 3.1)
    const s = 0.012 * H
    const parts: Part[] = [cap(x, y, wx, wy, s * 0.55, s * 0.5, skin), ell(wx, wy - s * 0.4, s * 0.5, s * 0.55, wave, skin)]
    for (let i = 0; i < 4; i++) {
      const a = -Math.PI / 2 + (i - 1.5) * 0.4 + wave
      const bend = claw * 0.9 * (i - 1.5 > 0 ? 1 : -1) * 0.5
      const mx = wx + Math.cos(a) * s * 0.9
      const my = wy - s * 0.5 + Math.sin(a) * s * 0.9
      parts.push(cap(wx + Math.cos(a) * s * 0.3, wy - s * 0.6 + Math.sin(a) * s * 0.3, mx, my, s * 0.16, s * 0.13, skin), cap(mx, my, mx + Math.cos(a + bend) * s * 0.6, my + Math.sin(a + bend) * s * 0.6, s * 0.13, s * 0.1, skin))
    }
    parts.push(cap(wx - s * 0.4, wy - s * 0.2, wx - s * 1, wy - s * 0.6 + claw * s * 0.3, s * 0.16, s * 0.1, skin))
    this.shape(parts, this.lighting, 0.5)
    const mound = this.paint(look.dirt, 0.9)
    this.ellipse(x, y + 0.002 * H, 0.016 * H, 0.005 * H, mound[0] * 1.1, mound[1] * 1.1, mound[2] * 1.1, 1)
  }

  // Teeming: the zombie shuffles back and forth across the graveyard, turning round at the edges.
  private stepZombie(cdt: number) {
    if (this.activity !== "teeming") return
    const z = this.zombie
    // A lurch: it steps, drags, and steps again.
    const lurch = 0.4 + 0.9 * Math.max(0, Math.sin(z.phase * TAU))
    const d = 0.1 * lurch * cdt
    z.x += z.dir * d
    z.phase += d / ZOMBIE_STRIDE
    if (z.x > this.A - 0.15 * this.k) z.dir = -1
    if (z.x < 0.12 * this.k) z.dir = 1
  }

  // A zombie standing at (x, y) in screen heights, facing dir: stiff legs, one dragging, a hunched torso in rags, both
  // arms held straight out and the head lolling. dance, 0 to 1, swaps the shuffle for arms waving overhead and a sway.
  private drawZombie(zx: number, zy: number, dir: number, phase: number, dance: number, rise: number) {
    const { H, look } = this
    const S = ZOMBIE * H * (0.85 + 0.3 * smoothstep(WALK0, 0.98, zy))
    const x = zx * H
    const y = zy * H
    const d = dir
    const [rl, ll] = stride(phase, 0, 0.7)
    const [rr] = stride(phase, 0.5, 0.7)
    const skin = look.night ? ([0.14, 0.34, 0.2] as RGB) : this.paint(look.zombie)
    const rags = this.paint([0.24, 0.2, 0.26])
    const pants = this.paint([0.2, 0.22, 0.3])
    const sway = Math.sin(this.time * 4) * dance
    const sink = (1 - rise) * S
    const bob = Math.abs(Math.sin(phase * Math.PI)) * 0.025 * S * (1 - dance)
    const hip: Point = [x + sway * 0.08 * S, y - S * 0.42 - bob + sink]
    // One leg steps, the other drags its foot along.
    const footA: Point = [x + d * rl * 0.12 * S, y - ll * 0.04 * S + sink]
    const footB: Point = [x + d * rr * 0.06 * S - d * 0.03 * S, y + sink]
    if (dance > 0) {
      footA[0] = x - 0.06 * S + sway * 0.05 * S
      footB[0] = x + 0.06 * S + sway * 0.05 * S
    }
    this.shape([cap(...hip, ...footA, 0.055 * S, 0.045 * S, pants), cap(...hip, ...footB, 0.055 * S, 0.045 * S, pants)], this.lighting, 0.6)
    const neck: Point = [hip[0] + d * 0.08 * S * (1 - dance), hip[1] - S * 0.34]
    this.shape([cap(...hip, ...neck, 0.11 * S, 0.12 * S, rags), ell(hip[0], hip[1] - 0.02 * S, 0.11 * S, 0.06 * S, 0, rags)], this.lighting, 0.7)
    // Ragged hem.
    for (let i = 0; i < 3; i++) this.polygon([[hip[0] - 0.1 * S + i * 0.07 * S, hip[1]], [hip[0] - 0.04 * S + i * 0.07 * S, hip[1]], [hip[0] - 0.07 * S + i * 0.07 * S, hip[1] + 0.06 * S]], rags)
    // Arms straight out in front, lurching; dancing, they wave overhead.
    const shoulder: Point = [neck[0], neck[1] + 0.05 * S]
    const arms: Part[] = []
    for (const [i, o] of [-0.02, 0.03].entries()) {
      const lurch = Math.sin(phase * TAU + i) * 0.03 * S
      const out: Point = [shoulder[0] + d * 0.3 * S, shoulder[1] + o * S + lurch]
      const wave = Math.sin(this.time * 4 + i * Math.PI)
      const upArm: Point = [shoulder[0] + (i ? 1 : -1) * 0.15 * S + wave * 0.06 * S, shoulder[1] - 0.28 * S]
      const hand: Point = [lerp(out[0], upArm[0], dance), lerp(out[1], upArm[1], dance)]
      arms.push(cap(...shoulder, ...hand, 0.04 * S, 0.034 * S, i ? skin : rags), ell(...hand, 0.04 * S, 0.035 * S, 0, skin))
    }
    this.shape(arms, this.lighting, 0.6)
    const tilt = d * 0.25 + Math.sin(this.time * 1.3) * 0.1
    const head: Point = [neck[0] + d * 0.05 * S + Math.sin(tilt) * 0.05 * S, neck[1] - 0.1 * S]
    this.shape([ell(...head, 0.09 * S, 0.1 * S, tilt, skin)], this.lighting, 0.7)
    this.shape([ell(head[0] - d * 0.02 * S, head[1] - 0.06 * S, 0.08 * S, 0.04 * S, tilt, this.paint([0.12, 0.1, 0.1]))], this.lighting, 0.3)
    const eye: RGB = look.style === "front" ? [0.15, 0.12, 0.1] : [1.2, 0.9, 0.15]
    this.disc(head[0] + d * 0.04 * S, head[1] - 0.005 * S, Math.max(0.018 * S, 0.5), eye[0], eye[1], eye[2], 1)
  }

  private stepLightning(dt: number) {
    const f = this.flash
    if (f.t >= 0) {
      f.t += dt
      if (f.t > 0.8) f.t = -1
      return
    }
    if (this.gloom < 0.5) return
    f.wait -= dt
    if (f.wait > 0) return
    f.wait = rand(5, 12)
    f.t = 0
    f.x = Math.random() < 0.5 ? rand(0.05, 0.35) * this.A : rand(0.65, 0.95) * this.A
  }

  // Lightning in the storm: the sky flickers twice and a forked bolt cracks down toward the ridge.
  private drawLightning() {
    const { H, A } = this
    const f = this.flash
    const k = Math.exp(-(((f.t - 0.08) / 0.05) ** 2)) + 0.7 * Math.exp(-(((f.t - 0.35) / 0.08) ** 2))
    if (k < 0.03) return
    lightPool(this.hdr, this.W, H, f.x * H, 0.15 * H, 0.6 * H, 0.35 * H, BOLT, 1.5 * k, 0.05 * k)
    const pts: Point[] = [[f.x * H, 0]]
    for (let i = 1; i <= 7; i++) pts.push([(f.x + (hash(i * 3.7 + f.wait) - 0.5) * 0.05 * i * 0.4) * H, ((HORIZON - 0.04) * i / 7) * H])
    const r = this.thick(0.0015, 0.6)
    const parts: Part[] = []
    for (let i = 0; i + 1 < pts.length; i++) parts.push(cap(...pts[i], ...pts[i + 1], r, r, [BOLT[0] * 2 * k, BOLT[1] * 2 * k, BOLT[2] * 2 * k]))
    const fork = pts[3]
    parts.push(cap(...fork, fork[0] + (f.x < A / 2 ? 0.04 : -0.04) * H, fork[1] + 0.08 * H, r * 0.8, r * 0.6, [BOLT[0] * 1.5 * k, BOLT[1] * 1.5 * k, BOLT[2] * 1.5 * k]))
    this.shape(parts, this.lighting, 0)
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
  private witchAt(t: number): Point {
    const w = this.witch
    const A = this.A
    const mx = this.orb.x * A
    const x = w.dir > 0 ? lerp(-0.15, A + 0.15, t) : lerp(A + 0.15, -0.15, t)
    const reach = Math.max(mx + 0.15, A - mx + 0.15)
    return [x, w.y + 0.06 * ((x - mx) / reach) * w.dir - 0.05 * Math.exp(-(((x - mx) / 0.25) ** 2)) + 0.05 + Math.sin(t * 9) * 0.006]
  }

  // A witch riding side-on: a broomstick with its bristles, a cape billowing behind, a pointed hat, her chin up in a
  // cackle.
  private drawWitch() {
    const H = this.H
    const [wx, wy] = this.witchAt(this.witch.t)
    const x = wx * H
    const y = wy * H
    const s = 0.05 * H
    const d = this.witch.dir
    const dark = this.paint([0.09, 0.06, 0.1])
    const flap = Math.sin(this.time * 7) * 0.12
    this.polygon([[x - d * s * 0.95, y + s * 0.1], [x - d * s * 1.55, y - s * 0.12], [x - d * s * 1.7, y + s * 0.2], [x - d * s * 1.5, y + s * 0.42]], this.paint([0.55, 0.4, 0.18]))
    this.shape([cap(x - d * s * 1.05, y + s * 0.12, x + d * s * 1.05, y - s * 0.06, Math.max(s * 0.05, 0.6), Math.max(s * 0.04, 0.6), this.paint([0.3, 0.2, 0.1]))], this.lighting, 0.5)
    this.polygon([[x - d * s * 0.05, y - s * 0.55], [x - d * s * 1.05, y - s * (0.2 + flap)], [x - d * s * 0.85, y + s * (0.05 - flap)], [x - d * s * 0.2, y + s * 0.02]], dark)
    const cackle = Math.max(0, Math.sin(this.time * 10)) * 0.25
    this.shape([ell(x, y - s * 0.22, s * 0.2, s * 0.3, d * 0.3, dark), ell(x + d * s * 0.14, y - s * 0.62, s * 0.12, s * 0.12, 0, dark), cap(x + d * s * 0.2, y - s * 0.6, x + d * s * (0.36 + cackle * 0.2), y - s * (0.6 + cackle), s * 0.04, s * 0.02, dark), cap(x + d * s * 0.08, y - s * 0.42, x + d * s * 0.55, y - s * 0.02, s * 0.06, s * 0.05, dark), cap(x + d * s * 0.05, y - s * 0.05, x + d * s * 0.35, y + s * 0.32, s * 0.07, s * 0.05, dark)], this.lighting, 0.5)
    this.ellipse(x + d * s * 0.14, y - s * 0.7, s * 0.3, Math.max(s * 0.05, 0.7), dark[0], dark[1], dark[2], 1)
    this.polygon([[x, y - s * 0.72], [x + d * s * 0.3, y - s * 0.72], [x - d * s * 0.3, y - s * 1.25]], dark)
  }

  private stepDance(dt: number) {
    const e = this.dance
    if (e.t < 0) {
      e.wait -= dt
      if (e.wait > 0) return
      e.t = 0
      return
    }
    e.t += dt
    if (e.t < DANCE) return
    e.t = -1
    e.wait = eggWait(true) * TIME_SCALE
  }

  // The egg: three zombies claw up out of the ground in the graveyard's front, dance in step, and sink back down.
  private drawDance() {
    const t = this.dance.t
    const rise = smoothstep(0, 4, t) * (1 - smoothstep(DANCE - 4, DANCE, t))
    const dance = smoothstep(4, 6, t) * (1 - smoothstep(DANCE - 6, DANCE - 4, t))
    const k = this.k
    for (const [i, x] of [0.3 * k, 0.42 * k, 0.54 * k].entries()) {
      const step = Math.sin(this.time * 2 + i * 0.3) * 0.02 * dance
      this.drawZombie(x + step, 0.95, i === 1 ? -1 : 1, this.time * 2, dance, rise)
    }
  }

  // Restores the house, tree and graveyard over clouds and storm drawn in front of them, within the box.
  private unsky(x0: number, y0: number, x1: number, y1: number) {
    restoreFore(this.hdr, this.background, this.fore, this.W, x0, y0, x1, Math.min(this.H - 1, y1))
  }

  // A thick straight line from a to b (pixels), radius in screen heights.
  private edge(a: Point, b: Point, radius: number, color: RGB) {
    const r = this.thick(radius, 0.5)
    this.shape([cap(a[0], a[1], b[0], b[1], r, r, color)], this.lighting, 0)
  }

  // A thin line of rim light along an outline (pixels), on the edges facing the sun or moon.
  private rimEdges(pts: Point[]) {
    const r = this.thick(0.0012, 0.45)
    const lx = this.orb.x * this.W
    const k = this.look.night ? 0.12 : 0.22
    const c: RGB = [this.light[0] * k, this.light[1] * k, this.light[2] * k]
    const parts: Part[] = []
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, ay] = pts[i]
      const [bx, by] = pts[i + 1]
      const facing = clamp((((lx - (ax + bx) / 2) / this.H) * 2), -1, 1)
      if (facing <= 0.05 && Math.abs(ay - by) > Math.abs(ax - bx)) continue
      parts.push(cap(ax, ay, bx, by, r, r, c))
    }
    if (parts.length) this.shape(parts, this.lighting, 0)
  }
}

// A band of ground fog, rows high from y0, tiled seamlessly across the width: thickest low over the graveyard.
function makeFog(W: number, H: number, y0: number, rows: number) {
  const tex = new Float32Array(W * rows)
  for (let j = 0; j < rows; j++) {
    const v = (y0 + j + 0.5) / H
    const band = smoothstep(0.6, 0.74, v) * (1 - smoothstep(0.9, 0.99, v))
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

export const hauntedHouse: Wallpaper = {
  id: "haunted-house",
  name: "Haunted House",
  description: "A crooked Victorian haunted house on a rise above a foggy graveyard under a huge moon, with a witch flying by now and then",
  activity: {
    calm: "The candle and jack-o'-lanterns flicker, fog creeps, a bat or two flits and the swing sways",
    lively: "Adds bats pouring from the turret, ghosts drifting by and a ghoul peeking out from behind a gravestone",
    teeming: "Adds a zombie shuffling through the graveyard, a hand clawing out of a grave, a witch crossing the moon and a light moving room to room",
  },
  scrim: {
    day: [
      [34, 40, 38],
      [40, 44, 36],
      [26, 30, 22],
    ],
    sunset: [
      [22, 6, 26],
      [44, 12, 18],
      [12, 4, 10],
    ],
    night: [
      [4, 2, 14],
      [8, 4, 22],
      [4, 3, 12],
    ],
  },
  create: (settings) => new HauntedHouse(settings),
}
