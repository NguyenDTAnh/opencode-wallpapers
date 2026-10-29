import { expect, test } from "bun:test"
import { eggWait } from "./egg"

test("eggWait reads no process global", () => {
  const saved = globalThis.process
  // @ts-expect-error deliberately removing process, as a browser window has none
  delete globalThis.process
  try {
    expect(typeof eggWait()).toBe("number")
  } finally {
    globalThis.process = saved
  }
})
