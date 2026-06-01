# CineGen — Filmmaker Task List

Goal: get CineGen to a working filmmaker workflow while retiring the legacy architecture across the same areas being built out. Each product task should, where it touches monolithic bundles, global bridges, or duplicated SSOT, also clean up that coupling. Architecture work and feature work should happen together — not in separate passes — so every new capability lands on solid ground.

---

## What We Are Building Toward

Rationale: without a shared definition of "working," every area of the codebase can be partially implemented indefinitely. This section is the minimum viable filmmaker loop. Everything below it serves one of these outcomes.

A CineGen filmmaker should be able to:

1. Start a project from a Fountain script, a mood concept, a visual reference upload, or a hand-drawn beat board.
2. Have that entry point automatically produce navigable scenes, structured characters and locations, a usable shot list, and mood-board scaffolding.
3. Configure shots with cinematic intent — shot type (ECU through ELS), camera angle, lens, movement, lighting technique, and atmospheric tone — and have those choices flow directly into generation prompts.
4. Attach provided visual assets (photos, reference images, concept art) to characters, locations, and shots so that generation uses them as style and consistency anchors.
5. Build and refine a mood board that sets the visual DNA of the project — color palette, lighting mood, texture references — and see that DNA propagate automatically into storyboard prompts and shot configuration.
6. Let AI agents enrich each department's work (scripts, guides, prompts, boards, clips, audio) without blocking the workflow when agents are not configured.
7. Save automatically, recover the full project state on reload, and export a complete portable `.cine` package to share, archive, or move between machines.
8. Import a `.cine` project exported from another session, validate it, and resume work from exactly where it left off.
9. See every step clearly: what is configured, what will be generated, what failed, and what needs human review before downstream work proceeds.
10. Generate images and video freely outside the formal production sequence — a Drafts section where experiments can be promoted into shots, storyboard frames, mood board items, or character references once they prove themselves.

---

## P0 — Project Foundation [MOSTLY COMPLETE — 2026-05-28]

Server-resident `.cine` tier (`source/server/projects/`), GET/POST project endpoints, project serializer covering all ten core document types plus AI Director documents, incremental autosave with dirty-document tracking, atomic staging writes, cross-file validator extracted to `cine-project-validator.ts`, Zod manifest schema, format migration registry, visible save status badge, and Duplicate Sample As Local Project are all working. Full details in `ARCHITECTURE-LEGACY-PROGRESS.md`.

- [x] Define and enforce project snapshot invariants.
  - `normalizeAppliedCineProject()` in `source/src/data/project-snapshot-normalize.ts` runs on every load via `applyMutableProjectState()`.

- [x] Extend `npm run validate:cine` to cover server-resident project snapshots.
  - Scans `source/server/projects/*.cine` alongside the bundled sample; incomplete server scaffolds warn-and-skip.
  - Optional `npm run validate:cine -- --cross-file` runs cross-file integrity on complete packages.

---

## P0 — Progressive Project Setup [MOSTLY COMPLETE — 2026-05-29]

Feature catalog with stable `featureId`s, per-project `ProjectFeaturesConfig` persisted as `features.cinefeatures`, Project Features modal with checkbox tree and drag-reorder, blank-project default (Mood Boards only), `Alt+1…9` skips disabled sections, selection rerouting on config change, Start-from-Script wizard enables Production Office and Scenes after sync, blank project toolbar action routes through `createNewProject()`. Full details in `ARCHITECTURE-LEGACY-PROGRESS.md`.

- [x] Add `features.cinefeatures` to bundled sample manifests so duplicated samples carry explicit feature order.
- [x] Manual QA: enable Script only → paste screenplay → disable Script → reload → Fountain text and scene data still present.
  - Boot restores active project + `features.cinefeatures`; disabling a department hides tree nodes only (data remains in snapshot). Re-verify in UI after reload.

---

## P0 — Script to Production [SUBSTANTIALLY COMPLETE]

