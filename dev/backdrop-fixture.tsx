import { createEffect, createSignal, Show } from "solid-js"
import { render } from "solid-js/web"
import { Backdrop, backdropCss } from "../src/gui/backdrop"
import type { Engine } from "../src/desktop/engine"
import { findWallpaper } from "../src/desktop/scenes"

// Reduced host markup from Desktop 2.2.2's shell, sidebar and session surface. No live app state is read.
const hostCss = `
* { box-sizing: border-box }
html, body, #root { margin: 0; height: 100%; }
:root {
  --v2-background-bg-deep: rgb(16, 16, 16);
  --v2-background-bg-base: rgb(28, 28, 28);
  --v2-background-bg-layer-01: rgb(38, 38, 38);
  --v2-background-bg-layer-02: rgb(48, 48, 48);
  --color-v2-background-bg-base: var(--v2-background-bg-base);
  --color-v2-background-bg-deep: var(--v2-background-bg-deep);
}
.shell { position: relative; height: 100%; display: flex; flex-direction: column; }
.bg-v2-background-bg-deep { background: var(--color-v2-background-bg-deep); }
.bg-v2-background-bg-base { background: var(--color-v2-background-bg-base); }
.bg-v2-background-bg-layer-03 { background: rgb(38, 38, 38); }
.row { position: relative; display: flex; flex: 1; min-height: 0; }
[data-slot=vertical-tabs-sidebar] { position: relative; z-index: 10; width: 200px; }
[data-slot=vertical-tabs-panel] { position: absolute; inset: 0; overflow: hidden; contain: layout style paint; }
[data-slot=vertical-tabs-peek-surface], [data-slot=vertical-tabs-mount] { position: absolute; inset: 0; }
[data-slot=vertical-tabs-mount] { contain: strict; will-change: opacity; }
main { display: flex; flex: 1; contain: content; }
[data-slot=session-chat-panel] { position: relative; z-index: 10; flex: 1; display: flex; }
.session { flex: 1; display: flex; flex-direction: column; position: relative; }
[data-session-title] { height: 40px; }
[data-session-title] > div { height: 100%; }
.session-header-fade { height: 16px; background: linear-gradient(to bottom, var(--v2-background-bg-base), transparent); }
[data-slot=session-timeline-scroll] { flex: 1; }
[data-component=session-composer-dock] { height: 100px; }
[data-slot=composer-morph] { background: var(--v2-background-bg-layer-01); height: 60px; margin: 10px; }
[role=menu] { position: absolute; top: 80px; left: 30px; width: 120px; height: 70px; background: var(--v2-background-bg-base); z-index: 50; }
[role=dialog] { position: fixed; bottom: 130px; right: 30px; width: 160px; height: 80px; background: var(--v2-background-bg-layer-01); z-index: 100; }
#switch { position: fixed; top: 0; right: 0; z-index: 101; }
[data-home-row] { background: var(--v2-background-bg-base); }
[data-home-row]:is(:hover, :focus-within, [data-selected]) { background: var(--v2-background-bg-layer-01); }
[data-component=home-session-search] > label { display: block; background: rgb(48 48 48 / 60%); }
#home-fixture { position: fixed; inset: 160px 0 auto; z-index: 40; }
.home-session-group-header { position: relative; }
.home-session-group-header::before { content: ""; position: absolute; top: -12px; left: 0; width: 100%; height: 12px; background: var(--v2-background-bg-base); }
.home-session-group-header::after { content: ""; position: absolute; top: 100%; left: 0; width: 100%; height: 16px; background: linear-gradient(var(--v2-background-bg-base), transparent); }
`

const [enabled, setEnabled] = createSignal(true)
const [engine, setEngine] = createSignal<Engine>()
const [theme, setTheme] = createSignal<"light" | "dark">("dark")
const [home, setHome] = createSignal(false)
const [scene, setScene] = createSignal("ocean")
const [brightness, setBrightness] = createSignal<"subtle" | "normal" | "vivid">("normal")
createEffect(() => engine()?.start(findWallpaper(scene())!, { activity: "calm", time: "day", season: "summer", weather: "clear", brightness: brightness() }, 1.5))

