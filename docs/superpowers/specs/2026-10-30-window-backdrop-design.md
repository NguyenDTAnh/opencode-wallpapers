# Wallpapers as the OpenCode Desktop window backdrop

## Intent

The panel part shipped first and works, but a wallpaper that only fills a side panel is not what the plugin is for:
the scenes were written to sit behind an interface, and the desktop window is where that idea lands. Two probes made
this a real possibility rather than a guess:

1. A plugin can paint behind the whole app. It appends a fixed element to `BODY` at `z-index: 0`, below `#root`, and
   overrides the app's own background CSS variables to transparent.
2. Text stays readable, because a scrim sits between the scene and the app's surfaces — the same scrim idea the TUI
   uses, painted under `#root` instead of over the text.

A live spike ran a real scene at window size for a minute, crossfaded to a second wallpaper, and stayed readable
throughout. This spec covers that feature. The panel stays, as the place the settings live and as the fallback when
the backdrop cannot be painted.

## Goals

1. A `backdrop` setting in the panel with two values, `window` the default:
   - `window`: the scene paints behind the whole window, with a scrim between it and the app's surfaces, and survives
     closing the panel tab, collapsing the side region and switching sessions.
   - `panel`: what ships today — the scene fills the plugin's own panel.
   Turning the wallpaper off entirely stays where it is, on the Wallpaper row.
2. Only one engine runs at a time. Switching to `window` destroys the panel's engine, and back. Two engines stepping
   the same scene is the bug this rule exists to prevent.
3. The scrim follows the interface theme: dark over a dark interface, pale over a light one, read from
   `ctx.appearance.mode()`.
4. When the background override does not take effect — an app update renaming the CSS variables is the likely cause —
   the plugin detects it once, falls back to painting in the panel, and says so in one toast. Never a black window.
   The fallback is not written to the store, so the next window boot tries `window` again.
5. Cost when idle, or when the window is hidden or minimised, is near zero.
6. The panel part keeps working as it does today.

## Non-goals

1. Painting over any part of the app. The backdrop sits below `#root` and the scrim does too; nothing the plugin adds
   covers text, a button or the composer. A dialog that paints its own opaque fill is unaffected.
2. Changing the panel's behaviour beyond the new setting.
3. A second wallpaper choice for the backdrop. One wallpaper, one set of settings; where it is painted is a separate
   question from what is painted.
4. Reworking the scenes.
5. External wallpapers through the `wallpapers` option. The GUI already reports them as unsupported.

## Constraints

- The backdrop's element is `position: fixed` on `BODY`, below `#root` in paint order, `pointer-events: none`.
- The override is CSS on the app's own variables. These names are internal to the app and can change in an update,
  which is why goal 4 exists.
- The window process has no Node access.
- The bundle stays one CommonJS file reached through `./gui-experimental`.
- The plugin id stays `wallpapers`; the store key stays `plugin.wallpapers.prefs`.
- `ctx.appearance.mode()` is the theme, and it is reactive.

## Approaches

### Chosen: one store, one `backdrop` field

`Stored` gains `backdrop?: "window" | "panel"`, defaulting to `"window"`. The panel reads it and decides what to
render. One source of settings, one wallpaper choice, and the panel remains the natural place to change both.

When the mode is `window`, the panel renders its settings block but no canvas: the scene is already on screen, behind
everything, and a second canvas would be a second engine running the same scene.

### Rejected: the backdrop replaces the panel

Cleaner to look at, but it takes away the settings' home and the fallback surface. A window backdrop that cannot be
painted needs somewhere to fall back to.

### Rejected: independent window and panel wallpapers

Two states, two engines, and no reason: what is painted is one choice; where it is painted is another, and only the
latter needs a setting.

## Design

### Who owns the backdrop (`src/gui/backdrop.ts`, `src/gui.tsx`)

The `setup` owns it, not the `Scene` component. A wallpaper behind the window must survive closing the panel tab,
collapsing the side region and switching sessions — a component-scoped owner would take the wallpaper with it, which
contradicts the mode's own meaning.

So `setup` opens the backdrop when the stored mode is `window`, and destroys it when the mode changes to `panel` or
`off`. The store subscription lives in `setup` too. What the panel loses in `window` mode is the engine, and with it
the agent-event wiring, which moves to `setup`: it subscribes to the same `session.execution.*` events on the sidecar
server and calls `engine.react`. There is no `panel.visible()` gate in this mode — `document.hidden` is the only
pause, since the wallpaper belongs to the window and not to a tab.

The panel keeps its engine only in `panel` mode, with the wiring it has today. Exactly one engine exists at any time,
owned by whoever is painting.

### The backdrop layer (`src/gui/backdrop.ts`)

A module that owns one element tree and its lifetime:

```ts
export interface Backdrop {
  destroy(): void
}
export function openBackdrop(options: {
  onError: (error: unknown) => void
  onFallback: () => void
}): Backdrop | undefined
```

`openBackdrop` appends the style element and the fixed container with the canvas and the scrim inside it, then checks
that the override took effect (below). It returns a `Backdrop` whose `destroy()` removes both, or `undefined` when the
check fails, having already removed everything.

### The background override and its self-check (`src/gui/backdrop.ts`)

The variables to override are the ones the spike proved sufficient, and they come from the installed app:

