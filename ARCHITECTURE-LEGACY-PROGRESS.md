# Cinegen Architecture Progressive Fix Tracker

Last verified: 2026-06-04
Source baseline: `planning/architecture-audit-report-2026-05-25.md`

This is a living reference for incremental cleanup until legacy bundles and global bridges are removed.

---

## Status legend

- `VERIFIED` = still accurate as written
- `UPDATED` = audit finding was true, but partially/fully improved since that report
- `OPEN` = confirmed issue still active and queued

---

## Verified Baseline

### Architecture shape

- `VERIFIED` Mixed architecture remains: modern Lit/store/services + legacy `window.*` bridge modules.
- `UPDATED` Script wizard state/slides extracted to `wizard/` modules (`script-wizard-state.ts`, `script-wizard-bundle.ts`). Visual/concept/asset/storyboard wizard slide templates extracted to `wizard-slides-*.ts` modules (5900+ lines across 4 modules). Toolkit modal service is now 664 lines with minimal orchestration.
- `VERIFIED` `source/server/proxy.js` remains monolithic and owns multiple concerns (proxy, key/routing/settings APIs, agents routing).
- `VERIFIED` Build still reports pre-existing circular chunk warnings involving setup assistant/workspace/modals/panels.

### Monolithic hotspots (current line counts)

- `UPDATED` `source/src/toolbar/toolbar-modals-service.ts` — 664 (+ 341 in `toolbar-blank-project-wizard.ts`, + 550 in `wizard-slides-visual.ts`, + 568 in `wizard-slides-concept.ts`, + 358 in `wizard-slides-asset.ts`, + 377 in `wizard-slides-storyboard.ts`)
- `UPDATED` `source/src/setup-assistant/setup-assistant-bundle.ts` — 2161→843 (templates → `templates.ts`, events → `events.ts`)
- `UPDATED` `source/src/storyboard/storyboard-bundle.ts` — 444 (+ 371 in `storyboard-reference-bank.ts`, + 181 in `storyboard-frame-editor.ts`, + 257 in `storyboard-context-menus.ts`, + 377 in `storyboard-frame-operations.ts`)
- `UPDATED` `source/src/workspace/workspace-bundle.ts` — 603 (decomposed: extracted overview panel + asset detail, removed `@ts-nocheck`)
- `UPDATED` `source/src/services/status-bar-service.ts` — 808 (+ 425 in `status-bar-audio.ts`)
- `UPDATED` `source/server/proxy.js` — 1749→60 (decomposed into 9 lib modules)

---

## Progress Since Original Audit

### Consolidations completed

- `UPDATED` Storage key SSOT improved in `source/src/constants/storage-keys.ts` (storyboard + section visibility + console history keys centralized).
- `UPDATED` `escHtml` duplication removed; canonical function now only in `source/src/utils/html.ts`.
- `UPDATED` Raw `cg-tree-node-select` listener replaced with constant usage in storyboard flow.
- `UPDATED` Dead file `source/src/legacy/script-order.ts` removed.
- `UPDATED` `workspace-bundle.ts` decomposed: overview panel extracted to `workspace-overview-panel.ts`, asset detail panel to `workspace-asset-detail-panel.ts`. Bundle shrank 1340→603 lines and `@ts-nocheck` removed — compiles with strict TypeScript.
- `UPDATED` `storyboard-bundle.ts` extracted `generateFrameImage` / `buildStoryboardDraftFrames` into `storyboard-generation-service.ts`; removed 6 dead functions. Bundle shrank 1633→1512 lines.
- `UPDATED` Lint guards expanded: `(window as any).* =` and `(window as unknown as …).* =` write patterns now caught; `new Event(...)` added to custom-event patterns; both scripts emit allowlisted-file audit counts.

### Provider/routing SSOT (second pass)

- `UPDATED` Shared modality SSOT introduced at `source/src/services/routing-modalities.ts`.
  - Canonical: `ROUTING_MODALITIES`, `RoutingModalityKey`, `apiScopeForModality`.
- `UPDATED` Shared OpenAI-compatible target resolver introduced at `source/src/services/ai/openai-compatible-target.ts`.
  - Used by both `provider-router` and setup assistant connection test path.
- `UPDATED` Call-sites rewired:
  - `source/src/services/ai/provider-router.ts`
  - `source/src/setup-assistant/connection-test.ts`
  - `source/src/services/provider-fetch.ts`
  - `source/src/services/provider-catalog-refresh.ts`
  - `source/src/services/provider-model-catalog.ts`
  - `source/src/settings/api-keys-settings-bundle.ts`

