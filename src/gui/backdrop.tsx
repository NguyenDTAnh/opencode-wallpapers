import { createEngine, type Engine } from "../desktop/engine"
import { createEffect, onCleanup, onMount } from "solid-js"
import type { Brightness } from "../wallpaper"

export interface BackdropProps {
  theme: "light" | "dark"
  brightness: Brightness
  onReady(engine: Engine | undefined): void
  onError(error: unknown): void
}

// The scene sits behind a scrim, so the canvas is lifted before the scrim dims it. The level follows the chosen
// brightness setting instead of one fixed number.
export const BRIGHTNESS_FILTER: Record<Brightness, number> = { subtle: 1.2, normal: 1.6, vivid: 2 }

// The canvas is plugin-owned. OpenCode only mounts this component through Slot; it is never located or appended by script.
export function Backdrop(props: BackdropProps) {
  let canvas!: HTMLCanvasElement
  let engine: Engine | undefined

  createEffect(() => {
    if (canvas) canvas.style.filter = `brightness(${BRIGHTNESS_FILTER[props.brightness]})`
  })

  onMount(() => {
    engine = createEngine({ canvas, onError: props.onError })
    props.onReady(engine)
  })

  onCleanup(() => {
    engine?.destroy()
    props.onReady(undefined)
  })

  return (
    <div class="wallpapers-backdrop" aria-hidden="true">
      <canvas ref={canvas} class="wallpapers-backdrop-canvas" />
      <div class={`wallpapers-backdrop-scrim wallpapers-backdrop-scrim-${props.theme}`} />
    </div>
  )
}

// The layer is mounted through window.bottom and positioned behind the app by CSS registered through Style.
export const backdropCss = `
.wallpapers-backdrop {
  position: fixed;
  inset: 0;
  z-index: -1;
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
  background: rgb(0 0 0 / 0.5);
}
.wallpapers-backdrop-scrim-light {
  background: linear-gradient(180deg, rgb(255 255 255 / 0.6) 0%, rgb(255 255 255 / 0.75) 50%, rgb(255 255 255 / 0.65) 100%);
}

/* window.bottom is a direct shell child in Desktop 2.2.2. Negative z-index stays above the shell's fill. */
#root .bg-v2-background-bg-deep:has(> .wallpapers-backdrop) {
  isolation: isolate;
}

/* Internal selectors verified against Desktop 2.2.2. Never override inherited theme variables. */
#root:has(.wallpapers-backdrop) :is(
  [data-slot=vertical-tabs-peek-surface],
  [data-slot=vertical-tabs-mount],
  [data-slot=home-panel],
  [data-slot=home-projects-viewport] [data-home-row]:not(:hover, :focus-within, [data-selected], :has([data-menu=true])),
  [data-component=new-session],
  [data-slot=session-chat-panel] > .bg-v2-background-bg-base,
  [data-slot=session-timeline-scroll],
  [data-component=collapsed-tool-group] > [data-component=collapsible].tool-collapsible > [data-slot=collapsible-trigger][aria-expanded=true]
) {
  background-color: transparent !important;
}

/* Only the colours change here; the sticky behaviour is fixed separately below. */
#root:has(.wallpapers-backdrop) [data-slot=home-panel] section > .sticky:has([data-component=home-session-search]) {
  background: transparent !important;
}

/* The search row and the "New session" button share this wrapper. It sticks to the top today, which lifts the
   whole header over the list while scrolling. Relative keeps it a positioning context for that absolutely placed
   button without pinning it. */
#root:has(.wallpapers-backdrop) [data-slot=home-panel] section > div:has([data-component=home-session-search]) {
  position: relative !important;
  top: auto !important;
}

#root:has(.wallpapers-backdrop) [data-component=home-session-search] > label {
  background: var(--v2-background-bg-layer-01) !important;
  box-shadow: none;
}

#root:has(.wallpapers-backdrop) [data-slot=home-sessions-list] .home-session-group-header {
  background: transparent !important;
}

/* Both decorations of the date row would paint over the wallpaper. */
#root:has(.wallpapers-backdrop) [data-slot=home-sessions-list] .home-session-group-header::before,
#root:has(.wallpapers-backdrop) [data-slot=home-sessions-list] .home-session-group-header::after,
#root:has(.wallpapers-backdrop) .session-header-fade {
  background: transparent !important;
}

/* The date row's own sticky offset is what opened a gap under the search field. */
#root:has(.wallpapers-backdrop) [data-slot=home-sessions-list] .home-session-group-header {
  position: relative !important;
  top: auto !important;
}

/* Anything the app gave a surface, except the current item and the hover states, which need their highlight. */
#root:has(.wallpapers-backdrop) [data-slot=vertical-tabs-mount] :is(button, [role=tab], [data-home-row], .bg-v2-background-bg-base):not(
  :hover, :focus-within, :focus-visible, :has(:hover), :has(:focus-visible), [data-selected], [data-state=active], [aria-selected=true], :has([data-selected]), :has([aria-selected=true]), :has([data-menu=true])
) {
  background-color: transparent !important;
  background-image: none !important;
}

/* The selected session keeps a readable surface. */
#root:has(.wallpapers-backdrop) [data-slot=vertical-tabs-mount] div.bg-v2-background-bg-base:has([data-selected]),
#root:has(.wallpapers-backdrop) [data-slot=vertical-tabs-mount] div.bg-v2-background-bg-base:has([aria-selected=true]) {
  background-color: var(--v2-background-bg-layer-02) !important;
}
`
