// Injected into the desktop app's window while the plugin is active. Class names are prefixed so they cannot collide
// with the app's own styles.
export const css = `
/* The settings, rendered into one of the app's dialogs. It paints its own surface, so it reads the same way over a
   moving scene as any other dialog. */
.wallpapers-dialog {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 22rem;
  max-width: 30rem;
  padding: 0.25rem 0;
}

.wallpapers-dialog-title {
  margin-bottom: 0.5rem;
  color: var(--v2-text-text-base, #e6e9ee);
  font-size: 0.9375rem;
  font-weight: 550;
}

.wallpapers-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.125rem 0;
}

.wallpapers-row-label {
  color: var(--v2-text-text-base, #b9bfc9);
  font-size: 0.8125rem;
}

.wallpapers-row select {
  min-width: 10rem;
  max-width: 14rem;
  padding: 0.1875rem 0.375rem;
  border: 1px solid var(--v2-border-border-base, #31353d);
  border-radius: 0.25rem;
  background: var(--v2-background-bg-layer-02, #242830);
  color: var(--v2-text-text-base, #e6e9ee);
  font-size: 0.8125rem;
}

.wallpapers-describe {
  margin-top: 0.5rem;
  min-height: 2.25rem;
  color: var(--v2-text-text-muted, #767c87);
  font-size: 0.75rem;
  line-height: 1.5;
}

.wallpapers-dialog-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

.wallpapers-dialog-actions button {
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--v2-border-border-base, #31353d);
  border-radius: 0.25rem;
  background: var(--v2-background-bg-layer-02, #242830);
  color: var(--v2-text-text-base, #e6e9ee);
  font-size: 0.8125rem;
  cursor: pointer;
}

.wallpapers-dialog-actions button:hover {
  background: var(--v2-background-bg-layer-03, #2e3238);
}
`
