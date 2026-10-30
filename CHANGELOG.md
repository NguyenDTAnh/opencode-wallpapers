# Changelog

## Unreleased

- The wallpaper now fills the OpenCode Desktop window behind the interface, including the sidebar, the Home
  projects and session list, the timeline and the chat surface. Controls stay readable: the composer, menus,
  dialogs, the search field and hover/selected rows keep their own opaque surfaces.
- The scene is a plugin-owned component rendered through the GUI `Slot` API, with its CSS registered through
  `Style`. The plugin no longer locates or inserts nodes into the app's DOM.
- The animation repaints during a window resize instead of clearing to the app's background, so tiling or resizing
  the window no longer flashes.
- `/wallpaper` opens the settings in a native dialog built from `ctx.ui.Dialog` and `ctx.ui.Menu`; `/wallpaper
  <argument>` still applies one setting. The side panel is gone, and the TUI is unchanged.
- Desktop leaves out what needs a terminal or a filesystem: the `WALLPAPER_*` variables, kitty pixel mode,
  wallpapers from other packages, and the per-project setting.

## 0.1.0

First release.

- Ten animated wallpapers: ocean, desert, jungle, space, farm, tundra, beach, city, zen garden and prehistoric.
- Three activity levels (calm, lively, teeming) and three times of day (day, sunset, night), plus auto, which follows
  the local clock and fades between them.
- Seasons, and weather that is each wallpaper's own, fixed, or the real local weather from Open-Meteo.
- Agent reactions: livelier while the agent works, a visitor when it finishes, clouds after an error.
- Clicks on the background and a rare easter egg in every wallpaper.
- The `/wallpaper` menu with brightness, shuffle, per-project wallpapers and a power saver; crossfades between
  choices; light theme support.
- Optional kitty graphics pixel mode.
- Wallpapers from other packages via the `wallpapers` plugin option, with a typed API at `opencode-wallpapers/api`.