### Agent route SSOT

- `UPDATED` Shared agent route manifest introduced at `source/src/constants/agent-routes.js` (+ TS declarations).
- `UPDATED` `source/src/services/ai/agents-service.ts` now consumes shared route constants/helpers.
- `UPDATED` `source/server/proxy.js` now consumes shared static route constants for agent endpoint matching.

### Provider metadata SSOT

- `UPDATED` Canonical provider runtime metadata registry introduced at `source/src/constants/provider-registry.js` (+ TS declarations).
- `UPDATED` `source/server/proxy.js` now derives env-key/base-url/authHeader/slot/provider mappings from the shared registry.
- `UPDATED` `source/src/services/ai/provider-router.ts` now resolves default provider → proxy target via the shared registry.

### Setup state consistency fix

- `UPDATED` Setup auto-open gate now checks server-side routing + keys completeness before opening wizard.
  - File: `source/src/setup-assistant/setup-assistant-bundle.ts`
  - Behavior: avoids false "Welcome" slide on reload when routing and keys are already complete server-side.

---

## Re-validated Findings From Original Audit

### Single source of truth gaps

- `OPEN` Agent route definitions still duplicated between frontend agent client and proxy handler.
- `UPDATED` Provider target resolution duplication reduced (shared resolver added), but provider metadata/base URL/env mapping still split across frontend catalog + proxy + setup paths.
- `OPEN` Backend shot routing duplication risk remains (`generation-agent` vs `provider-router.tool`).
- `UPDATED` Modality constants duplication significantly reduced; one intentional divergence remains in setup assistant ordering (`sa-wizard-constants.ts`).

### Redundancy / ownership overlap

- `OPEN` Modal registration and orchestration remain spread (manager centralized, registrations/bodies distributed).
- `OPEN` Provider/routing responsibilities still span multiple services; improved, not fully unified.
- `OPEN` Legacy global bridges still used broadly in workspace/storyboard/settings flows.

### Dead/unused candidates

- `VERIFIED` `legacy/script-order.ts` is removed.
- `UPDATED` Removed unused `source/src/wizard/index.ts` barrel after integration confirmation (build verified).
- `UPDATED` Removed unused `source/src/services/ai/index.ts` barrel after integration confirmation (build verified).

---

## Progressive Fix Plan (PR-sized increments)

### Phase A — SSOT completion (near-term)

- [x] Create shared agent route manifest consumed by `agents-service` and proxy agent router.
- [x] Consolidate provider metadata registry (`providerId`, `slotId`, `defaultBaseUrl`, `proxyTarget`, `envKey`) into one canonical module + adapter.
- [x] Normalize setup assistant modality order to consume shared `ROUTING_MODALITIES` (or explicitly document why order differs).

### Phase B — Bundle decomposition

- [x] Extract script wizard from `toolbar/toolbar-modals-service.ts` into `wizard/script-wizard-*`.
- [x] Split `toolbar-modals-service` by concern (projects/modals/wizards/debug).
- [x] Split `setup-assistant/setup-assistant-bundle.ts` into state, routing tests, UI rendering, and persistence gates.

Progress note (2026-05-26):
- Completed script wizard extraction in two steps:
  - moved script-wizard state/entities helpers into `source/src/wizard/script-wizard-state.ts`
  - moved script wizard slide definitions into `source/src/wizard/script-wizard-bundle.ts`, with `toolbar-modals-service.ts` now wiring dependencies into that module