`syncFountainToProject()` in `source/src/script/script-to-project.ts` deterministically produces scenes, breakdown rows, starter shots (ECU through ELS heuristic), character and location placeholders, and mood-board attachment points. Start-from-Script wizard wired to `createNewProject()` + `syncFountainToProject()`. Sidebar and workspace respond to sync via `requestProjectTreeRefresh()`.

Architecture note: as remaining work lands, migrate high-traffic `fountain-bundle` and `workspace-bundle` global function calls to module imports. Use `CG_TREE_NODE_SELECT` from `shell-events.ts`; use `requestProjectTreeRefresh()` from `project-tree-service.ts`.

- [x] Step 2 UI in Start-from-Script wizard to show breakdown rows and starter shots.
  - Core Elements slide shows breakdown table + per-scene starter shot list via `script-wizard-analysis-summary.ts`.

- [~] Wire script editor changes back into project structure.
  - [x] "Refresh Breakdown From Script" in Script Info toolbar (`refreshBreakdownFromScript()`).
  - [x] Automatic re-sync after meaningful editor edits (2000ms debounced structure sync via `scheduleStructureSync`).
  - Reconciler preserves scene IDs and existing coverage when headings match (`syncFountainToProject`).

- [x] Verify empty-project placeholder (blank projects show Mood Boards only until features are enabled or a wizard runs).
  - Code analysis confirms: `buildBlankProjectFeaturesConfig` enables only `mood-boards`, `buildDisplayProjectTree` filters to Mood Boards only, `getFirstEnabledTreeNodeName` routes to moodboards view, and `enableFeatureBranch` + `rerouteSelectionIfDisabled` handles re-routing when features are added.

---

## P0 — Shot Architecture with Cinematography Terms [SUBSTANTIALLY COMPLETE]

`SceneShot` extended with `shotType`, `cameraAngle`, `cameraMovement`, `lens`, `lightingTechnique`, `composition`, `atmosphereTags`, `status`, `linkedFrameIds`, `linkedClipId`, `linkedAudioId`, `sceneReferenceSlots`. Camera-lighting-view writes selections into active shot. Coverage shot cards show status badges and inline dropdowns. Shot reordering wired. Chip selections auto-initialize from active shot. `buildCameraPrompt()` gathers active shot cinematography parameters with style guide fallback.

Architecture note: extract shot parameter accumulation and prompt-dispatch logic from `camera-lighting-bundle.ts` into a narrower `shot-config-service.ts` module rather than extending the existing bundle.

- [x] Complete "Build Shot Prompt" through to the Prompt Engineer Agent.
  - `buildCameraPrompt()` in `camera-lighting-bundle.ts` now checks `getAgentHealth()`; when agents are ready it calls `buildGenerationPrompt(activeProjectId, shotId)` and displays the agent-optimized prompt. Falls back to the local `buildLocalCameraPrompt()` builder when agents are unavailable or the call errors.
  - Provider choice recording on shot pending.
  - Per-shot prompt bar (show prompt text inline on shot card) pending.

- [x] Enforce valid shot lifecycle transitions.
  - `shot-lifecycle.ts` transition rules; status dropdown on coverage cards; auto `storyboarded` when frames link.
  - [x] Wire generation queue paths to use `setShotStatus()` for `queued` / `generated` transitions.
  - `generation-queue-service.ts` syncs queue jobs with shot lifecycle; storyboard batch + Build Shot Prompt wired.

- [x] Consolidate backend shot routing with frontend shot types.
  - SSOT: `source/src/constants/shot-type-routing.js` (`DEFAULT_SHOT_TYPE_ROUTING`, `inferShotRoutingTag`).
  - `provider-router.tool.js` and `generation-agent.js` import shared rules; provider metadata remains in `provider-registry.js`.

---

## P0 — Mood Board as Visual DNA [SUBSTANTIALLY COMPLETE]

Every new project initializes with a "Visual DNA" mood board, scene reference override slots, and `styleGuide` defaults. Concept/Mood-First wizard writes `styleGuide` and `colorState` on completion via `applyConceptWizardSceneKit()`. Style guide indicator in Camera/Lighting panel. Image upload with drag-drop and style reference toggle. `colorState` persistence round-trips through `styleGuide.colorPalette` in the `.cine` serializer.

