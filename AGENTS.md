# CineGen — Agent Instructions

## TL;DR

This is a **Lit + TypeScript + Vite** filmmaking web app with a Node proxy backend. Mixed architecture: modern Lit stores/services alongside legacy `window.*` bridge modules being incrementally retired.

## Commands

| Command | What it does |
|---------|-------------|
| `npm run dev` | Vite dev server (predev auto-runs `setup:key-files`) |
| `npm run build` | `lint:legacy-globals` -> `tsc --noEmit` -> `vite build` |
| `npm run lint:legacy-globals` | Two custom lint scripts (globals + custom events) |
| `npm run validate:cine` | Validate `.cine` package filesystem integrity |
| `npm start` | Prod static server on `dist/` — requires `build` first |

**Always run `npm run build` before committing.** It replaces a missing test suite as the gate.

## Architecture

- **Entry**: `index.html` -> `src/main.ts` -> early layout init -> `app-bootstrap.ts` (orchestrates ~15 init modules sequentially)
- **Framework**: Lit 3 + `@lit/context` + `@lit/task`. `useDefineForClassFields: false` + `experimentalDecorators: true` in tsconfig.
- **Proxy**: `server/proxy.js` (~1500 lines, monolithic) handles AI provider passthrough, key/routing/settings APIs, project CRUD, agent dispatch, and state WebSocket. `server/index.mjs` is the production static server wrapping the same handler.
- **Backends proxy**: `backends/` has standalone scripts for .env-only key injection (not the main path — the dev server proxy in `vite.config.ts` is the primary proxy).
- **Projects**: `.cine` package — directory of domain-specific JSON files (`cine.manifest.json` at root). Bundled samples via `import.meta.glob`. Writable projects in `server/projects/`. Autosave uses dirty-doc tracking + atomic staging writes.
- **Agents**: Mastra-based. 12 agent routes registered. Agent API exposed as `window.CineGen.agents` (loaded async in bootstrap). Health-check gated; local fallbacks when agents are not configured.

## SSOT modules (add to these before creating alternatives)

- `src/constants/provider-registry.js` — provider metadata (id, slot, base URL, env key, proxy target)
- `src/constants/agent-routes.js` — agent route definitions
- `src/constants/storage-keys.ts` — all persistence keys
- `src/services/routing-modalities.ts` — modality constants and API scope mapping

## Conventions

- **No new `window.*` globals** — except in the allowlisted bridge files (`boot/app-bootstrap.ts`, `services/status-bar-service.ts`, `services/preferences.ts`, `workspace/workspace-bundle.ts`, `workspace/treatment-form-service.ts`, `components/panels/cinegen-treatment-panel.ts`). Enforced by `scripts/check-window-cinegen-writes.mjs`.
- **No raw custom-event string literals** outside the allowlist in `scripts/check-raw-custom-event-strings.mjs`. Use exported event constants from `events/shell-events.ts` instead.
- **Lit class fields pattern**: always `useDefineForClassFields: false` with `@property()` / `@state()` decorators. Do not use class field initializers for reactive properties.
- **`@/` path alias** maps to `src/`.
- **`.cine` doc types** are canonical in `src/data/project-data.ts`. Add new doc types there, not as ad-hoc files.
- **Keys go through server-backed API endpoints** (`POST /api/settings/keys`), not frontend localStorage.

## GUI styleguide

Static control reference (not bundled by Vite). Open in a browser while `npm run dev` is running, or serve `source/` locally.

| File | Purpose |
|------|---------|
| `styleguide/CineGenBaseGUI-Controls-Styleguide.html` | Master–detail sheet for buttons, inputs, panels, and chrome |
| `styleguide/CineGenBaseGUI-button-shapes.css` | Button shape modifiers (pill, square, icon-only, etc.) |
| `styleguide/CineGenBaseGUI-button-surfaces.css` | Button finish/relief variants (matte/reflective, protruded/inset) |

Production CSS lives in `css/` (`CineGenBaseGUI.css`, `CineGenBaseGUI-tokens.css`, `CineGenBaseGUI-button-surfaces.css`, `CineGenBaseGUI-controls-extra.css`). The styleguide HTML links both the local `styleguide/` button sheets and the shared `css/` bundle.

**URL (dev):** `http://localhost:5173/styleguide/CineGenBaseGUI-Controls-Styleguide.html`

## Key structural gotchas

- **Two separate key stores**: `server/keys.json` (UI-entered, used by proxy) and `backends/.env` (used by Mastra agents). Not yet unified.
- **Build output**: `dist/` is gitignored but present for deployment. Always rebuild before `npm start`.
- **Vite config** (`vite.config.ts`) includes a custom `cinegen-proxy` plugin for dev server — this is how the proxy works during development, not the `backends/` scripts.
- **`server/routing.json`, `keys.json`, `settings.json`, `app-state.json`** are runtime-created and gitignored.
- **No test framework** is installed. Validation relies on `npm run build` and `npm run validate:cine`.
- **Monolithic bundles being decomposed**: `workspace-bundle.ts` (~1340 lines, `@ts-nocheck`), `storyboard-bundle.ts` (~1510 lines), `status-bar-service.ts` (~1208 lines), `proxy.js` (~1500 lines), `toolbar-modals-service.ts` (~3143 lines), `setup-assistant-bundle.ts` (~2509 lines).
