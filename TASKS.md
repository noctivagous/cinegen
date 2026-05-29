# CineGen — Filmmaker Task List

Goal: get CineGen to a working filmmaker workflow while retiring the legacy architecture across the same areas being built out. Each product task should, where it touches monolithic bundles, global bridges, or duplicated SSOT, also clean up that coupling. Architecture work and feature work should happen together — not in separate passes — so every new capability lands on solid ground.

---

## What We Are Building Toward

Rationale: without a shared definition of "working," every area of the codebase can be partially implemented indefinitely. This section is the minimum viable filmmaker loop. Everything below it serves one of these eight outcomes.

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

---

## P0 — Project Foundation: Create, Save, and Recover

Rationale: every wizard, agent, and department panel writes into one shared project structure. Before anything else, that structure needs to exist, be writable for new projects, be persistable on every meaningful mutation, and be fully recoverable on reload. The current sample project (`ASCENSION_STREAM`) demonstrates the right shape, but there is a foundational gap: user-created projects and `.cine` packages are two disconnected things. User projects exist as flat key/value blobs in the server store. The rich multi-file `.cine` directory format — with separate documents for screenplay, scenes, storyboard, characters, locations, shots, references, sound, and AI queues — is used only by bundled read-only samples compiled into the Vite build via `import.meta.glob`. There is no serializer that goes from current in-memory project state to a `.cine` directory, and no path for the server to read a user-provided `.cine` from disk. Everything in this section works toward closing that gap. Import and export flow from this same foundation.

Architecture note: this section touches `source/src/services/project-service.ts`, `source/src/data/project-data.ts`, `source/src/constants/storage-keys.ts`, `source/src/services/persistence.ts`, and a new `source/server/routes/projects.js`. Any new persistence keys go in `storage-keys.ts` first. No browser-local storage APIs.

- [x] Establish the server-resident project tier.
  - [x] Create a `source/server/projects/` directory. Each subdirectory is a writable `.cine` package (e.g. `source/server/projects/my-film.cine/`) that the server reads and writes at runtime — not compiled into the Vite build.
  - [x] Add a `GET /api/projects` endpoint that lists all server-resident projects (name, id, last-modified) alongside bundled read-only samples, with a `writable: boolean` flag on each entry.
  - [x] Add a `GET /api/projects/:id/load` endpoint that reads the project's `.cine` files from disk (via manifest + per-document hydration), and returns the full `AppliedCineProject` shape (validation gate noted for follow-up when cross-file validator is shared).
  - [x] This third persistence tier sits between the bundled samples (Vite, read-only) and the existing flat key/value store (session-only), and becomes the primary home for all user-created projects.

- [x] Build the project serializer.
  - [x] Create `source/src/services/project-serializer.ts` that converts the current in-memory project state (via `captureRuntimeProjectSnapshot` + `serializeAppliedProject`) into the typed `.cine` document files defined by `cine-project-types.ts`.
  - [x] Core document types mapped: `screenplay.cinescript`, `treatment.cinetreatment`, `storyboard.cinestoryboard`, `scenes.cinescenes`, `breakdown.cinebreakdown`, `characters.cinecharacters`, `locations.cinelocations`, `features.cinefeatures` (project hierarchy enable/order), `references.cinereferenceimages`, `style.cinestyle`. Full coverage of generation queues, agent logs, shot libraries, etc. still tracked in serializer follow-ups.
  - [x] The serializer calls `validateCrossFileIntegrity` for full writes; failures set `valid = false` and surface the error. Incremental writes skip cross-file validation (it requires all documents) but still run `parseCineManifest`.
  - [x] This serializer is the enabling piece for autosave, export, and duplicate-as-local-project.

- [x] Wire autosave to the serializer with incremental dirty-document writes.
  - [x] When a mutation occurs, `markProjectDirty()` fires from: script editor (`fountain-bundle.ts`), scene detail shot edits and reordering (`cinegen-scene-tabs.ts`), camera/lighting chip selections (`camera-lighting-bundle.ts`), mood board mutations (`project-data.ts`), and project features modal.
  - [x] On debounce expiry, serialize and write the dirty documents to the project's server-resident `.cine` directory via `POST /api/projects/:id/documents` (map of filename → content). Flush also callable explicitly via `triggerProjectSave()`.
  - [x] Writing is resilient; bundled `.cine` packages remain read-only (write paths no-op on `entry.file`).
  - [x] Put debounce timing, dirty-tracking, and persistence error reporting behind one imported service in `source/src/services/project-service.ts` (plus direct import to `status-bar-service` for error reporting).
  - [x] No new storage keys added (followed the rule).

- [ ] Define and enforce project snapshot invariants.
  - Required fields: `screenplay.text`, `currentSceneData`, `breakdownData`, `assetLibrary` (characters, locations, costumes, props), `storyboardFrames`, `moodBoards`, `projectFeatures` (sidebar hierarchy enable/order/expanded), `generationLog`, `productionContext` reference anchor.
  - Add normalizers in `source/src/data/project-data.ts` that fill missing fields with safe defaults on load; these run on both server-resident and bundled project loads.
  - Avoid per-component normalization; centralize it in data/service modules.
  - [x] `projectFeatures` defaults: blank/server-create projects → Mood Boards only; bundled/full trees → all catalog branches enabled (migration in `normalizeConfigForProject()`).

- [x] Make new local project creation produce the full scaffold.
  - [x] On "Create Project": `createNewProject()` POSTs to `/api/projects`, the server writes an initial minimal `.cine` package to `source/server/projects/<id>.cine/`, and loads it back through `GET /api/projects/:id/load`.
  - [x] `createNewProject(name, opts)` is typed and used by the Start-from-Script wizard; other wizards to adopt in next slice.

- [x] Surface save status and failures visibly.
  - [x] Add a clear "Saving…", "Saved", and "Save failed" indicator in the status bar (compact `.save-status-badge` following the exact styleguide chip/status aesthetic + icon language from status-mode-badge / project-status badges; states driven by `updateSaveStatus()`).
  - [x] Persistence write failures are surfaced (error state + title detail + console); not swallowed.
  - [x] Continued the status-flow migration: direct imports from `source/src/services/status-bar-service.ts` (no new `window.*` in the save paths).

- [x] Add "Duplicate Sample As Local Project."
  - [x] `duplicateBundledProject(sampleFile, newName)` in `project-service.ts` copies a bundled sample's state through the serializer into a new server-resident `.cine` package.
  - [x] UI added to `cinegen-projects-modal-list.ts`: each read-only sample card shows a **Duplicate** button that creates a writable copy and opens it.
  - [x] Full serializer → write → load round-trip exercised.

- [ ] Extend `npm run validate:cine` to cover server-resident project snapshots.
  - After autosave writes a document, optionally re-validate the affected document against its schema.
  - In the validate script: check all required fields exist after normalization, confirm Fountain text produces matching tree nodes and scene records, and confirm shot/frame cross-references are valid.
  - Run as a pre-build smoke check and on demand during development.

---

## P0 — Progressive Project Setup (Project Features)

Rationale: filmmakers should not face the full ASCENSION_STREAM department tree on day one. A blank project should start with Mood Boards only; departments and tools are enabled progressively without deleting screenplay, scenes, shots, or mood-board data when hidden from the sidebar.

Architecture note: canonical static hierarchy lives in `source/src/tree/project-feature-catalog.ts` (from `ascension-stream.cine/project-tree.cinetree` + Mood Boards). Per-project state is `projectFeatures` on `AppliedCineProject`, persisted as `features.cinefeatures` via the serializer and server `POST /api/projects` / `GET .../load`. Display tree is built in `source/src/services/project-features-service.ts`; `getProjectTreeChildren()` consumes it. Workspace **Section Settings** (`section-visibility-service.ts`) remains a separate, global subsection visibility control for the active department — do not conflate the two.

- [x] Canonical feature catalog with stable `featureId`s and Mood Boards branch.
- [x] Per-project `ProjectFeaturesConfig` (`enabled`, `order`, `parentById`, `expanded`) on snapshot + `features.cinefeatures` document.
- [x] Sidebar **Features** button (next to Tree / Grid / Grid+) opens **Project Features** modal (`cg-feature-tree`: checkboxes + nested drag-and-drop reorder/reparent).
- [x] Blank project default: only **Mood Boards** visible in tree/grid; disabling a branch hides nodes only (data retained).
- [x] Bundled samples / projects with a full tree: all catalog features enabled on first load when no `features` doc exists.
- [x] Alt+1…9 hierarchy shortcuts skip disabled top-level sections.
- [x] Selection reroutes to first enabled node when the current target is hidden after a config change.
- [x] Start-from-Script wizard enables `production-office` and `scenes` branches after `syncFountainToProject()` via `enableFeatureBranch()`.
- [x] Wire `enableFeatureBranch()` (or targeted `enableFeatureIds()`) on other entry wizards when they hydrate departments (Visual-First, Concept/Mood-First, Beat Board, asset import).
- [x] Align **Blank project** toolbar action with server path: `stubNewBlankProject()` now routes through `createNewProject()` so every blank project is server-resident with matching `features.cinefeatures`.
- [x] Serializer incremental flush: honor `DIRTY_DOCS` so only changed files (including `features.cinefeatures`) POST on autosave — `serializeAppliedProject` accepts `dirtyDocTypes` and filters the returned `documents` map.
- [ ] Add `features.cinefeatures` to bundled sample manifests (optional) so duplicated samples carry explicit feature order.
- [ ] Manual QA: enable Script only → paste screenplay → disable Script → reload → Fountain text and scene data still present.