render(() => <>
  <style>{hostCss + backdropCss}</style>
  <div class="shell bg-v2-background-bg-deep">
    <div class="row">
      <aside data-slot="vertical-tabs-sidebar">
        <div data-slot="vertical-tabs-panel">
          <div data-slot="vertical-tabs-peek-surface" class="bg-v2-background-bg-deep" />
          <div data-slot="vertical-tabs-mount" class="bg-v2-background-bg-deep">
            <div id="sidebar-div-row-wrap" class="bg-v2-background-bg-base" style={{ backgroundImage: "linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0.2))" }}>
              <button id="sidebar-div-row"><div id="sidebar-div-inside" class="bg-v2-background-bg-base" style={{ backgroundImage: "linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0.2))" }}>Session row inside a surfaced div</div></button>
            </div>
            <div id="sidebar-div-row-selected-wrap" data-selected="">
              <button id="sidebar-div-row-selected"><div id="sidebar-div-selected-inside" class="bg-v2-background-bg-base" data-selected="">Selected row</div></button>
            </div>
            <button id="sidebar-tab" data-slot="tabs-trigger" class="bg-v2-background-bg-base">Session tab</button>
            <button id="sidebar-tab-selected" data-slot="tabs-trigger" data-selected="true" class="bg-v2-background-bg-layer-03">Selected tab</button>
            <div data-home-row class="bg-v2-background-bg-base"><button>Default Project</button></div>
            <div role="menu" />
          </div>
        </div>
      </aside>
      <main>
        <div data-slot="session-chat-panel">
          <div class="session bg-v2-background-bg-base">
            <div data-session-title><div class="bg-v2-background-bg-base" /></div>
            <div class="session-header-fade" aria-hidden="true" />
            <div data-slot="session-timeline-scroll"><div role="menu" /></div>
            <div data-component="session-composer-dock" class="bg-v2-background-bg-base">
              <div data-slot="composer-morph" />
            </div>
          </div>
        </div>
      </main>
    </div>
    <Show when={enabled()}>
      <Backdrop theme={theme()} brightness={brightness()} onReady={setEngine} onError={(e) => { throw e }} />
    </Show>
  </div>
  <div role="dialog" />
  <Show when={home()}>
    <div id="home-fixture" data-slot="home-panel" class="bg-v2-background-bg-base">
      <div data-slot="home-projects-viewport">
        <div data-home-row><button>Default Project</button></div>
        <div data-home-row data-selected><button>Selected Project</button></div>
      </div>
      <section>
        <div class="sticky top-0 bg-v2-background-bg-base" id="home-header">
          <div data-component="home-session-search"><label><input placeholder="Search sessions" /></label></div>
          <div class="pointer-events-none absolute right-0 top-[68px] z-20" id="home-new-session-wrap">
            <button data-action="home-new-session">New session</button>
          </div>
        </div>
        <div data-slot="home-sessions-list">
          <div class="sticky bg-v2-background-bg-base home-session-group-header" id="home-date">Today</div>
        </div>
      </section>
    </div>
  </Show>
  <div id="switch">
    <button onClick={() => setEnabled(!enabled())}>Toggle wallpaper</button>
    <button onClick={() => setTheme(theme() === "dark" ? "light" : "dark")}>Toggle theme</button>
    <button onClick={() => setHome(!home())}>Toggle home</button>
    <button onClick={() => setScene(scene() === "ocean" ? "city" : "ocean")}>Toggle scene</button>
    <button onClick={() => setBrightness(brightness() === "vivid" ? "subtle" : brightness() === "subtle" ? "normal" : "vivid")}>Cycle brightness</button>
  </div>
</>, document.getElementById("root")!)