- Began concern-based split of `toolbar-modals-service.ts` by extracting debug/settings reset behavior into `source/src/toolbar/toolbar-debug-service.ts` and re-exporting existing debug APIs from `toolbar-modals-service.ts` for compatibility.
- Continued concern-based split by extracting project/settings modal workflows into `source/src/toolbar/toolbar-project-modals-service.ts` (projects list wiring/open, project settings form save/open, active project name sync), with compatibility re-exports kept in `toolbar-modals-service.ts`.
- Extracted remaining wizard-generic navigation/dismissal glue into `source/src/toolbar/toolbar-wizard-modals-service.ts` (slide stepping/rendering, wizard modal open/close helpers, wizard action dispatch, project-action + wizard prev/next wiring), completing the toolbar concern split with compatibility wrappers maintained in `toolbar-modals-service.ts`.
- Began `setup-assistant/setup-assistant-bundle.ts` decomposition by extracting setup-complete + progress persistence gates into `source/src/setup-assistant/setup-assistant-persistence.ts` and rewiring the bundle to call this module (server-state inference, setup complete flag, progress save/load/apply/clear).
- Extracted setup-assistant state/model utilities into `source/src/setup-assistant/setup-assistant-state.ts` (default wizard state, vendor-slot normalization, vendor lookup/key checks, modality coverage/required-model checks) and rewired bundle wrappers to this module.
- Extracted setup-assistant routing test orchestration into `source/src/setup-assistant/setup-assistant-routing-tests.ts` (single-modality and vendor-wide connection tests, status updates, model-list persistence hooks), wired via `_saRoutingTestDeps()` in bundle.
- Extracted setup-assistant UI rendering shell into `source/src/setup-assistant/setup-assistant-render.ts` (`renderSetupStep`, rail/body/footer rendering) while preserving existing step templates and event behavior in bundle.
- Reduced setup-assistant bundle indirection by removing pass-through helper wrappers in `source/src/setup-assistant/setup-assistant-bundle.ts` and calling extracted module APIs directly (state, persistence, and connection-test helpers).
- Phase B decomposition goals are complete for state/slide extraction; rendering templates remain inline in `toolbar-modals-service.ts` and would be a follow-up extraction pass (completed in Phase D pass 2 — templates extracted to `wizard-slides-*.ts` modules).

Progress note (2026-06-04):
- Phase D workspace-bundle decomposition: extracted overview panel (~542 lines) into `workspace-overview-panel.ts`, asset detail panel (~247 lines) into `workspace-asset-detail-panel.ts`. Bundle shrank 1340→603 lines. Removed `@ts-nocheck`, fixed ~30 type errors — now compiles with strict TypeScript.
- Phase D storyboard extraction (pass 1): moved `generateFrameImage` and `buildStoryboardDraftFrames` into `storyboard-generation-service.ts`; removed 6 dead functions/stubs from bundle. Bundle shrank 1633→1512 lines.
- Phase D storyboard extraction (pass 2): extracted reference bank management (22 functions, types, constants) into `storyboard-reference-bank.ts` (371 lines). Bundle shrank 1512→1167 lines. Added to CAST_ALLOWLIST for `(window as any).referenceGenerationStatus =` writes. Uses same names for imports so window.* global assignments in `installStoryboardBundleGlobals` work unchanged.
- Phase D storyboard extraction (pass 3): extracted frame editor modal (6 functions, ~165 lines) into `storyboard-frame-editor.ts` (181 lines). Bundle shrank 1167→1006 lines. Module avoids circular deps by referencing `renderStoryboard`/`regenerateThumbnail` via `(window as any)` bridge (installed before user interaction).
- Phase D storyboard extraction (pass 4): extracted storyboard + script context menus, chip creation, dismiss wiring (11 functions, ~257 lines) into `storyboard-context-menus.ts` (257 lines). Bundle shrank 1006→782 lines. Uses `window.*` bridge calls for `regenerateThumbnail`, `makeStoryboardFrameForText`, `linkSelectedFrameToScript`, etc. to avoid circular deps.
- Phase D storyboard extraction (pass 5): extracted frame CRUD operations + image upload + script linking + regenerateThumbnail + draft linking (17 functions, ~377 lines) into `storyboard-frame-operations.ts` (377 lines). Bundle shrank 782→444 lines. Uses window bridge for `renderStoryboard`, `getSelectedStoryboardFrame`, `autogenBoardsEnabled`, etc.
- Phase D status-bar extraction: extracted audio sub-modality concern (16 functions, ~425 lines) into `status-bar-audio.ts`. Main file shrank 1192→808 lines (32% reduction). Circular dependency accepted (audio module imports shared utilities from main file, main file imports audio-specific functions).
- Phase D toolbar extraction (pass 1): extracted blank-project wizard (14 functions, ~340 lines) into `toolbar-blank-project-wizard.ts`. Main file shrank 2757→2444 lines (11% reduction).
- Phase D toolbar extraction (pass 2): extracted 4 WIZARD_SLIDES arrays (~1850 lines of Lit `html` slide templates) into per-wizard modules: `wizard-slides-visual.ts` (550), `wizard-slides-concept.ts` (568), `wizard-slides-asset.ts` (358), `wizard-slides-storyboard.ts` (377). Main file shrank 2444→664 lines (73% reduction). Self-referencing arrays resolved via hoisted getter functions.
- Phase C lint guard expansion: added `CAST_ALLOWLIST` for `(window as any).* =` / `(window as unknown as …).* =` write patterns; added `new Event(...)` to event literal patterns; both scripts now emit baseline audit counts (24 CineGen writes, 114 cast/direct writes, 95 event strings).

