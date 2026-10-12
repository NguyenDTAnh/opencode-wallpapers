// Re-renders the README gallery (teeming at 45 s via dev/snap.ts, one shot for a wallpaper with a fixed time) and
// fails if any screenshot differs from the published one on the assets branch (see dev/assets.ts) beyond a tiny
// tolerance, copying the stale ones' fresh renders to dev/out/screenshots/; --update writes the fresh renders into
// screenshots/ instead. Naming wallpapers limits it to them: bun dev/screenshots.ts [--update] [wallpaper...]
import { availableParallelism } from "node:os"
import { TIMES } from "../src/engine"
import { WALLPAPERS } from "../wallpapers"
import { assets } from "./assets"
import { decodePng } from "./png"

const update = process.argv.includes("--update")
const ids = process.argv.slice(2).filter((arg) => !arg.startsWith("--"))
const unknown = ids.filter((id) => !WALLPAPERS.some((w) => w.id === id))
if (unknown.length) throw new Error(`unknown wallpaper ${unknown.join(", ")}`)
const shots = (ids.length ? WALLPAPERS.filter((w) => ids.includes(w.id)) : WALLPAPERS).flatMap((w) => (w.fixedTime ? [w.fixedTime] : TIMES).map((time) => ({ id: w.id, time, file: `screenshots/${w.id}${time === "day" || w.fixedTime ? "" : `-${time}`}.png` })))
assets()
const queue = [...shots]
const stale: string[] = []
await Promise.all(
  Array.from({ length: availableParallelism() }, async () => {
    for (let shot = queue.shift(); shot; shot = queue.shift()) {
      const snap = Bun.spawn(["bun", "dev/snap.ts", shot.id, "teeming", shot.time, "45"], { stdout: "ignore" })
      if (await snap.exited) throw new Error(`dev/snap.ts ${shot.id} teeming ${shot.time} 45 failed`)
      const fresh = await Bun.file(`dev/out/${shot.id}-teeming-${shot.time}-45s.png`).bytes()
      if (update) {
        await Bun.write(shot.file, fresh)
        continue
      }
      const reason = await staleness(fresh, Bun.file(shot.file))
      if (reason) {
        stale.push(`${shot.file}: ${reason}`)
        await Bun.write(`dev/out/${shot.file}`, fresh)
      }
    }
  }),
)
if (update) {
  console.log(`wrote ${shots.length} screenshots`)
  process.exit(0)
}
if (!stale.length) {
  console.log(`${shots.length} screenshots up to date`)
  process.exit(0)
}
console.log(`${stale.sort().join("\n")}\nstale screenshots (fresh renders are in dev/out/screenshots): CI publishes them to the assets branch once this reaches main; see "README images" in CONTRIBUTING.md`)
process.exit(1)

async function staleness(fresh: Uint8Array, published: Bun.BunFile) {
  if (!(await published.exists())) return "missing"
  const a = decodePng(fresh)
  const b = decodePng(await published.bytes())
  if (a.width !== b.width || a.height !== b.height) return `${b.width}x${b.height}, expected ${a.width}x${a.height}`
  // Math functions round slightly differently across CPUs, which can flip a threshold here and there: city at night
  // drew 92 pixels differently on GitHub's Linux x64 than on macOS arm64. Real scene changes touch far more.
  let differ = 0
  for (let p = 0; p < a.rgba.length; p += 4) {
    if (Math.max(Math.abs(a.rgba[p] - b.rgba[p]), Math.abs(a.rgba[p + 1] - b.rgba[p + 1]), Math.abs(a.rgba[p + 2] - b.rgba[p + 2])) > 2) differ++
  }
  if (differ > a.width * a.height * 0.0005) return `${differ} pixels differ`
}