Architecture note: mood board item types `'image' | 'video' | 'sound' | 'text'` remain canonical; do not add type literals outside `source/src/data/project-data.ts`.

- [ ] Surface mood board in the Beat Board and Visual-First wizards.
  - Beat board entries have an `assetNeeds` field and camera notes; link these to mood board items as loose references.
  - Visual-First wizard upload flow should add uploaded images as mood board items and reference slots simultaneously.

---

## P1 — Assets in Shots: The Reference Pipeline

Rationale: the most sophisticated thing CineGen can do for a filmmaker is use their actual visual assets — photos of real actors, location scouts, costume reference sheets, concept art — as anchors for AI generation. This turns generic AI output into production-consistent imagery. The pipeline schema is in place: `CharacterGuideEntry.references.face / body / profile / threeQuarter / closeUp / costume[]`, `LocationGuideEntry.references: string[]`, and `storyboard-prompt-builder.ts` already calls `getReferenceImageUrls()` to build `refImageUrls`. The gap is the upload-to-reference flow that populates those fields and makes them selectable per shot.

Architecture note: keep all reference URL storage server-backed. Do not store image data in browser localStorage. Asset file handling belongs in `source/src/moodboards/moodboard-files.ts` or a dedicated `source/src/assets/asset-upload-service.ts`.

- [ ] Build an asset-to-reference flow.
  - Drag an image onto a character → it becomes a face/costume reference. Drag onto a location → it becomes a location plate. Drag onto a shot → it becomes a per-shot style reference override.
  - Accept JPG, PNG, WebP, PDF (first page), and short video thumbnails.
  - Write uploaded references into `CharacterGuideEntry.references.*` or `LocationGuideEntry.references[]` through a typed service call.

- [ ] Surface per-shot reference slot UI.
  - Each shot in the scene detail shows its linked reference images (characters, location plate, style override).
  - Allow adding, removing, and reordering reference slots per shot.
  - These populate `SceneShot.sceneReferenceSlots` and flow into `getReferenceImageUrls()` when the prompt is built.

- [ ] Make the Casting and Production Design agents use uploaded references.
  - When `buildCharacterGuides()` is called, include existing uploaded face/costume references so the agent labels them rather than inventing placeholders.
  - Same for `buildLocationGuides()` with uploaded location plates.
  - Agent outputs enriched guide entries back into the same reference slots, not a separate data structure.

- [ ] Add a "Use as Shot Reference" action to asset views.
  - From any asset detail view, assign that asset as a reference for a specific shot (character angle, location plate, or style override).
  - Creates or updates the `sceneReferenceOverrides` entry for that scene and shot.

- [ ] Preserve stable reference IDs across project saves.
  - Reference image slots must survive save/load cycles with the same IDs so prompts built before a save remain valid after reload.
  - Confirm `moodboard-persistence.ts` and `project-data.ts` serialize and restore reference slot arrays correctly.

- [ ] Make the storyboard reference bank a first-class UI concept.
  - Surface `storyboardReferenceBank` and `sceneReferenceOverrides` in the storyboard panel.
  - Allow toggling individual references off per generation without deleting them from the project.

---

## P1 — Agent Scaffolding: Connecting the Mastra Layer to the Filmmaker Loop

Completed: `ProductionContext` → UI project state adapter (`agent-context-adapter.ts`), script agent analysis wired in Start-from-Script wizard, agent health check in Setup Assistant done step, AI Director review queue UI (`cinegen-review-queue-view`) with Approve/Reject controls, all twelve Mastra agent routes registered.

- [ ] Make agent LLM key resolution consistent with Settings keys.
  - Currently the proxy can use `source/server/keys.json` while Mastra agents depend on `backends/.env`.
  - Make `getMastra()` in `backends/agents/mastra.js` read from the same server-backed key store used by Settings → API Keys.
  - Reload/reinitialize Mastra when keys change via `/api/settings/keys`.

