// The README's images live on the orphan assets branch, so installing the plugin doesn't download them. The dev tools
// read and write them in screenshots/, a worktree of that branch, created here on first use.
import { existsSync } from "node:fs"

export function assets() {
  if (existsSync("screenshots/.git")) return
  if (existsSync("screenshots")) throw new Error("screenshots/ isn't a checkout of the assets branch: move it away and rerun")
  if (Bun.spawnSync(["git", "rev-parse", "--verify", "--quiet", "refs/heads/assets"]).exitCode) git("fetch", "--depth=1", "origin", "assets:assets")
  git("worktree", "add", "screenshots", "assets")
}

function git(...args: string[]) {
  if (Bun.spawnSync(["git", ...args], { stdout: "ignore", stderr: "inherit" }).exitCode) throw new Error(`git ${args.join(" ")} failed`)
}
