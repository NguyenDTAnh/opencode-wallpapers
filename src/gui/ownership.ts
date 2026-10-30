import type { BackdropMode } from "../desktop/settings"

// Which layer paints the wallpaper. Exactly one owns the engine: two canvases stepping the same scene double the CPU
// and let the two copies drift apart, since each keeps its own busy/pace state.
export function ownerFor(mode: BackdropMode): "backdrop" | "panel" {
  return mode === "window" ? "backdrop" : "panel"
}

// What setup must do when the mode or the handle changes. Opening and closing are separate answers so a mode switch
// never leaves the old owner running.
export function nextAction(mode: BackdropMode, hasHandle: boolean): "open" | "close" | "none" {
  const wanted = ownerFor(mode) === "backdrop"
  if (wanted && !hasHandle) return "open"
  if (!wanted && hasHandle) return "close"
  return "none"
}
