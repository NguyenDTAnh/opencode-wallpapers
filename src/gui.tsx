import { Command, Plugin, Slot, Style } from "@opencode/plugin/gui"
import { createEffect, createSignal, onCleanup, Show } from "solid-js"
import type { Engine } from "./desktop/engine"
import { apply, type Stored } from "./desktop/settings"
import { findWallpaper } from "./desktop/scenes"
import { resolveSettings, nextShuffle } from "./desktop/weather"
import { forecast, REFRESH, type Forecast } from "./forecast"
import { Backdrop, backdropCss } from "./gui/backdrop"
import { Controls } from "./gui/controls"
import { definition } from "./gui/definition"
import { css } from "./gui/css"

// How long the old scene takes to fade into a newly chosen one.
const FADE = 1.5

const setup: Plugin.Setup<typeof definition> = (ctx) => {
  ctx.add(Style, css + backdropCss)

  const store = ctx.stores.prefs
  const prefs = () => store.value

  // The scene is the window's background: it belongs to the window, not to a tab, a panel or a dialog.
  const [backdrop, setBackdrop] = createSignal<Engine>()
  // What the running scene was built from, so a brightness-only change restyles instead of restarting.
  let painted = ""

  // Auto time, seasons and hourly shuffle follow the clock, and the scene must follow them. The store alone cannot carry
  // that: writing an identical value back notifies nothing, so the tick is a signal the paint effect reads.
  const [now, setNow] = createSignal(new Date())
  const [local, setLocal] = createSignal<Forecast>()

  ctx.add(Slot, {
    at: "window.bottom",
    order: -100,
    render: () => (
      <Show when={findWallpaper(prefs().wallpaper)}>
        <Backdrop
          theme={ctx.appearance.mode()}
          brightness={prefs().brightness ?? "normal"}
          onReady={(engine) => {
            painted = ""
            setBackdrop(engine)
          }}
          onError={(error) => notify(ctx, error)}
        />
      </Show>
    ),
  })

  // Local weather is fetched only while it is the chosen setting, as the TUI does.
  createEffect(() => {
    const current = prefs()
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

  createEffect(() => {
    const current = prefs()
    const at = now()
    const engine = backdrop()
    if (!engine) return
    engine.power(current.power ?? "saver")
    const settings = resolveSettings(current, at, local())
    const wallpaper = findWallpaper(current.wallpaper)
    if (!wallpaper) {
      engine.stop()
      painted = ""
      return
    }
    // Only brightness changes restyle in place; the scene reads the rest in its constructor.
    const key = `${wallpaper.id} ${settings.activity} ${settings.time} ${settings.season} ${settings.weather}`
    const same = key === painted
    painted = key
    engine.start(wallpaper, settings, same ? undefined : FADE)
  })

  // Agent reactions. The server is resolved in an effect because `servers.get` answers undefined before the app
  // interface mounts, which is when setup runs.
  const running = new Map<string, boolean>()
  let outcome: "done" | "error" | "idle" = "idle"
  const begin = (sessionID: string) => {
    if (![...running.values()].some(Boolean)) backdrop()?.react("busy")
    running.set(sessionID, true)
  }
  const end = (server: ReturnType<typeof ctx.servers.get>, sessionID: string, result: "done" | "error" | "idle") => {
    if (running.get(sessionID) === false) return
    running.set(sessionID, false)
    const info = server?.data.session.get(sessionID)
    if (outcome !== "error" && !(result === "error" && info?.parentID)) outcome = result
    if ([...running.values()].some(Boolean)) return
    backdrop()?.react(outcome)
    outcome = "idle"
  }
  createEffect(() => {
    const server = ctx.servers.get("sidecar")
    if (!server) return
    const stops = [
      server.data.on("session.execution.started", (event) => begin(event.data.sessionID)),
      server.data.on("session.execution.succeeded", (event) => end(server, event.data.sessionID, "done")),
      server.data.on("session.execution.failed", (event) => end(server, event.data.sessionID, "error")),
      server.data.on("session.execution.interrupted", (event) => end(server, event.data.sessionID, "idle")),
    ]
    onCleanup(() => stops.forEach((stop) => stop()))
  })

  const timer = setInterval(() => {
    setNow(new Date())
    const current = prefs()
    const next = nextShuffle(current)
    if (next) store.set(apply(current, next).state)
  }, 60_000)

  onCleanup(() => clearInterval(timer))

  // The settings live in a dialog, opened by /wallpaper and by the command palette.
  const openDialog = () =>
    ctx.dialogs.open((dialog) => (
      <ctx.ui.Dialog title="Wallpaper" footer={<ctx.ui.Button onClick={() => dialog.close()}>Done</ctx.ui.Button>}>
        <Controls ui={ctx.ui} state={prefs()} onChange={(next: Stored) => store.set(next)} />
      </ctx.ui.Dialog>
    ))

  ctx.add(Command, () => ({
    id: "choose",
    title: ctx.t("choose"),
    group: ctx.t("title"),
    slash: { name: "wallpaper", arguments: true as const },
    run: (argument?: string) => {
      // An argument sets one setting and reports, as the TUI's /wallpaper <arg> does; no argument opens the dialog.
      if (argument?.trim()) {
        const result = apply(store.value, argument)
        store.set(result.state)
        ctx.toast.show({ title: result.message, variant: result.error ? "error" : "default" })
        return
      }
      openDialog()
    },
  }))

  ctx.add(Command, () => ({
    id: "off",
    title: ctx.t("off"),
    group: ctx.t("title"),
    run: () => {
      const result = apply(store.value, "off")
      store.set(result.state)
      ctx.toast.show({ title: result.message })
    },
  }))

  ctx.add(Command, () => ({
    id: "activity",
    title: ctx.t("activity"),
    group: ctx.t("title"),
    run: () => cycle(ctx, "activity", ["calm", "lively", "teeming"]),
  }))

  ctx.add(Command, () => ({
    id: "time",
    title: ctx.t("time"),
    group: ctx.t("title"),
    run: () => cycle(ctx, "time", ["auto", "day", "sunset", "night"]),
  }))

  // The TUI accepts a `wallpapers` option that points at extra scene packages. A window has no filesystem to load them
  // from, so the GUI says so once instead of silently showing fewer scenes than the config asks for.
  const external = (ctx.options as { wallpapers?: unknown }).wallpapers
  if (Array.isArray(external) && external.length) ctx.toast.show({ title: ctx.t("external"), variant: "error" })
}

// Cycles one setting through its values, as the TUI's palette entries do.
function cycle(ctx: Parameters<typeof setup>[0], field: "activity" | "time", options: readonly string[]) {
  const state = ctx.stores.prefs.value
  const value = field === "activity" ? (state.activity ?? "calm") : (state.time ?? "auto")
  const next = options[(options.indexOf(value) + 1) % options.length]
  ctx.stores.prefs.set(apply(state, next).state)
}

function notify(ctx: Parameters<typeof setup>[0], error: unknown) {
  ctx.toast.show({ title: error instanceof Error ? error.message : String(error), variant: "error" })
}

export default Plugin.define({ ...definition, setup })
