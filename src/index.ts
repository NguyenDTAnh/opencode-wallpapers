import { Plugin } from "@opencode/plugin"

// The server part exists to give the plugin its id: the GUI takes the id from here, so the panel key stays
// `wallpapers:scene` and the store key stays `plugin.wallpapers.prefs`, matching the TUI plugin. It contributes no
// tools, hooks or commands of its own.
export default Plugin.define({
  id: "wallpapers",
  setup() {},
})
