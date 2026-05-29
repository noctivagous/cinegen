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
6. Let AI agents enrich each department's work (scripts, bibles, prompts, boards, clips, audio) without blocking the workflow when agents are not configured.
7. Save automatically, recover the full project state on reload, and export a complete portable `.cine` package to share, archive, or move between machines.
8. Import a `.cine` project exported from another session, validate it, and resume work from exactly where it left off.
9. See every step clearly: what is configured, what will be generated, what failed, and what needs human review before downstream work proceeds.

---

## P0 — Project Foundation: Create, Save, and Recover

Rationale: every wizard, agent, and department panel writes into one shared project structure. Before anything else, that structure needs to exist, be writable for new projects, be persistable on every meaningful mutation, and be fully recoverable on reload. The current sample project (`ASCENSION_STREAM`) demonstrates the right shape, but there is a foundational gap: user-created projects and `.cine` packages are two disconnected things. User projects exist as flat key/value blobs in the server store. The rich multi-file `.cine` directory format — with separate documents for screenplay, scenes, storyboard, characters, locations, shots, references, sound, and AI queues — is used only by bundled read-only samples compiled into the Vite build via `import.meta.glob`. There is no serializer that goes from current in-memory project state to a `.cine` directory, and no path for the server to read a user-provided `.cine` from disk. Everything in this section works toward closing that gap. Import and export flow from this same foundation.

Architecture note: this section touches `source/src/services/project-service.ts`, `source/src/data/project-data.ts`, `source/src/constants/storage-keys.ts`, `source/src/services/persistence.ts`, and a new `source/server/routes/projects.js`. Any new persistence keys go in `storage-keys.ts` first. No browser-local storage APIs.

- [ ] Establish the server-resident project tier.
  - Create a `source/server/projects/` directory. Each subdirectory is a writable `.cine` package (e.g. `source/server/projects/my-film.cine/`) that the server reads and writes at runtime — not compiled into the Vite build.
  - Add a `GET /api/projects` endpoint that lists all server-resident projects (name, id, last-modified) alongside bundled read-only samples, with a `writable: boolean` flag on each entry.
  - Add a `GET /api/projects/:id/load` endpoint that reads the project's `.cine` files from disk, validates them through the existing `parseCineManifest` + `validateCrossFileIntegrity` path, and returns the full `AppliedCineProject` shape.
  - This third persistence tier sits between the bundled samples (Vite, read-only) and the existing flat key/value store (session-only), and becomes the primary home for all user-created projects.

- [ ] Build the project serializer.
  - Create `source/src/services/project-serializer.ts` that converts the current in-memory project state (`currentSceneData`, `storyboardFrames`, `assetLibrary`, `moodBoards`, `breakdownData`, `projectTreatment`, `styleGuide`, `referenceImages`, `generationQueue`, `reviewQueue`, `agentLog`, etc.) into the typed `.cine` document files defined by `cine-project-types.ts`.
  - Each document type maps to one file: `screenplay.cinescript`, `scenes.cinescenes`, `storyboard.cinestoryboard`, `characters.cinecharacters`, `locations.cinelocations`, `breakdown.cinebreakdown`, `referenceImages.cinereferenceimages`, and so on.
  - The serializer must produce output that passes `validateCrossFileIntegrity` before being written to disk — validation is the serializer's final step, not the caller's responsibility.
  - This serializer is the enabling piece for autosave, export, and duplicate-as-local-project.

- [ ] Wire autosave to the serializer with incremental dirty-document writes.
  - When a mutation occurs, mark only the affected document(s) as dirty (e.g. a script edit marks `screenplay` dirty; a shot edit marks `scenes` dirty; a frame change marks `storyboard` dirty).
  - On debounce expiry, serialize and write only the dirty documents to the project's server-resident `.cine` directory via `POST /api/projects/:id/documents` (accepts a map of `{ documentType: serializedContent }`).
  - Writing one document at a time is safe, cheap, and resilient — a crash mid-save leaves all other documents intact.
  - Bundled `.cine` packages remain read-only; show this clearly in the UI.
  - Put debounce timing, dirty-tracking, and persistence error reporting behind one imported service in `source/src/services/project-service.ts`.
  - All new storage keys declared in `source/src/constants/storage-keys.ts` before use.