```
--surface-base
--surface-raised-base
--surface-raised-stronger-non-alpha
--surface-stronger-non-alpha
--color-v2-background-bg-base
--v2-background-bg-base
--v2-background-bg-deep
--color-v2-background-bg-layer-02
html, body, #root { background: transparent }
```

`--surface-base` alone is not enough: in the installed desktop it is an alpha colour (`#ffffff08` dark, `#00000008`
light), and the opaque fill the probe measured came from `--surface-raised-stronger-non-alpha`. The list above is the
whole set the spike overrode, and it worked.

The self-check attaches a probe element to `document.body` — it must be attached, because a detached element inherits
no custom properties from `:root` and would report transparent both before and after, which reads as a failed check
every time. The probe reads `background: var(--surface-raised-stronger-non-alpha)` before the style is appended and
after, and the difference between an opaque colour and `rgba(0, 0, 0, 0)` is the pass.

If it fails, `openBackdrop` removes what it appended and returns `undefined`.

### Fallback stays out of the store

A failed check does not write `backdrop: "panel"`. Writing it would pin a user to panel mode forever after one app
update renamed a variable, even once the plugin caught up. Instead the failed check is remembered in RAM for the
window's lifetime, the panel renders as if the mode were `panel`, and one toast says the window backdrop is
unavailable. The next window boot tries again, so a plugin update that fixes the variable list recovers without the
user touching anything.

The `Backdrop` row keeps showing the stored value. A muted line under the settings block says the window backdrop
fell back, while the fallback is in effect.

### The panel's own surface (`src/gui/css.ts`)

`.wallpapers-panel` paints `var(--color-background-100, #16181d)`, and the app does not define that variable, so the
panel is opaque today. In `window` mode the panel's frame becomes transparent, so the scene shows through to the
sidebar behind it; the settings block keeps its own translucent surface, which follows the theme. `panel` mode keeps
today's opaque frame, so the panel part is unchanged.

### The scrim (`src/gui/css.ts`)

Two classes, picked by `ctx.appearance.mode()`:

- dark interface: `rgb(0 0 0 / 0.55)` to `rgb(0 0 0 / 0.72)` to `rgb(0 0 0 / 0.62)`, top to bottom, as the spike used.
- light interface: the same shape over white, `rgb(255 255 255 / 0.6)` to `rgb(255 255 255 / 0.75)` to
  `rgb(255 255 255 / 0.65)`, so a light theme does not put a dark band behind dark text.

Both stay below `#root`. Brightness setting does not change the scrim; it changes the scene, as it already does.

### Settings (`src/desktop/settings.ts`, `src/desktop/rows.ts`)

`Stored` gains `backdrop?: "window" | "panel"`, defaulting to `"window"`. The `Backdrop` row has those two values —
`off` stays where it is, on the Wallpaper row, so turning the backdrop off cannot also clear the chosen wallpaper and
hand the next hourly shuffle a reason to turn it back on. The row's values are the strings `apply` takes.

`apply` gains one branch, `window` / `panel`, written the same way as the others.

### Files

```
src/gui/backdrop.ts         NEW  the fixed layer, the override, the self-check
src/gui/css.ts              MOD  backdrop and scrim styles, light and dark
src/gui/panel.tsx           MOD  panel renders settings only in window mode
src/gui.tsx                 MOD  setup owns the backdrop and the agent events in window mode
src/desktop/settings.ts     MOD  Stored.backdrop, apply branch
src/desktop/rows.ts         MOD  the Backdrop row
src/desktop/settings.test.ts MOD cases for the new branch
```

## Risks

- The CSS variable names are internal to the app. Goal 4 is the answer: detect, fall back, say so once. The detection
  is proven, so a renamed variable costs a fallback, not a black window.
- A scene at window size costs more than one at panel size. The engine's pixel budget already caps the render; the
  spike's numbers cannot be quoted as the cost because the agent ran concurrently, so the feature's own verification
  measures it with the machine otherwise idle.
- The app's surfaces other than the ones the override names may paint their own opaque fill. The spike's
  `elementsFromPoint` run found none above the ones named; if one appears, it joins the override list, and the
  self-check catches the failure.
- Light theme is untested. The scrim values above are proposals, and the verification step measures them.

## Verification

1. `bun test`, `tsc --noEmit` and `tsc -p tsconfig.gui.json --noEmit` all pass.
2. `bun run build` emits both bundles.
3. With `backdrop: "window"`, the scene is behind the sidebar, the timeline and the composer, and every label is
   readable. Switching wallpapers crossfades at window size.
4. Closing the panel tab, collapsing the side region and switching sessions keep the backdrop on screen.
5. With `backdrop: "panel"`, the panel renders as it does today and the backdrop is gone.
6. Switching between the two destroys one engine and starts the other — one animation loop, checked with `sys_stats`
   (`sections: ["cpu"]`).
7. With the window minimised, CPU falls to near zero.
8. Break the override on purpose (rename one variable in the bundle) and reload: the plugin falls back to the panel,
   shows one toast, and the stored `backdrop` is still `"window"`.
9. A light theme shows a pale scrim and readable text.

## Left to the builder

- The exact light-theme scrim values.
- Whether the panel's settings block also collapses when the wallpaper is off.
