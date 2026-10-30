import type { BackdropMode } from "../desktop/settings"

// Which layer paints the wallpaper. Exactly one owns the engine: two canvases stepping the same scene double the CPU
// and let the two copies drift apart, since each keeps its own busy/pace state.
export function ownerFor(mode: BackdropMode, failed = false): "backdrop" | "panel" {
  // A failed override means nothing can paint in the window, so the panel takes over. The store keeps saying window:
  // writing the fallback there would pin the user to panel mode forever after one app update renamed a variable.
  if (mode === "window") return failed ? "panel" : "backdrop"
  return "panel"
}

// What setup must do when the mode or the handle changes. Opening and closing are separate answers so a mode switch
// never leaves the old owner running.
export function nextAction(mode: BackdropMode, hasHandle: boolean, failed = false): "open" | "close" | "none" {
  const wanted = ownerFor(mode, failed) === "backdrop"
  if (wanted && !hasHandle) return "open"
  if (!wanted && hasHandle) return "close"
  return "none"
}