---

## P0 — Script to Production: Fountain → Scenes, Shots, Breakdown

Rationale: the Fountain script is the source of truth for production structure. Everything downstream — scenes, characters, locations, breakdown rows, the shot list, storyboard boards, reference needs, and audio cues — traces back to it. Before agents can enrich and before wizards can guide, the app needs a reliable deterministic pipeline from script text to structured project state. The Fountain parsing infrastructure already exists in `source/src/script/fountain-bundle.ts` and `source/src/workspace/script-info-utils.ts`; the gap is wiring it into a clean, composable project-sync module.

Architecture note: as this path is implemented, migrate high-traffic `fountain-bundle` and `workspace-bundle` global function calls to module imports. Use `CG_TREE_NODE_SELECT` from `source/src/events/shell-events.ts` instead of raw event strings. Use `requestProjectTreeRefresh()` from `source/src/tree/project-tree-service.ts` instead of `window.renderFullTree?.()`.

- [x] Build a `script-to-project` sync module.
  - [x] `source/src/script/script-to-project.ts` parses scene headings, character cues, INT/EXT sluglines, and time-of-day.
  - [x] Produces `currentSceneData`, `breakdownData` rows, `assetLibrary.characters` / `.locations` placeholders.
  - [x] Creates Scenes folder and scene tree nodes via `project-tree-service.ts`.
  - [x] Initializes mood-board attachment points (`sceneReferenceOverrides[sceneId] = {}`).
  - [x] Exposes `syncFountainToProject(text, projectId): ScriptSyncResult` with no globals.

- [x] Create a deterministic starter shot list per scene.
  - [x] For each parsed scene: master shot (LS/WS) + coverage shots based on heuristic.
  - [x] Uses `SceneShot` shape from `scene-types.ts` with `scriptLink` anchors.
  - [x] Deterministic heuristic: dialogue → OTS coverage; action → wide + insert; single-character → MS + CU.
  - [x] Keeps app useful without LLM agents.
  - [ ] Consolidate with backend `generation-agent.js` shot-routing rules (deferred to backend-alignment task).

- [x] Wire the Start-from-Script wizard to this sync.
  - [x] Step 1 now calls `createNewProject()` + `syncFountainToProject()` so downstream data is real.
  - [x] Deterministic baseline runs unconditionally; agent enrichment (`runScriptWizardStep2`) still to wire.
  - [ ] Step 2 UI to show breakdown rows and starter shots (currently shows character/location chips only; shot table integration next slice).

- [ ] Wire script editor changes back into project structure.
  - After meaningful edits, re-run `syncFountainToProject()` with a reconciler that preserves existing scene IDs and user-edited shot lists for scenes whose headings still match.
  - Add a visible "Refresh Breakdown From Script" action for explicit re-sync.
  - Avoid destructive replacement of user-edited data.

- [x] Ensure the sidebar and workspace respond to the sync.
  - [x] After `syncFountainToProject()`, wizard calls `requestProjectTreeRefresh()` (replaced `window.renderFullTree?.()`).
  - [x] Scene nodes open `scene-detail`, storyboard nodes open preprod/storyboard.
  - [x] Start-from-Script wizard enables Production Office + Scenes in **Project Features** after sync (see P0 Progressive Project Setup).
  - [ ] Empty-project placeholder verification pending (blank projects now show Mood Boards only until features are enabled or a wizard runs).

---

## P0 — Shot Architecture with Cinematography Terms

