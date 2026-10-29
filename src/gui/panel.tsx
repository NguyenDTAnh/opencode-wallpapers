import { Show, createEffect, createSignal, onCleanup, onMount } from "solid-js"
import { usePanel, type MountedSession, type Persisted, type Servers } from "@opencode/plugin/gui"
import { createEngine, type Engine } from "../desktop/engine"
import { INITIAL, apply, type Stored } from "../desktop/settings"
import { findWallpaper } from "../desktop/scenes"
import { resolveSettings, nextShuffle } from "../desktop/weather"
import { forecast, REFRESH, type Forecast } from "../forecast"
import { Controls } from "./controls"

// How long the old scene takes to fade into a newly chosen one.
const FADE = 1.5
// A stored global is loaded before setup runs, so a missing value means the store is not ready yet.
const state = (store: Persisted<Stored>): Stored => store.value ?? INITIAL

// One panel tab. The engine lives and dies with the component, so moving the tab or switching sessions does not leave
// an animation loop running.
export function Scene(props: {
  readonly session: MountedSession
  readonly store: Persisted<Stored>
  readonly servers: Servers
  readonly onError: (error: unknown) => void
}) {
  let surface!: HTMLDivElement
  let canvas!: HTMLCanvasElement
  let engine: Engine | undefined
  const [open, setOpen] = createSignal(false)
  const [now, setNow] = createSignal(new Date())
  const [local, setLocal] = createSignal<Forecast>()
  // What the running scene was built from, so a brightness-only change restyles instead of restarting.
  let started: string | undefined
  let startedKey = ""
  const panel = usePanel()

  onMount(() => {
    engine = createEngine({ canvas, onError: props.onError })
    if (!state(props.store).wallpaper) setOpen(true)
    // Auto time and season follow the clock, hourly shuffle needs a tick, and local weather refreshes on its own
    // schedule. One minute is enough for the first two; the forecast call caches internally.
    const clock = setInterval(() => setNow(new Date()), 60_000)
    onCleanup(() => clearInterval(clock))
    // Scenes follow the agent the way they do in the TUI: busy while any session runs, then done, error or idle once
    // the last one stops. A subagent's failure is left to its parent, and repeated ends for a session count once.
    const servers = props.servers
    const server = servers.get(props.session.server.id) ?? servers.get("sidecar")
    const running = new Map<string, boolean>()
    let outcome: "done" | "error" | "idle" = "idle"
    const started = (sessionID: string) => {
      if (![...running.values()].some(Boolean)) engine?.react("busy")
      running.set(sessionID, true)
    }
    const ended = (sessionID: string, result: "done" | "error" | "idle") => {
      if (running.get(sessionID) === false) return
      running.set(sessionID, false)
      const info = server?.data.session.get(sessionID)
      if (outcome !== "error" && !(result === "error" && info?.parentID)) outcome = result
      if ([...running.values()].some(Boolean)) return
      engine?.react(outcome)
      outcome = "idle"
    }
    const stops = server
      ? [
          server.data.on("session.execution.started", (event) => started(event.data.sessionID)),
          server.data.on("session.execution.succeeded", (event) => ended(event.data.sessionID, "done")),
          server.data.on("session.execution.failed", (event) => ended(event.data.sessionID, "error")),
          server.data.on("session.execution.interrupted", (event) => ended(event.data.sessionID, "idle")),
        ]
      : []
    onCleanup(() => stops.forEach((stop) => stop()))
  })

  onCleanup(() => {
    engine?.destroy()
    engine = undefined
  })

  // Local weather is fetched only while it is the chosen setting, as the TUI does.
  createEffect(() => {
    const current = state(props.store)
    if (current.weather !== "local" || !current.location) {
      setLocal(undefined)
      return
    }
    const place = current.location
    let cancelled = false
    const refresh = () => void forecast(place).then((result) => (cancelled ? undefined : setLocal(result)))
    refresh()
    const timer = setInterval(refresh, REFRESH)
    onCleanup(() => {
      cancelled = true
      clearInterval(timer)
    })
  })

  // Hourly shuffle: the store check is idempotent, so it runs on the same minute tick as the clock.
  createEffect(() => {
    now()
    const current = state(props.store)
    const next = nextShuffle(current)
    if (next) props.store.set(apply(current, next).state)
  })

  createEffect(() => {
    const current = state(props.store)
    // Reading the signal keeps this effect subscribed to the clock.
    const at = now()
    // The host keeps a cached render mounted while its tab is hidden, so the scene stops here rather than animating
    // behind another tab at full rate.
    const visible = panel.visible()
    if (!engine) return
    engine.power(current.power ?? "saver")
    const wallpaper = findWallpaper(current.wallpaper)
    if (!wallpaper || !visible) {
      engine.stop()
      started = undefined
      return
    }
    const settings = resolveSettings(current, at, local())
    const key = `${settings.activity} ${settings.time} ${settings.season} ${settings.weather}`
    // Only brightness changes reuse the running scene; a new wallpaper or new scene settings get a fresh one, and
    // only a new wallpaper fades.
    const same = started === wallpaper.id && startedKey === key
    const fade = started && !same && started !== wallpaper.id ? FADE : undefined
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
      <Show when={!state(props.store).wallpaper}>
        <div class="wallpapers-empty">No wallpaper chosen yet. Pick one from the settings below.</div>
      </Show>
      <div class="wallpapers-bottom">
        <Show when={open()}>
          <div class="wallpapers-settings">
            <Controls state={state(props.store)} onChange={(next) => props.store.set(next)} />
          </div>
        </Show>
        <div class="wallpapers-bar">
          <span class="wallpapers-bar-name">{findWallpaper(state(props.store).wallpaper)?.name ?? "Off"}</span>
          <button type="button" onClick={() => setOpen(!open())}>
            {open() ? "Hide settings" : "Settings"}
          </button>
        </div>
      </div>
    </div>
  )
}