- [ ] Harden `agentFetch()` for error conditions.
  - Return typed error shapes for: agent not configured, missing key, 4xx/5xx responses, non-JSON bodies.
  - Show these as actionable UI messages in the wizard and department panels — not silent failures.

- [ ] Ensure the orchestrator state machine is resumable after reload.
  - The orchestrator state in `agents.db` should survive server restarts.
  - The frontend should be able to check `getReviewQueue()` on load and restore any pending review state.

---

## P1 — Wizard Completion and Contracts

Completed: Concept/Mood-First wizard complete via `applyConceptWizardSceneKit()`. Beat Board wizard (8 slides) complete via `applyBeatBoardSceneKit()`. Shared wizard completion hook `runWizardCompletion()` in `source/src/wizard/wizard-completion-hook.ts` used by all five entry wizards.

- [ ] Define the wizard output contract.
  - Each wizard must produce a complete project scaffold, screenplay text, scene nodes, contributions to `assetLibrary` and `styleGuide` / `colorState`, and at least placeholder shots.
  - Document the specific outputs of each wizard as a typed `WizardOutput` interface.
  - Route all wizard completions through shared project sync/adapters rather than each wizard building its own partial project state.

- [ ] Complete the Start-from-Script wizard (8 steps).
  - Step 1: paste/import Fountain, name project, create scaffold. ✓
  - Step 2: review extracted characters, locations, breakdown, and starter shots (agent-enriched if configured). [shot table UI pending]
  - Step 3: casting setup — assign reference images to characters, accept or edit guides.
  - Step 4: production design setup — assign location plates, accept or edit location guides.
  - Step 5: style guide — color palette, lighting mood, visual tone (writes into `styleGuide` and `colorState`).
  - Step 6: mood board seeding — generate or upload 3–5 reference images for the project mood board.
  - Step 7: shot coverage review — confirm or add cinematography parameters to starter shots.
  - Step 8: generate initial storyboard frames for the first 3 scenes.

- [ ] Complete the Visual-First wizard.
  - Upload images → auto-identify as character/location/style references.
  - Set lighting mood, style notes, color palette from uploaded images (using color extractor agent).
  - Generate a script outline from the visual assets.
  - Produce scene kit (scenes based on identified locations, characters cast from uploaded faces).

---

## P1 — Storyboard as Shot Visualization

Rationale: storyboard frames are where cinematography intent becomes visible. The storyboard component is working, the shot/frame bridge is implemented, and the prompt builder already integrates camera parameters and references. The gap is a reliable "Draft Storyboards" path that starts from shots and that works both with and without configured AI providers.

Architecture note: as generation logic is touched, extract it from the 1510-line `storyboard-bundle.ts` into smaller service modules. Remove inline string event handlers from storyboard HTML fragments and bind events through module functions.

- [ ] Add a "Draft Storyboards" path that starts from the shot list.
  - For each shot with at least a `shotType` and `sceneId`: build a prompt from camera parameters + style guide.
  - If provider keys are configured: generate a frame image.
  - If no provider is configured: create a text-placeholder frame with the shot parameters displayed as a slate.
  - Show generation progress clearly (queued, generating, failed).

- [ ] Ensure all generated frames are linked to shots by default.
  - Every frame created through the "Draft Storyboards" path gets `scene`, `shotId`, `duration`, and `scriptLink` metadata.
  - Run `reconcileShotFrameLinks()` after batch generation.
  - The shot lifecycle advances to `storyboarded` once a frame is linked.

- [ ] Add simple manual storyboard creation.
  - Let a filmmaker add a text-only placeholder frame to any shot without using AI.
  - Let a filmmaker upload an image as a storyboard frame (sketch, reference still, etc.).
  - This keeps the app useful when providers are not configured.

- [ ] Surface the animatic player.
  - `cinegen-storyboard-animatic-player.ts` exists; make it accessible from the Storyboard section header.
  - Show frames in sequence order with estimated shot durations.
  - Connect the previs timeline dock to the animatic so they stay in sync.

