// Which layer paints the wallpaper. The window backdrop owns it whenever it opened; the panel paints only as the
// fallback, when the app's own style variables could not be overridden.
//
// Exactly one owner at a time: two canvases stepping the same scene double the CPU and let the copies drift apart,
// since each keeps its own busy and pace state.
export function ownerFor(fallback: boolean): "backdrop" | "panel" {
  return fallback ? "panel" : "backdrop"
}

// What setup must do when the fallback flag or the handle changes. Opening and closing are separate answers so the old
// owner is never left running.
export function nextAction(hasHandle: boolean, fallback: boolean): "open" | "close" | "none" {
  if (!fallback && !hasHandle) return "open"
  if (fallback && hasHandle) return "close"
  return "none"
}
