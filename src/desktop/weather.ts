import { settingsFor, type Settings } from "../wallpaper"
import { coordinatesOf, type Forecast } from "../forecast"
import { currentCollection, due, inCollection, seasonAt, timeAt, type Stored } from "./settings"
import { findWallpaper } from "./scenes"

// Turns stored settings into what a scene renders with. The panel calls this on every change and on every minute
// tick, so the time of day, season and local weather follow the clock without restarting the scene needlessly.
export function resolveSettings(state: Stored, now: Date, local: Forecast | undefined): Settings {
  const choice = state.time ?? "auto"
  const place = state.location ?? ""
  // Seasons flip south of the equator: coordinates in the place text are known before any forecast arrives.
  const south = (coordinatesOf(place)?.latitude ?? local?.latitude ?? 0) < 0
  const setting = state.season ?? "auto"
  const weatherSetting = state.weather ?? "off"
  const wallpaper = findWallpaper(state.wallpaper)
  const settings: Settings = {
    activity: state.activity ?? "calm",
    time: choice === "auto" ? timeAt(now) : choice,
    brightness: state.brightness,
    season: setting === "auto" ? seasonAt(now, south) : setting,
    weather: weatherSetting === "off" ? undefined : weatherSetting === "local" ? (local?.weather ?? "clear") : weatherSetting,
  }
  // A wallpaper with one look ignores time, season and weather.
  return wallpaper ? settingsFor(wallpaper, settings) : settings
}

// Shuffle stays within the chosen collection, and keeps the wallpaper when it is the collection's only one.
export function nextShuffle(state: Stored): string | undefined {
  if ((state.shuffle ?? "off") !== "hourly") return undefined
  if (!state.wallpaper) return undefined
  if (!due(state)) return undefined
  const members = inCollection(state).filter((w) => w.id !== state.wallpaper)
  if (!members.length) return undefined
  return members[Math.floor(Math.random() * members.length)].id
}

// The collection menu offers "all" plus every named collection, which the panel shows as-is.
export function collectionName(state: Stored): string {
  return currentCollection(state)
}
