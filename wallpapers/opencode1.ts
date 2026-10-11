import { Canvas } from "../src/canvas"
import { eggWait } from "../src/egg"
import { TAU, clamp, hash2, lerp, rand, smoothstep, type RGB } from "../src/math"
import { touch } from "../src/touched"
import type { Activity, Settings, Time, Wallpaper } from "../src/wallpaper"
import { WeatherLayer } from "../src/weather"

// The scene runs slower than real time, which keeps it calm behind text.
const TIME_SCALE = 0.35
// The OpenCode mark on its grid of blocks: 4 across and 5 down, a ring one block thick around a 2x3 counter whose top
// row is open and whose lower two rows hold the fill. The hero mark's blocks are 3 checker squares, as in the brand
// artwork; smaller marks use 1 or 2.
const COLS = 4
const ROWS = 5
const HERO = 3
// The solid blocks as [column, row], bottom row first: the order falling blocks stack in.
const BLOCKS: [number, number][] = []
for (let r = ROWS - 1; r >= 0; r--) for (let c = 0; c < COLS; c++) if (r !== 1 || c === 0 || c === COLS - 1) BLOCKS.push([c, r])
// A building mark, in scene seconds: each block starts falling STAGGER after the one before, takes FALL to land from
// DROP screen heights up, and the mark dissolves block by block, each fading over FADE.
const STAGGER = 0.3
const FALL = 1.4
const DROP = 0.3
const BUILT = (BLOCKS.length - 1) * STAGGER + FALL
const FADE = 1.6
const GONE = (BLOCKS.length - 1) * 0.22 + FADE
// Teeming: a slow wave sweeps the checker every WAVE scene seconds.
const WAVE = 42
// Marks that never assemble or dissolve are this old, so they are always whole.
const STILL = 1e6

// Everything that changes with the time of day. Day is the brand's own light-gray look; sunset warms it; night turns
// the floor dark and the marks into saturated light, never white or gray, under the white text.
interface Look {
  // The checker's two squares.
  floor: [RGB, RGB]
  // Light added over the floor around (x, y): x a fraction of the width, y of the height; reach in screen heights.
  pool: { x: number; y: number; reach: number; color: RGB }
  // The marks cast a hard pixel shadow this many blocks across and down, multiplying the floor by shadow.
  shadow: RGB
  cast: [number, number]
  // Outline and fill of each kind of mark: the hero's, two for the rest, and at night a rare warm one.
  marks: [outline: RGB, fill: RGB][]
  // How strongly each mark's outline lights the floor around it.
  halo: number
  // Added along the liquid's surface.
  surface: RGB
  // Added to a checker square as it twinkles, and as a wave or ripple passes.
  twinkle: RGB
  wave: RGB
}

