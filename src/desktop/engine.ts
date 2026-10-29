import { settingsFor, type AgentEvent, type Brightness, type Power, type Scene, type Settings, type Wallpaper } from "../wallpaper"

// The canvas engine for the desktop panel. The TUI engine (src/engine.tsx) exists to turn a scene's pixels into
// terminal cells: two colours per cell, octant glyphs, a scrim behind text. A canvas has real pixels, so all of that
// goes away and this stays a loop, a blit, and a brightness LUT.

// The TUI's brightness levels, copied so the panel dims the same way: gain lifts the scene, and the soft knee keeps
// the top end under 255 so a scene never competes with the interface on top of it.
const LEVELS: Record<Brightness, number> = { subtle: 0.6, normal: 1, vivid: 1.6 }

const curves = new Map<Brightness, Uint8Array>()

export function brightnessCurve(brightness: Brightness): Uint8Array {
  const cached = curves.get(brightness)
  if (cached) return cached
  const gain = LEVELS[brightness]
  const curve = new Uint8Array(256)
  for (let v = 0; v < 256; v++) {
    const x = (v / 255) * gain
    curve[v] = Math.round((x / (1 + x * 0.9)) * 255)
  }
  curves.set(brightness, curve)
  return curve
}

// How much faster a scene runs while the agent works, by activity level. From the TUI engine.
const BUSY_PACE = { calm: 1.12, lively: 1.25, teeming: 1.4 } as const
// How long a failure keeps a scene overcast before it eases back. From the TUI engine.
const GLOOM_MS = 120_000
// The crossfade between two wallpapers, in seconds of real time.
const FADE = 1.5
// Scenes clamp a step at 0.1 s; longer gaps are split, so a stalled tab does not jump the scene forward.
const MAX_STEP = 0.1

// Whether two settings produce the same running scene. Brightness is excluded: it is applied at blit time.
function sameScene(a: Settings, b: Settings): boolean {
  return a.activity === b.activity && a.time === b.time && a.season === b.season && a.weather === b.weather
}

export interface EngineOptions {
  canvas: HTMLCanvasElement
  fps?: number
  idleFps?: number
  idleAfter?: number
  pixelBudget?: number
  now?: () => number
  onError?: (error: unknown) => void
}

export interface Engine {
  // While running, the old scene crossfades into the new one over `fade` seconds.
  start(wallpaper: Wallpaper, settings: Settings, fade?: number): void
  stop(): void
  react(event: AgentEvent): void
  power(mode: Power): void
  resize(): void
  // Scene coordinates: x runs 0..W/H across and y runs 0..1 down.
  poke(x: number, y: number): void
  destroy(): void
}

interface Layer {
  scene: Scene
  wallpaper: Wallpaper
  settings: Settings
}

