# Window Backdrop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `backdrop` setting with a `window` mode that paints the wallpaper behind the whole OpenCode Desktop window, under the app's own surfaces, with a theme-aware scrim.

**Architecture:** `setup` owns the backdrop's lifetime, because a window wallpaper must survive closing the panel tab and switching sessions. The backdrop module appends one fixed element below `#root`, overrides the app's background CSS variables to transparent, and self-checks that the override took effect — falling back to panel mode without writing the store. Exactly one engine exists at a time; the mode decides which one owns it.

**Tech Stack:** TypeScript, Solid JSX, `@opencode/plugin/gui` 2.2.x, `effect/Schema`, HTML canvas 2D.

**Spec:** `docs/superpowers/specs/2026-10-30-window-backdrop-design.md`

## Global Constraints

- The backdrop's element is `position: fixed` on `BODY`, below `#root` in paint order (`z-index: 0`), `pointer-events: none`.
- The override names exactly these variables, as the spike proved sufficient on the installed app: `--surface-base`, `--surface-raised-base`, `--surface-raised-stronger-non-alpha`, `--surface-stronger-non-alpha`, `--color-v2-background-bg-base`, `--v2-background-bg-base`, `--v2-background-bg-deep`, `--color-v2-background-bg-layer-02`, plus `html, body, #root { background: transparent }`.
- The self-check's probe element must be appended to `document.body` before reading computed style. A detached element inherits no custom property and would always report transparent, reading as a failed check.
- A failed self-check never writes the store. The fallback lives in RAM for the window's lifetime; one toast per failed attempt; the next attempt happens on the next window boot.
- Exactly one engine runs at a time. `backdrop: "window"` means the panel renders no canvas.
- The scrim sits below `#root`. It never paints over the app's controls.
- Plugin id `wallpapers`; store key `plugin.wallpapers.prefs`; panel key `wallpapers:scene`.
- The window process has no Node access.
- The bundle stays one CommonJS file reached through `./gui-experimental`.
- `tui.tsx` and `src/engine.tsx` keep their behaviour.

## Review Focus

1. The self-check's decision treats an already-transparent surface as a pass, so an app that paints its base with alpha reads as a working override over a black window. Pinned by the unit test in Task 1.
2. A failed self-check writes `backdrop: "panel"` to the store, pinning the user to panel mode after one app update. Pinned by the unit test in Task 1.
3. Both the panel's engine and the backdrop's engine run at once after a mode switch, doubling the CPU and splitting the scene state. Pinned by the unit test in Task 3 and measured in Task 6.
4. The panel keeps its opaque frame in `window` mode, hiding the scene behind an opaque rectangle. Covered by the manual check in Task 6, since it is a painted result.
5. The scrim is dark over a light interface, putting a dark band behind dark text. Covered by the manual check in Task 6.

---

## File Structure

```
src/gui/backdrop.ts         NEW  fixed layer, override, self-check, engine owner in window mode
src/gui/backdrop.test.ts    NEW  self-check and fallback tests (bun test)
src/gui/css.ts              MOD  backdrop and scrim styles, light and dark
src/gui/panel.tsx           MOD  panel renders settings only when the mode is window
src/gui.tsx                 MOD  setup owns the backdrop and the agent events
src/desktop/settings.ts     MOD  Stored.backdrop, apply branch
src/desktop/rows.ts         MOD  the Backdrop row
src/desktop/settings.test.ts MOD cases for the new branch
src/desktop/rows.test.ts    MOD cases for the new row
```

`backdrop.ts` owns the element tree and the self-check, and knows nothing about Solid. `panel.tsx` stops owning the engine when the mode is `window`; it keeps the settings block. `gui.tsx` wires the mode to the right owner.

---

### Task 1: Backdrop module with self-check

**Files:**
- Create: `src/gui/backdrop.ts`
- Create: `src/gui/backdrop.test.ts`
- Modify: `src/gui/css.ts`