### Phase C — Legacy bridge retirement

- [x] Replace high-traffic `window.*` global paths with explicit module imports (start with provider/settings/status flows).
  - [x] Create a migration inventory for high-traffic globals in provider/settings/status paths (`rg "window\." source/src/{services,settings,toolbar,components}` + owner/module notes).
  - [x] Define explicit import targets for each inventoried global path (service API, store facade, or typed helper), including temporary compatibility adapters where needed.
  - [x] Provider flows: migrate call-sites that read/write provider routing, model catalogs, and connection-test state to direct imports (remove `window.CineGen.*` access in these paths).
  - [x] Settings flows: migrate settings modal + API key screens to consume module imports/services directly instead of global bridges.
  - [x] Status flows: migrate status-bar/model-status interactions to imported service/store APIs; remove direct `window.*` reads/writes in status update paths.
  - [x] Add regression guards: ESLint rule or repo lint check to block new `window.CineGen` writes in `source/src/**` (allowlist only temporary bridge files).
  - [x] Remove compatibility shims once all call-sites in the three target flows are migrated and verified in `npm run build`.
  - [x] Update migration notes in this tracker and record remaining global paths for next wave (workspace/storyboard follow-up).

Progress note (2026-05-26):
- Began Phase C with a settings-flow migration pass:
  - rewired `source/src/settings/wire-ai-providers-modal.ts` to imported module APIs (removed direct `window.*` handlers for modal actions and API key controls)
  - rewired `source/src/settings/init-ai-settings.ts` to direct imports for modal init and status indicator refresh
  - rewired `source/src/settings/ai-api-settings-bundle.ts` internal dependencies to imported toolbar/settings helpers instead of `window.*` checks, while keeping compatibility globals installed for legacy callers
  - exported typed helpers from `source/src/settings/api-keys-settings-bundle.ts` so settings modules can import directly
- Continued settings-flow migration pass:
  - removed remaining settings bridge calls in `source/src/settings/api-keys-settings-bundle.ts` (including `(window as any)` access in routing reassignment helpers)
  - exported `loadAiApiSettings` / `saveAiApiSettings` from `source/src/settings/ai-api-settings-bundle.ts` to support direct module usage from API key flows
- Current settings inventory snapshot: `source/src/settings/**` has no remaining `window.*` bridge calls.
- Began status-flow migration pass in `source/src/services/status-bar-service.ts`:
  - replaced routing/provider/model/key lookups (`loadAiApiSettings`, `loadApiKeys`, vendor/key checks, model label/caps helpers, provider/model option merges) with direct module imports
  - replaced internal status menu update persistence paths to call imported settings APIs instead of `window` indirection
  - remaining `window.*` references in this file are mostly browser event/global export compatibility paths for status bar bootstrap and legacy hooks
- Continued status-flow migration pass:
  - replaced `window.isSetupComplete` status badge check with direct persistence helper usage (`isSetupComplete(storageService, SETUP_COMPLETE_STORAGE_KEY)`)
  - removed debug-only global marker write (`__statusBarInitCalled`)
  - removed `(window as any)` casts in status global installation by using typed local window extension for legacy export bindings
- Began provider-flow migration pass:
  - rewired `source/src/services/provider-catalog-refresh.ts` to remove `window.*` access for key checks, base URL lookup, and refresh follow-up hooks (now module-based via storage and imported settings/status APIs)
  - rewired `source/src/services/ai/resolve-modality-vendor.ts` to use imported settings/api-key services instead of `window.*` access
  - exported provider-facing helpers needed for module consumption (`populateAiApiSettingsForm`, `renderVendorList`, `readVendorKey`)
