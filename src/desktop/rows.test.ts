import { expect, test } from "bun:test"
import { INITIAL } from "./settings"
import { rowsFor } from "./rows"

const noon = new Date(2026, 5, 1, 12, 0)

test("every row offers a current value it can label and describe", () => {
  const rows = rowsFor({ ...INITIAL, wallpaper: "beach" }, noon)
  expect(rows.map((r) => r.title)).toEqual([
    "Collection",
    "Wallpaper",
    "Activity",
    "Time of day",
    "Season",
    "Weather",
    "Brightness",
    "Power",
    "Shuffle",
  ])
  for (const row of rows) {
    expect(row.values).toContain(row.value)
    expect(row.label(row.value)).not.toBe("")
    expect(row.describe(row.value)).not.toBe("")
  }
})

test("a fixed wallpaper hides time, season and weather", () => {
  const titles = rowsFor({ ...INITIAL, wallpaper: "matrix" }, noon).map((r) => r.title)
  expect(titles).not.toContain("Time of day")
  expect(titles).not.toContain("Season")
  expect(titles).not.toContain("Weather")
})

test("the wallpaper row offers every scene plus off", () => {
  const wallpaper = rowsFor(INITIAL, noon).find((r) => r.title === "Wallpaper")!
  expect(wallpaper.values[0]).toBe("off")
  expect(wallpaper.values).toContain("beach")
  expect(wallpaper.label("off")).toBe("Off")
})

test("auto time and season labels name what auto currently resolves to", () => {
  const rows = rowsFor({ ...INITIAL, time: "auto", season: "auto" }, noon)
  expect(rows.find((r) => r.title === "Time of day")!.label("auto")).toContain("Day")
  expect(rows.find((r) => r.title === "Season")!.label("season auto")).toContain("Summer")
})

test("the wallpaper row stays inside the chosen collection", () => {
  const rows = rowsFor({ ...INITIAL, collections: { "": "Classics" } }, noon)
  const wallpaper = rows.find((r) => r.title === "Wallpaper")!
  expect(wallpaper.values).toContain("matrix")
  expect(wallpaper.values).not.toContain("beach")
})

test("the collection row lists all plus every named collection", () => {
  const collection = rowsFor(INITIAL, noon).find((r) => r.title === "Collection")!
  expect(collection.values[0]).toBe("collection all")
  expect(collection.values).toContain("collection Landscapes")
})
