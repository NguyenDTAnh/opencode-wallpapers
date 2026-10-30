import { Command, Panel, Plugin, Style, type PanelProps, type PanelTab } from "@opencode/plugin/gui"
import { createEffect, createMemo, createSignal, onCleanup } from "solid-js"
import { apply } from "./desktop/settings"
import { findWallpaper } from "./desktop/scenes"
import { resolveSettings, nextShuffle } from "./desktop/weather"
import { forecast, REFRESH, type Forecast } from "./forecast"
import { openBackdrop, type BackdropHandle } from "./gui/backdrop"
import { nextAction, ownerFor } from "./gui/ownership"
import { Scene } from "./gui/panel"
import { definition } from "./gui/definition"
import { css } from "./gui/css"

// The plugin's id comes from the server part (src/index.ts), so every key here is wallpapers-scoped.
const TAB = "scene"
// How long the old scene takes to fade into a newly chosen one.
const FADE = 1.5

const setup: Plugin.Setup<typeof definition> = (ctx) => {
  ctx.add(Style, css)

  const store = ctx.stores.prefs
  const prefs = () => store.value

  // The window backdrop belongs to the window, not to a tab: it must survive closing the panel, collapsing the side
  // region and switching sessions. So setup owns it, and the panel paints only when the mode says the panel does.
  let backdrop: BackdropHandle | undefined
  // What the running scene was built from, so a brightness-only change restyles instead of restarting.
  let painted = ""
  // The override failed in this window. Nothing can paint in the backdrop, so the panel paints instead, and the stored
  // mode is left alone so the next window boot tries again. A signal: the panel reads it to take the scene over.
  const [fallback, setFallback] = createSignal(false)

  // Auto time, seasons and hourly shuffle follow the clock, and the scene must follow them. The store alone cannot
  // carry that: writing an identical value back notifies nothing, so the tick is a signal the paint effect reads.
  const [now, setNow] = createSignal(new Date())
  const [local, setLocal] = createSignal<Forecast>()

  const close = () => {
    backdrop?.destroy()
    backdrop = undefined
    painted = ""
  }

  // Opens the layer once, unless the override failed. The wallpaper is the window's background; the panel is only the
  // place its settings live, and the fallback surface when nothing can paint in the window.
  createEffect(() => {
    const action = nextAction(backdrop !== undefined, fallback())
    if (action === "close") close()
    if (action !== "open") return
    backdrop = openBackdrop({
      onError: (error) => notify(ctx, error),
      onFallback: () => {
        setFallback(true)
        ctx.toast.show({ title: ctx.t("fallback"), variant: "error" })
      },
      theme: ctx.appearance.mode(),
    })
  })

  // The scrim follows the interface theme, so a light interface does not get a dark band behind dark text. The mode is
  // read outside the optional chain: inside it, a missing handle would subscribe to nothing and never run again.
  createEffect(() => {
    const theme = ctx.appearance.mode()
    backdrop?.setTheme(theme)
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

  // Paints through the backdrop whenever it owns the scene. Reading the store and the clock keeps this subscribed to
  // everything that changes the picture, including the time of day moving on by itself.
  createEffect(() => {
    const current = prefs()
    const at = now()
    if (ownerFor(fallback()) !== "backdrop" || !backdrop) return
    backdrop.power(current.power ?? "saver")
    const settings = resolveSettings(current, at, local())
    const wallpaper = findWallpaper(current.wallpaper)
    if (!wallpaper) {
      backdrop.setWallpaper(undefined, settings)
      painted = ""
      return
    }
    // Only brightness changes restyle in place; the scene reads the rest in its constructor.
    const key = `${wallpaper.id} ${settings.activity} ${settings.time} ${settings.season} ${settings.weather}`
    const same = key === painted
    painted = key
    backdrop.setWallpaper(wallpaper, settings, same ? undefined : FADE)
  })

  // Agent reactions belong to whoever paints. The server is resolved in an effect because `servers.get` answers
  // undefined before the app interface mounts, which is when setup runs.
  const running = new Map<string, boolean>()
  let outcome: "done" | "error" | "idle" = "idle"
  const begin = (sessionID: string) => {
    if (![...running.values()].some(Boolean)) backdrop?.react("busy")
    running.set(sessionID, true)
  }
  const end = (server: ReturnType<typeof ctx.servers.get>, sessionID: string, result: "done" | "error" | "idle") => {
    if (running.get(sessionID) === false) return
    running.set(sessionID, false)
    const info = server?.data.session.get(sessionID)
    if (outcome !== "error" && !(result === "error" && info?.parentID)) outcome = result
    if ([...running.values()].some(Boolean)) return
    backdrop?.react(outcome)
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

  // In window mode no panel is mounted to tick the clock, so both ticks live here and reach both owners.
  const timer = setInterval(() => {
    setNow(new Date())
    const current = prefs()
    const next = nextShuffle(current)
    if (next) store.set(apply(current, next).state)
  }, 60_000)

  onCleanup(() => {
    clearInterval(timer)
    close()
  })

  // Read the language inside the getter, so a language change relabels the tab without a new object.
  const tab: PanelTab = {
    id: TAB,
    get title() {
      return ctx.t("title")
    },
    closable: "compact",
    fallback: true,
  }

  ctx.add(Panel, {
    id: TAB,
    region: "side",
    mobile: {
      get title() {
        return ctx.t("title")
      },
      order: 45,
      kind: "menu",
      icon: "photo",
    },
    list: (input: { readonly open: readonly string[] }) => (input.open.includes(TAB) ? [tab] : []),
    render: (props: PanelProps) => (
      <Scene
        session={props.session}
        store={store}
        servers={ctx.servers}
        fallback={fallback}
        onError={(error) => notify(ctx, error)}
      />
    ),
  })

  ctx.add(Command, () => ({
    id: "choose",
    title: ctx.t("choose"),
    group: ctx.t("title"),
    slash: { name: "wallpaper", arguments: true as const },
    run: (argument?: string) => {
      if (argument?.trim()) {
        const result = apply(store.value, argument)
        store.set(result.state)
        if (result.error) ctx.toast.show({ title: result.message, variant: "error" })
        return
      }
      const session = ctx.sessions.current()
      if (session) ctx.layout.open(`${ctx.id}:${TAB}`, session, { tab: "select", background: true })
      else ctx.toast.show({ title: ctx.t("open") })
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

  // The TUI accepts a `wallpapers` option that points at extra scene packages. A window has no filesystem to load
  // them from, so the GUI says so once instead of silently showing fewer scenes than the config asks for.
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