const LOOKS: Record<Time, Look> = {
  // The brand artwork: a pale neutral checker, a near-black hero with a mid-gray fill, and gray marks around it.
  day: {
    floor: [
      [0.6, 0.6, 0.595],
      [0.555, 0.555, 0.55],
    ],
    pool: { x: 0.6, y: 0.2, reach: 0.8, color: [0.11, 0.11, 0.105] },
    shadow: [0.8, 0.8, 0.82],
    cast: [1 / 3, 1 / 3],
    marks: [
      [
        [0.045, 0.04, 0.04],
        [0.4, 0.395, 0.39],
      ],
      [
        [0.19, 0.18, 0.18],
        [0.42, 0.415, 0.41],
      ],
      [
        [0.1, 0.095, 0.095],
        [0.32, 0.315, 0.31],
      ],
    ],
    halo: 0,
    surface: [0.05, 0.05, 0.05],
    twinkle: [-0.07, -0.07, -0.068],
    wave: [0.07, 0.07, 0.07],
  },
  // A rose-amber checker lit low from the left, long violet shadows, plum outlines holding amber and gold.
  sunset: {
    floor: [
      [0.56, 0.32, 0.25],
      [0.51, 0.29, 0.23],
    ],
    pool: { x: 0.02, y: 0.45, reach: 1.1, color: [0.16, 0.08, 0.02] },
    shadow: [0.62, 0.52, 0.64],
    cast: [2 / 3, 1 / 3],
    marks: [
      [
        [0.07, 0.022, 0.032],
        [0.82, 0.38, 0.14],
      ],
      [
        [0.26, 0.075, 0.08],
        [0.9, 0.52, 0.2],
      ],
      [
        [0.14, 0.04, 0.065],
        [0.75, 0.28, 0.2],
      ],
    ],
    halo: 0,
    surface: [0.22, 0.12, 0.04],
    twinkle: [0.1, 0.05, 0.02],
    wave: [0.09, 0.045, 0.02],
  },
  // A deep navy checker; the marks glow cobalt, violet and teal, with liquid light inside, and light the floor.
  night: {
    floor: [
      [0.017, 0.024, 0.058],
      [0.011, 0.016, 0.042],
    ],
    pool: { x: 0.45, y: -0.15, reach: 0.95, color: [0.006, 0.016, 0.045] },
    shadow: [1, 1, 1],
    cast: [0, 0],
    marks: [
      [
        [0.04, 0.13, 0.85],
        [0.0, 0.46, 0.4],
      ],
      [
        [0.36, 0.08, 0.9],
        [0.1, 0.22, 0.95],
      ],
      [
        [0.0, 0.45, 0.45],
        [0.12, 0.14, 0.8],
      ],
      [
        [0.9, 0.42, 0.06],
        [0.55, 0.18, 0.04],
      ],
    ],
    halo: 0.12,
    surface: [0.04, 0.3, 0.26],
    twinkle: [0.02, 0.05, 0.15],
    wave: [0.012, 0.035, 0.11],
  },
}

// A mark: its top-left corner in screen heights, block size in checker squares, kind (an index into the look's marks),
// slosh phase, drift speed, and how far back it is (0 near to 1 far, fading into the floor). Built marks fall into
// place block by block from age 0 and dissolve from life on; the rest just are.
interface Mark {
  x: number
  y: number
  size: number
  kind: number
  phase: number
  vx: number
  far: number
  age: number
  life: number
  poked: boolean
  // How hard a passing wave or ripple has set its fill sloshing, easing back to 0.
  kick: number
}

// A checker square lighting up and fading: its column and row, age and length in scene seconds.
interface Twinkle {
  i: number
  j: number
  age: number
  span: number
}

// A ring of light spreading through the checker from (x, y) in screen heights.
interface Ripple {
  x: number
  y: number
  age: number
  strength: number
}

class OpenCodeMark extends Canvas {
  private time = 0
  private readonly activity: Activity
  private readonly look: Look
  private readonly weather: WeatherLayer
  // One checker square in real pixels, and the hero's grid position in squares.
  private square = 4
  private heroI = 0
  private heroJ = 0
  private hero: Mark = { x: 0, y: 0, size: HERO, kind: 0, phase: 0, vx: 0, far: 0, age: STILL, life: Infinity, poked: false, kick: 0 }
  private drift: Mark[] = []
  private driftA = 0
  private built: Mark[] = []
  private nextBuild = 4
  private twinkles: Twinkle[] = []
  private nextTwinkle = 2
  private ripples: Ripple[] = []
  // Per checker square, how much it twinkles and how much a wave, ripple or the egg lifts it this frame.
  private glow = new Float32Array(0)
  // Fills brim after a task is done and ease back.
  private brim = 0
  private egg = { wait: eggWait() * TIME_SCALE, t: -1 }

  constructor(settings: Settings) {
    super()
    this.activity = settings.activity
    this.look = LOOKS[settings.time]
    this.weather = new WeatherLayer(settings.weather ?? "clear", settings.time, 0)
    this.nextBuild = settings.activity === "teeming" ? 1 : Infinity
  }