**Interfaces:**
- Consumes: `createEngine`, `Engine`, `EngineOptions` from `../desktop/engine`; `Wallpaper`, `Settings`, `AgentEvent` from `../desktop/wallpaper`.
- Produces:

```ts
export type BackdropMode = "window" | "panel"
export interface BackdropHandle {
  setWallpaper(wallpaper: Wallpaper | undefined, settings: Settings, fade?: number): void
  react(event: AgentEvent): void
  power(mode: Power): void
  destroy(): void
}
export function openBackdrop(options: {
  onError: (error: unknown) => void
  onFallback: () => void
  check?: typeof overridePassed
}): BackdropHandle | undefined
export function overridePassed(before: string, after: string): boolean
```

`overridePassed` is pure so the decision is testable without a DOM, and `openBackdrop` takes the check as an injectable parameter defaulting to reading the real computed styles.

- [ ] **Step 1: Write the failing tests**

`src/gui/backdrop.test.ts`:

```ts
import { expect, test } from "bun:test"
import { overridePassed } from "./backdrop"

test("the override passed when an opaque fill became transparent", () => {
  expect(overridePassed("rgb(28, 28, 28)", "rgba(0, 0, 0, 0)")).toBe(true)
})

test("the override failed when the fill is unchanged", () => {
  expect(overridePassed("rgb(28, 28, 28)", "rgb(28, 28, 28)")).toBe(false)
  expect(overridePassed("rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)")).toBe(false)
})

test("an already-transparent surface does not count as a pass", () => {
  // A variable the app paints with alpha, such as --surface-base, is transparent-looking before the override too.
  expect(overridePassed("rgba(255, 255, 255, 0.03)", "rgba(0, 0, 0, 0)")).toBe(false)
})

test("a failed check destroys the layer and never writes a store", () => {
  let fell = false
  // openBackdrop takes the check as a parameter, so the failure path is reachable without a real app.
  const result = openBackdrop({ onError: () => {}, onFallback: () => (fell = true), check: () => false })
  expect(result).toBeUndefined()
  expect(fell).toBe(true)
})
```

`bun test` has no DOM, so `openBackdrop` must not touch `document` before the check runs: append the elements only after the check passes. That keeps the failure path testable here, and the success path is covered by Task 6.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test src/gui/backdrop.test.ts`
Expected: FAIL, cannot resolve `./backdrop`.

- [ ] **Step 3: Implement `overridePassed`**

Pure: a pass is `after` reading `rgba(0, 0, 0, 0)` while `before` does not. Everything else is a failure, including a surface that was already transparent, since such a surface proves nothing about the override.

- [ ] **Step 4: Implement `openBackdrop`**

Read the probe's computed `background` for `var(--surface-raised-stronger-non-alpha)` before and after appending a style that sets the override variables to `transparent`, and call `check(before, after)`. On failure, call `onFallback` and return `undefined` without touching the document. On success, append the style element and the fixed container holding the canvas and the scrim, create the engine against that canvas with `onError` forwarded, and return the handle.

`setWallpaper` forwards to `engine.start`; `react` and `power` forward; `destroy` destroys the engine and removes both elements.

- [ ] **Step 5: Add the CSS**

`src/gui/css.ts` gains `.wallpapers-backdrop`, `.wallpapers-backdrop-canvas`, and two scrim classes, `wallpapers-backdrop-scrim-dark` and `wallpapers-backdrop-scrim-light`, with the values from the spec:

- dark: `rgb(0 0 0 / 0.55)` → `rgb(0 0 0 / 0.72)` → `rgb(0 0 0 / 0.62)`
- light: `rgb(255 255 255 / 0.6)` → `rgb(255 255 255 / 0.75)` → `rgb(255 255 255 / 0.65)`

- [ ] **Step 6: Run the tests to verify they pass**

Run: `bun test src/gui/backdrop.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 7: Commit**

```bash
git add src/gui/backdrop.ts src/gui/backdrop.test.ts src/gui/css.ts
git commit -m "feat: add backdrop layer with self-check and theme scrims"
```

---

### Task 2: Settings and rows