- Continued provider-flow migration pass:
  - removed remaining `(window as any)` bridge usage in `source/src/services/provider-model-catalog.ts` (`listProvidersWithKeyForModality`) and replaced with direct vendor state checks
  - normalized `source/src/services/provider-catalog-refresh.ts` to direct module imports for API key/settings/status hooks (removed remaining dynamic-import bridge indirection)
  - updated provider refresh call-sites in `source/src/settings/ai-api-settings-bundle.ts` and `source/src/settings/init-ai-settings.ts` to static imports (removed dynamic import calls for `provider-catalog-refresh`)
  - added enforced regression guard script `source/scripts/check-window-cinegen-writes.mjs` (+ `npm run lint:legacy-globals`) with a temporary-file allowlist; wired into `source` build pipeline
  - removed status-flow compatibility shim reliance in `source/src/services/status-bar-service.ts` by replacing inline menu `onclick` handlers with bound listeners and trimming global status exports to `window.CineGen.triggerModelActivityBlink` only; migrated remaining consumers in `source/src/bridge/compat.ts` and `source/src/toolbar/toolbar-debug-service.ts` to direct imports
  - additional settings/provider compatibility migration pass:
    - rewired toolbar/settings consumers to avoid `window.openAiProvidersModal` / `window.closeAiProvidersModal` (`toolbar-modals-service`, `toolbar-project-modals-service`, `toolbar-debug-service`, `setup-assistant/steps/sa-step-done.ts`)
    - rewired provider/settings UI components to direct imports (`components/settings/cinegen-aip-test-connection.ts`, `components/modals/cinegen-ai-provider-info.ts`)
    - exported remaining helper APIs needed by direct consumers (`refreshModalityModelOptions`, `syncDetailInputsToDraft`, `clearApiKeys`, `clearAiApiRouting`)
    - verified target-flow shim removals with `npm run build`; remaining legacy globals are outside Phase C target flows and tracked as next-wave workspace/storyboard cleanup
  - strengthened lint guards by adding `source/scripts/check-raw-custom-event-strings.mjs` and wiring it into `npm run lint:legacy-globals` to block new raw custom-event string literals outside a temporary legacy allowlist
- [x] Remove unused barrels only after integration confirmation.
- [x] Add lint guards (`check-window-cinegen-writes.mjs` + `check-raw-custom-event-strings.mjs`) blocking new globals and raw event strings; wired into build pipeline.
- [x] Introduce stricter lint checks beyond current guard coverage:
  - Expanded `check-window-cinegen-writes.mjs` to catch `(window as any).xxx =` and `(window as unknown as …).xxx =` write patterns (previously missed), with a separate `CAST_ALLOWLIST`.
  - Added `new Event(...)` to event literal patterns in `check-raw-custom-event-strings.mjs`.
  - Both scripts now emit allowlisted-file audit counts (warn-level, non-failing) showing total legacy writes/events remaining.
  - Current baseline: 24 CineGen writes (6 files), 114 cast/direct writes (15 files), 95 raw event strings (33 files).

### Phase D — Structural cleanup

- [x] Break `source/server/proxy.js` into route-focused modules.
- [x] Extract overview panel + asset detail panel from `workspace-bundle.ts` (1340→603 lines, `@ts-nocheck` removed).
- [x] Extract storyboard generation service from `storyboard-bundle.ts` (1633→1512 lines, 6 dead functions removed).
- [x] Extract reference bank management from `storyboard-bundle.ts` into `storyboard-reference-bank.ts` (1512→1167 lines, 371-line new module).
- [x] Extract storyboard frame editor modal into `storyboard-frame-editor.ts` (1167→1006 lines).
- [x] Extract storyboard + script context menus into `storyboard-context-menus.ts` (1006→782 lines).
- [x] Extract frame CRUD + operations into `storyboard-frame-operations.ts` (782→444 lines).
- [x] Extract audio sub-modality from `status-bar-service.ts` into `status-bar-audio.ts` (1192→808 lines).
- [x] Extract blank-project wizard from `toolbar-modals-service.ts` into `toolbar-blank-project-wizard.ts` (2757→2444 lines).
- [x] Extract 4 wizard slide arrays from `toolbar-modals-service.ts` into per-wizard modules (2444→664 lines).
- [x] Extract template functions from `setup-assistant-bundle.ts` into `setup-assistant-templates.ts` (2161→843 lines, 61% reduction).
- [ ] Continue modularizing large workspace/storyboard/status-bar bundles (remaining: `toolbar-modals-service.ts` 664, `setup-assistant-bundle.ts` 843, `storyboard-bundle.ts` 444, `status-bar-service.ts` 808).
- [x] Reduce circular chunk coupling in setup assistant/workspace/modal/panel loading graph.