  step(dt: number) {
    dt = clamp(dt, 0, 0.1) * TIME_SCALE
    this.time += dt
    this.stepGloom(dt)
    this.weather.step(dt)
    this.brim = Math.max(0, this.brim - dt / 14)
    const A = this.A
    for (const m of this.drift) {
      m.x += m.vx * dt
      const w = (COLS * m.size * this.square) / this.H
      if (m.vx > 0 && m.x > A + 0.05) m.x -= A + w + 0.3
      if (m.vx < 0 && m.x < -w - 0.05) m.x += A + w + 0.3
    }
    for (const m of this.built) m.age += dt
    this.built = this.built.filter((m) => m.age < m.life + GONE)
    if (this.activity === "teeming") {
      this.nextBuild -= dt
      if (this.nextBuild <= 0) {
        this.nextBuild = rand(10, 16)
        if (this.built.filter((m) => !m.poked).length < (A > 2.2 ? 4 : 3)) this.build()
      }
    }
    for (const t of this.twinkles) t.age += dt
    this.twinkles = this.twinkles.filter((t) => t.age < t.span)
    this.nextTwinkle -= dt
    if (this.nextTwinkle <= 0) {
      this.nextTwinkle = this.activity === "calm" ? rand(5, 11) : this.activity === "lively" ? rand(1.2, 2.6) : rand(0.5, 1.1)
      const cols = Math.ceil(this.W / this.square)
      const rows = Math.ceil(this.H / this.square)
      const i = Math.floor(rand(0, cols))
      const j = Math.floor(rand(0, rows))
      if (!this.underHero(i, j)) this.twinkles.push({ i, j, age: 0, span: rand(4, 8) })
    }
    for (const r of this.ripples) r.age += dt
    this.ripples = this.ripples.filter((r) => r.age < 9)
    const s = this.square / this.H
    for (const m of [this.hero, ...this.drift, ...this.built]) m.kick = Math.max(m.kick * Math.exp(-dt * 0.35), this.surge(m.x + COLS * m.size * 0.5 * s, m.y + ROWS * m.size * 0.5 * s))
    const e = this.egg
    if (e.t >= 0) {
      e.t += dt
      if (e.t > 24) {
        e.t = -1
        e.wait = eggWait(true) * TIME_SCALE
      }
      return
    }
    e.wait -= dt
    if (e.wait <= 0) e.t = 0
  }

  render() {
    this.restore()
    this.drawFloor()
    for (const m of this.drift) if (m.far > 0) this.drawMark(m)
    for (const m of this.drift) if (m.far === 0) this.drawMark(m)
    for (const m of this.built) this.drawMark(m)
    this.drawMark(this.hero, false)
    this.weather.draw(this.hdr, this.W, this.H)
    this.finish()
  }

  // A task is done: every fill tops up to the brim, and a ripple runs out from the hero.
  protected override visit() {
    this.brim = 1
    const s = this.square / this.H
    this.ripples.push({ x: (this.heroI + COLS * 1.5) * s, y: (this.heroJ + ROWS * 1.5) * s, age: 0, strength: 1 })
    if (this.activity === "teeming") this.build()
  }

  // A click sends a ripple through the checker and builds a small mark there, if it fits.
  poke(x: number, y: number) {
    if (this.ripples.length < 5) this.ripples.push({ x, y, age: 0, strength: 0.8 })
    if (this.built.filter((m) => m.poked).length >= 2) return
    const s = this.square / this.H
    const size = this.activity === "calm" ? 1 : 2
    const m = this.newMark(Math.round(x / s - COLS * size * 0.5) * s, Math.round(y / s - ROWS * size * 0.5) * s, size)
    if (!m) return
    m.poked = true
    m.life = BUILT + 30
    this.built.push(m)
  }

