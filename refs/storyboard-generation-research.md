# Storyboard Image Generation — Prompt Context & Project Data Integration Research

> Research scope: How AI storyboard image generation can leverage all available project data to produce consistent, contextually accurate, and cinematically rich storyboard frames. Based on analysis of the CineGen codebase and industry best practices for AI filmmaking pipelines (2025–2026).

---

## 1. Current State: What the Codebase Does Today

### Prompt Construction (`storyboard/storyboard-bundle.ts:998-1011`)

The current `generateFrameImage()` function assembles a single-line prompt from:

1. **Frame label** — e.g., *"AI Draft - Establishing shot (INT. COFFEE SHOP - DAY)"*
2. **Frame scriptLink** — the linked Fountain script line (action or dialogue)
3. **Style prompt** — hard-coded default: *"Pencil illustration of film frame, monochrome linework..."* or a `Style:` override extracted from frame notes
4. **Reference descriptor text** — character names, location label, and interior/exterior label from the **storyboard reference bank**

**Example of a current prompt:**
> `AI Draft - Establishing shot (INT. COFFEE SHOP - DAY): Sarah enters the cafe, rain dripping from her coat. Pencil illustration of film frame, monochrome linework... Consistent character appearance reference: Sarah. Primary location reference: Coffee Shop. Environment reference: Interior Lighting Reference.`

### What Is Ignored

The prompt builder does **not** access:
- **Project Treatment** — genre, tone, synopsis, visual notes for AI
- **Scene Detail** — scene title, master shot prompt, scene notes, coverage shot metadata
- **Asset Library** — character descriptions, location details, props, wardrobe, effects
- **Breakdown Data** — time of day, specific props, wardrobe items, SFX per scene
- **Camera/Lighting Selections** — shot types, angles, lighting, composition, movements, atmosphere chosen by the user
- **Script Info Entities** — extracted characters, locations, props, wardrobe, SFX from the Fountain script
- **Project Settings** — aspect ratio, color space (hard-coded to 1024x1024 regardless)
- **Frame notes** — beyond the `Style:` prefix extraction

---

## 2. Industry Best Practices for AI Storyboard Prompts

### 2.1 The 9-Element Prompt Structure

Per leading AI video/image generation research (Runway, Kling, Veo, Sora prompting guides), a high-quality cinematic prompt contains **6–9 ordered elements**:

| # | Element | Example |
|---|---------|---------|
| 1 | **Subject** | *"A woman in her 30s, rain-soaked coat, determined expression"* |
| 2 | **Action** | *"pushes open the cafe door, water dripping from her umbrella"* |
| 3 | **Scene / Environment** | *"dimly lit indie coffee shop, warm amber interior, rain-streaked windows"* |
| 4 | **Framing / Shot Type** | *"medium shot, waist-up"* |
| 5 | **Camera Movement** | *"slow dolly in as she enters"* |
| 6 | **Lens / Optical Effects** | *"shallow depth of field, anamorphic lens flare, subtle film grain"* |
| 7 | **Visual Style** | *"pencil illustration, monochrome linework, cinematic composition"* |
| 8 | **Lighting / Atmosphere** | *"practical lamps casting warm pools, cool blue spill from the street"* |
| 9 | **Motion Speed / Energy** | *"deliberate, moody, rain-slicked tension"* |

### 2.2 Storyboard-First Workflow

The recommended production pipeline is:

```
Script → Storyboard (still images) → Pre-vis/Animatic → AI Video Clips → Edit → Audio Post
```

Key principles:
- **Image-to-video is the dominant professional workflow.** A high-quality still acts as a *visual contract* before motion is applied.
- **Consistency across frames requires shared context.** Same style descriptors, same lighting language, same character references on every prompt in a scene.
- **Character consistency** requires seed/reference-image discipline and rich descriptive context (not just names).
- **5–10 second segments** are the reliable generation unit; storyboard frames map directly to these.

### 2.3 Context Is the Differentiator

Tools like Studiovity, Boords, and DeepFiction that parse scripts into storyboards emphasize:

> *"It parses the scene headings, identifies characters, generates shot breakdowns, and creates visual frames for the full script."*

> *"Paste a screenplay, break it into scenes, and generate frames that follow the narrative. That continuity matters when you're presenting to a client or handing off to a production team."*

> *"DeepFiction generates storyboard images directly from your scene descriptions, maintaining the character details and world consistency you built in Stage 1."*

The key insight: **The storyboard frame is not an isolated image. It is a visual expression of everything known about that moment in the project.**

---

## 3. Available Project Data Sources (CineGen)

### 3.1 Project Treatment (`projectTreatment`)

**Fields:** `workingTitle`, `logline`, `genre`, `tone`, `synopsis`, `themes`, `targetAudience`, `movieReferences`, `notes`