Rationale: the camera-lighting-bundle already contains a complete cinematic vocabulary — shot types (ECU through ELS), angles (Eye-Level through Worm's Eye), lighting techniques (3-Point through Soft Light), composition rules (Rule of Thirds through Symmetry), movements (Static through Crane), and atmosphere descriptors — but this data lives disconnected from the shot records in `currentSceneData`. The "Build Shot Prompt" button in `cinegen-camera-lighting-view.ts` exists but the action has no end-to-end path. This section wires the vocabulary data into per-shot metadata, and those shot parameters into the prompt-building pipeline that the Prompt Engineer Agent and `storyboard-prompt-builder.ts` already consume.

Architecture note: as this path is built, extract the shot parameter accumulation and prompt-dispatch logic from `camera-lighting-bundle.ts` into a narrower `shot-config-service.ts` module rather than extending the existing bundle.

- [x] Define the extended shot metadata schema.
  - [x] `SceneShot` in `source/src/workspace/scene-types.ts` extended with:
    - `shotType`, `cameraAngle`, `cameraMovement`, `lens`, `lightingTechnique`, `composition`, `atmosphereTags`
    - `status: 'planned' | 'storyboarded' | 'prompted' | 'queued' | 'generated' | 'reviewed' | 'approved' | 'rejected' | 'locked'`
    - `linkedFrameIds`, `linkedClipId`, `linkedAudioId`, `sceneReferenceSlots`

- [x] Make the camera-lighting-view write into the active shot.
  - [x] `selectCameraItem()` now writes selections directly into the active shot's metadata via `writeSelectionToActiveShot()` (no globals).
  - [x] Writes to: `shotType`, `cameraAngle`, `cameraMovement`, `lightingTechnique`, `composition`, `atmosphereTags`.
  - [x] Shot config reflected back into `currentSceneData` for persistence.
  - [x] Chip selections auto-initialize from the active shot when the panel opens.
    - `syncCameraSelectionsFromActiveShot()` in `camera-lighting-bundle.ts` reads shot metadata into `cameraLightingSelections` before rendering.
    - Wired to `previs-selection-changed` event so selecting a different shot updates chips automatically.

- [~] Wire "Build Shot Prompt" through to the Prompt Engineer Agent.
  - [x] `buildCameraPrompt()` now gathers active shot's cinematography parameters first, falling back to global selections.
  - [x] Includes `colorState.getPalette()` and `styleGuide` fields in prompt context.
  - [x] Shows resulting prompt in `alertCG` (per-shot prompt bar enhancement pending).
  - [ ] Full agent dispatch via `agents-service.ts → buildGenerationPrompt()` not yet wired; currently falls back to local prompt builder.
  - [ ] Provider choice recording on shot pending.

- [~] Define and enforce the shot lifecycle.
  - `planned` → shot exists with basic coverage heuristics but no cinematography detail.
  - `storyboarded` → at least one frame is linked to the shot.
  - `prompted` → a generation prompt has been built and approved.
  - `queued` → shot is in the generation queue.
  - `generated` → a clip exists for the shot.
  - `reviewed` → clip has been reviewed in AI Director.
  - `approved` / `rejected` / `locked` — terminal review states.
  - [ ] Enforce valid transitions; do not allow `queued` without `prompted`.
  - [x] Surface status as a colored badge on shot rows in the scene detail overview and coverage tabs.

- [~] Make the shot list table in scene detail editable.
  - [x] Allow inline editing of shot type, angle, and movement via dropdowns in each coverage shot card.
  - [x] Allow reordering shots within a scene.
    - Up/down arrow buttons on each coverage shot card in `cinegen-scene-tabs.ts`.
    - `_reorderShot()` swaps adjacent shots and `_renumberShots()` reassigns sequential shot numbers.
  - [x] Show per-shot generation status badges.
  - [x] Avoid rebuilding the table from a global render function; bind events through module functions.

- [ ] Consolidate backend shot routing with frontend shot types.
  - `backends/agents/cinematography/generation-agent.js` has its own shot-type → provider routing rules.
  - `backends/agents/tools/provider-router.tool.js` has a parallel set.
  - Move shared routing rules into one backend module and consume from both places.
  - Ensure `source/src/constants/provider-registry.js` is the SSOT for provider metadata on both sides.

---

## P0 — Mood Board as Visual DNA

Rationale: the mood board is the visual contract between the filmmaker's intent and what gets generated. Color palette, lighting mood, texture references, and atmospheric still frames all live here. The infrastructure is in place: `moodboard-generation.ts` queues generation jobs, `moodboard-persistence.ts` handles load/save, `cinegen-moodboards-panel.ts` renders the grid, and `colorState` from `source/src/color/color-state.ts` already feeds into `storyboard-prompt-builder.ts`. The gap is that none of this is connected to the new-project path or surfaced as a first-class filmmaker step in the wizards.

Architecture note: mood board item types `'image' | 'video' | 'sound' | 'text'` should remain the canonical set; do not add new type literals outside `source/src/data/project-data.ts`.

- [x] Initialize mood-board scaffolding in the new-project path.
  - [x] Every new project starts with a default "Visual DNA" mood board (`referenceImages` document).
  - [x] Each scene gets an empty `sceneReferenceOverrides` entry on sync.
  - [x] `styleGuide` defaults stored in project scaffold (client `createBlankSnapshot` + server `POST /api/projects`).

- [x] Wire the Concept/Mood-First wizard into mood board state.
  - The wizard's `moodDescription`, `lightingDesc`, `atmosphereTags`, `atmosphereNotes`, and `colorPalette` fields (already in `concept-wizard-state.ts`) should write directly into the project's `styleGuide` on wizard completion.
  - Extracted palette colors should populate `colorState` so they propagate automatically to the storyboard prompt builder.
  - The wizard's generated images should be added as mood board items of type `'image'`.
  - Done via `applyConceptWizardSceneKit()` in `concept-wizard-bundle.ts`.

- [x] Make mood board → style guide → shot prompt a visible data pipeline.
  - In the Camera/Lighting panel, show an indicator when the active project style guide has color palette or lighting mood values. (Done in `cinegen-camera-lighting-view.ts` `_renderStyleGuideIndicator()`.)
  - When "Build Shot Prompt" is triggered, explicitly incorporate `colorState.getPalette()` and `styleGuide.lightingMood` into the prompt context. (Done in `camera-lighting-bundle.ts` `buildCameraPrompt()`.)
  - Let users see and override these values per shot without losing the project-level defaults.

- [x] Add image upload to mood boards.
  - Accept drag-drop or file picker for still images (JPG, PNG, WebP).
  - Store as mood board item of type `'image'` with a local file URL.
  - Allow marking any mood board image as a "style reference" that becomes a `refImageUrl` in storyboard prompt generation.
  - Drag-drop and file picker exist in `cinegen-moodboards-view.ts`. Style reference toggle added to `cinegen-moodboard-item-viewer.ts`; sets `styleGuide.styleReference` which `buildCameraPrompt()` already consumes.

- [ ] Surface mood board in the Beat Board and Visual-First wizards.
  - Beat board entries have a `assetNeeds` field and a camera notes field; link these to mood board items as loose references.
  - Visual-First wizard upload flow should add uploaded images as mood board items and reference slots simultaneously.

- [x] Wire `colorState` persistence into project save.
  - [x] On project load (`applyMutableProjectState`): seeds `colorState` from `styleGuide.colorPalette`.
  - [x] On snapshot capture (`captureRuntimeProjectSnapshot`): merges `colorState.getPalette()` into `styleGuide.colorPalette`.
  - [x] Round-trips through `.cine` `style` document.

---

## P1 — Assets in Shots: The Reference Pipeline

Rationale: the most sophisticated thing CineGen can do for a filmmaker is use their actual visual assets — photos of real actors, location scouts, costume reference sheets, concept art — as anchors for AI generation. This turns generic AI output into production-consistent imagery. The pipeline already has the schema for it: `CharacterGuideEntry` has `references.face / body / profile / threeQuarter / closeUp / costume[]`, `LocationGuideEntry` has `references: string[]`, and `storyboard-prompt-builder.ts` already calls `getReferenceImageUrls()` to build `refImageUrls` for each generation request. The gap is the upload-to-reference flow that populates those fields and makes them selectable per shot.

Architecture note: keep all reference URL storage server-backed. Do not store image data in browser localStorage. Asset file handling belongs in `source/src/moodboards/moodboard-files.ts` or a dedicated `source/src/assets/asset-upload-service.ts`.

- [ ] Build an asset-to-reference flow.
  - A filmmaker should be able to: drag an image onto a character → it becomes a face/costume reference. Drag an image onto a location → it becomes a location plate. Drag an image onto a shot → it becomes a per-shot style reference override.
  - Accept JPG, PNG, WebP, PDF (first page), and short video thumbnails.
  - Write uploaded references into `CharacterGuideEntry.references.*` or `LocationGuideEntry.references[]` through a typed service call.

- [ ] Surface per-shot reference slot UI.
  - Each shot in the scene detail can show its linked reference images (characters, location plate, style override).
  - Allow adding, removing, and reordering reference slots per shot.
  - These populate `SceneShot.sceneReferenceSlots` and flow into `getReferenceImageUrls()` when the prompt is built.

- [ ] Make the Casting and Production Design agents use uploaded references.
  - When `buildCharacterGuides()` is called from `agents-service.ts`, include any existing uploaded face/costume references so the agent can describe and label them rather than inventing placeholder descriptions.
  - Same for `buildLocationGuides()` with uploaded location plates.
  - The agent outputs enriched guide entries back into the same reference slots, not a separate data structure.

- [ ] Add a "Use as Shot Reference" action to asset views.
  - From any asset detail view, provide a button to assign that asset as a reference for a specific shot (character angle, location plate, or style override).
  - This creates or updates the `sceneReferenceOverrides` entry for that scene and shot.

- [ ] Preserve stable reference IDs across project saves.
  - Reference image slots must survive save/load cycles with the same IDs so storyboard prompts built before a save remain valid after reload.
  - Confirm `moodboard-persistence.ts` and `project-data.ts` serialize and restore reference slot arrays correctly.

- [ ] Make the storyboard reference bank a first-class UI concept.
  - Surface `storyboardReferenceBank` and `sceneReferenceOverrides` in the storyboard panel so filmmakers understand which reference images will be sent to generation.
  - Allow toggling individual references off per generation without deleting them from the project.

---

## P1 — Agent Scaffolding: Connecting the Mastra Layer to the Filmmaker Loop

Rationale: all twelve Mastra agents are implemented and all API routes are registered. The `agents-service.ts` client exists with typed methods for every department. The orchestrator state machine is in place. The gap is that the agents do not yet have a clear, reliable path from user action to agent call to UI state update to human review gate. Without this path, the agents are just backend services that nobody surfaces to the filmmaker. This section builds the wiring, not the agents themselves.

Architecture note: all agent endpoints are already defined in `source/src/constants/agent-routes.js`. New call sites must consume those constants — no new route string literals in UI code. Agent outputs must flow through the `ProductionContext` adapter into UI project state, not directly into UI globals.

- [x] Build a `ProductionContext` → UI project state adapter.
  - [x] Define a single typed adapter (`source/src/services/agent-context-adapter.ts`) that converts `ProductionContext.shotList[]` entries into `SceneShot` records, `characterGuide[]` into `assetLibrary.characters` with reference slots, and `locationGuide[]` into `assetLibrary.locations`.
  - [x] Use this adapter in all places where agent output needs to appear in the UI: wizards, AI Director panel, storyboard refresh after agent approval.
  - [x] Avoid a split where agents write `production-context.json` but the UI reads only `currentSceneData`.

- [x] Wire script agent analysis into the Start-from-Script wizard.
  - [x] Step 2 calls `analyzeScript()` via `runScriptWizardStep2()` when agent health is confirmed.
  - [x] Results fetched via `getProductionContext()` and mapped through `applyProductionContext()` into project state.
  - [x] Character guides, location guides, shot list, and style guide are non-destructively merged.
  - [x] Fall back to deterministic `syncFountainToProject()` when agent is not configured; wizard never blocks silently.

- [x] Surface `/api/agents/health` in Setup and wizard entry points.
  - [x] Show agent readiness (LLM key configured, Mastra booted) in Setup Assistant done step as a readable row with spinner / check / xmark icon.
  - [x] `agents-service.ts → getAgentHealth()` wired to `sa-step-done` Lit component; fetches asynchronously on mount.
  - [x] Do not let a wizard suggest AI analysis will run if agent health returns false.
  - [x] Every agent call in `script-wizard-bundle.ts` checks `getAgentHealth()` first and falls back to deterministic behavior with a visible toast when agents are unavailable.

- [x] Build the AI Director review queue UI.
  - [x] Surface `getReviewQueue()` results in the AI Director department panel (`cinegen-review-queue-view`).
  - [x] Each queue item shows the agent that produced it, the type of output (shot list, character guide, storyboard frame, prompt), notes preview, and Approve/Reject controls.
  - [x] Calling `approveReviewItem()` triggers the next orchestrator step and refreshes the queue.
  - [x] Calling `rejectReviewItem()` re-queues the work with a feedback note and refreshes the queue.

- [ ] Make agent LLM key resolution consistent with Settings keys.
  - Currently the proxy can use `source/server/keys.json` while Mastra agents depend on `backends/.env`.
  - Make `getMastra()` in `backends/agents/mastra.js` read from the same server-backed key store used by Settings → API Keys.
  - Reload/reinitialize Mastra when keys change via `/api/settings/keys`.
  - Add this to the provider/routing SSOT rather than creating a second settings path.

- [ ] Harden `agentFetch()` for error conditions.
  - Return typed error shapes for: agent not configured, missing key, 4xx/5xx responses, non-JSON bodies.
  - Show these as actionable UI messages (not silent failures) in the wizard and department panels.

- [ ] Ensure the orchestrator state machine is resumable after reload.
  - The orchestrator state in `agents.db` should survive server restarts.
  - The frontend should be able to check `getReviewQueue()` on load and restore any pending review state.

---

## P1 — Wizard Completion and Contracts

Rationale: there are five entry wizards (Start-from-Script, Visual-First, Concept/Mood-First, Asset Import, Beat Board) plus the in-workflow Storyboard Sketch wizard. Each already has state bundles, slide definitions, and a window API. What they lack is a shared output contract: a definition of exactly what project artifacts each wizard is responsible for producing, and a shared delivery path so that a Visual-First project and a Script-First project arrive at the same dependable project shape. Without this, agents, mood boards, shots, and generation flows will be partially hydrated depending on which wizard was used.

- [ ] Define the wizard output contract.
  - Each wizard must produce a complete project scaffold (via `createNewProject()`), add screenplay text (Fountain or generated outline), produce scene nodes, contribute to `assetLibrary`, contribute to `styleGuide` / `colorState`, and produce at least placeholder shots.
  - Document the specific outputs of each wizard as a typed `WizardOutput` interface.
  - Route all wizard completions through shared project sync/adapters rather than each wizard building its own partial project state.

- [ ] Complete the Start-from-Script wizard (8 steps).
  - Step 1: paste/import Fountain, name project, create scaffold.
  - Step 2: review extracted characters, locations, breakdown, and starter shots (agent-enriched if configured).
  - Step 3: casting setup — assign reference images to characters, accept or edit guides.
  - Step 4: production design setup — assign location plates, accept or edit location guides.
  - Step 5: style guide — color palette, lighting mood, visual tone (writes into `styleGuide` and `colorState`).
  - Step 6: mood board seeding — generate or upload 3–5 reference images for the project mood board.
  - Step 7: shot coverage review — confirm or add cinematography parameters to starter shots.
  - Step 8: generate initial storyboard frames for the first 3 scenes.

- [ ] Complete the Visual-First wizard.
  - Upload images (characters, locations, concept art, reference stills) → auto-identify as character/location/style references.
  - Set lighting mood, style notes, color palette from uploaded images (using color extractor agent).
  - Generate a script outline from the visual assets.
  - Produce scene kit (scenes based on identified locations, characters cast from uploaded faces).

- [x] Complete the Concept/Mood-First wizard.
  - Mood description, scene settings, lighting description, atmosphere tags → produce `styleGuide`.
  - Color palette → populate `colorState`.
  - Character archetypes → produce placeholder character entries.
  - Generate 3–5 mood board images from the concept description.
  - Generate a style-locked prompt template for all future shot prompts.
  - Implemented via `applyConceptWizardSceneKit()` in `concept-wizard-bundle.ts`, called on Slide 8 (Scene Kit Initialization).

- [x] Complete the Beat Board wizard (8 slides).
  - Story beats with title, description, camera notes, asset needs, and duration.
  - Beat-to-shot mapping: each beat maps to one or more shots with initial cinematography parameters.
  - Import beat board as project Fountain outline and shots.
  - Option to trigger Storyboard Agent on the resulting shots.
  - Implemented via `applyBeatBoardSceneKit()` in `beat-board-bundle.ts`: generates Fountain from beats, calls `syncFountainToProject()`, enriches scenes with beat-derived shots, and adds characters/locations to asset library. Storyboard Agent trigger added to Slide 7.

- [x] Add a shared wizard completion hook.
  - After any wizard completes, call: `syncFountainToProject()` (if screenplay text changed), `enableFeatureBranch()` for departments the wizard touched, autosave, tree refresh, and navigate to the first enabled scene or mood board.
  - No wizard should end on a blank screen.
  - Implemented in `source/src/wizard/wizard-completion-hook.ts` as `runWizardCompletion()`. All five entry wizards (Script, Visual-First, Concept/Mood-First, Asset Import, Beat Board) now use it on scene-kit build.

---

## P1 — Storyboard as Shot Visualization

Rationale: storyboard frames are where cinematography intent becomes visible. The storyboard component is working, the shot/frame bridge is implemented, and the prompt builder already integrates camera parameters and references. The gap is a reliable "Draft Storyboards" path that starts from shots — not from a reference bank requirement — and that works both with and without configured AI providers.

Architecture note: as generation logic is touched, extract it from the 1510-line `storyboard-bundle.ts` into smaller service modules. Remove inline string event handlers from storyboard HTML fragments and bind events through module functions. This is Phase E of the architecture plan.

- [ ] Add a "Draft Storyboards" path that starts from the shot list.
  - For each shot with at least a `shotType` and `sceneId`: build a prompt from camera parameters + style guide.
  - If provider keys are configured: generate a frame image.
  - If no provider is configured: create a text-placeholder frame with the shot parameters displayed as a slate.
  - Show generation progress clearly (queued, generating, failed) so the filmmaker knows what happened.

- [ ] Ensure all generated frames are linked to shots by default.
  - Every frame created through the "Draft Storyboards" path gets `scene`, `shotId`, `duration`, and `scriptLink` metadata.
  - Run `reconcileShotFrameLinks()` after batch generation.
  - The shot lifecycle advances from `storyboarded` once a frame is linked.

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
  - Keep the public API small and typed.
  - Replace `window.*` global reads/writes in the touched paths with module imports.

---

## P1 — Project Import and Export

Rationale: because the project serializer and server-resident project tier are built in P0, import and export are natural extensions — not separate features requiring new persistence designs. Export zips the server-resident `.cine` directory and offers it as a download. Import accepts that zip, extracts it server-side, validates it, and registers it as a new server-resident project. The `.cine` format's document-per-concern design means the zip contains readable text files: a filmmaker can inspect, version-control, or manually edit the Fountain script or JSON documents before re-importing. Binary media (generated images, video clips) is referenced by URL rather than embedded, so the zip stays small — typically a few hundred KB of JSON for a short film, regardless of how many frames have been generated.

Architecture note: zip handling belongs on the server (Node's built-in `zlib` plus `tar` or a lightweight zip library). The client only needs a file picker for import and an anchor-download trigger for export. Do not handle zip bytes in the browser. Validate through `parseCineManifest` + `validateCrossFileIntegrity` before any imported project appears in the project list.

- [ ] Add `GET /api/projects/:id/export` — export as `.cine` zip.
  - Before zipping, run the serializer to flush any dirty in-memory state to the server-resident package directory, ensuring the export reflects the current session.
  - Zip the entire `.cine` directory (preserving the directory structure: `cine.manifest.json` at root, one file per document).
  - Stream the zip back as `Content-Disposition: attachment; filename="<project-name>.cine.zip"`.
  - Expose as a "Download Project" action in the toolbar Projects menu and the project settings modal.
  - The zip is self-contained: another CineGen instance can import it directly without any additional server state.

- [ ] Add `POST /api/projects/import` — import a `.cine` zip.
  - Accept a multipart file upload of a `.cine.zip`.
  - Extract to a temporary directory, then validate: run `parseCineManifest` on `cine.manifest.json`, run `validateCrossFileIntegrity` across all referenced document files.
  - On validation success: copy to `source/server/projects/<id>.cine/` (using the project ID from the manifest, disambiguating if it already exists).
  - On validation failure: return a structured JSON error listing every schema violation; do not install the project.
  - Return the new project's entry (id, name, writable: true) on success.
  - Expose as "Import Project…" in the toolbar Projects menu with a file picker that accepts `.cine.zip`.

- [ ] Add import/export to the Projects modal UI.
  - In `cinegen-projects-modal-list.ts`: add an "Import Project…" button at the top of the list.
  - On each writable project row: add a "Download" icon that triggers the export endpoint.
  - On each read-only (bundled) sample row: add a "Duplicate as Local Project" option that creates a writable copy (uses the serializer path from P0).
  - Show a progress indicator during import (upload + server-side extraction can take a moment for large projects).
  - Show validation errors inline if import fails, with specific file and field references from the validator.

- [ ] Handle media URL portability in export and import.
  - Generated images and video clips are stored as absolute provider URLs or local server paths. On export, record all `refImageUrls`, `mediaRefs`, and `generatedRefs` that point to local server paths.
  - Add a `media/` folder to the zip for any referenced local files that exist in `source/server/projects/<id>.cine/media/` (uploaded reference images, locally-stored storyboard thumbnails).
  - On import, rewrite local path references to point to the newly installed project's media directory.
  - Provider-generated URLs (Fal, Replicate, Runway, etc.) remain as external URLs and are noted in the import UI as "external references — may expire."

- [ ] Add a `GET /api/projects/:id/export/manifest` — lightweight export preview.
  - Return a JSON summary: project name, scene count, shot count, storyboard frame count, asset counts, agent log entry count, and a list of any external media URLs included.
  - Surface this in the export confirmation dialog so the filmmaker knows what is included before downloading.

- [ ] Version the `.cine` format explicitly.
  - `CINE_PROJECT_VERSION` is already declared in `cine-project-types.ts` as `2`.
  - On import, if the version is older, run a migration function that upgrades the document structure before validation.
  - On import, if the version is newer than the current app supports, reject with a clear message: "This project was created with a newer version of CineGen."
  - Add a `migrations/` module in `source/src/data/` that maps version numbers to upgrade functions; keep migrations additive and non-destructive.

---

## P2 — Legacy Bridge Retirement (Phase C/E Continuation)

Rationale: Phases A and B are complete (SSOT, provider registry, agent routes, setup decomposition, script wizard extraction, toolbar concern split, setup-assistant-bundle decomposition). Phase C provider/settings/status migration is complete. The remaining legacy surface is workspace/storyboard/toolbar/chip/fountain flows — the highest-traffic paths in the filmmaker loop. Retiring these globals in the same tasks as the P0/P1 features above is the most efficient approach: touch the code once, clean it up in the same PR.

Progress reference: `source/ARCHITECTURE-LEGACY-PROGRESS.md`.

- [ ] Inventory remaining `window.*` paths in workspace, storyboard, toolbar, chip, and fountain bundles.
  - Run `rg "window\." source/src/{workspace,storyboard,toolbar,services,components}` plus owner/module notes.
  - Rank by user-path frequency: script import/edit, tree refresh, scene selection, storyboard generation, save, breakdown table, chip nav.
  - Record the target module/service/store replacement for each inventoried path.
  - Track completion as the related P0/P1 tasks land.

- [ ] Replace workspace/storyboard globals as P0/P1 paths are implemented.
  - `window.renderFullTree?.()` → `requestProjectTreeRefresh()`
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
  - Both guards run in `npm run lint:legacy-globals`; run this before closing each Phase E task.

- [ ] Shrink `bridge/compat.ts` and `types/globals.d.ts`.
  - Remove no-longer-needed exports from `bridge/compat.ts` as call sites are migrated.
  - Remove stale `Window` and `HTMLElementTagNameMap` entries from `types/globals.d.ts` only after call sites are migrated and `npm run build` is verified.

---

## P2 — Bundle and Module Decomposition (Phase D Continuation)

Rationale: large monolithic bundles create circular chunk warnings, slow builds, difficult code review, and tight coupling between concerns that should evolve independently. The biggest offenders identified in the architecture report are still open. Decomposition should happen along the same boundaries as the product features: project sync, shot config, mood board, **project features** (`project-features-service.ts`, `project-feature-catalog.ts`), wizard contracts, storyboard orchestration, save state, and provider setup.

- [ ] Continue decomposing `source/src/workspace/workspace-bundle.ts` (currently 1340 lines, `@ts-nocheck`).
  - Extract MVP flow pieces first: scene selection, breakdown rendering, project sync hooks, table action wiring.
  - Move new shot config / scene detail interactions into typed modules rather than extending the bundle.
  - Remove `@ts-nocheck` incrementally as functions are extracted and typed.

- [ ] Continue decomposing `source/src/storyboard/storyboard-bundle.ts` (currently 1510 lines).
  - Extract: generation orchestration (→ `storyboard-generation-service.ts`), frame mutation (→ `storyboard-frame-service.ts`), reference gating, selection concern.
  - Do this in the same PRs as the P1 storyboard tasks above.

- [ ] Continue decomposing `source/src/services/status-bar-service.ts` (currently 1208 lines).
  - Separate: save status, provider/model status, setup status, menu rendering.
  - Keep already-migrated direct imports from regressing to globals.

- [ ] Keep `source/src/toolbar/toolbar-modals-service.ts` as compatibility glue only.
  - Move new wizard, project, and debug behavior into the existing extracted toolbar modules.
  - Delete compatibility wrappers once all imports have moved.

- [ ] Reduce circular chunk coupling.
  - Track build warnings involving setup assistant, workspace, modals, and panels.
  - Prefer dynamic imports at panel/modal load boundaries and static imports for pure helpers.
  - Verify after each decomposition with `npm run build`.
  - This is Phase D of the architecture plan.

---

## P2 — Backend Reliability and Decomposition (Phase D Continuation)

Rationale: the server will be the backbone for provider keys, agent calls, `ProductionContext`, review gates, persistence, and state sync. Currently one 1178-line file (`source/server/proxy.js`) owns all of this. Splitting it now prevents future agent and wizard endpoints from accumulating in one fragile file and makes it possible to add auth, validation, and async write safety to specific modules without affecting everything else.

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

- [ ] Add request-body validation for all server write routes.
  - Reject malformed vendor/routing records, settings patches, and agent request bodies with clear JSON error responses.
  - Use Zod (already a dependency) for validation schemas.

- [ ] Wrap orchestrator and review queue endpoints with explicit errors.
  - Return 400/404 JSON for missing `projectId` or `itemId`, not uncaught 500s.

- [ ] Add production parity for state sync.
  - Ensure `source/server/index.mjs` wires the same state WebSocket behavior as the Vite dev proxy.

- [ ] Document local-only deployment assumptions.
  - The `/api/*` surface has no auth; document this clearly in `source/server/` as acceptable for local dev only.
  - If multi-user or cloud deployment becomes a goal, add an auth/security task before exposing the server externally.

---

## Recommended First Sprint

Rationale: this sprint establishes the scaffolding that all future work can reuse — a reliable project shape grounded in the `.cine` format, a working script-to-scenes path, incremental autosave, agent fallbacks, mood board initialization, and the first shot records with cinematography metadata. Doing this together means the second sprint can immediately add reference assets, generate storyboard frames, wire the AI Director review gate, and implement import/export without first redesigning how projects are stored. Each item also touches Phase C/E legacy cleanup so that the app emerges from the sprint with fewer globals on the MVP path, not more.

**Progress (2026-05-28):** Server-resident `.cine` tier (dir + GET list/load + writable flags in Projects hub) + real serializer with core document mappings + autosave (dirty tracking + debounce + POST /documents) + visible save status ("Saving…"/"Saved"/"Save failed" badge in status bar following styleguide patterns) complete. All changes server-backed only, direct imports for status service, type-checked + no new lints. Read-only samples clearly distinguished via badges. (See P0 Project Foundation section below for detailed sub-task status.)

**Progress (2026-05-29):** **Project Features** modal + `features.cinefeatures` persistence + display-tree filtering (blank → Mood Boards only). Start-from-Script wizard enables Production Office and Scenes after script sync. See **P0 — Progressive Project Setup (Project Features)**.

- [x] Establish the server-resident project tier: create `source/server/projects/`, add `GET /api/projects` and `GET /api/projects/:id/load` endpoints, update the project list to show all tiers with `writable` flags.
- [x] Build the project serializer (`source/src/services/project-serializer.ts`): in-memory state → typed `.cine` document files, with validation as the final step.
- [x] Implement `syncFountainToProject()`: scenes, breakdown rows, starter shots with cinematography schema.
- [x] Wire Start-from-Script wizard to `syncFountainToProject()` and `createNewProject()` (which writes the initial `.cine` package to the server-resident tier).
- [x] Wire autosave to the serializer with dirty-document tracking; write only changed documents to `POST /api/projects/:id/documents`.
- [x] Add visible save status and read-only project indicator.
- [x] Implement "Duplicate Sample As Local Project" to exercise the serializer → write → load round-trip before import/export depends on it.
- [ ] Add agent-health check in wizard entry; fall back to deterministic parsing when agent is not configured.
  - Note: deterministic fallback already works (sync runs unconditionally); agent-health badge still to wire in UI.
- [x] Initialize mood-board scaffolding and `styleGuide` defaults in every new project.
- [x] Wire `colorState` persistence to project save/load (through `styleGuide.colorPalette` in the serializer).
- [x] Extend shot schema to include `shotType`, `cameraAngle`, `cameraMovement`, `lightingTechnique`, and `status` fields.
- [x] Surface shot lifecycle status badges in scene detail (overview list + coverage cards).
- [x] Add inline shot type / angle / movement dropdowns to coverage shot cards.
- [~] Make "Build Shot Prompt" in the Camera/Lighting panel produce a real prompt from shot params + style guide.
  - Produces real prompt from active shot metadata.
  - `colorState.getPalette()` and `styleGuide` integration in prompt text still pending.
  - Full agent dispatch and prompt-bar persistence pending.
- [x] Inventory and replace MVP-path globals touched by: script import, tree refresh, scene selection, storyboard generation, and save.
  - Replaced: `window.renderFullTree?.()` → `requestProjectTreeRefresh()`; `window.renderBreakdownTable?.()` → `renderBreakdownTable()` import; `window.hydrateScriptEditorFromProject?.()` → direct import; `window.scheduleFountainRender?.()` → direct import.
  - Remaining globals in workspace-bundle, storyboard-bundle, fountain-bundle tracked for next slice.
- [ ] Verify end-to-end: new project → paste script → scenes appear → scene detail opens → starter shots appear with cinematic metadata → mood board initialized → autosave writes to server-resident `.cine` directory → reload → full project state restores.
  - Partial: script sync, tree creation, starter shots, mood board scaffold, style guide, and server-resident create are implemented. Full reload round-trip verification pending manual QA.
- [x] Run `npm run build` and `npm run lint:legacy-globals` after code changes; fix new warnings before closing tasks.

---

## Success Criteria

Rationale: these are not aspirational — they are the checks that confirm the task list has built real foundations rather than just adding screens. Passing them means future agents, wizards, mood boards, shots, storyboards, generated clips, reference assets, review gates, and timeline assembly all have a dependable base to work from.

- [ ] A filmmaker can create a blank project and paste a Fountain script without needing the sample project.
- [ ] The app produces navigable scene nodes, breakdown rows, and starter shots deterministically from that script.
- [ ] Each starter shot carries `shotType`, `cameraAngle`, `cameraMovement`, `lightingTechnique`, `composition`, `atmosphereTags`, `status`, and a `scriptLink` anchor.
- [ ] Characters and locations extracted from the script appear in the asset library and are ready to accept uploaded reference images.
- [x] Every project has a mood board initialized at creation with `styleGuide` defaults and at least one empty board slot.
- [~] A filmmaker can enable only the departments they need (e.g. Script + Storyboard + Mood Boards) without losing data when hiding others.
  - Implemented via **Project Features** modal; verify across reload and server-resident projects.
- [ ] Color palette choices in any wizard or the color wheel update `colorState` and propagate into storyboard prompt generation automatically.
- [ ] "Build Shot Prompt" in the Camera/Lighting panel produces a generation-ready prompt that includes cinematic parameters, color palette, and lighting mood from the style guide.
- [ ] Uploaded reference images (character face photos, location plates, concept art) are assignable to shots and appear in `refImageUrls` when that shot's prompt is built.
- [ ] User-created projects live in `source/server/projects/` as proper `.cine` directories, not flat key/value blobs.
- [ ] Autosave writes only dirty documents to the project's server-resident `.cine` directory; a crash mid-save leaves all other documents intact.
- [ ] A project can be exported as a `.cine.zip` download that contains all Fountain text, JSON documents, and locally-stored media files.
- [ ] A `.cine.zip` can be imported, validated against the full `validateCrossFileIntegrity` schema, and opened as a writable server-resident project.
- [ ] Import validation surfaces specific file and field errors when the package is malformed, rather than a generic failure.
- [ ] Bundled sample projects can be duplicated as local writable projects through the serializer → write → load path.
- [ ] External media URLs (provider-generated images/clips) are preserved as-is in the export and noted in the import UI as potentially expiring.
- [ ] Storyboard generation is available when providers are configured, or clearly disabled with a manual text-placeholder path that keeps the app usable offline.
- [ ] Agent-assisted extraction (script analysis, guides, prompts) enriches the project when configured but does not block any core workflow step when agents are absent.
- [ ] The AI Director review queue surfaces pending agent outputs and Approve/Reject controls that advance the orchestrator.
- [ ] MVP-path script, workspace, storyboard, and save flows use imported services and module events instead of new `window.*` paths.
- [ ] New storage keys, provider routing, and agent route usage go through existing SSOT modules — `storage-keys.ts`, `provider-registry.js`, `agent-routes.js`.
- [ ] `bridge/compat.ts` and `types/globals.d.ts` are smaller after each migrated area, not larger.
- [ ] `source/server/proxy.js` is split into route-focused modules without duplicating provider or agent route constants.
- [ ] `npm run build` and `npm run lint:legacy-globals` pass after each PR.


---

## Condition Assessment (as of 2026-05-29)

This section is a snapshot of what has been built, what works reliably, and where the known gaps are. It is an honest read of the codebase, not aspirational.

### What Is Solid

**Project foundation.** The three-tier project model is working. Bundled read-only samples load through Vite's `import.meta.glob`. Server-resident writable projects exist in `source/server/projects/` and are created, loaded, and incrementally written via the `GET /api/projects`, `GET /api/projects/:id/load`, `POST /api/projects`, and `POST /api/projects/:id/documents` endpoints in `proxy.js`. The `Duplicate Sample As Local Project` path exercises the full serializer → write → load round-trip and has been verified to work.

**Serializer.** `project-serializer.ts` maps `AppliedCineProject` snapshots to the ten core `.cine` document files: `screenplay.cinescript`, `treatment.cinetreatment`, `storyboard.cinestoryboard`, `scenes.cinescenes`, `breakdown.cinebreakdown`, `characters.cinecharacters`, `locations.cinelocations`, `references.cinereferenceimages`, `style.cinestyle`, and `features.cinefeatures`. These cover the MVP filmmaker loop documents. The AI Director department documents (generation queue, review queue, agent log) and cinematography documents (shot library, camera presets, spatial annotations) are not yet serialized; those paths have explicit TODOs.

**Autosave.** Dirty-document tracking with debounce is in place via `markProjectDirty()` and `triggerProjectSave()` in `project-service.ts`. Write failures surface as a visible "Save failed" badge with console detail. Read-only bundled projects correctly no-op on write paths.

**Validator.** `validateCrossFileIntegrity` in `cine-project-loader.ts` is thorough: it validates referential integrity across scenes, characters, locations, shots, frames, tree nodes, asset detail keys, media paths, and output path status. It runs on every bundled package load. This is a strong foundation.

**Script → project sync.** `syncFountainToProject()` in `source/src/script/script-to-project.ts` deterministically produces scenes, breakdown rows, starter shots (ECU through ELS), character and location placeholders, and mood-board attachment points from a Fountain script with no LLM dependency. The Start-from-Script wizard triggers this on step 1 and enables the right feature branches after sync.

**Shot architecture.** `SceneShot` in `scene-types.ts` carries `shotType`, `cameraAngle`, `cameraMovement`, `lens`, `lightingTechnique`, `composition`, `atmosphereTags`, `status`, `linkedFrameIds`, `linkedClipId`, `linkedAudioId`, and `sceneReferenceSlots`. Coverage shot cards show status badges; inline dropdowns allow editing. Reorder up/down is wired.

**Project Features.** The progressive disclosure system (blank project → Mood Boards only; wizard completion → enable departments) is working end-to-end with `features.cinefeatures` persistence, the modal UI, `Alt+1…9` section jumping respecting disabled sections, and selection rerouting on config change.

**Legacy bridge retirement.** Phase A (SSOT), Phase B (bundle decomposition), and Phase C (provider/settings/status migration) are complete. Lint guards (`check-window-cinegen-writes.mjs`, `check-raw-custom-event-strings.mjs`) enforce no new unguarded globals on committed MVP paths. Phase D (structural cleanup) and Phase E (workspace/storyboard globals) are open.

**Agent layer.** All twelve Mastra agent routes are registered. `agent-context-adapter.ts` maps `ProductionContext` outputs into UI project state. The AI Director review queue UI (`cinegen-review-queue-view`) surfaces `getReviewQueue()` with Approve/Reject controls. Agent health check is wired in the Setup Assistant done step.

### Known Gaps

**Validator enforced on writes.** ✅ Extracted `validateCrossFileIntegrity` and all helpers into `cine-project-validator.ts`. The shared module accepts an optional `packageFileSet`; when omitted, file-existence checks are skipped so it can validate server-resident projects. `project-serializer.ts` now calls the validator in its write gate; failures set `valid = false` and surface the error in `errors`.

**Autosave call sites are solid.** ✅ `markProjectDirty()` now fires from: script editor (`fountain-bundle.ts`), scene detail shot edits and reordering (`cinegen-scene-tabs.ts`), camera/lighting chip selections (`camera-lighting-bundle.ts`), and mood board mutations (`autosaveMoodBoards` in `project-data.ts`).

**Incremental dirty flush wired.** ✅ `flushDirtyDocuments` now passes `Array.from(DIRTY_DOCS)` to `serializeAppliedProject`, which filters the `documents` map to only the changed types. Cross-file integrity validation is skipped for incremental writes (it requires all documents) but still runs on full flushes. The server-side atomic swap already handles partial document maps correctly: untouched existing files are copied into staging before the swap.

**Serializer AI Director documents wired.** ✅ `project-serializer.ts` now maps `shotLibrary`, `cameraPresets`, `spatialAnnotations`, `generationQueue`, `reviewQueue`, `costTracking`, and `agentLog` from `AppliedCineProject` into `.cine` document files. The manifest includes all seven entries. `triggerProjectSave` marks them dirty for full flushes. The server-side `CINE_DOC_RE` regex accepts all new extensions so atomic writes pass them through.

**Format version migration registry added.** ✅ `source/src/data/cine-migrations/migration-registry.ts` defines `registerMigration`, `getMigration`, and `runMigrations`. `parseCineManifest` accepts `{ migrate?: boolean }`; when true and the loaded version is older than current, the registry runs sequential migrations. `v2-baseline.ts` (identity) and `v2-to-v3.ts` (stub) are registered. No v3 format exists yet, so old packages still load fine (v2 is current) and future format bumps will have a clear upgrade path.

**Zod schemas introduced (manifest first).** ✅ `source/src/data/cine-schemas.ts` defines `CineManifestSchema` via Zod, with `parseManifestZod()` as the canonical parse entry. `parseCineManifest` now calls `parseManifestZod` as a structural pre-validation layer, logging the first Zod error path (if any) before falling through to the existing imperative checks. Document schemas (`cinescenes`, `cinecharacters`, etc.) will be added opportunistically as features touch each type, following the parallel-track approach described in Option D.

**No write atomicity on the server.** ✅ `POST /api/projects/:id/documents` and project creation now use `writeDocumentsAtomic` in `proxy.js`. The helper seeds a staging directory with existing files, writes new/updated documents into staging, then renames current → backup and staging → current. On swap failure it attempts rollback from backup. Stale staging/backup artifacts from interrupted prior writes are cleaned up on the next call. The `.cine` directory is never in a partially-updated state.

**Media URL portability is unresolved.** AI-generated image and video URLs from providers (Fal, Replicate, Runway, etc.) are stored as external URLs that expire. There is no media caching layer, no local copy path, and no import/export media handling yet.

**Import/export not built.** `GET /api/projects/:id/export` and `POST /api/projects/import` do not exist yet. The format and serializer are ready; the server-side zip handling and client UI are P1 work that has not started.

---

## `.cine` Package Architecture: Evaluation and Alternatives

This section evaluates the current `.cine` format architecture honestly — what it does well, where it is fragile, and what alternative or enhancement patterns are worth considering as the format becomes load-bearing for real filmmaker projects.

### The Current Design

The `.cine` package is a directory of JSON text files, each with a domain-specific extension (`.cinescript`, `.cinescenes`, `.cinecharacters`, etc.), anchored by a `cine.manifest.json` that names each document by key. The server reads and writes these files directly via `fs.promises.readFile` / `fs.promises.writeFile`. The Vite build compiles bundled samples via `import.meta.glob` with `?raw` import so they are loaded without a network round-trip.

**Strengths of this design:**

- **Human-readable and git-diffable.** Each `.cine` document is a pretty-printed JSON file. A filmmaker can open the package directory, read the Fountain screenplay directly, inspect their shot list as JSON, and commit changes to version control. This is meaningful for a creative tool where the content matters and where machine-readable formats tend to resist inspection.
- **Domain isolation by file.** Each document owns exactly one concern. A partial save (script only, or features only) writes one file and leaves all others intact. This is a natural boundary for dirty-document tracking and for import/export validation.
- **Extension-based type safety.** The `.cinescript` / `.cinescenes` / `.cinecharacters` naming convention gives the validator and loader unambiguous type expectations without embedding a `type` field in every file. `parseCineManifest` and `loadOptionalArrayDoc` enforce this at load time.
- **Cross-file integrity validation.** `validateCrossFileIntegrity` checks referential integrity across all documents — scene IDs, character IDs, location IDs, shot/frame links, tree node views, media paths — before any package is applied to in-memory state. This is a strong correctness guarantee for bundled samples.
- **Portable zip format.** Because the package is already a flat directory of text files, zipping it for export is a `tar` or `archiver` call away. The format is self-describing: another CineGen instance (or a text editor) can understand it without a proprietary reader.
- **Document-per-concern scales naturally.** Adding a new department (e.g. a `vr-previs.cinevr` document) is a manifest key addition plus a loader function. No existing documents are touched.

**Weaknesses of the current implementation:**

1. **Validator is module-private and not called on writes.** The best correctness guarantee in the codebase (`validateCrossFileIntegrity`) is only reachable from inside `cine-project-loader.ts`, which operates on Vite-compiled bundled packages (the `./project-files/` path prefix is hardcoded into the internal `packageFileSet` builder). The serializer cannot call it. Until the validator is refactored into a server-runnable form that operates on plain `Record<string, string>` document payloads rather than on the Vite `import.meta.glob` map, write-time validation cannot be enforced. This is the single largest structural gap.

2. **No write atomicity.** Writing ten files in a `for` loop is not a transaction. A killed process leaves an inconsistent state where, for example, `scenes.cinescenes` is updated but `storyboard.cinestoryboard` is stale. For a creative project that a filmmaker has spent hours building, this is a real risk.

3. **No version migration.** Hard-rejecting on version mismatch with a thrown error is correct for a validator, but unusable for a shipped app. A package written by a slightly older instance of CineGen will fail to open on a newer one, with no path forward.

4. **`unknown[]` and `Record<string, unknown>` are too loose.** The storyboard frames array (`CineProjectStoryboard.frames: unknown[]`), and most of the optional fields on `CineProjectFile`, use the weakest possible TypeScript types. The cross-file validator compensates at load time, but the type system offers no help at mutation or serialization time. When the serializer maps `applied.storyboardFrames ?? []` into the storyboard document, TypeScript accepts anything.

5. **Vite glob coupling.** The loader's `packageRawByPath` map is populated by `import.meta.glob('./project-files/**/*', { query: '?raw' })`. This works perfectly for Vite-compiled bundled samples but is completely unavailable to the server-side `proxy.js`. The server reads `.cine` directories with `fs.promises.readdir` / `fs.promises.readFile`. These two paths are fully parallel, with no shared validation code between them. Any validation improvement in the loader does not automatically apply to server-resident projects.

6. **No content-addressed change detection.** Every autosave cycle serializes all ten documents to JSON strings and POSTs them. There is no check whether the content actually changed since the last write. A filmmaker editing a single shot description causes all ten files to be written, including the Fountain screenplay (potentially many KB) and the full storyboard document.

---

### Alternative Architectures

#### Option A: Keep JSON files, add a server-side validator and staging write (recommended near-term)

This is the lowest-risk path and requires no format change.

**A1 — Refactor the validator into a format-agnostic module.** Extract `validateCrossFileIntegrity` (and its helpers) from `cine-project-loader.ts` into a new `source/src/data/cine-project-validator.ts` that accepts `{ manifest: CineProjectManifest, documents: Record<string, string> }` — the same shape the serializer already produces and the server already writes. This module can be `import`ed by both the client-side loader and the server-side `proxy.js` (or a future route module). The bundled-sample loader calls it with document strings from `packageRawByPath`; the server calls it with strings from `fs.promises.readFile`. One implementation, two call sites.

**A2 — Add write staging for atomicity.** Before writing documents to `source/server/projects/<id>.cine/`, write them to a temporary `.cine.stage/` directory in the same parent. Once all files are written without error, rename `.cine.stage/` to the target `.cine/` directory (on the same filesystem, this is an atomic `rename` on most operating systems). If the write fails midway, the staging directory is abandoned and the committed `.cine/` directory is intact. Node's `fs.promises.rename` is atomic on POSIX when source and destination are on the same mount.

**A3 — Content-hash skip on unchanged documents.** In the serializer, compute a `SHA-256` of each serialized document string before deciding whether to include it in the POST payload. Store the last-written hashes (a small in-memory map per project, persisted as `checksums.json` inside the `.cine/` directory). On autosave, only include documents whose hash has changed. This eliminates redundant writes with no format change and negligible overhead.

**A4 — Formal version migration registry.** Add `source/src/data/cine-migrations/` with numbered modules (`v2-to-v3.ts`, etc.). `parseCineManifest` accepts a `{ migrate: boolean }` option; when true, it runs migrations instead of rejecting on version mismatch. Each migration function receives the raw document strings and returns updated strings, so it operates at the file level before any hydration. Migrations are additive only: they may rename or add keys but never delete data.

This combination — shared validator, staging writes, content hashing, and migration registry — addresses all five weaknesses without changing the format or touching the manifest shape. It is the right first path because it preserves all the current strengths (human-readable, git-diffable, portable) while closing the correctness and atomicity gaps.

---

#### Option B: SQLite per project (strong alternative for performance and concurrency)

LibSQL (used by Mastra for `agents.db`) is already a dependency. A project could be stored as a single `project.db` SQLite file with a `documents` table:

```
CREATE TABLE documents (
  key TEXT PRIMARY KEY,  -- 'screenplay', 'scenes', 'characters', etc.
  content TEXT NOT NULL, -- JSON payload
  updated_at INTEGER NOT NULL
);
```

**Advantages:**
- **Atomic writes.** `BEGIN; UPDATE documents SET content = ? WHERE key = 'scenes'; UPDATE documents SET content = ? WHERE key = 'storyboard'; COMMIT;` — the whole autosave batch is atomic or not committed at all.
- **Concurrent write safety.** SQLite's WAL mode handles concurrent readers with a single writer safely. No custom async write queue needed.
- **Fast selective reads.** `SELECT content FROM documents WHERE key = 'screenplay'` loads only the screenplay; the storyboard is not touched until needed. This is lazy document loading without any architectural complexity.
- **Change detection built in.** `SELECT updated_at FROM documents WHERE key = ?` before writing lets the autosave skip unchanged documents trivially.
- **Export is still possible.** On export, `SELECT * FROM documents` plus a Fountain file reconstruction gives back the full package. The zip can still contain JSON files (materialized from the database) so the export format remains human-readable even if the on-disk format is SQLite.

**Disadvantages:**
- **Loses direct git-diffability.** A SQLite binary is not human-readable. Filmmakers who want to version-control their project with git cannot diff a screenplay change as a text diff. This is a meaningful loss for a creative tool.
- **Requires a binary-to-text round-trip for export.** The readable `.cine` export format needs to be materialized from the database, adding a layer that the current format does not need.
- **Database tooling cost.** Queries need to be written and maintained. The current format's file-system operations are simpler and easier to audit.
- **Bundled samples become a different format.** The Vite `import.meta.glob` path for bundled samples cannot load SQLite databases at build time; samples would need to be stored differently from user projects (the current design actually handles this elegantly because everything is text).

**Recommendation:** SQLite is worth reconsidering if CineGen gains multi-user or cloud sync requirements, where atomic write guarantees are non-negotiable and binary storage is acceptable. For the current local-dev, single-filmmaker, single-machine context, the atomicity problem is better solved with staging writes (Option A2), which costs nothing in tooling complexity.

---

#### Option C: Event-sourced append-only log (powerful but high complexity)

Instead of saving document snapshots, record every mutation as an event:

```json
{ "id": "evt-001", "ts": 1748500000, "type": "shot.created", "sceneId": "scene01", "shotId": 3, "payload": { ... } }
{ "id": "evt-002", "ts": 1748500001, "type": "shot.updated", "shotId": 3, "field": "shotType", "value": "CU" }
```

The project state is the result of replaying all events from the beginning (or from the last snapshot checkpoint).

**Advantages:**
- **Perfect undo history.** Every change is recorded; undo is replaying to an earlier point.
- **Zero write conflicts.** Appending to an event log is safe under concurrent writes; there is no file that needs to be fully replaced.
- **Agent auditability.** Every agent action, every human override, every shot parameter change has a named event and timestamp. This is exactly what the AI Director department needs.
- **Natural streaming.** Events can be streamed over WebSocket to a second browser window (real-time collaboration).

**Disadvantages:**
- **Load time grows with project age.** Replaying 50,000 events to open a project is unacceptable. Requires checkpointing — periodic snapshots that restart the replay — which is the current snapshot model re-introduced as a dependency.
- **Massive schema complexity.** Every mutation type needs an event schema, a reducer, a migration path when the event schema changes, and a snapshot format. The current codebase has ten document types; an event-sourced system has potentially fifty event types.
- **No human-readable at rest.** An event log is cryptic without a tool to replay and display it.

**Recommendation:** Do not adopt full event sourcing for the core project format. However, adopt the *pattern* selectively for the AI Director department: the `agentLog` document in `.cine` is already an append-only log of agent actions, and the review queue and generation queue are already event-like. These can grow into a lightweight event stream for the agent layer without touching the screenplay, shot, or character documents.

---

#### Option D: Zod schemas as the single source of truth (high-value enhancement, no format change)

The current validator in `cine-project-loader.ts` is ~500 lines of imperative `assertObject` / `assertStringField` / `assertArray` calls. Zod is already a dependency (used by the Mastra agent tools). Replacing the bespoke validator with Zod schemas would give:

- **TypeScript types inferred automatically.** `z.infer<typeof CineScenesSchema>` replaces `Record<string, unknown>`. Every document type becomes a strict TypeScript type without manual declaration.
- **Declarative and readable.** A Zod schema for a scene document is 20 lines of `z.object()` definitions rather than 80 lines of imperative checks.
- **Better error messages.** Zod's parse errors include the path to the failing field (e.g. `scenes.scene01.coverage[2].shotType: expected string, got undefined`). The current validator is good, but Zod would be consistently structured.
- **Shared between client and server.** The Zod schemas live in `source/src/data/cine-schemas.ts`, imported by the client loader, the client serializer, and the server route handler (via `source/server/` imports or a copied module). One canonical definition.
- **Easy version migration.** A migration from v2 to v3 is a Zod transform: `CineManifestSchemaV2.transform(v3upgrader)`. The output is typed.

**Status:** `CineManifestSchema` is implemented in `source/src/data/cine-schemas.ts` and wired into `parseCineManifest` as a structural pre-validation layer. Document schemas (`cinescenes`, `cinecharacters`, `cinelocations`, etc.) will be added opportunistically as features touch each document type. The migration path remains: introduce schemas alongside the existing imperative validator, delegate gradually, and remove imperative code as coverage and confidence grow. The format does not change at all — only the implementation of the validator changes.

---

### What To Keep As-Is

The manifest-plus-documents directory structure is the right shape. It gives portability (a `.cine` package is inspectable in any text editor), natural domain separation (one file per concern), and an obvious zip-for-export path. The `.cinescript` / `.cinescenes` extension naming is clear and makes file type identification obvious in a file browser. The `CINE_PROJECT_FORMAT` / `CINE_PROJECT_VERSION` fields in the manifest are correct anchors for future format evolution. None of these need to change.

The cross-file integrity validator is one of the strongest parts of the codebase. The concept — that a package is not valid unless all inter-document references are consistent — is exactly right. The implementation gap is only that it cannot currently be called from write paths. Solving that structural coupling (Option A1) makes the existing validator 10× more valuable without rewriting it.

### Priority Sequence

Given the current state, the recommended order for `.cine` architecture work is:

1. **A1 ✅ done.** Validator extracted to `cine-project-validator.ts` and wired into `project-serializer.ts`.
2. **A2 ✅ done.** Staging-directory atomic writes implemented in `proxy.js`.
3. **A3 ✅ done.** Incremental dirty flush wired; `serializeAppliedProject` filters by `dirtyDocTypes`.
4. **A4 ✅ done.** Migration registry created with `v2-baseline` and `v2-to-v3` stub; `parseCineManifest` accepts `{ migrate?: boolean }`.
5. **D (manifest) ✅ done, document schemas pending.** `CineManifestSchema` is live in `cine-schemas.ts`. Document schemas (`cinescenes`, `cinecharacters`, `cinelocations`) will be added opportunistically as features touch each type.
6. **B only if multi-user becomes a goal.** SQLite per-project is the right move if concurrent writers or cloud sync become requirements. It is not the right move now.
7. **C never for the core format.** Event sourcing is worth adopting for the AI Director agent log (`agentLog` document) as that domain is naturally append-only. The screenplay, shot list, character, and scene documents should remain snapshots.

---

## Extra Notes on Terminology

Here is a list of the different guides used in film and television production, their modern secular names, and their specific functions:

### 1. **Show Guide (formerly "Show Bible" or "Series Bible")**
*   **Purpose:** The master reference document for a television series.
*   **Function:** It defines the show's vision, tone, world rules, character backstories, and long-term story arcs. It is used both to **pitch** the series to networks (development phase) and to maintain **continuity** for writers and producers during production (archival phase).
*   **Key Content:** Logline, series overview, character profiles, season outlines, and tone/atmosphere descriptions.

### 2. **World Guide (formerly "World Bible")**
*   **Purpose:** A specialized subset of the Show Guide, common in sci-fi, fantasy, and historical genres.
*   **Function:** Focuses exclusively on the setting, history, magic systems, technology, geography, and cultural rules of the fictional universe. It ensures that the physical and metaphysical laws of the story remain consistent.
*   **Key Content:** Maps, timelines, glossaries of terms, political structures, and rules of magic/technology.

### 3. **Writer's Guide (or Writer's Handbook)**
*   **Purpose:** An internal operational manual specifically for the writing staff.
*   **Function:** Used in the writers' room to ensure all episodes feel like they belong to the same show. It often includes "dos and don'ts" for character voices, recurring jokes, and narrative boundaries.
*   **Key Content:** Character voice samples, thematic mandates, episode templates, and a running log of established canon (what has already happened).

### 4. **Production Guide (or Production Manual)**
*   **Purpose:** A logistical document for the physical production team.
*   **Function:** Distinct from the creative guides, this focuses on the practical execution of filming. It details the "ingredients" needed for every scene (cast, locations, props, VFX, costumes) to assist the 1st AD and department heads in scheduling and budgeting.
*   **Key Content:** Script breakdowns, shooting schedules, contact lists, safety protocols, and department-specific requirements.

### 5. **Character Profile (or Character Breakdown)**
*   **Purpose:** A focused document on individual characters (used in both film and TV).
*   **Function:** In **film**, this often replaces the need for a full "bible." It is used primarily for **casting** and actor preparation. In **TV**, these profiles are compiled into the Show Guide.
*   **Key Content:** Age range, physical traits, psychological motivations, backstory, relationships, and arc summary.

### 6. **Pitch Deck (or Look Book)**
*   **Purpose:** A visual sales tool used before a project is greenlit.
*   **Function:** While similar to a Show Guide, it is heavily visual and concise, designed to sell the *vibe* and marketability of the project rather than serve as a long-term reference.
*   **Key Content:** Mood boards, color palettes, reference images, cast wish lists, and a high-level summary of the story.

### Summary of Terminology Shift
| Traditional Term | Modern/Inclusive Alternative | Primary Use |
| :--- | :--- | :--- |
| **Show Bible** | **Show Guide** / **Series Guide** | Master series reference & pitch |
| **World Bible** | **World Guide** / **World Book** | Setting & universe rules |
| **Production Bible** | **Production Guide** / **Manual** | Logistics & scheduling |
| **Writer's Bible** | **Writer's Guide** / **Handbook** | Staff continuity & tone |   