  protected override layout() {
    const { W, H, A, px } = this
    // A checker square is one terminal row tall (two columns wide), so every square fills whole cells; very tall
    // terminals and pixel mode use bigger ones.
    const real = H / px
    this.square = this.cells ? 4 * Math.max(1, Math.round(real / 4 / 64)) : Math.max(2, Math.round(real / 45))
    const g = this.square * px
    const cols = Math.ceil(W / g)
    const rows = Math.ceil(H / g)
    const margin = Math.round((0.1 * real) / this.square)
    this.heroI = Math.max(1, cols - margin - COLS * HERO)
    this.heroJ = Math.max(1, rows - margin - ROWS * HERO)
    this.hero.x = (this.heroI * this.square) / real
    this.hero.y = (this.heroJ * this.square) / real
    this.glow = new Float32Array(cols * rows * 2)
    const look = this.look
    const p = look.pool
    const marks = look.marks
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const u = ((i + 0.5) * g) / H
        const v = ((j + 0.5) * g) / H
        const k = Math.exp(-((u - p.x * A) ** 2 + (v - p.y) ** 2) / (p.reach * p.reach))
        const f = look.floor[(i + j) & 1]
        rect(this.hdr, W, H, i * g, j * g, (i + 1) * g, (j + 1) * g, f[0] + p.color[0] * k, f[1] + p.color[1] * k, f[2] + p.color[2] * k, 1)
      }
    const b = HERO * g
    const x = this.heroI * g
    const y = this.heroJ * g
    if (look.halo > 0) {
      const o = marks[0][0]
      halo(this.hdr, W, H, x, y, x + COLS * b, y + ROWS * b, b * 1.4, o[0] * look.halo, o[1] * look.halo, o[2] * look.halo)
    }
    shadowOf(this.hdr, W, H, x + look.cast[0] * b, y + look.cast[1] * b, b, look.shadow, 1)
    this.drawMark(this.hero, false)
    if (this.driftA === A) return
    this.driftA = A
    this.drift = []
    if (this.activity === "calm") return
    // Lanes of marks drifting along the top and bottom, near ones bigger and quicker, far ones fading into the floor
    // and passing behind the hero.
    const lanes: [y: number, size: number, vx: number, far: number, count: number][] = [
      [0.05, 2, -0.012, 0, Math.max(1, Math.round(A * 0.8))],
      [0.1, 1, 0.007, 0.55, Math.max(1, Math.round(A * 1.2))],
      [0.84, 1, 0.006, 0.55, Math.max(1, Math.round(A * 0.9))],
    ]
    for (const [ly, size, vx, far, count] of lanes) {
      for (let n = 0; n < count; n++)
        this.drift.push({ x: ((n + rand(0.15, 0.7)) / count) * (A - 0.2), y: ly, size, kind: 1 + ((n + size) % 2), phase: rand(0, TAU), vx: vx * rand(0.8, 1.2), far, age: STILL, life: Infinity, poked: false, kick: 0 })
    }
  }

  // How much a wave or ripple lifts the checker at (u, v) in screen heights.
  private surge(u: number, v: number) {
    let k = 0
    const sweep = (this.time % WAVE) / WAVE / 0.6
    if (this.activity === "teeming" && sweep < 1) {
      const d = (u * 0.8 + v * 0.6 - (sweep * (0.8 * this.A + 1.6) - 0.5)) / 0.16
      if (d > -3 && d < 3) k += 0.7 * Math.exp(-d * d)
    }
    for (const r of this.ripples) {
      const d = (Math.hypot(u - r.x, v - r.y) - r.age * 0.09) / 0.035
      if (d > -3 && d < 3) k += r.strength * Math.exp(-d * d) * (1 - r.age / 9)
    }
    return k
  }

  private underHero(i: number, j: number) {
    return i >= this.heroI - 1 && i < this.heroI + COLS * HERO + 3 && j >= this.heroJ - 1 && j < this.heroJ + ROWS * HERO + 3
  }

  // A new mark of size squares per block at (x, y), snapped to the checker, unless it would crowd the hero or another
  // built mark or leave the screen.
  private newMark(x: number, y: number, size: number): Mark | undefined {
    const s = this.square / this.H
    const i = Math.round(x / s)
    const j = Math.round(y / s)
    const w = COLS * size
    const h = ROWS * size
    if (i < 1 || j < 1 || (i + w + 1) * s > this.A || (j + h + 1) * s > 1) return
    const clear = (bi: number, bj: number, bw: number, bh: number) => i + w + 1 <= bi || bi + bw + 1 <= i || j + h + 1 <= bj || bj + bh + 1 <= j
    if (!clear(this.heroI, this.heroJ, COLS * HERO, ROWS * HERO)) return
    if (this.built.some((m) => m.age < m.life + GONE && !clear(Math.round(m.x / s), Math.round(m.y / s), COLS * m.size, ROWS * m.size))) return
    const kind = Math.random() < 0.85 ? 1 + Math.floor(rand(0, 2)) : this.look.marks.length - 1
    return { x: i * s, y: j * s, size, kind, phase: rand(0, TAU), vx: 0, far: 0, age: 0, life: BUILT + rand(32, 48), poked: false, kick: 0 }
  }

  // Teeming: a mark assembles out of falling blocks somewhere open, away from the middle where text sits and, where
  // there is room, between the drifting lanes.
  private build() {
    const s = this.square / this.H
    const w = COLS * 2 * s
    const h = ROWS * 2 * s
    const A = this.A
    for (let n = 0; n < 16; n++) {
      const [x, y] = n < 10 ? this.openSpot(0.03, A - w - 0.03, 0.29, 0.81 - h) : this.openSpot(0.03, A - w - 0.03, 0.03, 0.97 - h)
      if (x + w > A / 2 - 0.45 && x < A / 2 + 0.45 && y + h > 0.3 && y < 0.7) continue
      const m = this.newMark(x, y, 2)
      if (!m) continue
      this.built.push(m)
      return
    }
  }

  // Twinkles darken or light single checker squares; waves, ripples and the egg lift whole stretches of them.
  private drawFloor() {
    const { W, H, look } = this
    const g = this.square
    const cols = Math.ceil(W / g)
    const rows = Math.ceil(H / g)
    const glow = this.glow
    glow.fill(0)
    for (const t of this.twinkles) if (t.i < cols && t.j < rows) glow[(t.j * cols + t.i) * 2] += Math.sin((t.age / t.span) * Math.PI) ** 2
    const wave = this.activity === "teeming" && (this.time % WAVE) / WAVE < 0.6
    const e = this.egg.t
    const egg = e >= 0 ? smoothstep(0, 4, e) * smoothstep(24, 18, e) : 0
    if (wave || this.ripples.length || egg > 0) {
      // The egg: the checker itself draws one giant mark across the screen, its blocks a sixth of the height.
      const eb = Math.max(1, Math.round(rows / 6.5))
      const ei = Math.floor(cols / 2 - eb * 2)
      const ej = Math.floor(rows / 2 - eb * 2.5)
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) {
          const u = ((i + 0.5) * g) / H
          const v = ((j + 0.5) * g) / H
          let k = this.surge(u, v)
          if (egg > 0) {
            const c = Math.floor((i - ei) / eb)
            const rr = Math.floor((j - ej) / eb)
            if (c >= 0 && c < COLS && rr >= 0 && rr < ROWS && (rr !== 1 || c === 0 || c === COLS - 1)) k += 0.6 * egg * (rr >= 2 && rr <= 3 && c > 0 && c < COLS - 1 ? 0.5 : 1)
          }
          glow[(j * cols + i) * 2 + 1] = k
        }
    }
    glowSquares(this.hdr, W, H, g, cols, rows, glow, look.twinkle, look.wave)
  }

  // Draws a mark: its shadow, a halo at night, then its blocks; while it is whole, a liquid fill that rises, falls and
  // sloshes. Building marks drop their blocks in bottom up and dissolve them away at the end.
  private drawMark(m: Mark, shadow = true) {
    const { W, H, look, hdr, px } = this
    const g = this.square * px
    const b = m.size * g
    const cell = this.cells ? 2 * px : px
    // Snapped to whole pixels (and, for quadrant terminals, pairs of rows), so edges stay crisp in cells.
    const x = Math.round((m.x * H) / px) * px
    const y = Math.round((m.y * H) / cell) * cell
    if (x > W || x + COLS * b < 0) return
    const [o0, f0] = look.marks[m.kind % look.marks.length]
    const base = look.floor[1]
    const mix = (c: RGB, k: number): RGB => [lerp(c[0], base[0], k), lerp(c[1], base[1], k), lerp(c[2], base[2], k)]
    const fade = m.far * 0.55
    const outline = mix(o0, fade)
    const fill = mix(f0, fade)
    const whole = m.age >= BUILT && m.age < m.life
    const settle = m.life === Infinity ? 1 : smoothstep(BUILT, BUILT + 5, m.age) * smoothstep(m.life, m.life - 5, m.age)
    const dx = look.cast[0] * b
    const dy = look.cast[1] * b
    if (whole) {
      if (look.halo > 0 && shadow) halo(hdr, W, H, x, y, x + COLS * b, y + ROWS * b, b * 1.2, outline[0] * look.halo, outline[1] * look.halo, outline[2] * look.halo)
      if (shadow && look.cast[0] > 0) shadowOf(hdr, W, H, x + dx, y + dy, b, look.shadow, 1 - m.far * 0.6)
      rect(hdr, W, H, x, y, x + COLS * b, y + b, outline[0], outline[1], outline[2], 1)
      rect(hdr, W, H, x, y + (ROWS - 1) * b, x + COLS * b, y + ROWS * b, outline[0], outline[1], outline[2], 1)
      rect(hdr, W, H, x, y + b, x + b, y + (ROWS - 1) * b, outline[0], outline[1], outline[2], 1)
      rect(hdr, W, H, x + (COLS - 1) * b, y + b, x + COLS * b, y + (ROWS - 1) * b, outline[0], outline[1], outline[2], 1)
      this.drawLiquid(x + b, y + b, b, m, fill, settle)
      return
    }
    // Building or dissolving, block by block.
    for (const [n, [c, r]] of BLOCKS.entries()) {
      const t = m.age - n * STAGGER
      if (t <= 0) continue
      const fall = clamp(t / FALL, 0, 1)
      const gone = m.age >= m.life ? clamp((m.age - m.life - order(n, m.phase) * 0.22) / FADE, 0, 1) : 0
      const a = smoothstep(0, 0.5, fall) * (1 - gone)
      if (a <= 0.01) continue
      const lift = Math.round(((1 - fall) ** 2 * DROP * H) / cell) * cell
      const bx = x + c * b
      const by = y + r * b - lift
      const color = r >= 2 && r <= 3 && c >= 1 && c <= 2 ? fill : outline
      if (look.cast[0] > 0) shadowOf1(hdr, W, H, bx + dx, by + dy, b, look.shadow, a * smoothstep(0.6, 1, fall))
      rect(hdr, W, H, bx, by, bx + b, by + b, color[0], color[1], color[2], a)
    }
  }

  // The fill: two blocks deep at rest, rising and falling with a slow slosh across, topping up after a task is done
  // and draining after an error. Its surface is shaded per pixel column, anti-aliased, with a brighter edge.
  private drawLiquid(x: number, y: number, b: number, m: Mark, fill: RGB, settle: number) {
    const { W, H, look, hdr, px } = this
    const t = this.time
    const calm = this.activity === "calm"
    const slosh = Math.sin(t * (TAU / 3.2) + m.phase) * m.kick
    const rise = settle * ((calm ? 0.22 : 0.3) * Math.sin(t * (TAU / 15) + m.phase) + 0.12 * slosh)
    const tilt = settle * ((calm ? 0.1 : 0.16) * Math.sin(t * (TAU / 7.5) + m.phase * 1.7) + 0.4 * slosh)
    const level = clamp(2 + rise + this.brim * 1.1 - this.gloom * 0.9, 0.3, 3)
    const night = look.halo > 0
    const glow = 1 + (night ? 0.5 : 0.1) * this.brim
    const bottom = y + 3 * b
    const edge = this.cells ? 0 : px
    const s = look.surface
    let least = bottom
    for (let i = 0; i < 2 * b; i += px) {
      const u = (i + 0.5 * px) / (2 * b) - 0.5
      const top = Math.min(bottom, bottom - b * (level + tilt * u * 2 + 0.04 * settle * Math.sin(u * 7 + t * 0.9 + m.phase)))
      least = Math.min(least, top)
      // At night the liquid's light rises into the open top of the counter.
      if (night) rise1(hdr, W, H, x + i, x + i + px, Math.max(y, top - b), top, fill[0] * 0.35, fill[1] * 0.35, fill[2] * 0.35)
      rect(hdr, W, H, x + i, top, x + i + px, bottom, fill[0] * glow, fill[1] * glow, fill[2] * glow, 1)
      if (edge) rect(hdr, W, H, x + i, top, x + i + px, top + edge, fill[0] * glow + s[0], fill[1] * glow + s[1], fill[2] * glow + s[2], 1)
    }
    // A few pixel bubbles rise through the fill and vanish at the surface.
    const size = this.cells ? 2 * px : Math.max(px, Math.round(b / 8 / px) * px)
    const count = calm ? 1 : 2
    for (let k = 0; k < count; k++) {
      const p = t / 7 + hash2(k, m.phase * 10)
      const n = Math.floor(p)
      if (hash2(n, k + m.phase * 10) > (calm ? 0.45 : 0.7)) continue
      const f = p - n
      const bx = x + Math.round((hash2(n * 3.1, k) * (2 * b - size)) / size) * size
      const by = Math.round((bottom - size - f * (bottom - least)) / size) * size
      if (by < least + size * 0.5) continue
      const c = night ? 1.6 : 1.12
      rect(hdr, W, H, bx, by, bx + size, by + size, fill[0] * glow * c + s[0], fill[1] * glow * c + s[1], fill[2] * glow * c + s[2], smoothstep(0, 0.15, f))
    }
  }

}

