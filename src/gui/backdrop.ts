import { createEngine, type Engine } from "../desktop/engine"
import type { AgentEvent, Power, Settings, Wallpaper } from "../wallpaper"

// The window backdrop: a fixed layer below the app's own tree, so the scene reads as the window's background rather
// than a rectangle on top of it. The app paints its base colour, so the layer also overrides the variables that colour
// comes from — the names are internal to the app, which is why every open verifies its own override.

export type BackdropMode = "window" | "panel"

export interface BackdropHandle {
  setWallpaper(wallpaper: Wallpaper | undefined, settings: Settings, fade?: number): void
  react(event: AgentEvent): void
  power(mode: Power): void
  // The scrim follows the interface theme, read from ctx.appearance.mode().
  setTheme(theme: "light" | "dark"): void
  destroy(): void
}

// The variables the spike proved sufficient on the installed app. --surface-base alone is not enough: it carries an
// alpha colour, and the opaque fill comes from --surface-raised-stronger-non-alpha.
const OVERRIDE = `
html, body, #root { background: transparent !important; }

/* The app declares its fills under [data-color-scheme], which outranks :root, so the override matches that selector.
   Only the background layers go transparent: they are what the window paints behind the interface. */
[data-color-scheme], [data-color-scheme][data-color-scheme],
:root, :root[data-theme], body {
  --v2-background-bg-deep: transparent !important;
  --v2-background-bg-base: transparent !important;
  --v2-background-bg-layer-02: transparent !important;
  --color-v2-background-bg-base: transparent !important;
  --color-v2-background-bg-layer-02: transparent !important;
}

/* Overlays read the same background variables, so each overlay scope restores them to the app's own grey ramp. Pinning
   a colour would not survive an overlay that nests another surface (a list inside a dialog reads bg-base, not the
   dialog's own layer), so the variables are restored instead of the paint. */
[data-component="dialog-v2"],
[data-component="dialog-overlay"],
[data-component="popover-content"],
[data-component="menu-v2-content"],
[data-component="context-menu-content"],
[data-component="context-menu-sub-content"],
[data-component="hover-card-content"],
[data-component="session-tab-popover"],
[data-component="list"],
[data-component="search-list"] {
  --v2-background-bg-deep: var(--v2-grey-1200) !important;
  --v2-background-bg-base: var(--v2-grey-1100) !important;
  --v2-background-bg-layer-01: var(--v2-grey-1000) !important;
  --v2-background-bg-layer-02: var(--v2-grey-900) !important;
  --v2-background-bg-layer-03: var(--v2-grey-800) !important;
  --color-v2-background-bg-base: var(--v2-grey-1100) !important;
  --color-v2-background-bg-layer-02: var(--v2-grey-900) !important;
}
`

// The variable whose value proves the override reached the app.
const WITNESS = "--v2-background-bg-deep"

export function overridePassed(before: string, after: string): boolean {
  // A pass is an opaque fill turning fully transparent. Anything else proves nothing: a surface that was already
  // transparent (an alpha colour such as --surface-base) says nothing about whether our style applied.
  return alpha(after) === 0 && alpha(before) === 1
}

// The alpha of a computed CSS colour: rgb() and hex read as opaque, rgba() takes its fourth component.
function alpha(color: string): number {
  const value = color.trim().toLowerCase()
  if (value === "transparent" || value === "rgba(0, 0, 0, 0)" || value === "rgba(0,0,0,0)") return 0
  const rgba = /^rgba?\(([^)]+)\)$/.exec(value)
  if (!rgba) return 1
  const parts = rgba[1].split(/[,/\s]+/).filter(Boolean)
  if (parts.length < 4) return 1
  const last = parts[3]
  return last.endsWith("%") ? Number.parseFloat(last) / 100 : Number.parseFloat(last)
}

// Reads the app's own fill for the witness variable. The probe must be attached: a detached element inherits no custom
// property from :root and would report transparent either way, which would read as a failed check.
function readWitness(): string {
  const probe = document.createElement("div")
  probe.style.cssText = "position:fixed;inset:0;pointer-events:none;opacity:0;pointer-events:none"
  probe.style.background = `var(${WITNESS})`
  document.body.append(probe)
  const value = getComputedStyle(probe).backgroundColor
  probe.remove()
  return value
}

function verifyOverride(): boolean {
  const before = readWitness()
  const style = document.createElement("style")
  style.textContent = OVERRIDE
  document.head.append(style)
  try {
    return overridePassed(before, readWitness())
  } finally {
    style.remove()
  }
}

export function openBackdrop(options: {
  onError: (error: unknown) => void
  onFallback: () => void
  check?: () => boolean
  theme?: "light" | "dark"
}): BackdropHandle | undefined {
  const check = options.check ?? verifyOverride
  // Nothing is appended before the check: the failure path must not leave anything behind, and it has to be reachable
  // where there is no document at all.
  if (!check()) {
    options.onFallback()
    return undefined
  }

  const style = document.createElement("style")
  style.textContent = OVERRIDE + backdropCss
  document.head.append(style)

  const root = document.createElement("div")
  root.className = "wallpapers-backdrop"
  const canvas = document.createElement("canvas")
  canvas.className = "wallpapers-backdrop-canvas"
  root.append(canvas)
  const scrim = document.createElement("div")
  scrim.className = `wallpapers-backdrop-scrim wallpapers-backdrop-scrim-${options.theme ?? "dark"}`
  root.append(scrim)
  document.body.prepend(root)

  let engine: Engine | undefined = createEngine({ canvas, onError: options.onError })


  return {
    setWallpaper(wallpaper, settings, fade) {
      if (!engine) return
      if (!wallpaper) return engine.stop()
      engine.start(wallpaper, settings, fade)
    },
    react(event) {
      engine?.react(event)
    },
    power(mode) {
      engine?.power(mode)
    },
    setTheme(theme) {
      scrim.className = `wallpapers-backdrop-scrim wallpapers-backdrop-scrim-${theme}`
    },
    destroy() {
      engine?.destroy()
      engine = undefined
      root.remove()
      style.remove()
    },
  }
}

// The layer's own styles. The scrim sits between the scene and the app's surfaces so text and controls stay readable;
// it is part of the backdrop, below #root, and never paints over anything the app drew.
export const backdropCss = `
.wallpapers-backdrop {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}
.wallpapers-backdrop-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
.wallpapers-backdrop-scrim {
  position: absolute;
  inset: 0;
}
.wallpapers-backdrop-scrim-dark {
  background: linear-gradient(180deg, rgb(0 0 0 / 0.55) 0%, rgb(0 0 0 / 0.72) 50%, rgb(0 0 0 / 0.62) 100%);
}
.wallpapers-backdrop-scrim-light {
  background: linear-gradient(180deg, rgb(255 255 255 / 0.6) 0%, rgb(255 255 255 / 0.75) 50%, rgb(255 255 255 / 0.65) 100%);
}
`