- [ ] Extract storyboard generation orchestration into a service.
  - Move frame generation, reference gating, and generation queue management out of `storyboard-bundle.ts` into `source/src/storyboard/storyboard-generation-service.ts`.
  - Replace `window.*` global reads/writes in the touched paths with module imports.

- [ ] Add a free-form generation entry point from the Drafts panel.
  - When generating from Drafts context (no shot or scene pre-selected), the shot construction modal operates without a shot-lifecycle gate; output goes to `drafts.cinedrafts` rather than a `SceneShot`.
  - "Promote to Storyboard Frame" on a draft card: user selects target scene and shot (or creates a new placeholder shot); the draft's output URL becomes the frame's `imageUrl`, advancing shot status to `storyboarded`.

---

## P1 — Drafts: Generative Scratch Surface

Rationale: the AI Director enforces sequence, quality, and traceability for production work — and that rigor is correct for what ships. But filmmakers develop visual language experimentally, long before a shot list exists: a DP tests a lighting idea, a director pins a frame from another film, a production designer mocks up a location feel in 20 minutes. The Drafts section is a generative sketchbook. Generate freely, without requiring a pre-existing shot or storyboard frame. Promote results that prove themselves into the formal production structure. The mood board is the *curated* visual reference bank; Drafts is the *raw* scratch surface that feeds it.

Architecture note: a `drafts.cinedrafts` document added to the `.cine` format is an append-only collection of generation experiments. The shot construction modal operates in two contexts: production (shot-linked, writes into `SceneShot`) and draft (unlinked, writes into `drafts.cinedrafts`). Promotion creates formal structure at promotion time; draft entries themselves are never mutated after creation except for `tags` and `promotedTo`.

- [ ] Add the Drafts section to the project feature catalog.
  - New `featureId: 'drafts'` in `source/src/tree/project-feature-catalog.ts`.
  - Off by default on blank projects; enabled when the filmmaker first triggers a free-form generation.
  - No department dependency — Drafts does not require script, storyboard, or casting to be enabled first.

- [ ] Define and serialize the `drafts.cinedrafts` document type.
  - `CineProjectDraft` entry: `{ id, prompt, provider, modelId, outputUrl, thumbnailUrl, createdAt, tags, promotedTo?: { type: 'frame' | 'moodboard' | 'reference' | 'shot', targetId } }`.
  - Append-only: new experiments are added; `tags` and `promotedTo` are the only writable fields after creation.
  - Add `drafts` to the serializer's document map; mark dirty on every append.
  - Add `drafts.cinedrafts` to the manifest and the server-side `CINE_DOC_RE` pattern.

- [ ] Build the Drafts panel.
  - `cinegen-drafts-panel.ts` — grid of experiment cards: thumbnail, prompt excerpt, provider badge, creation time, tags, promotion status.
  - Empty state: a large prompt area + provider selector inviting the filmmaker to generate.
  - Filter by tag and by promotion status (All / Unpromoted / Promoted).
  - Cards with `promotedTo` show a "Promoted → [Frame / Mood Board / Reference]" badge.

- [ ] Make the shot construction modal operate in draft context.
  - When opened from the Drafts panel (no `shotId` or `sceneId`): all cinematography parameters optional; generation writes a new `CineProjectDraft`; no shot-lifecycle gate.
  - When opened from a production shot: existing behavior unchanged.
  - Modal header shows context: "Draft" vs. "Production: [Scene / Shot]".

- [ ] Add "Promote to Production" actions to draft cards.
  - "Use as Storyboard Frame" → user selects target scene and shot; draft output URL becomes frame `imageUrl`, shot advances to `storyboarded`.
  - "Add to Mood Board" → adds mood board item of type `'image'` with draft's output URL and prompt as description.
  - "Use as Character Reference" → assigns output URL to a user-selected character reference slot (`face`, `body`, `costume`, etc.).
  - "Use as Location Plate" → assigns to a user-selected location's `references[]`.
  - Promotion sets `promotedTo` on the draft entry and marks it dirty for autosave.

- [ ] Propagate style guide into draft generation.
  - Allow the filmmaker to optionally inject the active `styleGuide` (color palette, lighting mood, style reference) into draft generation prompts — same pipeline as production shots, but opt-in.

