import { Schema } from "effect"
import { ACTIVITIES, BRIGHTNESSES, POWERS, SEASONS, TIMES, WEATHERS, collectionOf, type Activity, type Brightness, type Power, type Season, type Time, type Weather } from "../wallpaper"
import { COLLECTIONS, SCENES, findWallpaper, scenesInCollection } from "./scenes"

// Re-exported so the GUI imports one module for its settings vocabulary.
export { ACTIVITIES, BRIGHTNESSES, POWERS, SEASONS, TIMES, WEATHERS }

export const WEATHER_SETTINGS = ["off", "local", ...WEATHERS] as const
export type WeatherSetting = (typeof WEATHER_SETTINGS)[number]

export const SHUFFLES = ["off", "hourly"] as const
export type Shuffle = (typeof SHUFFLES)[number]

// Where the wallpaper is painted: behind the whole window, or inside the plugin's own panel.
export const BACKDROPS = ["window", "panel"] as const
export type BackdropMode = (typeof BACKDROPS)[number]

// The desktop GUI keeps one settings object for the app: a panel is a view, not a per-project surface, so the TUI's
// per-project map and its "new wallpaper each launch" shuffle mode have no meaning here.
export interface Stored {
  wallpaper: string
  activity?: Activity
  time?: Time | "auto"
  brightness?: Brightness
  power?: Power
  season?: Season | "auto"
  weather?: WeatherSetting
  // A place for local weather: a name or "latitude,longitude".
  location?: string
  shuffle?: Shuffle
  // The collection the menu and shuffle pick from, by scope; missing is all.
  collections?: Record<string, string>
  // When the wallpaper last changed, by scope, for hourly shuffle.
  changed?: Record<string, number>
  // Where the wallpaper is painted. Defaults to the window.
  backdrop?: BackdropMode
}

export const INITIAL: Stored = { wallpaper: "", backdrop: "window" }

export const StoredSchema = Schema.Struct({
  wallpaper: Schema.String,
  activity: Schema.optional(Schema.Literals(ACTIVITIES)),
  time: Schema.optional(Schema.Union([Schema.Literal("auto"), Schema.Literals(TIMES)])),
  brightness: Schema.optional(Schema.Literals(BRIGHTNESSES)),
  power: Schema.optional(Schema.Literals(POWERS)),
  season: Schema.optional(Schema.Union([Schema.Literal("auto"), Schema.Literals(SEASONS)])),
  weather: Schema.optional(Schema.Literals(WEATHER_SETTINGS)),
  location: Schema.optional(Schema.String),
  shuffle: Schema.optional(Schema.Literals(SHUFFLES)),
  collections: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  changed: Schema.optional(Schema.Record(Schema.String, Schema.Number)),
  backdrop: Schema.optional(Schema.Literals(BACKDROPS)),
})

export function current(state: Stored): string {
  return state.wallpaper
}

export function currentCollection(state: Stored): string {
  return state.collections?.[""] ?? "all"
}

// A change that happened far enough back to shuffle. One scope: the app, keyed by "". Before any change there is no
// hour to measure from, so nothing is due.
export function due(state: Stored): boolean {
  const at = state.changed?.[""]
  return at !== undefined && Date.now() - at >= HOUR
}

// Wallpapers in the chosen collection, in menu order.
export function inCollection(state: Stored) {
  return scenesInCollection(currentCollection(state))
}

