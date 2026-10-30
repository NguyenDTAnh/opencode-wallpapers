import { Command, Panel, Plugin, Style, type PanelProps, type PanelTab } from "@opencode/plugin/gui"
import { createEffect, onCleanup } from "solid-js"
import { apply } from "./desktop/settings"
import { findWallpaper } from "./desktop/scenes"
import { resolveSettings, nextShuffle } from "./desktop/weather"
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

  // The window backdrop belongs to the window, not to a tab: it must survive closing the panel, collapsing the side
  // region and switching sessions. So setup owns it, and the panel paints only when the mode says the panel does.
  let backdrop: BackdropHandle | undefined
  // What the running scene was built from, so a brightness-only change restyles instead of restarting.
  let painted = ""
  // The override failed in this window. Nothing can paint in the backdrop, so the panel paints instead, and the stored
  // mode is left alone so the next window boot tries again.
  let failed = false

  const store = ctx.stores.prefs
  const prefs = () => store.value

  const close = () => {
    backdrop?.destroy()
    backdrop = undefined
    painted = ""
  }

  // Opens or closes the layer as the mode changes. `null` means the override failed, so the panel keeps painting.
  createEffect(() => {
    const action = nextAction(prefs().backdrop ?? "window", backdrop !== undefined, failed)
    if (action === "close") close()
    if (action !== "open") return
    backdrop = openBackdrop({
      onError: (error) => notify(ctx, error),
      onFallback: () => {
        failed = true
        ctx.toast.show({ title: ctx.t("fallback"), variant: "error" })
      },
      theme: ctx.appearance.mode(),
    })
  })

  // The scrim follows the interface theme, so a light interface does not get a dark band behind dark text.
  createEffect(() => backdrop?.setTheme(ctx.appearance.mode()))

  // Paints through the backdrop whenever it owns the scene. Reading the store keeps this subscribed to every setting
  // that changes the picture.
  createEffect(() => {
    const current = prefs()
    if (ownerFor(current.backdrop ?? "window", failed) !== "backdrop" || !backdrop) return
    backdrop.power(current.power ?? "saver")
    const settings = resolveSettings(current, new Date(), undefined)
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

  // Agent reactions belong to whoever paints: both owners call engine.react, so the events are read once here and
  // forwarded to the live backdrop. A subagent's failure is left to its parent, and repeated ends count once.
  const server = ctx.servers.get("sidecar")
  const running = new Map<string, boolean>()
  let outcome: "done" | "error" | "idle" = "idle"
  const begin = (sessionID: string) => {
    if (![...running.values()].some(Boolean)) backdrop?.react("busy")
    running.set(sessionID, true)
  }
  const end = (sessionID: string, result: "done" | "error" | "idle") => {
    if (running.get(sessionID) === false) return
    running.set(sessionID, false)
    const info = server?.data.session.get(sessionID)
    if (outcome !== "error" && !(result === "error" && info?.parentID)) outcome = result
    if ([...running.values()].some(Boolean)) return
    backdrop?.react(outcome)
    outcome = "idle"
  }
  const stops = server
    ? [
        server.data.on("session.execution.started", (event) => begin(event.data.sessionID)),
        server.data.on("session.execution.succeeded", (event) => end(event.data.sessionID, "done")),
        server.data.on("session.execution.failed", (event) => end(event.data.sessionID, "error")),
        server.data.on("session.execution.interrupted", (event) => end(event.data.sessionID, "idle")),
      ]
    : []

  // Auto time, seasons and hourly shuffle all follow the clock. In window mode no panel is mounted to tick them, so the
  // tick lives here; the store update it makes reaches both owners.
  const clock = setInterval(() => {
    const current = prefs()
    const next = nextShuffle(current)
    if (next) store.set(apply(current, next).state)
    else store.set({ ...current })
  }, 60_000)

  onCleanup(() => {
    clearInterval(clock)
    stops.forEach((stop) => stop())
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
      <Scene session={props.session} store={store} servers={ctx.servers} fallback={() => failed} onError={(error) => notify(ctx, error)} />
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