**Relevance to storyboard prompts:**
- `genre` + `tone` → Establish the visual world (sci-fi thriller = desaturated, neon; romantic comedy = warm, bright)
- `synopsis` + `themes` → Inform shot composition and emotional register
- `notes` ("Notes for AI") → Explicit visual directives: *"desaturated palette, neon accents, handheld documentary feel"*
- `movieReferences` → Can be used for style anchoring (with caveats about copyright/training data)

**Already implemented but unused:** `getTreatmentForVisualAI()` in `workspace/treatment-form-service.ts:41-46` strips `movieReferences` and returns all other fields specifically for image/video generation. Storyboard code never calls it.

### 3.2 Scene Detail (`currentSceneData`)

**Per-scene fields:** `title`, `master` (with `label`, `duration`, `status`, `prompt`), `coverage[]`, `broll[]`, `pickups[]`, `notes`

**Relevance:**
- `scene.notes` → Director's notes for the entire scene: *"Keep atmosphere tense, minimal dialogue"*
- `scene.master.prompt` → The master shot already has a prompt field! This is a prime candidate for reuse.
- `scene.title` → Human-readable scene identity (e.g., *"Scene 2 - The Confrontation"*)
- `coverage[].type` + `coverage[].label` → Shot type intent: *"Master Shot"*, *"Coverage - Sarah's reaction"*
- `coverage[].scriptLink` → The Fountain anchor for the shot (may differ from frame's scriptLink)

### 3.3 Asset Library (`assetLibrary`)

**Buckets:** `characters[]`, `locations[]`, `props[]`, `vehicles[]`, `wardrobe[]`, `effects[]`, `audio[]`, `production[]`

**Each item has:** `name`, `desc`, `icon`

**Relevance:**
- `characters[].desc` → *"Sarah — mid-30s, dark wavy hair, leather jacket, scar above left eyebrow"*
- `locations[].desc` → *"Coffee shop — exposed brick, Edison bulbs, rain-streaked front window"*
- `props[].desc`, `wardrobe[].desc` → Specific items that should appear in the frame
- The reference bank currently only uses the **name**. Using the `desc` would dramatically enrich the visual prompt.

### 3.4 Breakdown Data (`breakdownData`)

**Per-row (scene) fields:** `scene`, `int_ext`, `location`, `time`, `characters`, `props`, `wardrobe`, `sfx`, `notes`

**Relevance:**
- `time` → *"NIGHT"*, *"DAWN"* — directly affects lighting and atmosphere
- `props` + `wardrobe` + `sfx` → Specific items that must be visible/represented
- `notes` → Production notes per scene

### 3.5 Camera / Lighting / Atmosphere Selections (`cameraLightingSelections`)

**Categories:** `shotTypes`, `angles`, `lighting`, `composition`, `movements`, `atmosphere`

**Relevance:**
- The user explicitly selects shot parameters in the Camera & Lighting panel.
- `buildCameraPrompt()` already generates text like: *"Close-Up, Low Angle, Hard Light, cinematic, 4K"*
- These selections are **authoritative user intent** and should be merged into the frame prompt.

### 3.6 Script Info Entities

**Extracted from Fountain:** `characters`, `locations`, `props`, `wardrobe`, `sfx`

**Relevance:**
- Confirms which entities are actually present in the current scene
- Can be cross-referenced with the asset library for richer descriptions

### 3.7 Project Settings

**Fields:** `aspectRatio`, `frameRate`, `timecodeMode`, `defaultResolution`, `colorSpace`

**Relevance:**
- `aspectRatio` should determine the generated image dimensions:
  - `2.39:1` → `1024x428`
  - `16:9` → `1024x576`
  - `1.85:1` → `1024x554`
  - `4:3` → `768x576`
- Currently hard-coded to `1024x1024` for OpenAI, with no size passed to fal.ai.

---

## 4. Recommended Prompt Architecture

### 4.1 Proposed `buildStoryboardPrompt(frame)` Assembly Order

A centralized prompt builder should gather data in this priority order, with earlier elements being more specific to the frame and later elements providing project-wide consistency:

```
[SHOT INTENT]        ← frame label + shot type (from linked coverage shot)
[SUBJECT & ACTION]   ← frame scriptLink (the Fountain action/dialogue line)
[CHARACTERS]         ← assetLibrary character descriptions (not just names)
[LOCATION]           ← assetLibrary location description + breakdown location/time
[ENVIRONMENT]        ← reference bank interior/exterior + breakdown props/wardrobe/SFX
[FRAMING]            ← cameraLightingSelections shotTypes + angles
[CAMERA MOVEMENT]    ← cameraLightingSelections movements
[LIGHTING]           ← cameraLightingSelections lighting + atmosphere + breakdown time
[OPTICAL / STYLE]    ← projectTreatment notes + genre/tone + frame style override
[PROJECT CONTEXT]    ← projectTreatment logline/synopsis snippet for consistency
[ASPECT RATIO]       ← projectSettings.aspectRatio → mapped to dimensions
```

### 4.2 Example: Before vs. After

**BEFORE (current):**
> `AI Draft - Establishing shot (INT. COFFEE SHOP - DAY): Sarah enters the cafe. Pencil illustration... Consistent character appearance reference: Sarah. Primary location reference: Coffee Shop.`

**AFTER (proposed):**
> `Medium shot, eye-level. Slow dolly in. Sarah (mid-30s, dark wavy hair, leather jacket, scar above left eyebrow) pushes open the cafe door, water dripping from her coat. Dimly lit indie coffee shop, exposed brick, Edison bulbs, rain-streaked front window, warm amber interior with cool blue street spill. Practical lamps casting warm pools. Shallow depth of field. Pencil illustration, monochrome linework, cinematic composition, film grain. Genre: neo-noir thriller. Tone: oppressive, rain-slicked tension. Notes: desaturated palette, neon accents only in background signs. Time: NIGHT (per breakdown).`

### 4.3 Fal.ai Reference Image Enhancement

For providers that support reference images (fal.ai), the current code passes up to 4 reference image URLs. This should be enhanced to:
- Ensure the reference images themselves were generated with the **same enriched prompt context**
- Prioritize character reference images for character-heavy frames
- Prioritize location reference images for establishing shots

---

## 5. Implementation Recommendations

### 5.1 Phase 1: Immediate Wins (Minimal Code)

1. **Inject treatment context** into every frame prompt via `getTreatmentForVisualAI()`
2. **Use linked shot metadata** — if `frame.shotId` exists, pull `shot.type`, `shot.label`, `shot.scriptLink`
3. **Use scene notes and master prompt** — pull `scene.notes` and `scene.master.prompt` for scene-wide continuity
4. **Use asset descriptions** — when building `referenceDescriptorText()`, look up items in `assetLibrary` and append `desc`
5. **Respect project aspect ratio** — map `aspectRatio` to correct dimensions instead of hard-coding `1024x1024`

### 5.2 Phase 2: Structured Prompt Builder

Create a `buildStoryboardPrompt(frame)` utility that replaces the inline string concatenation. It should:
- Accept a `StoryboardFrame`
- Gather data from all sources above
- Assemble the 9-element prompt structure
- Return both the text prompt and recommended dimensions

### 5.3 Phase 3: User Control & Transparency

- Show the assembled prompt to the user in the frame editor before generation
- Allow the user to edit the prompt (currently not possible)
- Store the used prompt in the frame so it can be regenerated with identical context
- Log which data sources contributed to each prompt for debugging

---

## 6. Key Limitations (Honest Assessment)

- **No true 3D scene graph input.** You cannot hand a model a structured scene and expect deterministic spatial results. Rich text is the best available channel.
- **Prompt length limits.** DALL-E 3 and many models have ~4,000 character limits. The builder must prioritize and truncate intelligently.
- **Physics & temporal coherence.** Objects may morph between frames. Richer prompts reduce but don't eliminate this.
- **Character consistency across long sequences.** Requires heavy reference-image discipline. The prompt builder should favor reference images + rich descriptions.
- **Reference image quality depends on reference prompts.** If reference slot images were generated with the current thin prompts, regenerating them with rich prompts first will improve downstream frame consistency.

---

## 7. Sources & References

- Runway Gen-4 Prompting Guide — https://help.runwayml.com/hc/en-us/articles/39789879462419
- Runway Gen-3 Alpha Research — https://runwayml.com/research/introducing-gen-3-alpha
- Kling 3.0 "AI Director" — https://flowith.io/blog/kling-3-ai-director-era/
- Veo 3 Spatial Prompting (Scenario) — https://help.scenario.com/en/articles/spatial-prompting-for-videos-generation/
- AI Camera Shots Guide (Artlist) — https://artlist.io/blog/camera-shots-ai/
- AI Camera Movement Prompts (LetsEnhance) — https://letsenhance.io/blog/all/ai-video-camera-movements/
- Boords AI Storyboard Generator — https://boords.com/ai-storyboard-generator
- Studiovity AI Storyboarding — https://blog.studiovity.com/ai-storyboarding-in-filmmaking-for-faster-film-pre-production/
- DeepFiction AI Filmmaking Pipeline — https://www.deepfiction.ai/blog/ai-filmmaking-pipeline-script-to-screen-2026
- Leonardo.Ai Storyboard Guide — https://leonardo.ai/news/storyboard-ai/
- Higgsfield Storyboard Generator — https://higgsfield.ai/storyboard-generator
- CineGen `ai-video-production-research.md` (internal) — §4 Prompting Strategies

---

*Document compiled: 2026-05-22*
*Based on codebase analysis of `source/src/storyboard/storyboard-bundle.ts` and related project data modules.*