- [ ] Define and enforce project snapshot invariants.
  - Required fields: `screenplay.text`, `currentSceneData`, `breakdownData`, `assetLibrary` (characters, locations, costumes, props), `storyboardFrames`, `moodBoards`, `generationLog`, `productionContext` reference anchor.
  - Add normalizers in `source/src/data/project-data.ts` that fill missing fields with safe defaults on load; these run on both server-resident and bundled project loads.
  - Avoid per-component normalization; centralize it in data/service modules.

- [ ] Make new local project creation produce the full scaffold.
  - On "Create Project": initialize all required fields, write an initial minimal `.cine` package to `source/server/projects/<id>.cine/`, and load it back through the same `GET /api/projects/:id/load` path that all project opens use.
  - Expose a typed `createNewProject(name, entryMode)` function that all wizards call rather than building project shape independently.

- [ ] Surface save status and failures visibly.
  - Add a clear "Saving…", "Saved", and "Save failed" indicator in the status bar.
  - Do not swallow persistence write failures silently.
  - Continue the status-flow migration: use direct imports from `source/src/services/status-bar-service.ts` rather than `window.*` calls.

- [ ] Add "Duplicate Sample As Local Project."
  - Copy a bundled read-only sample's in-memory state through the serializer into a new server-resident `.cine` package.
  - The copy opens as a fully writable project. Make the transition clear before any edits happen.
  - This exercises the full serializer → write → load round-trip and validates it before import/export depends on the same path.

- [ ] Extend `npm run validate:cine` to cover server-resident project snapshots.
  - After autosave writes a document, optionally re-validate the affected document against its schema.
  - In the validate script: check all required fields exist after normalization, confirm Fountain text produces matching tree nodes and scene records, and confirm shot/frame cross-references are valid.
  - Run as a pre-build smoke check and on demand during development.

---

## P0 — Script to Production: Fountain → Scenes, Shots, Breakdown

Rationale: the Fountain script is the source of truth for production structure. Everything downstream — scenes, characters, locations, breakdown rows, the shot list, storyboard boards, reference needs, and audio cues — traces back to it. Before agents can enrich and before wizards can guide, the app needs a reliable deterministic pipeline from script text to structured project state. The Fountain parsing infrastructure already exists in `source/src/script/fountain-bundle.ts` and `source/src/workspace/script-info-utils.ts`; the gap is wiring it into a clean, composable project-sync module.

Architecture note: as this path is implemented, migrate high-traffic `fountain-bundle` and `workspace-bundle` global function calls to module imports. Use `CG_TREE_NODE_SELECT` from `source/src/events/shell-events.ts` instead of raw event strings. Use `requestProjectTreeRefresh()` from `source/src/tree/project-tree-service.ts` instead of `window.renderFullTree?.()`.

- [ ] Build a `script-to-project` sync module.
  - Parse scene headings, character cues, location sluglines (INT/EXT), and time-of-day from Fountain text.
  - Produce: `currentSceneData` (one `SceneDetail` per scene), `breakdownData` rows (scene number, slug, INT/EXT, location, time), `assetLibrary.characters` placeholders, `assetLibrary.locations` placeholders.
  - Create Scenes folder and scene tree nodes via `project-tree-service.ts`.
  - Initialize mood-board attachment points for each scene (empty `sceneReferenceOverrides` entry).
  - Expose as `syncFountainToProject(text: string, projectId: string): ScriptSyncResult` — no globals.
  - Suggested location: `source/src/script/script-to-project.ts`.

- [ ] Create a deterministic starter shot list per scene.
  - For each parsed scene: master shot + one coverage shot minimum.
  - Use the existing `SceneShot` shape from `source/src/workspace/scene-types.ts`.
  - Include `scriptLink` anchors (character cue line references) so script, scene detail, storyboard frame, and previs timeline margin stay connected.
  - Set initial `type`, `cameraAngle`, `cameraMovement`, `lens`, `purpose`, and `status: 'planned'` from a deterministic coverage heuristic (dialogue scene → OTS/coverage, action scene → wide + insert, single character → MS + CU).
  - This keeps the app useful before LLM agents are configured.
  - Architecture: consolidate shot-type heuristics with the backend `generation-agent.js` shot-routing rules; do not create a third shot-type map.

- [ ] Wire the Start-from-Script wizard to this sync.
  - After step 1 (script import + project name), call `syncFountainToProject()` so step 2 reviews real extracted data instead of collecting entity names from scratch.
  - Step 2 should show extracted characters, locations, breakdown rows, and starter shots for review/edit, not just confirm chips.
  - When agent health is configured, call `runScriptWizardStep2()` from `agents-service.ts` to enrich the deterministic baseline with LLM analysis.
  - Fall back gracefully to the deterministic baseline when no LLM key is present.

