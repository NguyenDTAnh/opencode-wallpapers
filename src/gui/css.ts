// Injected into the desktop app's window while the plugin is active. Class names are prefixed so they cannot collide
// with the app's own styles.
export const css = `
.wallpapers-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--color-background-100, #16181d);
}

.wallpapers-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  image-rendering: auto;
}

.wallpapers-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  text-align: center;
  color: var(--color-text-300, #8b909a);
  font-size: 0.875rem;
  line-height: 1.5;
}

.wallpapers-bottom {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: auto;
  min-height: 0;
}

.wallpapers-settings {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin: 0 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  background: color-mix(in srgb, var(--color-background-200, #1d2026) 88%, transparent);
  backdrop-filter: blur(6px);
  box-shadow: 0 1px 2px rgb(0 0 0 / 40%);
}

.wallpapers-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 0.75rem;
}

.wallpapers-row-label {
  color: var(--color-text-200, #b9bfc9);
  font-size: 0.8125rem;
}

.wallpapers-row select {
  min-width: 8rem;
  max-width: 11rem;
  padding: 0.125rem 0.25rem;
  border: 1px solid var(--color-border-200, #31353d);
  border-radius: 0.25rem;
  background: var(--color-background-300, #242830);
  color: var(--color-text-100, #e6e9ee);
  font-size: 0.8125rem;
}

.wallpapers-describe {
  margin-top: 0.25rem;
  color: var(--color-text-400, #767c87);
  font-size: 0.75rem;
  line-height: 1.4;
}

.wallpapers-bar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.5rem;
  padding: 0.375rem 0.625rem;
  border-radius: 0.375rem;
  background: color-mix(in srgb, var(--color-background-200, #1d2026) 88%, transparent);
  backdrop-filter: blur(6px);
  color: var(--color-text-200, #b9bfc9);
  font-size: 0.8125rem;
}

.wallpapers-bar-name {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wallpapers-bar button {
  padding: 0.125rem 0.5rem;
  border: 1px solid var(--color-border-200, #31353d);
  border-radius: 0.25rem;
  background: var(--color-background-300, #242830);
  color: var(--color-text-100, #e6e9ee);
  font-size: 0.75rem;
  cursor: pointer;
}

.wallpapers-bar button:hover {
  border-color: var(--color-border-300, #44494f);
}
`