**Files:**
- Modify: `src/desktop/settings.ts`
- Modify: `src/desktop/settings.test.ts`
- Modify: `src/desktop/rows.ts`
- Modify: `src/desktop/rows.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `settings.ts`: `Stored` gains `backdrop?: BackdropMode`; `INITIAL` becomes `{ wallpaper: "", backdrop: "window" }`; `StoredSchema` gains the field; `apply` accepts `window` and `panel`.
  - `rows.ts`: `rowsFor` returns a `Backdrop` row first, with values `["window", "panel"]`, whose value is `state.backdrop ?? "window"`.
  - Re-export `BackdropMode` from `settings.ts`.

- [ ] **Step 1: Write the failing tests**

Add to `src/desktop/settings.test.ts`:

```ts
test("backdrop defaults to window and apply switches it", () => {
  expect(INITIAL.backdrop).toBe("window")
  expect(apply(INITIAL, "panel").state.backdrop).toBe("panel")
  expect(apply(INITIAL, "panel").state.wallpaper).toBe(INITIAL.wallpaper)
})

test("backdrop is not cleared by wallpaper off, and off does not clear the backdrop", () => {
  const state: Stored = { ...INITIAL, wallpaper: "beach", backdrop: "panel" }
  expect(apply(state, "off").state.backdrop).toBe("panel")
  expect(apply(state, "window").state.wallpaper).toBe("beach")
})
```

Add to `src/desktop/rows.test.ts`:

```ts
test("the Backdrop row comes first and offers the two modes", () => {
  const rows = rowsFor(INITIAL, noon)
  expect(rows[0].title).toBe("Backdrop")
  expect(rows[0].values).toEqual(["window", "panel"])
  expect(rows[0].label("window")).toBe("Window")
})

