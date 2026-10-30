import { Plugin, Store } from "@opencode/plugin/gui"
import { INITIAL, StoredSchema } from "../desktop/settings"

// Declared apart from the setups, so each setup can be typed from it (Plugin.Setup<typeof definition>) without the
// component and the definition importing each other.
export const definition = Plugin.define({
  stores: { prefs: Store.global(StoredSchema, INITIAL) },
  i18n: {
    en: {
      title: "Wallpaper",
      choose: "Choose wallpaper",
      open: "Open the wallpaper panel",
      activity: "Cycle wallpaper activity",
      time: "Cycle wallpaper time of day",
      external: "External wallpapers are not loaded in the desktop app; using the built-in ones",
      fallback: "The window backdrop could not be painted, so the wallpaper is showing in the panel",
    },
  },
})
