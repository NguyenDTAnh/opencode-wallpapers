import { collectionOf, type Wallpaper } from "../wallpaper"
import { WALLPAPERS } from "../../wallpapers"

// The built-in scenes, as the desktop GUI sees them. External wallpapers need node:os and a filesystem, which a
// window has no access to, so the GUI only offers these.
export const SCENES: readonly Wallpaper[] = WALLPAPERS

export function findWallpaper(id: string): Wallpaper | undefined {
  return SCENES.find((w) => w.id === id)
}

export const COLLECTIONS: readonly string[] = [...new Set(SCENES.map(collectionOf))]

export function scenesInCollection(collection: string): Wallpaper[] {
  return collection === "all" ? [...SCENES] : SCENES.filter((w) => collectionOf(w) === collection)
}