// Where block n of a mark comes in its dissolve, from a hash of the mark's phase.
function order(n: number, phase: number) {
  return Math.floor(hash2(n, phase * 100) * BLOCKS.length)
}

// Mixes a color over x0..x1 by y0..y1 in pixels by a, anti-aliasing fractional edges.
function rect(hdr: Float32Array, W: number, H: number, x0: number, y0: number, x1: number, y1: number, r: number, g: number, b: number, a: number) {
  const ya = Math.max(0, Math.floor(y0))
  const yb = Math.min(H, Math.ceil(y1))
  const xa = Math.max(0, Math.floor(x0))
  const xb = Math.min(W, Math.ceil(x1))
  if (xb > xa && yb > ya) touch(hdr, xa, ya, xb - 1, yb - 1)
  for (let y = ya; y < yb; y++) {
    const cy = Math.min(y + 1, y1) - Math.max(y, y0)
    for (let x = xa; x < xb; x++) {
      const k = a * cy * (Math.min(x + 1, x1) - Math.max(x, x0))
      const o = (y * W + x) * 3
      hdr[o] += (r - hdr[o]) * k
      hdr[o + 1] += (g - hdr[o + 1]) * k
      hdr[o + 2] += (b - hdr[o + 2]) * k
    }
  }
}

