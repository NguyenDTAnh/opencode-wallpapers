import { expect, test } from "bun:test"
import { brightnessCurve } from "./engine"

test("brightness curves are ordered subtle < normal < vivid and never equal overall", () => {
  const subtle = brightnessCurve("subtle")
  const normal = brightnessCurve("normal")
  const vivid = brightnessCurve("vivid")
  // The soft knee maps the darkest values to the same output on every level, so the curves only separate higher up.
  for (let i = 1; i < 256; i++) {
    expect(subtle[i]).toBeLessThanOrEqual(normal[i])
    expect(normal[i]).toBeLessThanOrEqual(vivid[i])
  }
  expect(subtle[255]).toBeLessThan(normal[255])
  expect(normal[255]).toBeLessThan(vivid[255])
})

test("brightness curves keep black, grow monotonically and dim the top end", () => {
  for (const mode of ["subtle", "normal", "vivid"] as const) {
    const curve = brightnessCurve(mode)
    expect(curve[0]).toBe(0)
    // The TUI dims the top end on purpose, so scenes stay behind text.
    expect(curve[255]).toBeLessThan(255)
    for (let i = 1; i < 256; i++) expect(curve[i]).toBeGreaterThanOrEqual(curve[i - 1])
  }
})
