import { ACTIVITIES, BRIGHTNESSES, POWERS, SEASONS, SHUFFLES, TIMES, WEATHER_SETTINGS, current, currentCollection, inCollection, seasonAt, timeAt, type Stored } from "./settings"
import { COLLECTIONS, findWallpaper } from "./scenes"
import { coordinatesOf } from "../forecast"

// One settings row in the panel. `values` are the exact strings apply() takes, so no per-row mapping table exists.
export interface Row {
  readonly title: string
  readonly values: readonly string[]
  readonly value: string
  readonly label: (value: string) => string
  readonly describe: (value: string) => string
}

const capitalize = (text: string) => text[0].toUpperCase() + text.slice(1)

// The rows the panel shows, in the TUI's order. A wallpaper with a single look hides time, season and weather, since
// changing them would do nothing.
export function rowsFor(state: Stored, now: Date): Row[] {
  const fixed = Boolean(findWallpaper(current(state))?.fixedTime)
  const south = (coordinatesOf(state.location ?? "")?.latitude ?? 0) < 0
  const shown = findWallpaper(current(state))
  const rows: Row[] = [
    {
      title: "Collection",
      values: ["collection all", ...COLLECTIONS.map((c) => `collection ${c}`)],
      value: `collection ${currentCollection(state)}`,
      label: (v) => (v === "collection all" ? "All" : v.slice("collection ".length)),
      describe: (v) =>
        v === "collection all"
          ? "Every wallpaper"
          : inCollection({ ...state, collections: { "": v.slice("collection ".length) } })
              .map((w) => w.name)
              .join(", "),
    },
    {
      title: "Wallpaper",
      values: ["off", ...inCollection(state).map((w) => w.id)],
      value: current(state) || "off",
      label: (v) => findWallpaper(v)?.name ?? "Off",
      describe: (v) => findWallpaper(v)?.description ?? "No wallpaper",
    },
    {
      title: "Activity",
      values: ACTIVITIES,
      value: state.activity ?? "calm",
      label: capitalize,
      describe: (v) => (shown ?? findWallpaper("beach")!).activity[v as "calm" | "lively" | "teeming"],
    },
    {
      title: "Time of day",
      values: ["auto", ...TIMES],
      value: state.time ?? "auto",
      label: (v) => (v === "auto" ? `Auto (${capitalize(timeAt(now))})` : capitalize(v)),
      describe: (v) => (v === "auto" ? "Follows your clock: day from 7am, sunset from 6pm, night from 8pm" : `Always ${v}`),
    },
    {
      title: "Season",
      values: ["season auto", ...SEASONS.map((s) => `season ${s}`)],
      value: `season ${state.season ?? "auto"}`,
      label: (v) => (v === "season auto" ? `Auto (${capitalize(seasonAt(now, south))})` : capitalize(v.slice("season ".length))),
      describe: (v) => (v === "season auto" ? `Follows the calendar in the ${south ? "southern" : "northern"} hemisphere` : `Always ${v.slice("season ".length)}`),
    },
    {
      title: "Weather",
      values: WEATHER_SETTINGS.map((w) => `weather ${w}`),
      value: `weather ${state.weather ?? "off"}`,
      label: (v) => (v === "weather local" ? "Local" : capitalize(v.slice("weather ".length))),
      describe: (v) => {
        if (v === "weather off") return "Each wallpaper's own weather"
        if (v !== "weather local") return `Always ${v.slice("weather ".length)} on outdoor wallpapers`
        return state.location ? `Real weather for ${state.location}, checked every 30 minutes` : "Set a place first: /wallpaper location <city or lat,lon>"
      },
    },
    {
      title: "Brightness",
      values: BRIGHTNESSES,
      value: state.brightness ?? "normal",
      label: capitalize,
      describe: (v) =>
        ({ subtle: "A dim scene that stays out of the way", normal: "The standard look", vivid: "A brighter scene" })[v as (typeof BRIGHTNESSES)[number]],
    },
    {
      title: "Shuffle",
      values: SHUFFLES,
      value: state.shuffle ?? "off",
      label: (v) => ({ off: "Off", hourly: "Every hour" })[v as (typeof SHUFFLES)[number]],
      describe: (v) => (v === "hourly" ? "Switch to a different wallpaper every hour" : "Keep the wallpaper you chose"),
    },
  ]
  return fixed ? rows.filter((r) => r.title !== "Time of day" && r.title !== "Season" && r.title !== "Weather") : rows
}

// Re-exported for the controls, so they do not import the settings module for one word.
export { POWERS }