// Adds a color to the pixel column x0..x1, fading from nothing at y0 to full at y1.
function rise1(hdr: Float32Array, W: number, H: number, x0: number, x1: number, y0: number, y1: number, r: number, g: number, b: number) {
  const ya = Math.max(0, Math.floor(y0))
  const yb = Math.min(H, Math.ceil(y1))
  const xa = Math.max(0, Math.floor(x0))
  const xb = Math.min(W, Math.ceil(x1))
  if (xb <= xa || yb <= ya) return
  touch(hdr, xa, ya, xb - 1, yb - 1)
  for (let y = ya; y < yb; y++) {
    const k = ((y + 0.5 - y0) / (y1 - y0)) ** 2
    for (let x = xa; x < xb; x++) {
      const o = (y * W + x) * 3
      hdr[o] += r * k
      hdr[o + 1] += g * k
      hdr[o + 2] += b * k
    }
  }
}

// Multiplies x0..x1 by y0..y1 by a color, scaled toward no change by 1 - a.
function darken(hdr: Float32Array, W: number, H: number, x0: number, y0: number, x1: number, y1: number, m: RGB, a: number) {
  const ya = Math.max(0, Math.floor(y0))
  const yb = Math.min(H, Math.ceil(y1))
  const xa = Math.max(0, Math.floor(x0))
  const xb = Math.min(W, Math.ceil(x1))
  if (xb > xa && yb > ya) touch(hdr, xa, ya, xb - 1, yb - 1)
  for (let y = ya; y < yb; y++) {
    const cy = Math.min(y + 1, y1) - Math.max(y, y0)
    for (let x = xa; x < xb; x++) {
      const k = a * cy * (Math.min(x + 1, x1) - Math.max(x, x0))
      const o = (y * W + x) * 3
      hdr[o] *= 1 - (1 - m[0]) * k
      hdr[o + 1] *= 1 - (1 - m[1]) * k
      hdr[o + 2] *= 1 - (1 - m[2]) * k
    }
  }
}

