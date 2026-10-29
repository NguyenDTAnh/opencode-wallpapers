import { Command, Panel, Plugin, Style, type PanelProps, type PanelTab } from "@opencode/plugin/gui"
import { apply } from "./desktop/settings"
import { Scene } from "./gui/panel"
import { definition } from "./gui/definition"
import { css } from "./gui/css"

// The plugin's id comes from the server part (src/index.ts), so every key here is wallpapers-scoped.
const TAB = "scene"

const setup: Plugin.Setup<typeof definition> = (ctx) => {
  ctx.add(Style, css)

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
    render: (props: PanelProps) => <Scene session={props.session} store={ctx.stores.prefs} servers={ctx.servers} onError={(error) => notify(ctx, error)} />,
  })

  ctx.add(Command, () => ({
    id: "choose",
    title: ctx.t("choose"),
    group: ctx.t("title"),
    slash: { name: "wallpaper", arguments: true as const },
    run: (argument?: string) => {
      if (argument?.trim()) {
        const result = apply(ctx.stores.prefs.value, argument)
        ctx.stores.prefs.set(result.state)
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
