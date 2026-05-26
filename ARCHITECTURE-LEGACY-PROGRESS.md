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
- `OPEN` `source/src/wizard/index.ts` appears unused in runtime imports (keep candidate for removal once confirmed by maintainers).
- `OPEN` `source/src/services/ai/index.ts` appears unused in runtime imports (same caveat).

---

## Progressive Fix Plan (PR-sized increments)

### Phase A — SSOT completion (near-term)

- [ ] Create shared agent route manifest consumed by `agents-service` and proxy agent router.
- [ ] Consolidate provider metadata registry (`providerId`, `slotId`, `defaultBaseUrl`, `proxyTarget`, `envKey`) into one canonical module + adapter.
- [ ] Normalize setup assistant modality order to consume shared `ROUTING_MODALITIES` (or explicitly document why order differs).

### Phase B — Bundle decomposition

- [ ] Extract script wizard from `toolbar/toolbar-modals-service.ts` into `wizard/script-wizard-*`.
- [ ] Split `toolbar-modals-service` by concern (projects/modals/wizards/debug).
- [ ] Split `setup-assistant/setup-assistant-bundle.ts` into state, routing tests, UI rendering, and persistence gates.

### Phase C — Legacy bridge retirement

- [ ] Replace high-traffic `window.*` global paths with explicit module imports (start with provider/settings/status flows).
- [ ] Remove unused barrels only after integration confirmation.
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