// A whole mark's shadow with its top-left at (x, y): the mark's outline less the open top of its counter.
function shadowOf(hdr: Float32Array, W: number, H: number, x: number, y: number, b: number, m: RGB, a: number) {
  darken(hdr, W, H, x, y, x + COLS * b, y + b, m, a)
  darken(hdr, W, H, x, y + b, x + b, y + 2 * b, m, a)
  darken(hdr, W, H, x + (COLS - 1) * b, y + b, x + COLS * b, y + 2 * b, m, a)
  darken(hdr, W, H, x, y + 2 * b, x + COLS * b, y + ROWS * b, m, a)
}

// One falling block's shadow.
function shadowOf1(hdr: Float32Array, W: number, H: number, x: number, y: number, b: number, m: RGB, a: number) {
  darken(hdr, W, H, x, y, x + b, y + b, m, a)
}

// Adds light around the box x0..x1 by y0..y1, falling off over reach pixels from its edge.
function halo(hdr: Float32Array, W: number, H: number, x0: number, y0: number, x1: number, y1: number, reach: number, r: number, g: number, b: number) {
  const ya = Math.max(0, Math.floor(y0 - reach * 3))
  const yb = Math.min(H, Math.ceil(y1 + reach * 3))
  const xa = Math.max(0, Math.floor(x0 - reach * 3))
  const xb = Math.min(W, Math.ceil(x1 + reach * 3))
  if (xb > xa && yb > ya) touch(hdr, xa, ya, xb - 1, yb - 1)
  for (let y = ya; y < yb; y++) {
    const dy = Math.max(0, y0 - y - 0.5, y + 0.5 - y1)
    for (let x = xa; x < xb; x++) {
      const dx = Math.max(0, x0 - x - 0.5, x + 0.5 - x1)
      const k = Math.exp(-Math.hypot(dx, dy) / reach)
      const o = (y * W + x) * 3
      hdr[o] += r * k
      hdr[o + 1] += g * k
      hdr[o + 2] += b * k
    }
  }
}

