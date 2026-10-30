import { expect, test } from "bun:test"
import { nextAction, ownerFor } from "./ownership"

test("the window mode makes the backdrop the owner, the rest the panel", () => {
  expect(ownerFor("window")).toBe("backdrop")
  expect(ownerFor("panel")).toBe("panel")
})

test("setup opens a handle only when the window mode has none", () => {
  expect(nextAction("window", false)).toBe("open")
  expect(nextAction("window", true)).toBe("none")
})

test("setup closes the handle when the mode leaves the window", () => {
  expect(nextAction("panel", true)).toBe("close")
  expect(nextAction("panel", false)).toBe("none")
})

test("a mode switch always moves ownership to exactly one layer", () => {
  // window -> panel with a live handle closes it, and panel -> window with none opens one. Neither leaves two owners.
  expect([nextAction("window", true), nextAction("panel", true)]).toEqual(["none", "close"])
  expect([nextAction("panel", false), nextAction("window", false)]).toEqual(["none", "open"])
})

test("a failed override hands the painting back to the panel", () => {
  // The store still says window, but nothing can paint there: the panel must take over or the window goes blank.
  expect(ownerFor("window", true)).toBe("panel")
  expect(ownerFor("window", false)).toBe("backdrop")
  expect(ownerFor("panel", true)).toBe("panel")
})

test("a failed override never opens the layer again in the same window", () => {
  expect(nextAction("window", false, true)).toBe("none")
})
