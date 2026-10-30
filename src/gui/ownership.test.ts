import { expect, test } from "bun:test"
import { nextAction, ownerFor } from "./ownership"

test("the backdrop owns the scene unless the override failed", () => {
  expect(ownerFor(false)).toBe("backdrop")
  expect(ownerFor(true)).toBe("panel")
})

test("setup opens the layer once, and never while the fallback is in effect", () => {
  expect(nextAction(false, false)).toBe("open")
  expect(nextAction(true, false)).toBe("none")
  expect(nextAction(false, true)).toBe("none")
})

test("a failed override closes the layer and hands the scene to the panel", () => {
  expect(nextAction(true, true)).toBe("close")
  // And it stays closed for the rest of the window: the fallback flag is not cleared by another attempt.
  expect(nextAction(false, true)).toBe("none")
})

test("only one layer ever owns the scene", () => {
  // With a handle and no failure the backdrop paints; with a failure and no handle the panel does. The two conditions
  // are never both satisfied, so the owners never overlap.
  expect([ownerFor(false), nextAction(false, false)]).toEqual(["backdrop", "open"])
  expect([ownerFor(true), nextAction(false, true)]).toEqual(["panel", "none"])
})