// Adds each checker square's twinkle and lift (two values per square in glow) times their colors, keeping light
// non-negative, and touches each row's run of changed squares.
function glowSquares(hdr: Float32Array, W: number, H: number, g: number, cols: number, rows: number, glow: Float32Array, twinkle: RGB, wave: RGB) {
  for (let j = 0; j < rows; j++) {
    let first = -1
    let last = -1
    for (let i = 0; i < cols; i++) {
      const t = glow[(j * cols + i) * 2]
      const w = glow[(j * cols + i) * 2 + 1]
      if (t < 0.01 && w < 0.01) continue
      if (first < 0) first = i
      last = i
      const r = twinkle[0] * t + wave[0] * w
      const gr = twinkle[1] * t + wave[1] * w
      const b = twinkle[2] * t + wave[2] * w
      const ya = j * g
      const yb = Math.min(H, ya + g)
      const xa = i * g
      const xb = Math.min(W, xa + g)
      for (let y = ya; y < yb; y++)
        for (let x = xa; x < xb; x++) {
          const o = (y * W + x) * 3
          hdr[o] = Math.max(0, hdr[o] + r)
          hdr[o + 1] = Math.max(0, hdr[o + 1] + gr)
          hdr[o + 2] = Math.max(0, hdr[o + 2] + b)
        }
    }
    if (first >= 0) touch(hdr, first * g, j * g, (last + 1) * g - 1, Math.min(H, (j + 1) * g) - 1)
  }
}

export const opencode1: Wallpaper = {
  id: "opencode1",
  name: "OpenCode Mark",
  description: "The OpenCode mark on a softly lit pixel checker, its fill rising and falling like liquid",
  activity: {
    calm: "One large mark off to the side, its fill gently rising and falling, a pixel twinkling now and then",
    lively: "Smaller marks drift past at different depths, their fills sloshing, pixels twinkling across the checker",
    teeming: "Marks assemble out of falling blocks and dissolve away again, while a slow wave sweeps the checker",
  },
  scrim: {
    day: [
      [56, 56, 58],
      [50, 50, 52],
      [44, 44, 46],
    ],
    sunset: [
      [42, 20, 20],
      [38, 17, 16],
      [30, 13, 12],
    ],
    night: [
      [3, 5, 14],
      [3, 5, 12],
      [2, 4, 10],
    ],
  },
  create: (settings) => new OpenCodeMark(settings),
}
