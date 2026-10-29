import { expect, test } from "bun:test"
import { INITIAL } from "./settings"
import { findWallpaper } from "./scenes"
import { nextShuffle, resolveSettings } from "./weather"

const noon = new Date(2026, 5, 1, 12, 0)
const midnight = new Date(2026, 5, 1, 23, 0)

test("auto time follows the clock", () => {
  expect(resolveSettings({ ...INITIAL, time: "auto" }, noon, undefined).time).toBe("day")
  expect(resolveSettings({ ...INITIAL, time: "auto" }, midnight, undefined).time).toBe("night")
})

test("a fixed wallpaper ignores the time setting", () => {
  const fixed = findWallpaper("matrix")!
  expect(fixed.fixedTime).toBeDefined()
  expect(resolveSettings({ ...INITIAL, wallpaper: "matrix", time: "day" }, midnight, undefined).time).toBe(fixed.fixedTime!)
})

test("weather off is undefined, local falls back to clear without a forecast", () => {
  expect(resolveSettings({ ...INITIAL, weather: "off" }, noon, undefined).weather).toBeUndefined()
  expect(resolveSettings({ ...INITIAL, weather: "local" }, noon, undefined).weather).toBe("clear")
  expect(resolveSettings({ ...INITIAL, weather: "local" }, noon, { weather: "rain" }).weather).toBe("rain")
})

test("an explicit weather setting wins over the forecast", () => {
  expect(resolveSettings({ ...INITIAL, weather: "snow" }, noon, { weather: "rain" }).weather).toBe("snow")
})

test("a southern location flips the season", () => {
  const june = new Date(2026, 5, 1, 12, 0)
  expect(resolveSettings({ ...INITIAL, season: "auto" }, june, undefined).season).toBe("summer")
  expect(resolveSettings({ ...INITIAL, season: "auto", location: "-33.9,18.4" }, june, undefined).season).toBe("winter")
})

test("nextShuffle returns nothing when shuffle is off or nothing is due", () => {
  expect(nextShuffle({ ...INITIAL, wallpaper: "beach", shuffle: "off" })).toBeUndefined()
  expect(nextShuffle({ ...INITIAL, wallpaper: "beach", shuffle: "hourly" })).toBeUndefined()
  const stale = { ...INITIAL, wallpaper: "beach", shuffle: "hourly" as const, changed: { "": Date.now() - 3_600_001 } }
  const next = nextShuffle(stale)
  expect(next).toBeDefined()
  expect(next).not.toBe("beach")
})

test("nextShuffle stays in the chosen collection", () => {
  const stale = {
    ...INITIAL,
    wallpaper: "beach",
    shuffle: "hourly" as const,
    collections: { "": "Classics" },
    changed: { "": Date.now() - 3_600_001 },
  }
  const next = nextShuffle(stale)
  expect(findWallpaper(next!) && (findWallpaper(next!)!.collection ?? "Classics")).toBe("Classics")
})