Progress note (2026-06-04):
- Investigated 3 circular chunk cycles (modals-lazy ↔ setup-assistant, panels-lazy, workspace) — all indirect through the entry chunk, no direct static import edges between named chunks.
- Applied 3 fixes to eliminate all circular chunk + re-export warnings:
  - `cinegen-workspace.ts`: imported `switchView` directly from `view-routing.ts` instead of re-export through `workspace-bundle.ts` (broke Cycle 4 re-export warning).
  - `init-setup-assistant.ts`: removed redundant `import '@/components/modals/cinegen-setup-assistant-modal'` (already dynamically loaded by `modal-loader.ts`; broke one edge of Cycle 1).
  - `vite.config.ts`: excluded `modal-loader.ts` from `modals-lazy` chunk into entry chunk (hub module that all 3 cycles pivoted through; broke all remaining indirect cycles).
- Verified with `npm run build`: zero circular chunk warnings, zero re-export warnings.

Progress note (2026-06-04):
- Decomposed monolithic `server/proxy.js` (1749 lines) into 9 route-focused lib modules:
  - `server/lib/proxy-utils.js` — paths, CORS, json(), readBody(), appState persistence, CINE_DOC_RE
  - `server/lib/key-store.js` — key CRUD, env merge, `handleKeyApi` (imports shared provider-registry)
  - `server/lib/routing-store.js` — routing CRUD, `handleRoutingApi`
  - `server/lib/settings-store.js` — generic settings store, `handleSettingsStore`
  - `server/lib/state-ws.js` — app state API + WebSocket state sync (merged to avoid circular dep)
  - `server/lib/proxy-forward.js` — AI provider proxy forwarding
  - `server/lib/project-store.js` — atomic writes, project CRUD, import/export
  - `server/lib/agent-handler.js` — 14 agent routes + production context helpers
  - `server/lib/health.js` — health + connections endpoints
- `server/proxy.js` reduced from 1749→60 lines as a thin router with 4 exports
- Zero code duplication — each function moved verbatim, no behavioral changes
- Verified all API endpoints respond correctly via dev server: `/api/health`, `/api/connections`, `/api/settings/keys`, `/api/settings/routing`, `/api/state/app-shell`, `/api/projects`

Progress note (2026-06-04):
- Decomposed `setup-assistant-bundle.ts` (2161→843 lines, 61% reduction) by extracting two new modules:
  - `setup-assistant-templates.ts` (652 lines) — all step template functions (`tmplProviders`, `tmplCoverage`, `tmplModels`, `tmplDone`, `tmplWelcome`, plus ~20 helper functions). Accepts bundle-local state via a `TemplateDeps` context object.
  - `setup-assistant-events.ts` (544 lines) — all event wiring, provider CRUD, model selectors, save helpers, and connection test handlers. Accepts bundle state/actions via an `EventDeps` context object.
- Bundle now focuses on orchestration: state variables, open/close, navigation, render wiring, routing-test deps adapter, and the init/exports layer.
- Template and event modules use context-object pattern to avoid tight coupling to bundle-local state.

### Phase E — Next-wave legacy surface cleanup

- [ ] Inventory remaining high-traffic legacy globals outside provider/settings/status (focus: `workspace`, `storyboard`, `toolbar`, `chip`, `fountain` bundles) and rank by user-path frequency.
- [ ] Replace `window.*` read/write paths in workspace/storyboard/chip flows with explicit imports/services (start with `workspace-bundle`, `storyboard-bundle`, `chip-bundle`, `fountain-bundle`).
- [ ] Remove string-based inline handlers in remaining legacy-rendered HTML fragments and bind events through module functions.
- [ ] Shrink `bridge/compat.ts` and `types/globals.d.ts` to only required cross-bundle compatibility symbols; remove dead exports after migration.
- [ ] Add/expand lint guards for raw string event names and non-allowlisted global writes beyond `window.CineGen`.
- [ ] Verify end-to-end flows (script edit, storyboard generation/review, workspace navigation, toolbar actions) and `npm run build` before closing the phase.

---

## Guardrails For Future Changes

- Keep all persisted app state and keys server-backed.
- New storage keys must be added in `source/src/constants/storage-keys.ts` before use.
- New provider/routing logic should be added to shared SSOT modules first, then consumed by UI/services.
- Avoid adding new `window.*` globals unless there is a temporary migration reason with a removal ticket.

---

## P0 Condition Assessment (as of 2026-05-29)

### What Is Solid

**Project foundation.** The three-tier project model is working. Bundled read-only samples load through Vite's `import.meta.glob`. Server-resident writable projects exist in `source/server/projects/` and are created, loaded, and incrementally written via `GET /api/projects`, `GET /api/projects/:id/load`, `POST /api/projects`, and `POST /api/projects/:id/documents` in `proxy.js`. The Duplicate Sample As Local Project path exercises the full serializer → write → load round-trip and has been verified to work.

