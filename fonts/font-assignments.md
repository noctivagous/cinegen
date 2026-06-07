# CineGen Font Assignments

| Font | Role | CSS Token | Selector(s) |
|------|------|-----------|-------------|
| **Space Grotesk** | Titlebars / panel headers | `--font-titlebar` | `.panel-header` |
| **Inter** | Body / panels / modals / tree | `--font-body` | `body`, `.tree-item` (inherited) |
| **Source Sans 3** | Screenplay / script text | `--font-screenplay` | `.script-editor`, `.cm-content` |
| **Saira** | Button / control text | `--font-btn` | `.toolbar-btn`, `.sidebar-view-btn` |
| **Fira Sans** | (unused — removed) | — | — |
| **Gidole** | Available (DIN substitute) | — | — |
| **JetBrains Mono** | Monospace / technical | `--font-mono` | console, technical displays |

## Size Multipliers

| Element | Base Token | Multiplier | Result |
|---------|-----------|------------|--------|
| Button text | `var(--text-11px)` | 1.2× | `calc(var(--text-11px) * 1.2)` |
| Titlebar title | `var(--text-11px)` (inherited) | 1.2× | `calc(var(--text-11px) * 1.2)` |