test("the backdrop row reflects the stored mode", () => {
  expect(rowsFor({ ...INITIAL, backdrop: "panel" }, noon)[0].value).toBe("panel")
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test src/desktop/settings.test.ts src/desktop/rows.test.ts`
Expected: FAIL, `backdrop` is not in `Stored`.

- [ ] **Step 3: Implement**

Add the field, the schema entry, the `apply` branch (after the `off` branch, before `collection`, case-insensitive as the rest are), and the row. `INITIAL` carries `backdrop: "window"`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test src/desktop/settings.test.ts src/desktop/rows.test.ts`
Expected: PASS.

- [ ] **Step 5: Update the existing row-order test**

The `every row offers a current value` test asserts the row titles in order. Insert `"Backdrop"` first.

- [ ] **Step 6: Commit**

```bash
git add src/desktop/settings.ts src/desktop/settings.test.ts src/desktop/rows.ts src/desktop/rows.test.ts
git commit -m "feat: add the backdrop setting to the panel's rows"
```

---

### Task 3: Wire the mode to the right owner

**Files:**
- Modify: `src/gui.tsx`
- Modify: `src/gui/panel.tsx`

**Interfaces:**
- Consumes: `openBackdrop`, `BackdropHandle`, `overrideTokeEffect` from `./gui/backdrop`; `BackdropMode` from `./desktop/settings`; `ctx.stores.prefs`, `ctx.appearance.mode()`, `ctx.servers.get`, `ctx.sessions.current` from the SDK.
- Produces: the GUI entry that owns the backdrop in `window` mode; a panel that renders the settings block only in `window` mode and keeps today's behaviour in `panel` mode.

- [ ] **Step 1: Move the engine ownership into `setup`**

In `src/gui.tsx`, inside `setup`:

- Read the store's `backdrop` reactively.
- When it is `"window"` and no handle exists, call `openBackdrop({ onError: notify, onFallback })`, store the handle, and start the current wallpaper on it.
- When it is not `"window"` and a handle exists, destroy it and clear it.
- Subscribe to the sidecar server's `session.execution.*` events once, forwarding to whichever handle is live.
- Subscribe to `ctx.appearance.mode()` changes to swap the scrim class on the live backdrop.

The panel's own engine and its agent-event subscription are removed in this task; `panel` mode keeps them only if the panel still renders a canvas there.

- [ ] **Step 2: The panel renders by mode**

In `src/gui/panel.tsx`:

- `panel` mode: unchanged from today — the container, the canvas, the settings block, its own engine.
- `window` mode: the settings block only, no canvas, no engine. The panel's frame is transparent so the scene behind shows through.
- The mode comes from the store the panel already receives.

- [ ] **Step 3: Typecheck and build**

Run: `bun x tsc -p tsconfig.gui.json --noEmit && bun ./node_modules/vite/bin/vite.js build`
Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/gui.tsx src/gui/panel.tsx
git commit -m "feat: own the backdrop from setup and render the panel by mode"
```

---

### Task 4: Fallback path

**Files:**
- Modify: `src/gui/backdrop.ts`
- Modify: `src/gui.tsx`

**Interfaces:**
- Consumes: `openBackdrop`'s injectable `check` from Task 1.
- Produces: a fallback that never writes the store and toasts once per failed attempt.

- [ ] **Step 1: Implement the fallback**

When `openBackdrop`'s check fails, it returns `undefined` without touching the document. `setup`'s `onFallback` shows one toast saying the window backdrop is unavailable and the wallpaper moved to the panel, and records the failure in a local `let` so the panel can read it.

The store keeps `backdrop: "window"`. The next window boot calls `openBackdrop` again.

- [ ] **Step 2: Verify by breaking the override on purpose**

In the built bundle, rename `--surface-raised-stronger-non-alpha` to a name the app does not define, reload the window.
Expected: one toast, the wallpaper paints in the panel, and reading the store shows `backdrop: "window"` unchanged.

- [ ] **Step 3: Revert the rename, rebuild**

Run: `bun ./node_modules/vite/bin/vite.js build`
Expected: the window backdrop returns on reload.

- [ ] **Step 4: Commit**

```bash
git add src/gui/backdrop.ts src/gui.tsx
git commit -m "feat: fall back to the panel when the background override fails"
```

---

### Task 5: Documentation

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update the desktop section**

`README.md`'s "OpenCode Desktop" section describes the backdrop as the default: the scene behind the whole window, the scrim that keeps text readable, and the panel mode for when the backdrop cannot be painted.

- [ ] **Step 2: Add a changelog entry**

One entry under Unreleased.

- [ ] **Step 3: Commit**

```bash
git add README.md CHANGELOG.md
git commit -m "docs: describe the window backdrop"
```

---

### Task 6: Verification in the desktop app

Nothing here changes code. Each step names what to observe.

- [ ] **Step 1: Build and reload**

Run: `bun run build`, then reload the desktop window.
Expected: the scene paints behind the sidebar, the timeline and the composer; every label readable.

- [ ] **Step 2: Panel frame is transparent in window mode**

Look at the panel's own region.
Expected: the scene shows through it; the settings block keeps a translucent surface.

- [ ] **Step 3: One engine at a time**

Switch between `window` and `panel` a few times.
Expected: no doubling of CPU, checked with `sys_stats` (`sections: ["cpu"]`, `sample_ms: 2000`); the scene does not jump or restart.

- [ ] **Step 4: Backdrop survives tab and session changes**

Close the panel tab, collapse the side region, switch sessions.
Expected: the backdrop stays on screen in `window` mode.

- [ ] **Step 5: Crossfade at window size**

Switch wallpapers.
Expected: a crossfade, not a cut.

- [ ] **Step 6: Idle cost**

With the window minimised, sample CPU for 10 s.
Expected: near zero.

- [ ] **Step 7: Fallback**

Break the override as in Task 4 and reload.
Expected: one toast, panel mode, store unchanged.

- [ ] **Step 8: Light theme**

Switch the interface to light.
Expected: a pale scrim, dark text readable.

- [ ] **Step 9: The TUI still works**

Run `opencode` in a terminal, type `/wallpaper`.
Expected: unchanged from before this feature.

- [ ] **Step 10: Commit any fixes**

Only if the steps above required code changes.
