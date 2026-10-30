import { expect, test } from "bun:test"
import { BRIGHTNESS_FILTER } from "../gui/backdrop"

test("the Desktop scene brightens with the setting: subtle < normal < vivid", () => {
  expect(BRIGHTNESS_FILTER.subtle).toBeLessThan(BRIGHTNESS_FILTER.normal)
  expect(BRIGHTNESS_FILTER.normal).toBeLessThan(BRIGHTNESS_FILTER.vivid)
})

test("brightness levels stay above the scrim so the scene stays visible", () => {
  // The dark scrim is 50% black, which halves everything behind it; a filter of 1.2 still leaves more than half.
  for (const level of ["subtle", "normal", "vivid"] as const) {
    expect(BRIGHTNESS_FILTER[level]).toBeGreaterThan(1)
  }
})
