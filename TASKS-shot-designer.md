# Shot Designer — Task Plan

## Overview
New cinematography tool for composing shots visually and sequentially.
Two modes: Shot List Designer (MVP) and Composition Canvas (advanced).
Spatial/overhead maps are deferred indefinitely.

---

## Mode 1: Shot List Designer (MVP)

A sequence composer that arranges camera presets into a scene-level shot list.

**What it is:**
- List of shot cards, each a combo of presets from the Camera & Lighting panel
- Drag-and-drop reorder within a scene
- Annotate transitions between shots (Cut, Dissolve, Wipe, Fade, Iris)
- Generate a scene-level prompt from the full sequence

**Dependencies:**
- Camera & Lighting presets (Track A) — shot types with focal length params
- Existing `SceneShot` data model
- Existing prompt builder pipeline

**UI:**
- New Lit component: `src/components/panels/cinegen-shot-designer.ts`
- Renders below or beside the camera-lighting presets panel
- Each shot card shows: shot type abbr + focal length, angle, movement, lighting

**Prompt output:**
```
Shot 1: Close-Up (85mm), Eye-Level, Static, 3-Point Lighting
→ Cut to →
Shot 2: Medium Shot (50mm), Low Angle, Dolly In, Low-Key Lighting
→ Dissolve to →
Shot 3: Wide Shot (24mm), Overhead, Crane Down, Golden Hour
```

**Data flow:**
- Reads presets from `cameraLightingSelections` + `cameraLightingParams`
- Stores shot list as an array of shot descriptor objects (not full `SceneShot`)
- On "Build Scene Prompt", serializes the list through the existing prompt pipeline

### Special Effects per Shot

Each shot card in the list includes a **Special Effects** section alongside cinematography presets.

**Three categories** (moved from camera-lighting presets into this standalone department):
- **Atmospheric Effects** — Fog/Mist, Rain, God Rays, Dust/Particles, Haze, Smoke, Snow/Frost, Heat Shimmer
- **Weather & Environment** — Heavy Rain Storm, Gentle Snowfall, Thick Fog, Bright Sunny Daylight, Thunderstorm, Wind, Desert Haze, Urban Neon Reflections, Underwater Caustics
- **Particle FX** — Floating Embers, Magic Dust, Volumetric God Rays, Lens Flares, Holograms, Smoke/Steam, Water Splash, Explosive Debris, Energy Aura, Butterfly Swarm

**UI:** Separate section within the Shot Designer panel, not in camera-lighting presets. Each item has params (intensity, speed, density, color) rendered as dropdowns — same pattern as the presets panel.

**Prompt output:**
```
Shot 1: Close-Up (85mm), Eye-Level, Static, 3-Point Lighting (Warm), Heavy Rain (High), Floating Embers (Medium, Slow)
```

**Store:** Shot designer keeps its own SFX selections per shot card — separate from `cameraLightingSelections`/`cameraLightingParams`.

**Integration with camera presets:** Both contribute to the same prompt string. The shot card serializes cinematography + SFX together.

---

## Mode 2: Composition Canvas (Advanced)

A visual frame canvas for arranging character/element placeholders within the shot.

**What it is:**
- Canvas layer over the selected shot type's aspect ratio
- Draggable character icons from the project's character library
- Element labels (prop, background object, vehicle, etc.)
- Focal point marker (rule-of-thirds grid overlay)
- Depth markers (foreground / midground / background zones)

**Why it's useful:**
- Produces richer, spatially-aware prompts
- Helps the AI understand positional relationships ("Character A left foreground, Character B right midground")
- Bridges the gap between the shot list and the actual image composition

**Limitations:**
- No AI model reads spatial/scene layout data directly
- The canvas is translated into text prompt descriptions, not raw coordinates
- The AI interprets the spatial description with varying accuracy

**Prompt output:**
```
Left foreground: Character A (seated, profile)
Right midground: Character B (standing, facing camera)
Background: Window with rain, street lights visible
Focal point: Character A at rule-of-thirds right intersection
Depth: Strong foreground/midground separation
```

**Implementation approach:**
- HTML Canvas or SVG overlay in a Lit component
- Character library integration (reads from `assetLibrary.characters`)
- Grid overlay toggle (rule of thirds / golden ratio / center)
- Export as prompt text, not image data

---

## Mode 3: Spatial / Overhead Map (DEFERRED)

**Not building. Rationale:**
- No current AI model accepts overhead scene maps, camera position vectors, or blocking diagrams as input
- The information gain over text prompts is negligible
- Would require significant infrastructure (2D map renderer, path curving, collision detection) for zero model-side benefit
- Revisit only when a major model adds explicit scene layout input

---

## Implementation Order

| Step | What | Why this order |
|------|------|---------------|
| 1 | Track A — focal length params on shot types | Foundation: all shot presets need params first |
| 2 | Shot List Designer (Mode 1) | Quickest win, reuses existing presets |
| 3 | Composition Canvas (Mode 2) | More complex, but unlocks richer prompts |
| 4 | ~Spatial Maps~ | Deferred indefinitely |

---

## New Files

- `src/components/panels/cinegen-shot-designer.ts` — Lit component, both modes
- `src/camera/shot-list-types.ts` — types for shot list entries (if not inlined)
- `css/CineGenShotDesigner.css` — styling (or add to existing CSS)

## Integration Points

- **Tree entries** — `shot-designer` (existing) and `special-effects-department/*` (new) both need updating to point to the shot designer panel
- **Camera presets** — shot designer reads from `cameraLightingSelections` and `cameraLightingParams`
- **Prompt builder** — shot list serialization flows through `buildLocalCameraPrompt()` or a new `buildShotListPrompt()`