**Serializer.** `project-serializer.ts` maps `AppliedCineProject` snapshots to the ten core `.cine` document files plus seven AI Director documents: `shotLibrary.cineshotlibrary`, `cameraPresets.cinecamerapresets`, `spatialAnnotations.cinespatial`, `generationQueue.cinegenerationqueue`, `reviewQueue.cinereviewqueue`, `costTracking.cinecosttracking`, and `agentLog.cineagentlog`. These cover the full MVP filmmaker loop.

**Autosave.** Dirty-document tracking with debounce is in place via `markProjectDirty()` and `triggerProjectSave()` in `project-service.ts`. Write failures surface as a visible "Save failed" badge with console detail. Read-only bundled projects correctly no-op on write paths.

**Atomic writes.** `POST /api/projects/:id/documents` uses `writeDocumentsAtomic` in `proxy.js`. Seeds a staging directory with existing files, writes new/updated documents into staging, then renames current → backup and staging → current. On swap failure it attempts rollback from backup. The `.cine` directory is never in a partially-updated state.

**Validator.** `validateCrossFileIntegrity` in `cine-project-validator.ts` (extracted from `cine-project-loader.ts`) is thorough: validates referential integrity across scenes, characters, locations, shots, frames, tree nodes, asset detail keys, media paths, and output path status. Called by the serializer on full writes. Accepts `Record<string, string>` document payloads so it runs on both client and server.

**Zod + migration.** `CineManifestSchema` in `cine-schemas.ts` wired into `parseCineManifest` as a structural pre-validation layer. Migration registry in `source/src/data/cine-migrations/migration-registry.ts` with `v2-baseline` and `v2-to-v3` stub. `parseCineManifest` accepts `{ migrate?: boolean }`.

**Script → project sync.** `syncFountainToProject()` in `source/src/script/script-to-project.ts` deterministically produces scenes, breakdown rows, starter shots (ECU through ELS), character and location placeholders, and mood-board attachment points from a Fountain script with no LLM dependency. The Start-from-Script wizard triggers this on step 1 and enables the right feature branches after sync.

**Shot architecture.** `SceneShot` in `scene-types.ts` carries `shotType`, `cameraAngle`, `cameraMovement`, `lens`, `lightingTechnique`, `composition`, `atmosphereTags`, `status`, `linkedFrameIds`, `linkedClipId`, `linkedAudioId`, and `sceneReferenceSlots`. Coverage shot cards show status badges; inline dropdowns allow editing. Reorder up/down is wired.

**Project Features.** Progressive disclosure (blank project → Mood Boards only; wizard completion → enable departments) is working end-to-end with `features.cinefeatures` persistence, the modal UI, `Alt+1…9` section jumping respecting disabled sections, and selection rerouting on config change.

**Legacy bridge retirement.** Phase A (SSOT), Phase B (bundle decomposition), and Phase C (provider/settings/status migration) are complete. Lint guards (`check-window-cinegen-writes.mjs`, `check-raw-custom-event-strings.mjs`) enforce no new unguarded globals on committed MVP paths.

**Agent layer.** All twelve Mastra agent routes are registered. `agent-context-adapter.ts` maps `ProductionContext` outputs into UI project state. AI Director review queue UI (`cinegen-review-queue-view`) surfaces `getReviewQueue()` with Approve/Reject controls. Agent health check wired in Setup Assistant done step.

### Known Open Gaps

- **Media URL portability unresolved.** AI-generated image and video URLs from providers expire. No media caching layer, no local copy path, no import/export media handling yet.
- **Import/export (partial).** `GET /api/projects/:id/export`, `POST /api/projects/import`, and toolbar/projects-modal UI exist; media portability and validation UX remain P1.
- **Snapshot invariant enforcement.** Normalizers in `project-data.ts` for missing fields need to be written; the required-fields contract is documented but not yet enforced on load.
- **Agent LLM key consistency.** Proxy reads `source/server/keys.json`; Mastra reads `backends/.env`. These two stores are not yet unified.
- **Shot lifecycle (improved).** `setShotStatus()` enforces transitions; generation-queue service advances `prompted` / `queued` / `generated` (video) or returns to `storyboarded` (image jobs).

---

## `.cine` Package Architecture: Format Evaluation

### The Current Design

The `.cine` package is a directory of JSON text files, each with a domain-specific extension (`.cinescript`, `.cinescenes`, `.cinecharacters`, etc.), anchored by a `cine.manifest.json` that names each document by key.

