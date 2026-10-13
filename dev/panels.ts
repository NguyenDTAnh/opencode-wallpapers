// Checks that the scene keeps out of a panel the UI draws over the page: with a dialog open, no cell of the dialog
// window may get scene colors or glyphs, on any frame, including the surface recount every 10 frames.
// bun dev/panels.ts [wallpaper]
import { seed } from "./seed"
import { H, W, mockScreen, session } from "./mock"
import { wallpapers } from "./wallpapers"

const id = process.argv[2] ?? "ocean"
seed(1)
const screen = mockScreen()
screen.engine.start(wallpapers.find((w) => w.id === id)!, { activity: "calm", time: "day" })

// A dark theme's own colors, all near-neutral like the ones isSurface accepts: the page, the dialog window over it, and
// the dialog's dimmed backdrop around the window.
const PAGE = [6, 35, 29]
const DIALOG = [10, 45, 38]
const SCRIM = [3, 17, 15]
const win = { x0: Math.floor(W / 2) - 30, x1: Math.floor(W / 2) + 30, y0: Math.floor(H / 4), y1: H - Math.floor(H / 4) }
const swin = { x0: win.x0 - 4, x1: win.x1 + 4, y0: win.y0 - 2, y1: win.y1 + 2 }
const OPEN = 40
const RUN = 40
const cells = W * H
const inWindow = (i: number) => {
  const x = i % W
  const y = (i / W) | 0
  return x >= win.x0 && x < win.x1 && y >= win.y0 && y < win.y1
}

type Snap = { char: Uint32Array; bg: Uint16Array }
const snaps: Snap[] = []
for (let f = 0; f < OPEN + RUN; f++) {
  if (f >= OPEN) {
    screen.ui((i, x, y, buffers) => {
      const inside = x >= win.x0 && x < win.x1 && y >= win.y0 && y < win.y1
      const scrim = x >= swin.x0 && x < swin.x1 && y >= swin.y0 && y < swin.y1
      buffers.char[i] = 32
      buffers.bg.set([...(inside ? DIALOG : scrim ? SCRIM : PAGE), 255], i * 4)
      buffers.fg.set([...PAGE, 255], i * 4)
    })
  } else screen.frame(session(W, H))
  if (f >= OPEN) snaps.push({ char: new Uint32Array(screen.buffers.char), bg: new Uint16Array(screen.buffers.bg) })
}
screen.engine.stop()

let repainted = 0
let glyphs = 0
let recounted = 0
for (let s = 1; s < snaps.length; s++) {
  const a = snaps[s - 1]
  const b = snaps[s]
  let frameRepaint = 0
  for (let i = 0; i < cells; i++) {
    if (!inWindow(i)) continue
    let diff = a.char[i] !== b.char[i]
    for (let c = 0; c < 3; c++) if (a.bg[i * 4 + c] !== b.bg[i * 4 + c]) diff = true
    if (diff) frameRepaint++
  }
  repainted += frameRepaint
  if ((OPEN + s) % 10 === 0) recounted += frameRepaint
}
const last = snaps[snaps.length - 1]
for (let i = 0; i < cells; i++) if (inWindow(i) && last.char[i] !== 32) glyphs++

const size = (win.x1 - win.x0) * (win.y1 - win.y0)
console.log(`dialog window ${size} cells: ${glyphs} carry a scene glyph, ${repainted} cell repaints over the run (${recounted} of them on surface recounts)`)
if (glyphs || repainted) {
  console.log(`FAIL: the scene paints into the dialog window`)
  process.exit(1)
}
console.log("ok")
