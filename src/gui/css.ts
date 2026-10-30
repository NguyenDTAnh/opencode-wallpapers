export const css = `
.wallpapers-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 1rem;
  min-height: 1.875rem;
}
.wallpapers-setting {
  padding: 12px 0;
  border-bottom: 1px solid var(--v2-border-border-base, #31353d);
}
.wallpapers-setting-description {
  margin-top: 4px;
  color: var(--v2-text-text-muted, #999);
  font-size: 12px;
  line-height: 1.5;
}

.wallpapers-row-label {
  color: var(--v2-text-text-base, #c9ced6);
  font-size: 0.8125rem;
  line-height: 1.4;
}
`
