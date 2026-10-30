import { expect, test } from "bun:test"
import { openBackdrop, overridePassed } from "./backdrop"

test("the override passed when an opaque fill became transparent", () => {
  expect(overridePassed("rgb(28, 28, 28)", "rgba(0, 0, 0, 0)")).toBe(true)
})

test("the override failed when the fill is unchanged", () => {
  expect(overridePassed("rgb(28, 28, 28)", "rgb(28, 28, 28)")).toBe(false)
  expect(overridePassed("rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)")).toBe(false)
})

test("an already-transparent surface does not count as a pass", () => {
  // A variable the app paints with alpha, such as --surface-base, is transparent-looking before the override too.
  expect(overridePassed("rgba(255, 255, 255, 0.03)", "rgba(0, 0, 0, 0)")).toBe(false)
})

test("a failed check destroys the layer and never writes a store", () => {
  let fell = false
  // openBackdrop takes the check as a parameter, so the failure path is reachable without a real app.
  const result = openBackdrop({ onError: () => {}, onFallback: () => (fell = true), check: () => false })
  expect(result).toBeUndefined()
  expect(fell).toBe(true)
})
