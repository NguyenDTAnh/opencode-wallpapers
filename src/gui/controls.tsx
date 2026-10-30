import { For, createSignal } from "solid-js"
import { apply, type Stored } from "../desktop/settings"
import { rowsFor } from "../desktop/rows"

// The wallpaper settings, rendered into a dialog: one row per setting, and a line explaining the value under the
// pointer. Every value is an argument apply() takes, so changing one is one call.
export function Controls(props: {
  readonly state: Stored
  readonly onChange: (next: Stored) => void
  readonly onDone: () => void
}) {
  const rows = () => rowsFor(props.state, new Date())
  // The row whose description is showing. It follows the pointer and the focus, and falls back to the first row.
  const [focused, setFocused] = createSignal(0)
  const described = () => {
    const list = rows()
    return list[Math.min(focused(), list.length - 1)] ?? list[0]
  }

  return (
    <div class="wallpapers-dialog">
      <div class="wallpapers-dialog-title">Wallpaper</div>
      <For each={rows()}>
        {(row, index) => (
          <label class="wallpapers-row" onMouseEnter={() => setFocused(index())} onFocus={() => setFocused(index())}>
            <span class="wallpapers-row-label">{row.title}</span>
            <select value={row.value} onChange={(event) => props.onChange(apply(props.state, event.currentTarget.value).state)}>
              <For each={row.values}>{(value) => <option value={value}>{row.label(value)}</option>}</For>
            </select>
          </label>
        )}
      </For>
      <div class="wallpapers-describe">{described()?.describe(described()!.value)}</div>
      <div class="wallpapers-dialog-actions">
        <button type="button" onClick={props.onDone}>Done</button>
      </div>
    </div>
  )
}
