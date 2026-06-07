# CineGen Font System

## Overview

Seven self-hosted open-source font families bundled in `fonts/` — no external font services. All fonts are OFL-licensed.

| Font | Role | Style | Weight Range |
|------|------|-------|-------------|
| **Space Grotesk** | Titlebars / panel headers | Geometric, DIN-like | 400–700 (variable) |
| **Inter** | Body / panels / modals | Humanist sans | 400–700 + italics |
| **Source Sans 3** | Screenplay / script text | Adobe's UI sans | 400–700 (variable) |
| **Saira** | Button / control text | Condensed, bold-friendly | 400–900 (variable) |
| **Fira Sans** | Project hierarchy tree | Mozilla's humanist sans | 400–700 |
| **Gidole** | Available (DIN substitute) | DIN-style geometric | 400 only |
| **JetBrains Mono** | Monospace / technical | Developer monospace | 400–700 + italics |

## Font Selection Rationale

### Space Grotesk — Titlebars

- **Purpose**: Panel headers (`.panel-header`), section titles
- **Why**: Geometric sans with a technical/instrument feel — like DIN but more refined. The variable weight axis allows fine-tuning header prominence. Used in professional creative tools for its clean, industrial character
- **CSS token**: `--font-titlebar`

### Inter — Body Text

- **Purpose**: Panel content, modal dialogs, preference sheets, status bar, scene list headers — any text longer than a few words
- **Why**: Designed specifically for UI legibility at small sizes. Calibrated x-height, generous apertures, and optical corrections. Used in VS Code, GitHub, Figma
- **CSS token**: `--font-body`

### Source Sans 3 — Screenplay

- **Purpose**: Script editor (`.script-editor`, CodeMirror `.cm-content`), screenplay/fountain text
- **Why**: Adobe's open-source sans designed for screen readability. Clean, professional, and highly legible for extended script reading. Replaces Courier New for the screenplay view
- **CSS token**: `--font-screenplay`

### Saira — Button Text

- **Purpose**: Toolbar buttons (`.toolbar-btn`), sidebar view buttons (`.sidebar-view-btn`), any control
- **Why**: Saira is a condensed semi-geometric sans with strong bolder weights — ideal for constrained button widths where you need clear, punchy labels. Variable weight axis up to 900 for maximum emphasis
- **CSS token**: `--font-btn`

### Fira Sans — Hierarchy Tree

- **Purpose**: Project hierarchy tree items (`.tree-item`)
- **Why**: Mozilla's UI typeface with excellent readability at small sizes. The open apertures and generous spacing make nested tree labels easier to scan at a glance
- **CSS token**: `--font-tree`

### JetBrains Mono — Monospace

- **Purpose**: Console/terminal, technical data displays, hex/color values
- **Why**: Purpose-built for developer tools with increased x-height, distinguishable character shapes, and coding ligatures
- **CSS token**: `--font-mono`

## CSS Token Definitions

Defined in `css/CineGenBaseGUI-tokens.css`:

```css
--font-titlebar: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
--font-body: 'Inter', 'Segoe UI', 'Lucida Grande', sans-serif;
--font-scene-list: 'Inter', 'Segoe UI', 'Lucida Grande', sans-serif;
--font-screenplay: 'Source Sans 3', 'Courier New', Courier, monospace;
--font-btn: 'Saira', 'Inter', 'Segoe UI', sans-serif;
--font-tree: 'Fira Sans', 'Inter', 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', 'Courier New', Courier, monospace;
```

## Where Each Font Is Applied

| CSS rule | Token | Font |
|----------|-------|------|
| `body` | `--font-body` | Inter |
| `.panel-header` | `--font-titlebar` | Space Grotesk |
| `.toolbar-btn` | `--font-btn` | Saira |
| `.sidebar-view-btn` | `--font-btn` | Saira |
| `.tree-item` | `--font-tree` | Fira Sans |
| `.script-editor` | `--font-screenplay` | Source Sans 3 |
| `.cm-content` (CodeMirror) | `--font-screenplay` | Source Sans 3 |

## Adding a Font

1. Create a subdirectory under `fonts/` (e.g., `fonts/your-font/`)
2. Add WOFF2 files (preferred) or TTF/OTF
3. Add `@font-face` declarations in `fonts/fonts.css`
4. Add a CSS custom property in `css/CineGenBaseGUI-tokens.css` referencing the new family name
5. Apply the token to the relevant selectors

## File Structure

```
fonts/
├── fonts.css                       # All @font-face declarations
├── space-grotesk/
│   └── SpaceGrotesk[wght].woff2     # Variable font
├── source-sans-3/
│   ├── SourceSans3[wght].woff2      # Variable font
│   └── SourceSans3-Italic[wght].woff2
├── saira/
│   └── Saira[wght].woff2            # Variable font
├── fira-sans/
│   ├── FiraSans-Regular.woff2
│   ├── FiraSans-Italic.woff2
│   ├── FiraSans-Medium.woff2
│   ├── FiraSans-SemiBold.woff2
│   └── FiraSans-Bold.woff2
├── gidole/
│   ├── Gidole-Regular.ttf
│   └── Gidolinya-Regular.otf
├── inter/
│   ├── Inter-Regular.woff2
│   ├── Inter-Italic.woff2
│   ├── Inter-Medium.woff2
│   ├── Inter-MediumItalic.woff2
│   ├── Inter-SemiBold.woff2
│   ├── Inter-SemiBoldItalic.woff2
│   ├── Inter-Bold.woff2
│   └── Inter-BoldItalic.woff2
├── jetbrains-mono/
│   ├── JetBrainsMono-Regular.woff2
│   ├── JetBrainsMono-Italic.woff2
│   ├── JetBrainsMono-Medium.woff2
│   ├── JetBrainsMono-Bold.woff2
│   └── JetBrainsMono-BoldItalic.woff2
├── INTER-LICENSE.txt
└── ... (all fonts are OFL)
```

## Performance Notes

- Variable fonts (Space Grotesk, Source Sans 3, Saira) are single-file — ~90–150 KB each for the entire weight range
- Inter: 8 WOFF2 files (~1.1 MB total)
- JetBrains Mono: 5 WOFF2 files (~465 KB total)
- Fira Sans: 5 WOFF2 files (~400 KB total)
- Gidole: TTF only (140 KB) — consider converting to WOFF2
- `font-display: swap` on all faces prevents invisible text during load
- Fonts loaded via `<link rel="stylesheet" href="fonts/fonts.css">` in `index.html`