// Applies one /wallpaper argument and says what changed. Pure: the caller owns persistence, which keeps this testable
// without the plugin SDK.
export function apply(state: Stored, raw: string): { state: Stored; message: string; error?: true } {
  // Row values and slash arguments carry the display name ("collection Classics"); matching is case-insensitive so both
  // the menu and a typed "/wallpaper collection classics" work.
  const arg = raw.trim().toLowerCase()
  if (arg === "off") return { state: choose(state, ""), message: "Wallpaper off" }
  // Where the wallpaper is painted is a separate question from which wallpaper and from whether one is chosen, so this
  // branch leaves both alone.
  const backdrop = BACKDROPS.find((value) => value === arg)
  if (backdrop) return { state: { ...state, backdrop }, message: backdrop === "window" ? "Wallpaper behind the window" : "Wallpaper in the panel" }
  if (arg.startsWith("collection ")) {
    const name = arg.slice("collection ".length).trim()
    const chosen = name === "all" ? "all" : COLLECTIONS.find((c) => c.toLowerCase() === name)
    if (!chosen) return { state, message: `No collection "${name}". Available: all, ${COLLECTIONS.map((c) => c.toLowerCase()).join(", ")}`, error: true }
    const members = chosen === "all" ? [...SCENES] : SCENES.filter((w) => collectionOf(w) === chosen)
    const next = { ...state, collections: { ...state.collections, "": chosen } }
    // A wallpaper outside the new collection would leave the scene on something the menu no longer offers.
    const kept = members.some((w) => w.id === state.wallpaper) ? state.wallpaper : (members[0]?.id ?? "")
    return { state: kept === state.wallpaper ? next : choose(next, kept), message: chosen === "all" ? "Wallpapers from every collection" : `Wallpaper collection: ${chosen}` }
  }
  const level = ACTIVITIES.find((a) => a === arg)
  if (level) return { state: { ...state, activity: level }, message: `Wallpaper activity: ${level}` }
  if (arg === "location" || arg.startsWith("location ")) {
    const place = arg.slice("location".length).trim()
    return { state: { ...state, location: place }, message: place ? `Wallpaper location: ${place}` : "Wallpaper location cleared" }
  }
  const season = SEASONS.find((value) => value === arg || `season ${value}` === arg)
  if (season || arg === "season auto") {
    const value = season ?? "auto"
    return { state: { ...state, season: value }, message: season ? `Wallpaper season: ${season}` : "Wallpaper season follows the calendar" }
  }
  const weather = WEATHER_SETTINGS.find((value) => (value === arg && value !== "off") || `weather ${value}` === arg)
  if (weather) {
    const next = { ...state, weather }
    if (weather === "local" && !state.location) return { state: next, message: "Local weather needs a place: /wallpaper location <city or lat,lon>. Showing clear until then", error: true }
    return { state: next, message: weather === "off" ? "Wallpaper weather: the wallpaper's own" : `Wallpaper weather: ${weather}` }
  }
  const time = TIMES.find((value) => value === arg)
  if (time || arg === "auto") {
    const value = time ?? "auto"
    return { state: { ...state, time: value }, message: time ? `Wallpaper time: ${time}` : "Wallpaper time follows your clock" }
  }
  const mode = POWERS.find((p) => p === arg)
  if (mode) return { state: { ...state, power: mode }, message: `Wallpaper power: ${mode}` }
  const brightness = BRIGHTNESSES.find((value) => value === arg)
  if (brightness) return { state: { ...state, brightness }, message: `Wallpaper brightness: ${brightness}` }
  const wallpaper = findWallpaper(arg)
  if (!wallpaper) return { state, message: `No wallpaper "${arg}". Available: ${SCENES.map((w) => w.id).join(", ")}`, error: true }
  // A wallpaper from outside the chosen collection switches to its collection.
  const next = inCollection(state).some((w) => w.id === arg) ? state : { ...state, collections: { ...state.collections, "": collectionOf(wallpaper) } }
  return { state: choose(next, arg), message: `${wallpaper.name} wallpaper on` }
}

// Records the pick together with when it changed, which hourly shuffle measures against.
function choose(state: Stored, id: string): Stored {
  return { ...state, wallpaper: id, changed: { ...state.changed, "": Date.now() } }
}

const HOUR = 3_600_000

// Meteorological seasons: spring from March in the north, from September in the south.
export function seasonAt(date: Date, south: boolean): Season {
  return SEASONS[(Math.floor(((date.getMonth() + 10) % 12) / 3) + (south ? 2 : 0)) % 4]
}

// Day from 7am, sunset around dawn and dusk, night from 8pm.
export function timeAt(date: Date): Time {
  const hour = date.getHours() + date.getMinutes() / 60
  if (hour >= 20 || hour < 6) return "night"
  if (hour < 7 || hour >= 18) return "sunset"
  return "day"
}