- [ ] Wire script editor changes back into project structure.
  - After meaningful edits, re-run `syncFountainToProject()` with a reconciler that preserves existing scene IDs and user-edited shot lists for scenes whose headings still match.
  - Add a visible "Refresh Breakdown From Script" action for explicit re-sync.
  - Avoid destructive replacement of user-edited data.

- [ ] Ensure the sidebar and workspace respond to the sync.
  - After `syncFountainToProject()`, call `requestProjectTreeRefresh()` (not `window.renderFullTree?.()`).
  - Verify: scene nodes open `scene-detail`, storyboard nodes open preprod/storyboard, empty project shows the empty-workspace placeholder clearly.

---

## P0 — Shot Architecture with Cinematography Terms

Rationale: the camera-lighting-bundle already contains a complete cinematic vocabulary — shot types (ECU through ELS), angles (Eye-Level through Worm's Eye), lighting techniques (3-Point through Soft Light), composition rules (Rule of Thirds through Symmetry), movements (Static through Crane), and atmosphere descriptors — but this data lives disconnected from the shot records in `currentSceneData`. The "Build Shot Prompt" button in `cinegen-camera-lighting-view.ts` exists but the action has no end-to-end path. This section wires the vocabulary data into per-shot metadata, and those shot parameters into the prompt-building pipeline that the Prompt Engineer Agent and `storyboard-prompt-builder.ts` already consume.

Architecture note: as this path is built, extract the shot parameter accumulation and prompt-dispatch logic from `camera-lighting-bundle.ts` into a narrower `shot-config-service.ts` module rather than extending the existing bundle.

- [ ] Define the extended shot metadata schema.
  - Extend `SceneShot` in `source/src/workspace/scene-types.ts` to include:
    - `shotType: string` — ECU, CU, MCU, MS, MLS, LS/WS, ELS (from `cameraLightingData.shotTypes`)
    - `cameraAngle: string` — Eye-Level, Low Angle, High Angle, Dutch, Overhead, Worm's Eye, OTS, POV
    - `cameraMovement: string` — Static, Pan, Tilt, Dolly, Truck, Zoom, Handheld, Steadicam, Arc, Crane, Drone
    - `lens: string` — Wide (14–24mm), Standard (35–50mm), Portrait (85mm), Telephoto (135mm+), Macro, Anamorphic
    - `lightingTechnique: string` — 3-Point, High-Key, Low-Key, Side, Backlit, Rim, Golden Hour, Blue Hour, Practical, Gels, Hard, Soft
    - `composition: string` — Rule of Thirds, Centered, Leading Lines, Symmetry, Frame-within-Frame, Depth of Field, Negative Space
    - `atmosphereTags: string[]` — descriptors from the Atmosphere section (Fog, Dust, Rain, Smoke, etc.)
    - `status: 'planned' | 'storyboarded' | 'prompted' | 'queued' | 'generated' | 'reviewed' | 'approved' | 'rejected' | 'locked'`
    - `linkedFrameIds: string[]` — storyboard frame IDs for this shot
    - `linkedClipId?: string` — generated video clip reference
    - `linkedAudioId?: string` — audio cue reference
    - `sceneReferenceSlots: string[]` — reference image IDs (characters, location plates, style refs) to supply to generation

- [ ] Make the camera-lighting-view write into the active shot.
  - When a user selects a shot in the scene detail and opens the Camera/Lighting panel, initialize chip selections from that shot's existing metadata.
  - On chip selection/deselection, write back to the shot's `cameraAngle`, `shotType`, `cameraMovement`, `lightingTechnique`, and `atmosphereTags` through a module-level service (not a global).
  - Show the shot's current config in the "Shot Config:" prompt bar at the top of the panel.

- [ ] Wire "Build Shot Prompt" through to the Prompt Engineer Agent.
  - When clicked: gather the active shot's cinematography parameters, the scene's linked character/location bibles, the project's style guide (from mood board), and the active color palette.
  - Build a structured `ShotPromptInput` and call `agents-service.ts → buildGenerationPrompt()`.
  - Fall back to `storyboard-prompt-builder.ts → buildStoryboardPrompt()` when no agent is configured.
  - Persist the resulting prompt text onto the shot record and show it in the prompt bar.
  - Record the choice of provider (Runway, Kling, Veo, Seedance, etc.) on the shot.

- [ ] Define and enforce the shot lifecycle.
  - `planned` → shot exists with basic coverage heuristics but no cinematography detail.
  - `storyboarded` → at least one frame is linked to the shot.
  - `prompted` → a generation prompt has been built and approved.
  - `queued` → shot is in the generation queue.
  - `generated` → a clip exists for the shot.
  - `reviewed` → clip has been reviewed in AI Director.
  - `approved` / `rejected` / `locked` — terminal review states.
  - Enforce valid transitions; do not allow `queued` without `prompted`.
  - Surface status as a badge on shot rows in the scene detail and shot list tables.

- [ ] Make the shot list table in scene detail editable.
  - Allow inline editing of shot type, angle, and movement.
  - Allow reordering shots within a scene.
  - Show per-shot generation status badges.
  - Avoid rebuilding the table from a global render function; bind events through module functions.

- [ ] Consolidate backend shot routing with frontend shot types.
  - `backends/agents/cinematography/generation-agent.js` has its own shot-type → provider routing rules.
  - `backends/agents/tools/provider-router.tool.js` has a parallel set.
  - Move shared routing rules into one backend module and consume from both places.
  - Ensure `source/src/constants/provider-registry.js` is the SSOT for provider metadata on both sides.

---

## P0 — Mood Board as Visual DNA

Rationale: the mood board is the visual contract between the filmmaker's intent and what gets generated. Color palette, lighting mood, texture references, and atmospheric still frames all live here. The infrastructure is in place: `moodboard-generation.ts` queues generation jobs, `moodboard-persistence.ts` handles load/save, `cinegen-moodboards-panel.ts` renders the grid, and `colorState` from `source/src/color/color-state.ts` already feeds into `storyboard-prompt-builder.ts`. The gap is that none of this is connected to the new-project path or surfaced as a first-class filmmaker step in the wizards.

Architecture note: mood board item types `'image' | 'video' | 'sound' | 'text'` should remain the canonical set; do not add new type literals outside `source/src/data/project-data.ts`.

- [ ] Initialize mood-board scaffolding in the new-project path.
  - Every new project starts with one project-level mood board ("Visual DNA").
  - Each scene gets an empty `sceneReferenceOverrides` entry that the mood board and reference bank can populate.
  - Store `styleGuide` defaults (colorPalette: [], lightingMood: '', lensStyle: '', visualTone: '', styleReference: '') in the project scaffold.

- [ ] Wire the Concept/Mood-First wizard into mood board state.
  - The wizard's `moodDescription`, `lightingDesc`, `atmosphereTags`, `atmosphereNotes`, and `colorPalette` fields (already in `concept-wizard-state.ts`) should write directly into the project's `styleGuide` on wizard completion.
  - Extracted palette colors should populate `colorState` so they propagate automatically to the storyboard prompt builder.
  - The wizard's generated images should be added as mood board items of type `'image'`.

- [ ] Make mood board → style guide → shot prompt a visible data pipeline.
  - In the Camera/Lighting panel, show an indicator when the active project style guide has color palette or lighting mood values.
  - When "Build Shot Prompt" is triggered, explicitly incorporate `colorState.getPalette()` and `styleGuide.lightingMood` into the prompt context.
  - Let users see and override these values per shot without losing the project-level defaults.

- [ ] Add image upload to mood boards.
  - Accept drag-drop or file picker for still images (JPG, PNG, WebP).
  - Store as mood board item of type `'image'` with a local file URL.
  - Allow marking any mood board image as a "style reference" that becomes a `refImageUrl` in storyboard prompt generation.

- [ ] Surface mood board in the Beat Board and Visual-First wizards.
  - Beat board entries have a `assetNeeds` field and a camera notes field; link these to mood board items as loose references.
  - Visual-First wizard upload flow should add uploaded images as mood board items and reference slots simultaneously.

- [ ] Wire `colorState` persistence into project save.
  - Currently `colorState` is a singleton but its palette may not survive reload.
  - On project load, seed `colorState` from the project's `styleGuide.colorPalette`.
  - On project save, persist `colorState.getPalette()` back into `styleGuide.colorPalette`.

---

## P1 — Assets in Shots: The Reference Pipeline

Rationale: the most sophisticated thing CineGen can do for a filmmaker is use their actual visual assets — photos of real actors, location scouts, costume reference sheets, concept art — as anchors for AI generation. This turns generic AI output into production-consistent imagery. The pipeline already has the schema for it: `CharacterBibleEntry` has `references.face / body / profile / threeQuarter / closeUp / costume[]`, `LocationBibleEntry` has `references: string[]`, and `storyboard-prompt-builder.ts` already calls `getReferenceImageUrls()` to build `refImageUrls` for each generation request. The gap is the upload-to-reference flow that populates those fields and makes them selectable per shot.

Architecture note: keep all reference URL storage server-backed. Do not store image data in browser localStorage. Asset file handling belongs in `source/src/moodboards/moodboard-files.ts` or a dedicated `source/src/assets/asset-upload-service.ts`.

- [ ] Build an asset-to-reference flow.
  - A filmmaker should be able to: drag an image onto a character → it becomes a face/costume reference. Drag an image onto a location → it becomes a location plate. Drag an image onto a shot → it becomes a per-shot style reference override.
  - Accept JPG, PNG, WebP, PDF (first page), and short video thumbnails.
  - Write uploaded references into `CharacterBibleEntry.references.*` or `LocationBibleEntry.references[]` through a typed service call.

- [ ] Surface per-shot reference slot UI.
  - Each shot in the scene detail can show its linked reference images (characters, location plate, style override).
  - Allow adding, removing, and reordering reference slots per shot.
  - These populate `SceneShot.sceneReferenceSlots` and flow into `getReferenceImageUrls()` when the prompt is built.

- [ ] Make the Casting and Production Design agents use uploaded references.
  - When `buildCharacterBibles()` is called from `agents-service.ts`, include any existing uploaded face/costume references so the agent can describe and label them rather than inventing placeholder descriptions.
  - Same for `buildLocationBibles()` with uploaded location plates.
  - The agent outputs enriched bible entries back into the same reference slots, not a separate data structure.

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

- [ ] Build a `ProductionContext` → UI project state adapter.
  - Define a single typed adapter that converts `ProductionContext.shotList[]` entries into `SceneShot` records, `characterBible[]` into `assetLibrary.characters` with reference slots, and `locationBible[]` into `assetLibrary.locations`.
  - Use this adapter in all places where agent output needs to appear in the UI: wizards, AI Director panel, storyboard refresh after agent approval.
  - Avoid a split where agents write `production-context.json` but the UI reads only `currentSceneData`.

- [ ] Wire script agent analysis into the Start-from-Script wizard.
  - Step 2 calls `analyzeScript()` when agent health is confirmed.
  - Map returned `characters`, `locations`, `shotList`, and style suggestions through the adapter into project state.
  - Convert style suggestions into `styleGuide` fields and initial mood board references.
  - Fall back to deterministic `syncFountainToProject()` when agent is not configured; no wizard step should fail silently.

- [ ] Surface `/api/agents/health` in Setup and wizard entry points.
  - Show agent readiness (LLM key configured, Mastra booted, provider configured for each modality) in Setup Assistant and wizard first slides.
  - Do not let a wizard suggest AI analysis will run if agent health returns false.
  - Wire `agents-service.ts → checkAgentHealth()` to a readable badge or section in the setup assistant done step.

- [ ] Build the AI Director review queue UI.
  - Surface `getReviewQueue()` results in the AI Director department panel.
  - Each queue item should show the agent that produced it, the type of output (shot list, character bible, storyboard frame, prompt), a preview, and Approve/Reject controls.
  - Calling `approveReviewItem()` should trigger the next orchestrator step.
  - Calling `rejectReviewItem()` should re-queue the work with the filmmaker's feedback note.

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
  - Step 3: casting setup — assign reference images to characters, accept or edit bibles.
  - Step 4: production design setup — assign location plates, accept or edit location bibles.
  - Step 5: style guide — color palette, lighting mood, visual tone (writes into `styleGuide` and `colorState`).
  - Step 6: mood board seeding — generate or upload 3–5 reference images for the project mood board.
  - Step 7: shot coverage review — confirm or add cinematography parameters to starter shots.
  - Step 8: generate initial storyboard frames for the first 3 scenes.

- [ ] Complete the Visual-First wizard.
  - Upload images (characters, locations, concept art, reference stills) → auto-identify as character/location/style references.
  - Set lighting mood, style notes, color palette from uploaded images (using color extractor agent).
  - Generate a script outline from the visual assets.
  - Produce scene kit (scenes based on identified locations, characters cast from uploaded faces).

- [ ] Complete the Concept/Mood-First wizard.
  - Mood description, scene settings, lighting description, atmosphere tags → produce `styleGuide`.
  - Color palette → populate `colorState`.
  - Character archetypes → produce placeholder character entries.
  - Generate 3–5 mood board images from the concept description.
  - Generate a style-locked prompt template for all future shot prompts.

- [ ] Complete the Beat Board wizard (8 slides).
  - Story beats with title, description, camera notes, asset needs, and duration.
  - Beat-to-shot mapping: each beat maps to one or more shots with initial cinematography parameters.
  - Import beat board as project Fountain outline and shots.
  - Option to trigger Storyboard Agent on the resulting shots.

- [ ] Add a shared wizard completion hook.
  - After any wizard completes, call: `syncFountainToProject()` (if screenplay text changed), autosave, tree refresh, and navigate to the first scene.
  - No wizard should end on a blank screen.

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

Rationale: large monolithic bundles create circular chunk warnings, slow builds, difficult code review, and tight coupling between concerns that should evolve independently. The biggest offenders identified in the architecture report are still open. Decomposition should happen along the same boundaries as the product features: project sync, shot config, mood board, wizard contracts, storyboard orchestration, save state, and provider setup.

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

- [ ] Establish the server-resident project tier: create `source/server/projects/`, add `GET /api/projects` and `GET /api/projects/:id/load` endpoints, update the project list to show all tiers with `writable` flags.
- [ ] Build the project serializer (`source/src/services/project-serializer.ts`): in-memory state → typed `.cine` document files, with validation as the final step.
- [ ] Implement `syncFountainToProject()`: scenes, breakdown rows, starter shots with cinematography schema.
- [ ] Wire Start-from-Script wizard to `syncFountainToProject()` and `createNewProject()` (which writes the initial `.cine` package to the server-resident tier).
- [ ] Wire autosave to the serializer with dirty-document tracking; write only changed documents to `POST /api/projects/:id/documents`.
- [ ] Add visible save status and read-only project indicator.
- [ ] Implement "Duplicate Sample As Local Project" to exercise the serializer → write → load round-trip before import/export depends on it.
- [ ] Add agent-health check in wizard entry; fall back to deterministic parsing when agent is not configured.
- [ ] Initialize mood-board scaffolding and `styleGuide` defaults in every new project.
- [ ] Wire `colorState` persistence to project save/load (through `styleGuide.colorPalette` in the serializer).
- [ ] Extend shot schema to include `shotType`, `cameraAngle`, `cameraMovement`, `lightingTechnique`, and `status` fields.
- [ ] Make "Build Shot Prompt" in the Camera/Lighting panel produce a real prompt from shot params + style guide.
- [ ] Inventory and replace MVP-path globals touched by: script import, tree refresh, scene selection, storyboard generation, and save.
- [ ] Verify end-to-end: new project → paste script → scenes appear → scene detail opens → starter shots appear with cinematic metadata → mood board initialized → autosave writes to server-resident `.cine` directory → reload → full project state restores.
- [ ] Run `npm run build` and `npm run lint:legacy-globals` after code changes; fix new warnings before closing tasks.

---

## Success Criteria

Rationale: these are not aspirational — they are the checks that confirm the task list has built real foundations rather than just adding screens. Passing them means future agents, wizards, mood boards, shots, storyboards, generated clips, reference assets, review gates, and timeline assembly all have a dependable base to work from.

- [ ] A filmmaker can create a blank project and paste a Fountain script without needing the sample project.
- [ ] The app produces navigable scene nodes, breakdown rows, and starter shots deterministically from that script.
- [ ] Each starter shot carries `shotType`, `cameraAngle`, `cameraMovement`, `lightingTechnique`, `composition`, `atmosphereTags`, `status`, and a `scriptLink` anchor.
- [ ] Characters and locations extracted from the script appear in the asset library and are ready to accept uploaded reference images.
- [ ] Every project has a mood board initialized at creation with `styleGuide` defaults and at least one empty board slot.
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
- [ ] Agent-assisted extraction (script analysis, bibles, prompts) enriches the project when configured but does not block any core workflow step when agents are absent.
- [ ] The AI Director review queue surfaces pending agent outputs and Approve/Reject controls that advance the orchestrator.
- [ ] MVP-path script, workspace, storyboard, and save flows use imported services and module events instead of new `window.*` paths.
- [ ] New storage keys, provider routing, and agent route usage go through existing SSOT modules — `storage-keys.ts`, `provider-registry.js`, `agent-routes.js`.
- [ ] `bridge/compat.ts` and `types/globals.d.ts` are smaller after each migrated area, not larger.
- [ ] `source/server/proxy.js` is split into route-focused modules without duplicating provider or agent route constants.
- [ ] `npm run build` and `npm run lint:legacy-globals` pass after each PR.
