import type { Ui } from "@opencode/plugin/gui"
import { For } from "solid-js"
import { apply, type Stored } from "../desktop/settings"
import { rowsFor } from "../desktop/rows"

export function Controls(props: { readonly ui: Ui; readonly state: Stored; readonly onChange: (next: Stored) => void }) {
  const rows = () => rowsFor(props.state, new Date())
  return (
    <div>
      <For each={rows()}>{(row) => (
        <div class="wallpapers-setting">
          <div class="wallpapers-row">
            <div>
              <div class="wallpapers-row-label">{row.title}</div>
              <div class="wallpapers-setting-description">{row.describe(row.value)}</div>
            </div>
            <props.ui.Menu
              trigger="button"
              label={row.label(row.value)}
              items={row.values.map((value) => ({
                label: row.label(value),
                onSelect: () => props.onChange(apply(props.state, value).state),
              }))}
            />
          </div>
        </div>
      )}</For>
    </div>
  )
}
