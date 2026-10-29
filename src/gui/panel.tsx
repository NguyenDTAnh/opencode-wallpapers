import { Show, createEffect, createSignal, onCleanup, onMount } from "solid-js"
import type { MountedSession, Persisted } from "@opencode/plugin/gui"
import { createEngine, type Engine } from "../desktop/engine"
import { apply, type Stored } from "../desktop/settings"
import { findWallpaper } from "../desktop/scenes"
import { resolveSettings } from "../desktop/weather"
import { Controls } from "./controls"

// How long the old scene takes to fade into a newly chosen one.
const FADE = 1.5

// One panel tab. The engine lives and dies with the component, so moving the tab or switching sessions does not leave
// an animation loop running.
export function Scene(props: {
  readonly session: MountedSession
  readonly store: Persisted<Stored>
  readonly onError: (error: unknown) => void
}) {
  let surface!: HTMLDivElement
  let canvas!: HTMLCanvasElement
  let engine: Engine | undefined
  const [open, setOpen] = createSignal(false)
  // What the running scene was built from, so a brightness-only change restyles instead of restarting.
  let started: string | undefined
  let startedKey = ""

  onMount(() => {
    engine = createEngine({ canvas, onError: props.onError })
    // Watch the panel's box rather than the canvas: the canvas's own size is what the engine sets.
    const observer = new ResizeObserver(() => engine?.resize())
    observer.observe(surface)
    onCleanup(() => observer.disconnect())
    if (!props.store.value.wallpaper) setOpen(true)
  })

  onCleanup(() => {
    engine?.destroy()
    engine = undefined
  })

  createEffect(() => {
    const state = props.store.value
    if (!engine) return
    engine.power(state.power ?? "saver")
    const wallpaper = findWallpaper(state.wallpaper)
    if (!wallpaper) {
      engine.stop()
      started = undefined
      return
    }
    const settings = resolveSettings(state, new Date(), undefined)
    const key = `${settings.activity} ${settings.time} ${settings.season} ${settings.weather}`
    // Keep the scene when only brightness changed; a new wallpaper or new scene settings get a fresh one, with a fade
    // only when the scene actually changes.
    const same = started === wallpaper.id && startedKey === key
    const fade = !started ? undefined : same ? undefined : started === wallpaper.id ? FADE : undefined
    started = wallpaper.id
    startedKey = key
    engine.start(wallpaper, settings, same ? undefined : fade)
  })

  const poke = (event: MouseEvent) => {
    if (!engine) return
    const rect = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    // Scene x runs 0..W/H across and y runs 0..1 down, so the aspect ratio cancels the width.
    engine.poke((event.clientX - rect.left) / rect.height, (event.clientY - rect.top) / rect.height)
  }

  return (
    <div class="wallpapers-panel" ref={surface}>
      <canvas ref={canvas} class="wallpapers-canvas" onClick={poke} />
      <Show when={!props.store.value.wallpaper}>
        <div class="wallpapers-empty">No wallpaper chosen yet. Pick one from the settings below.</div>
      </Show>
      <div class="wallpapers-bottom">
        <Show when={open()}>
          <div class="wallpapers-settings">
            <Controls state={props.store.value} onChange={(next) => props.store.set(next)} />
          </div>
        </Show>
        <div class="wallpapers-bar">
          <span class="wallpapers-bar-name">{findWallpaper(props.store.value.wallpaper)?.name ?? "Off"}</span>
          <button type="button" onClick={() => setOpen(!open())}>
            {open() ? "Hide settings" : "Settings"}
          </button>
        </div>
      </div>
    </div>
  )
}

// Applies one settings value, kept here so the shared apply() stays the only place that decides what a value means.
export function change(store: Persisted<Stored>, value: string) {
  store.set(apply(store.value, value).state)
}
