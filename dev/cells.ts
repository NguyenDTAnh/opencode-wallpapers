// Renders terminal cells (a WALLPAPER_DUMP file, or dev/preview.ts output) to a PNG at 8x16 pixels per cell:
// bun dev/cells.ts dump.json out.png
import { OCTANTS } from "../src/octants"
import { SHAPES } from "../src/smooth"
import { DOTS, glyph } from "./font"
import { encodePng } from "./png"

const QUADS = [0x20, 0x2598, 0x259d, 0x2580, 0x2596, 0x258c, 0x259e, 0x259b, 0x2597, 0x259a, 0x2590, 0x259c, 0x2584, 0x2599, 0x259f, 0x2588]
const CW = 8
const CH = 16

export type Cells = { W: number; H: number; char: ArrayLike<number>; text?: string; fg: ArrayLike<number>; bg: ArrayLike<number> }

export function cellsToPng(cells: Cells) {
  const W = cells.W * CW
  const H = cells.H * CH
  const img = new Uint8Array(W * H * 4)
  // Cells with the top bit set point into OpenTUI's grapheme pool; the dump's text has the real characters.
  const rows = cells.text?.split("\n").map((line) => Array.from(line, (c) => c.codePointAt(0)!))
  for (let cy = 0; cy < cells.H; cy++)
    for (let cx = 0; cx < cells.W; cx++) {
      const i = cy * cells.W + cx
      const ch = cells.char[i] >= 0x80000000 ? (rows?.[cy]?.[cx] ?? 0x3f) : cells.char[i]
      const oct = ch === 0x20 ? -1 : OCTANTS.indexOf(ch)
      const quad = QUADS.indexOf(ch)
      const shape = oct < 0 ? SHAPES.get(ch) : undefined
      const dot = DOTS.get(ch)
      const gl = oct < 0 && quad < 0 && !shape && !dot && ch > 32 ? glyph(ch) : undefined
      for (let y = 0; y < CH; y++)
        for (let x = 0; x < CW; x++) {
          // Smooth glyphs are anti-aliased, as Ghostty and kitty draw them: mix by coverage of a 4x4 grid per pixel;
          // dots likewise, as a font renders them.
          let cover = 0
          if (shape) for (let s = 0; s < 16; s++) cover += shape((x + ((s & 3) + 0.5) / 4) / CW, (y + ((s >> 2) + 0.5) / 4) / CH) ? 1 / 16 : 0
          if (dot) cover = Math.min(1, Math.max(0, dot.r + 0.5 - Math.hypot(x + 0.5 - CW / 2, y + 0.5 - dot.y)))
          const lit =
            oct > 0
              ? !!(oct & (1 << (Math.floor((y * 4) / CH) * 2 + (x < CW / 2 ? 0 : 1))))
              : quad > 0
                ? !!(quad & (1 << ((y < CH / 2 ? 0 : 2) + (x < CW / 2 ? 0 : 1))))
                : gl
                  ? x >= 1 && x < 6 && y >= 3 && y < 11 && !!(gl[x - 1] & (1 << (y - 3)))
                  : ch > 127 && x >= 2 && x <= 4 && y >= 5 && y <= 8
          const k = shape || dot ? cover : lit ? 1 : 0
          const o = ((cy * CH + y) * W + cx * CW + x) * 4
          for (let c = 0; c < 3; c++) img[o + c] = (cells.bg[i * 4 + c] & 255) * (1 - k) + (cells.fg[i * 4 + c] & 255) * k
          img[o + 3] = 255
        }
    }
  return encodePng(img, W, H)
}

if (import.meta.main) {
  const [input, output] = process.argv.slice(2)
  await Bun.write(output, cellsToPng(await Bun.file(input).json()))
}
