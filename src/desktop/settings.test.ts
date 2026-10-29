import { expect, test } from "bun:test"
import { INITIAL, apply, seasonAt, timeAt, type Stored } from "./settings"

test("apply turns a wallpaper on", () => {
  const result = apply(INITIAL, "beach")
  expect(result.state.wallpaper).toBe("beach")
  expect(result.message).toContain("Beach")
})

test("apply off clears the wallpaper", () => {
  const on: Stored = { ...INITIAL, wallpaper: "beach" }
  expect(apply(on, "off").state.wallpaper).toBe("")
})

test("apply rejects an unknown wallpaper and leaves the state alone", () => {
  const result = apply(INITIAL, "nope")
  expect(result.error).toBe(true)
  expect(result.state).toBe(INITIAL)
})

test("apply sets activity, time, brightness and power", () => {
  expect(apply(INITIAL, "lively").state.activity).toBe("lively")
  expect(apply(INITIAL, "night").state.time).toBe("night")
  expect(apply(INITIAL, "vivid").state.brightness).toBe("vivid")
  expect(apply(INITIAL, "smooth").state.power).toBe("smooth")
})

test("apply auto resets time, and season auto resets season", () => {
  const night: Stored = { ...INITIAL, time: "night", season: "winter" }
  expect(apply(night, "auto").state.time).toBe("auto")
  expect(apply(night, "season auto").state.season).toBe("auto")
})

test("apply sets a collection and keeps the wallpaper inside it", () => {
  const on: Stored = { ...INITIAL, wallpaper: "beach" }
  const result = apply(on, "collection Classics")
  expect(result.state.collections?.[""]).toBe("Classics")
  expect(result.state.wallpaper).not.toBe("beach")
})

test("apply collects a wallpaper from another collection", () => {
  const state: Stored = { ...INITIAL, collections: { "": "Classics" } }
  const result = apply(state, "beach")
  expect(result.state.wallpaper).toBe("beach")
  expect(result.state.collections?.[""]).toBe("Landscapes")
})

test("seasonAt is meteorological and flips south of the equator", () => {
  expect(seasonAt(new Date(2026, 3, 15), false)).toBe("spring")
  expect(seasonAt(new Date(2026, 3, 15), true)).toBe("autumn")
})

test("timeAt switches at 6, 7, 18 and 20", () => {
  expect(timeAt(new Date(2026, 0, 1, 5, 59))).toBe("night")
  expect(timeAt(new Date(2026, 0, 1, 6, 30))).toBe("sunset")
  expect(timeAt(new Date(2026, 0, 1, 7, 0))).toBe("day")
  expect(timeAt(new Date(2026, 0, 1, 18, 0))).toBe("sunset")
  expect(timeAt(new Date(2026, 0, 1, 20, 0))).toBe("night")
})