**Strengths:**
- Human-readable and git-diffable — each document is a pretty-printed JSON file.
- Domain isolation by file — partial saves write one file and leave all others intact.
- Extension-based type safety — the `.cinescript` / `.cinescenes` naming gives the validator unambiguous type expectations.
- Cross-file integrity validation — `validateCrossFileIntegrity` checks referential integrity before any package is applied to in-memory state.
- Portable zip format — because the package is a flat directory of text files, zipping for export is a `tar` or `archiver` call away.
- Document-per-concern scales naturally — adding a new department is a manifest key addition plus a loader function.

**Addressed weaknesses (as of 2026-05-29):**
- Validator was module-private and not called on writes → extracted to `cine-project-validator.ts`, wired into serializer. ✅
- No write atomicity → staging-directory atomic writes in `proxy.js`. ✅
- No version migration → migration registry created, `parseCineManifest` accepts `{ migrate? }`. ✅
- `unknown[]` / `Record<string, unknown>` types too loose → Zod `CineManifestSchema` live; document schemas added opportunistically. ✅ (manifest only; document schemas in progress)
- Vite glob coupling → validator now accepts `Record<string, string>` payloads usable from both client and server. ✅
- No content-addressed change detection → incremental dirty-document flush (`serializeAppliedProject` filters by `dirtyDocTypes`). ✅

**Remaining weakness:**
- Media URL portability — generated image/video URLs from providers are stored as external URLs that may expire. No media caching or local copy path. Tracked in P1 Import/Export.

### Alternative Architecture Notes

**SQLite per project** — worth reconsidering if CineGen gains multi-user or cloud sync requirements. Atomic write guarantees and concurrent read safety are strong advantages. Loses direct git-diffability; bundled samples become a different format. Not the right move for the current local-dev, single-filmmaker context.

**Event-sourced log** — do not adopt for the core project format. Adopt the *pattern* selectively for the AI Director department: `agentLog` is already append-only and can grow into a lightweight event stream for the agent layer without touching screenplay, shot, or character documents.

**Zod schemas as SSOT** — the right long-term direction. `CineManifestSchema` is live. Document schemas (`cinescenes`, `cinecharacters`, `cinelocations`, etc.) will be added opportunistically as features touch each document type. Each Zod schema replaces ~80 lines of imperative `assertObject` calls with ~20 lines of `z.object()` definitions and gives TypeScript inferred types automatically.

### Priority Sequence (completed items)

1. **A1 ✅** Validator extracted to `cine-project-validator.ts` and wired into `project-serializer.ts`.
2. **A2 ✅** Staging-directory atomic writes implemented in `proxy.js`.
3. **A3 ✅** Incremental dirty flush wired; `serializeAppliedProject` filters by `dirtyDocTypes`.
4. **A4 ✅** Migration registry created with `v2-baseline` and `v2-to-v3` stub.
5. **D (manifest) ✅** `CineManifestSchema` live in `cine-schemas.ts`. Document schemas pending (opportunistic).
6. **B** — Only if multi-user becomes a goal.
7. **C** — Never for the core format; selectively for `agentLog`.

---

## Production Terminology Reference

Industry-standard guide names (modern secular alternatives to "bible" terminology):

| Traditional Term | Modern Alternative | Primary Use |
| :--- | :--- | :--- |
| Show Bible | Show Guide / Series Guide | Master series reference & pitch |
| World Bible | World Guide / World Book | Setting & universe rules |
| Production Bible | Production Guide / Manual | Logistics & scheduling |
| Writer's Bible | Writer's Guide / Handbook | Staff continuity & tone |

**Show Guide** — master reference for a TV series; defines vision, tone, world rules, character backstories, long-term arcs. Used for pitch (development) and continuity (production).

**World Guide** — setting-focused subset common in sci-fi/fantasy/historical; covers maps, timelines, glossaries, magic/technology rules.

**Writer's Guide** — internal operational manual for writing staff; includes character voice samples, thematic mandates, episode templates, running canon log.

**Production Guide** — logistical document for the physical production team; script breakdowns, shooting schedules, contact lists, safety protocols, department requirements.

**Character Profile / Breakdown** — focused document on individual characters; used for casting and actor preparation in film; compiled into the Show Guide for TV.

**Pitch Deck / Look Book** — visual sales tool; heavily visual and concise, designed to sell the vibe rather than serve as a long-term reference; includes mood boards, color palettes, reference images, cast wish lists.