export function createEngine(options: EngineOptions): Engine {
  const { canvas } = options
  const now = options.now ?? (() => performance.now())
  const fps = options.fps ?? 15
  const idleFps = options.idleFps ?? 5
  const idleAfter = options.idleAfter ?? 30_000
  const pixelBudget = options.pixelBudget ?? 640_000

  // The scene's own resolution. It is usually below the canvas's device resolution: a wallpaper is soft by nature, and
  // the upscale is cheaper than a full-resolution step.
  const source = document.createElement("canvas")
  const sourceContext = source.getContext("2d")
  // The outgoing scene during a crossfade.
  const previous = document.createElement("canvas")
  const previousContext = previous.getContext("2d")

  let current: Layer | undefined
  let outgoing: Layer | undefined
  let fading = 1
  let fadeLength = 0

  let width = 0
  let height = 0
  let interval = 1000 / fps
  let power: Power = "saver"
  let busy = false
  let pace = 1
  let lifting: ReturnType<typeof setTimeout> | undefined
  let frame: number | undefined
  let lastStep = 0
  let lastActivity = 0
  let destroyed = false

  let frameData: ImageData | undefined
  let outgoingData: ImageData | undefined
  let mixed: Uint8ClampedArray<ArrayBuffer> | undefined

  const report = (error: unknown) => options.onError?.(error)

  // Renders at most `pixelBudget` pixels, keeping the panel's aspect ratio.
  const measure = () => {
    const ratio = window.devicePixelRatio || 1
    const cssWidth = Math.max(1, canvas.clientWidth)
    const cssHeight = Math.max(1, canvas.clientHeight)
    let w = Math.round(cssWidth * ratio)
    let h = Math.round(cssHeight * ratio)
    const scale = Math.min(1, Math.sqrt(pixelBudget / (w * h)))
    w = Math.max(64, Math.round(w * scale))
    h = Math.max(36, Math.round(h * scale))
    return { w, h, cssWidth, cssHeight }
  }

  const resize = () => {
    if (destroyed) return
    const { w, h, cssWidth, cssHeight } = measure()
    const deviceWidth = Math.max(1, Math.round(cssWidth * (window.devicePixelRatio || 1)))
    const deviceHeight = Math.max(1, Math.round(cssHeight * (window.devicePixelRatio || 1)))
    if (canvas.width !== deviceWidth) canvas.width = deviceWidth
    if (canvas.height !== deviceHeight) canvas.height = deviceHeight
    if (w === width && h === height) return
    width = w
    height = h
    source.width = w
    source.height = h
    previous.width = w
    previous.height = h
    frameData = undefined
    outgoingData = undefined
    mixed = undefined
    try {
      current?.scene.resize(w, h, false)
      outgoing?.scene.resize(w, h, false)
    } catch (error) {
      report(error)
      stop()
    }
  }

  const drawScene = (layer: Layer, context: CanvasRenderingContext2D, cache: ImageData | undefined) => {
    layer.scene.render()
    const pixels = layer.scene.pixels
    const image = cache && cache.width === layer.scene.W && cache.height === layer.scene.H ? cache : new ImageData(new Uint8ClampedArray(layer.scene.W * layer.scene.H * 4), layer.scene.W, layer.scene.H)
    const data = image.data
    const curve = brightnessCurve(layer.settings.brightness ?? "normal")
    for (let i = 0; i < pixels.length; i += 4) {
      data[i] = curve[pixels[i]]
      data[i + 1] = curve[pixels[i + 1]]
      data[i + 2] = curve[pixels[i + 2]]
      data[i + 3] = 255
    }
    context.putImageData(image, 0, 0)
    return image
  }

  const blit = () => {
    const context = canvas.getContext("2d")
    if (!context || !current) return
    frameData = drawScene(current, sourceContext!, frameData)
    if (outgoing && fading < 1) {
      outgoingData = drawScene(outgoing, previousContext!, outgoingData)
      // Blend the two into a third buffer, so each scene keeps its own canvas.
      const blended = mixed && mixed.length === frameData.data.length ? mixed : new Uint8ClampedArray(frameData.data.length)
      mixed = blended
      const t = fading
      const a = frameData.data
      const b = outgoingData.data
      for (let i = 0; i < a.length; i += 4) {
        blended[i] = a[i] + (b[i] - a[i]) * (1 - t)
        blended[i + 1] = a[i + 1] + (b[i + 1] - a[i + 1]) * (1 - t)
        blended[i + 2] = a[i + 2] + (b[i + 2] - a[i + 2]) * (1 - t)
        blended[i + 3] = 255
      }
      context.putImageData(new ImageData(blended, source.width, source.height), 0, 0)
      // The outgoing scene is done fading; release it so only one scene is kept between changes.
      if (fading >= 1) {
        outgoing = undefined
        outgoingData = undefined
      }
    } else {
      context.drawImage(source, 0, 0, canvas.width, canvas.height)
    }
  }

  const step = (at: number) => {
    frame = undefined
    if (destroyed || !current) return
    if (document.hidden) return
    const elapsed = at - lastStep
    if (elapsed < interval - 1) {
      frame = requestAnimationFrame(step)
      return
    }
    lastStep = at
    if (power === "saver" && at - lastActivity > idleAfter) interval = 1000 / idleFps
    try {
      // A scene runs faster while the agent works, easing toward its activity level's pace as the TUI does.
      const target = busy && current.settings.activity ? BUSY_PACE[current.settings.activity] : 1
      pace += (target - pace) * 0.08
      // Long gaps are split, so a scene never takes a step it would clamp anyway.
      const seconds = Math.min(elapsed / 1000, 1) * pace
      for (let remaining = seconds; remaining > 0; remaining -= MAX_STEP) current.scene.step(Math.min(MAX_STEP, remaining))
      if (outgoing && fading < 1) {
        for (let remaining = seconds; remaining > 0; remaining -= MAX_STEP) outgoing.scene.step(Math.min(MAX_STEP, remaining))
        fading = Math.min(1, fading + seconds / fadeLength)
      }
      blit()
    } catch (error) {
      report(error)
      stop()
      return
    }
    frame = requestAnimationFrame(step)
  }

  const start = () => {
    if (destroyed || frame !== undefined || !current) return
    lastStep = now()
    frame = requestAnimationFrame(step)
  }

  const stop = () => {
    if (frame !== undefined) cancelAnimationFrame(frame)
    frame = undefined
    current = undefined
    outgoing = undefined
    frameData = undefined
    outgoingData = undefined
    mixed = undefined
    const context = canvas.getContext("2d")
    context?.clearRect(0, 0, canvas.width, canvas.height)
  }

  // Anything the user does resets the idle countdown, so a scene the pointer just touched keeps full rate.
  const touched = () => {
    lastActivity = now()
    interval = 1000 / fps
  }

  const engine: Engine = {
    start(wallpaper, settings, fade) {
      if (destroyed) return
      const resolved = settingsFor(wallpaper, settings)
      // Brightness is applied when the frame is blitted, so changing only that restyles the running scene. Everything
      // else (activity, time, season, weather) is read by the scene's constructor, so it needs a new scene.
      if (current && current.wallpaper.id === wallpaper.id && fade === undefined && sameScene(current.settings, resolved)) {
        current.settings = resolved
        touched()
        try {
          blit()
        } catch (error) {
          report(error)
          stop()
          return
        }
        start()
        return
      }
      resize()
      let scene: Scene
      try {
        scene = wallpaper.create(resolved)
        scene.resize(width, height, false)
      } catch (error) {
        report(error)
        stop()
        return
      }
      outgoing = current && fade ? current : undefined
      fading = outgoing ? 0 : 1
      fadeLength = fade ?? FADE
      current = { scene, wallpaper, settings: resolved }
      frameData = undefined
      touched()
      // The first frame renders outside the loop, so a scene that throws on its first render must not escape here.
      try {
        blit()
      } catch (error) {
        report(error)
        stop()
        return
      }
      start()
    },
    stop,
    react(event) {
      touched()
      busy = event === "busy"
      clearTimeout(lifting)
      // A failure dims the scene for a couple of minutes, then it eases back on its own.
      if (event === "error") lifting = setTimeout(() => engine.react("idle"), GLOOM_MS)
      try {
        current?.scene.react?.(event)
        outgoing?.scene.react?.(event)
      } catch (error) {
        report(error)
      }
    },
    power(mode) {
      power = mode
      touched()
    },
    resize,
    poke(x, y) {
      touched()
      try {
        current?.scene.poke?.(x, y)
      } catch (error) {
        report(error)
      }
    },
    destroy() {
      stop()
      destroyed = true
      clearTimeout(lifting)
      observer.disconnect()
      document.removeEventListener("visibilitychange", onVisibility)
    },
  }

  const onVisibility = () => {
    if (document.hidden) {
      if (frame !== undefined) cancelAnimationFrame(frame)
      frame = undefined
    } else {
      touched()
      start()
    }
  }

  const observer = new ResizeObserver(() => resize())
  observer.observe(canvas)
  document.addEventListener("visibilitychange", onVisibility)
  resize()
  return engine
}
