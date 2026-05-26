# Cinegen Architecture Progressive Fix Tracker

Last verified: 2026-05-25
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
- `VERIFIED` Script wizard is still embedded in `toolbar/toolbar-modals-service.ts`, not extracted into `wizard/`.
- `VERIFIED` `source/server/proxy.js` remains monolithic and owns multiple concerns (proxy, key/routing/settings APIs, agents routing).
- `VERIFIED` Build still reports pre-existing circular chunk warnings involving setup assistant/workspace/modals/panels.

### Monolithic hotspots (current line counts)

- `OPEN` `source/src/toolbar/toolbar-modals-service.ts` — 3143
- `OPEN` `source/src/setup-assistant/setup-assistant-bundle.ts` — 2509
- `OPEN` `source/src/storyboard/storyboard-bundle.ts` — 1510
- `OPEN` `source/src/workspace/workspace-bundle.ts` — 1340
- `OPEN` `source/src/services/status-bar-service.ts` — 1208
- `OPEN` `source/server/proxy.js` — 1178

---

## Progress Since Original Audit

### Consolidations completed

- `UPDATED` Storage key SSOT improved in `source/src/constants/storage-keys.ts` (storyboard + section visibility + console history keys centralized).
- `UPDATED` `escHtml` duplication removed; canonical function now only in `source/src/utils/html.ts`.
- `UPDATED` Raw `cg-tree-node-select` listener replaced with constant usage in storyboard flow.
- `UPDATED` Dead file `source/src/legacy/script-order.ts` removed.

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
- Phase B decomposition goals are complete; remaining cleanup is optional follow-up modularization.

### Phase C — Legacy bridge retirement

- [ ] Replace high-traffic `window.*` global paths with explicit module imports (start with provider/settings/status flows).
- [x] Remove unused barrels only after integration confirmation.
- [ ] Introduce stricter lint checks to prevent new global write paths and raw string event names.

### Phase D — Structural cleanup

- [ ] Break `source/server/proxy.js` into route-focused modules.
- [ ] Continue modularizing large workspace/storyboard/status-bar bundles.
- [ ] Reduce circular chunk coupling in setup assistant/workspace/modal/panel loading graph.

---

## Guardrails For Future Changes

- Keep all persisted app state and keys server-backed.
- New storage keys must be added in `source/src/constants/storage-keys.ts` before use.
- New provider/routing logic should be added to shared SSOT modules first, then consumed by UI/services.
- Avoid adding new `window.*` globals unless there is a temporary migration reason with a removal ticket.