---

## P1 — Project Import and Export

Rationale: because the project serializer and server-resident project tier are built in P0, import and export are natural extensions. Export zips the server-resident `.cine` directory and offers it as a download. Import accepts that zip, extracts it server-side, validates it, and registers it as a new server-resident project. The `.cine` format's document-per-concern design means the zip contains readable text files — a filmmaker can inspect, version-control, or manually edit the Fountain script or JSON documents before re-importing.

Architecture note: zip handling belongs on the server (Node's built-in `zlib` plus a lightweight zip library). The client only needs a file picker for import and an anchor-download trigger for export. Validate through `parseCineManifest` + `validateCrossFileIntegrity` before any imported project appears in the project list.

- [ ] Add `GET /api/projects/:id/export` — export as `.cine` zip.
  - Before zipping, flush any dirty in-memory state to the server-resident package directory.
  - Zip the entire `.cine` directory preserving structure (`cine.manifest.json` at root, one file per document).
  - Stream as `Content-Disposition: attachment; filename="<project-name>.cine.zip"`.
  - Expose as "Download Project" in the toolbar Projects menu and project settings modal.

- [ ] Add `POST /api/projects/import` — import a `.cine` zip.
  - Accept a multipart file upload of a `.cine.zip`.
  - Extract to a temp directory; run `parseCineManifest` + `validateCrossFileIntegrity`.
  - On success: copy to `source/server/projects/<id>.cine/` (disambiguate if ID already exists); return new project entry.
  - On failure: return structured JSON error listing every schema violation; do not install the project.

- [ ] Add import/export to the Projects modal UI.
  - "Import Project…" button at the top of the list with a file picker accepting `.cine.zip`.
  - "Download" icon on each writable project row.
  - Progress indicator during import; validation errors inline on failure with specific file and field references.

- [ ] Handle media URL portability in export and import.
  - On export: include a `media/` folder in the zip for any locally-stored files in `source/server/projects/<id>.cine/media/`.
  - On import: rewrite local path references to the newly-installed project's media directory.
  - Provider-generated URLs (Fal, Replicate, Runway, etc.) remain as external URLs; note them in the import UI as "external references — may expire."

- [ ] Add a `GET /api/projects/:id/export/manifest` — lightweight export preview.
  - Return JSON summary: project name, scene count, shot count, storyboard frame count, asset counts, agent log entry count, external media URL list.
  - Surface in the export confirmation dialog before downloading.

- [ ] Version the `.cine` format explicitly on import.
  - On import, if version is older: run the migration registry before validation.
  - On import, if version is newer than current: reject with "This project was created with a newer version of CineGen."

- [ ] Preserve FDX metadata via the annotation sidecar on import.
  - Extend `convertFDXToFountain()` to also collect scene numbers (`SceneProperties.Number`), script notes (`<ScriptNote>`), scene colors (`SceneProperties.Color`), dual-dialogue flags, and paragraph-level formatting (bold, italic, underline, alignment) keyed by Fountain text offset.
  - Write these into `CineAnnotationsDoc` (`annotations.cineannotations`) as `AnnotationMark` entries with category prefix `"fdx-"`.
  - On round-trip export (FDX → Fountain + annotations → FDX), rebuild the original FDX attributes from the sidecar so metadata survives save/load.
  - No schema change to the `.cine` format — the annotations doc already carries extensible `category` + `note` fields.

---

## P2 — Legacy Bridge Retirement (Phase C/E Continuation)

Rationale: Phases A and B are complete (SSOT, provider registry, agent routes, setup decomposition, script wizard extraction, toolbar concern split). Phase C provider/settings/status migration is complete. The remaining legacy surface is workspace/storyboard/toolbar/chip/fountain flows — the highest-traffic paths in the filmmaker loop. Retiring these globals in the same tasks as the P1 features above is the most efficient approach: touch the code once, clean it up in the same PR.

Progress reference: `source/ARCHITECTURE-LEGACY-PROGRESS.md`.

- [ ] Inventory remaining `window.*` paths in workspace, storyboard, toolbar, chip, and fountain bundles.
  - Run `rg "window\." source/src/{workspace,storyboard,toolbar,services,components}` plus owner/module notes.
  - Rank by user-path frequency: script import/edit, tree refresh, scene selection, storyboard generation, save, breakdown table, chip nav.
  - Record the target module/service/store replacement for each inventoried path.

- [ ] Replace workspace/storyboard globals as P1 paths are implemented.
  - `window.renderGlobalAssets?.()` → module-imported render function
  - `window.renderTimeline?.()` → explicit timeline service call
  - `window.renderBreakdownTable?.()` → module function from workspace service
  - Storyboard generation, frame mutation, selection, shot/frame reconciliation → module functions from extracted storyboard service

- [ ] Remove string-based inline handlers from editing surfaces.
  - Target: workspace shot-list tables, breakdown chip rows, storyboard frame controls, script info panels, and toolbar-rendered HTML fragments.
  - Bind events through module functions or Lit event listeners.

- [ ] Expand lint guards.
  - Extend `source/scripts/check-window-cinegen-writes.mjs` allowlist as each workspace/storyboard global is retired.
  - Extend `source/scripts/check-raw-custom-event-strings.mjs` to cover newly touched areas.
  - Run `npm run lint:legacy-globals` before closing each Phase E task.

- [ ] Shrink `bridge/compat.ts` and `types/globals.d.ts`.
  - Remove no-longer-needed exports from `bridge/compat.ts` as call sites are migrated.
  - Remove stale `Window` and `HTMLElementTagNameMap` entries from `types/globals.d.ts` only after call sites are migrated and `npm run build` is verified.

---

## P2 — Bundle and Module Decomposition (Phase D Continuation)

Rationale: large monolithic bundles create circular chunk warnings, slow builds, difficult code review, and tight coupling between concerns that should evolve independently. Decomposition should happen along the same boundaries as the product features above.

- [ ] Continue decomposing `source/src/workspace/workspace-bundle.ts` (~1340 lines, `@ts-nocheck`).
  - Extract MVP flow pieces first: scene selection, breakdown rendering, project sync hooks, table action wiring.
  - Move new shot config / scene detail interactions into typed modules rather than extending the bundle.
  - Remove `@ts-nocheck` incrementally as functions are extracted and typed.

- [ ] Continue decomposing `source/src/storyboard/storyboard-bundle.ts` (~1510 lines).
  - Extract: generation orchestration (→ `storyboard-generation-service.ts`), frame mutation (→ `storyboard-frame-service.ts`), reference gating, selection concern.
  - Do this in the same PRs as the P1 storyboard tasks above.

- [ ] Continue decomposing `source/src/services/status-bar-service.ts` (~1208 lines).
  - Separate: save status, provider/model status, setup status, menu rendering.
  - Keep already-migrated direct imports from regressing to globals.

- [ ] Reduce circular chunk coupling.
  - Track build warnings involving setup assistant, workspace, modals, and panels.
  - Prefer dynamic imports at panel/modal load boundaries; static imports for pure helpers.
  - Verify after each decomposition with `npm run build`.

---

## P2 — Backend Reliability and Decomposition (Phase D Continuation)

Rationale: the server will be the backbone for provider keys, agent calls, `ProductionContext`, review gates, persistence, and state sync. Currently one ~1178-line file (`source/server/proxy.js`) owns all of this.

- [ ] Split `source/server/proxy.js` into route-focused modules.
  - `server/routes/keys-routing.js` — keys/routing/settings store endpoints.
  - `server/routes/provider-proxy.js` — AI provider passthrough (OpenAI, Anthropic, Fal, Replicate, Runway, Luma, xAI, Together).
  - `server/routes/agent-routes.js` — `/api/agents/*` dispatch to Mastra.
  - `server/websocket/state-ws.js` — state WebSocket.
  - `server/lib/json-helpers.js` — shared JSON/body/error response helpers.
  - Keep shared provider registry and agent route constants as imports, not copied constants.

- [ ] Add async write queue for server JSON files.
  - `settings.json`, `keys.json`, `routing.json`, `app-state.json`, `production-context.json` must survive concurrent writes.
  - Use a simple serialized write queue per file path.

- [ ] Add request-body validation for all server write routes using Zod (already a dependency).

- [ ] Wrap orchestrator and review queue endpoints with explicit errors.
  - Return 400/404 JSON for missing `projectId` or `itemId`, not uncaught 500s.

- [ ] Add production parity for state sync.
  - Ensure `source/server/index.mjs` wires the same state WebSocket behavior as the Vite dev proxy.

---

## Current Focus (as of 2026-06-01)

P0 loose ends (features reload, generation-queue lifecycle, shot routing SSOT) are closed. The active front is P1 work: storyboard generation path, assets-in-shots reference pipeline, wizard contracts, and the Drafts scratch surface.

Recommended next steps in order:

1. "Draft Storyboards" batch path from shot list (P1 storyboard) — batch service exists; polish UX + placeholder path.
2. Define wizard output contract (`WizardOutput` interface) before Visual-First wizard completion.
3. Asset-to-reference upload flow (P1 reference pipeline).
4. Project import/export endpoints (P1).
5. Drafts panel scaffold (`drafts.cinedrafts` + feature catalog entry).

---

## Success Criteria

- [ ] A filmmaker can create a blank project and paste a Fountain script without needing the sample project.
- [ ] The app produces navigable scene nodes, breakdown rows, and starter shots deterministically from that script.
- [ ] Each starter shot carries `shotType`, `cameraAngle`, `cameraMovement`, `lightingTechnique`, `composition`, `atmosphereTags`, `status`, and a `scriptLink` anchor.
- [ ] Characters and locations extracted from the script appear in the asset library and are ready to accept uploaded reference images.
- [x] Every project has a mood board initialized at creation with `styleGuide` defaults and at least one empty board slot.
- [ ] A filmmaker can enable only the departments they need without losing data when hiding others.
- [ ] Color palette choices in any wizard or the color wheel update `colorState` and propagate into storyboard prompt generation automatically.
- [x] "Build Shot Prompt" in the Camera/Lighting panel produces a generation-ready prompt including cinematic parameters, color palette, and lighting mood from the style guide. Agent-optimized prompt when agents are configured; local builder fallback when they are not.
- [ ] Uploaded reference images (character face photos, location plates, concept art) are assignable to shots and appear in `refImageUrls` when that shot's prompt is built.
- [ ] User-created projects live in `source/server/projects/` as proper `.cine` directories, not flat key/value blobs.
- [ ] Autosave writes only dirty documents to the server-resident `.cine` directory; a crash mid-save leaves all other documents intact.
- [ ] A project can be exported as a `.cine.zip` download containing all Fountain text, JSON documents, and locally-stored media files.
- [ ] A `.cine.zip` can be imported, validated, and opened as a writable server-resident project.
- [ ] Import validation surfaces specific file and field errors when the package is malformed.
- [x] Bundled sample projects can be duplicated as local writable projects through the serializer → write → load path.
- [ ] Storyboard generation is available when providers are configured, or clearly disabled with a manual text-placeholder path that keeps the app usable offline.
- [ ] Agent-assisted extraction enriches the project when configured but does not block any core workflow step when agents are absent.
- [ ] The AI Director review queue surfaces pending agent outputs and Approve/Reject controls that advance the orchestrator.
- [ ] A filmmaker can generate images and video freely in the Drafts section without a pre-existing shot, and promote successful experiments into shots, storyboard frames, mood board items, or character references.
- [ ] MVP-path script, workspace, storyboard, and save flows use imported services and module events instead of new `window.*` paths.
- [ ] New storage keys, provider routing, and agent route usage go through existing SSOT modules — `storage-keys.ts`, `provider-registry.js`, `agent-routes.js`.
- [ ] `bridge/compat.ts` and `types/globals.d.ts` are smaller after each migrated area, not larger.
- [ ] `npm run build` and `npm run lint:legacy-globals` pass after each PR.
