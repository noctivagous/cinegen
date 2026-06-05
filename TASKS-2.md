# CineGen — Research & Integration Notes

## Table of Contents

1. [Image Fetch & Reference APIs](#1-image-fetch--reference-apis)
2. [JavaScript Sound Editor (Sound Department)](#2-javascript-sound-editor-sound-department)
3. [Color Wheel / Color Picker Libraries](#3-color-wheel--color-picker-libraries)
4. [Three.js Lighting Visualization](#4-threejs-lighting-visualization)
6. [Body Diagram / Mannequin for Wardrobe UI](#6-body-diagram--mannequin-for-wardrobe-ui)
7. [Global Assets, Mood Boards, ScratchPad & Drafts Grouping](#7-global-assets-mood-boards-scratchpad--drafts-grouping)
8. [Department-Specific UI Recommendations](#8-department-specific-ui-recommendations)

---

## 1. Image Fetch & Reference APIs

### Out-of-the-box (free API key registration, no payment)

| Service | API Key Required | Free Tier | Content Type | Notes |
|---------|:-:|:-:|:-:|-------|
| **Unsplash** | Yes (free) | 50 req/hr | Photos | Rich library, `GET /search/photos`, `GET /photos/:id`. Best general-purpose free image API. |
| **Pexels** | Yes (free) | 200 req/hr, 20K req/mo | Photos + Video | Easiest all-purpose free API. Also returns video clips. |
| **Pixabay** | Yes (free) | ~5K req/hr | Photos + Video + Vectors | Allows downloading + caching + serving from own infra. Most permissive licensing. |
| **Wikimedia Commons** | No | Unlimited | CC-licensed media | Truly API-key-free. REST API at `https://commons.wikimedia.org/w/api.php`. Images have various CC licenses. |

### Pinterest-specific (requires more setup)

| Approach | API Key | Notes |
|----------|:-:|-------|
| **Official Pinterest API** | Business account + approval | Heavy lift, rate-limited, requires app review |
| **RapidAPI Pinterest collection** | RapidAPI key (free tier) | Third-party wrappers, some paid tiers |
| **Apify Pinterest Scraper** | Apify account (free tier) | No official API key needed. Returns JSON of pins (title, description, image URL, board). |
| **ScrapeCreators unofficial API** | Free API key | No business account required. JSON results. |

### Recommendation for CineGen

- **Primary (out-of-box):** Unsplash + Pixabay — register free API keys, search images by query terms extracted from script/character/location descriptions.
- **Secondary (when Pinterest-specific):** Apify Pinterest scraper for mood board seeding with Pinterest visual search.
- **AI provider web search (when configured):** xAI Grok, OpenAI GPT with browsing, Perplexity, or any LLM provider that offers tool-calling with web search. Returns broader results including film stills, blog articles, cinematography references, tutorials. Useful for research ("how to light a film noir scene") and finding specific visual references that free image APIs don't cover.
- **Fallback (no keys):** Wikimedia Commons API — no key needed, search by CC-licensed images. Embed directly in app's search UI.
- All three consumption paths: **drop zone** → image is fetched (not uploaded by user) → added to mood board / reference slot / draft.

### Search Source Decision Tree

```
User requests: "Find references for Victorian-era mourning dress"

1. Image APIs (if keys configured)
   → Unsplash/Pexels: "victorian mourning dress"
   → Returns free-license photos
   → Good for: direct mood board use, character costume refs

2. AI provider web search (if LLM search tool configured)
   → Web search: "victorian mourning dress historical references"
   → Returns articles, museum collection pages, period film stills
   → Good for: research, understanding context, finding specific visual styles
   → Images shown as "Web Reference" (not downloadable — user must verify license)

3. Wikimedia Commons (fallback, no key needed)
   → Returns CC-licensed historical images
   → Good for: public domain period references

4. All results are presented in a unified grid
   → Tagged by source: "Free License" | "Web Reference" | "CC License"
   → User selects which to add as mood board item or reference slot
```

### Reference Budget & Provider Limits

Every AI model provider caps the number of reference images that can be used in a single generation. The app must track and surface these limits.

| Provider | Max References | Notes |
|----------|:--------------:|-------|
| **Runway Gen-4/4.5** | 3 images | Best for cinematic control with Motion Brush |
| **Kling 3.0+** (Elements) | 3–4 images | Strongest character binding via "Bind Subject" |
| **Veo 3.1** | Up to 3 images | Subject images preserve appearance across multi-shot scenes |
| **Luma Ray 3** | 1–several | Keyframe-based; limits vary by mode |
| **Pika** | 1–3 | Image-to-video and keyframe tools (Pikaframes) |

#### Mitigation Strategy: Character Sheet Compositing

Since 1–4 reference slots are tight, combine multiple character views into a single reference image:

```
Character Sheet (1 image, uses 1 slot)
├── Top row: 4 full-body views — Front, Left profile, Right profile, Back
├── Bottom row: 3–4 close-up portraits — Front face, Left profile, Right profile
└── Clean neutral background, consistent lighting, exact same outfit
```

**Character Sheet Composer Agent** should:
- Accept uploaded single-view images → auto-arrange into optimized composite
- Offer layout presets (2-row, column-based, 1:1, 16:9)
- Split composites back into individual views when the provider supports multi-ref (e.g., Kling Elements)
- Warn user when total reference count exceeds provider limit

#### Rate Limit & Caching Strategy

| Service | Free Tier | Risk |
|---------|-----------|------|
| Unsplash | 50 req/hr | Heavy search sessions can exhaust this quickly |
| Pexels | 200 req/hr, 20K req/mo | More generous but still bounded |
| Pixabay | ~5K req/hr | Least likely to hit limits |

**App behavior:**
- Cache fetched image results locally (server-side, indexed by search query) for 24 hours
- Deduplicate across departments: if Wardrobe already fetched "leather jacket" references, Props reuses the cache
- Show remaining quota indicator in the AI Fetch dialog
- On quota exhaustion, fall back to Wikimedia Commons (no key, unlimited) and note "using open-license source"

---

## 2. JavaScript Sound Editor (Sound Department)

### Candidate Libraries

| Library | Description | Size | Best For |
|---------|-------------|:----:|----------|
| **Wavesurfer.js** | Interactive waveform rendering + audio playback. Plugin system (timeline, regions, minimap, spectrogram). | ~40KB gzipped | Waveform display, playback, basic region editing |
| **Waveform Playlist** | Multi-track Web Audio editor inspired by Audacity. React + Tone.js. Record, fade, shift tracks in time. Export to AudioBuffer/WAV. | ~100KB | Multi-track editing, foley mixing |
| **BBC Peaks.js** | UI component for waveform interaction. Built by BBC for broadcast editors. | ~30KB | Zoomable waveform with segmentation |
| **Tone.js** | Web Audio framework for scheduling, synthesis, effects. | ~50KB | Audio effects chain (reverb, delay, distortion, EQ) |
| **Pizzicato.js** | Simpler Web Audio effects library. | ~20KB | Lightweight effects (reverb, delay, distortion, filters, tremolo) |

### Proposed Architecture

```
Sound Department Panel
├── Waveform display (Wavesurfer.js)
│   ├── Playhead / transport controls
│   ├── Region markers (dialogue, foley, music, SFX)
│   └── Waveform zoom
├── Track list (Waveform Playlist-inspired)
│   ├── Dialogue track
│   ├── Foley track
│   ├── Music track
│   ├── SFX track
│   └── Add/mute/solo per track
├── Effects chain (Tone.js)
│   ├── Reverb
│   ├── Delay / Echo
│   ├── EQ (high/mid/low shelf)
│   ├── Compressor
│   └── Pitch shift
├── Clip library
│   ├── Uploaded audio files
│   ├── AI-generated foley placeholders
│   └── Drag to timeline
└── Export / Bounce
    ├── WAV export selection
    └── Link to shot / scene
```

### Integration notes

- Wavesurfer.js has an ES module build — compatible with Lit + Vite.
- Tone.js can be dynamically imported only when the Sound department is enabled (code splitting).
- Waveform Playlist is React-based; for a Lit app, use Wavesurfer.js native and build a custom multi-track layer on top.

---

## 3. Color Wheel / Color Picker Libraries

### Candidate Libraries

| Library | Type | Size | Features | Lit Compat |
|---------|:----:|:----:|----------|:----------:|
| **iro.js** (`@jaames/iro`) | HSV color wheel on canvas | ~15KB | Full wheel, touch support, multicolor, HEX/RGB/HSL output, modular | Yes — ES module, no framework lock-in |
| **Pickr** | Modern color picker | ~30KB | Wheel + sliders + presets, dark/light themes, multiple color formats | Yes — framework-agnostic |
| **KellyC Color Picker** | Canvas color wheel | ~10KB | HSV model, mobile-friendly, attaches to `<input>`, single file | Yes — no dependencies |
| **ColorWheel (keupoz)** | Simple HSV wheel | ~8KB | UMD + ES module, touch support | Yes — ES module available |

### Recommendation

Use **iro.js** as the primary color wheel for Color Grade / Color Presets sections:

```typescript
import iro from '@jaames/iro';

const colorPicker = new iro.ColorPicker('#picker-container', {
  width: 280,
  color: '#ff0000',
  layout: [
    { component: iro.ui.Wheel },
    { component: iro.ui.Slider, options: { sliderType: 'hue' } },
    { component: iro.ui.Slider, options: { sliderType: 'saturation' } },
    { component: iro.ui.Slider, options: { sliderType: 'value' } },
  ]
});

colorPicker.on('color:change', (color) => {
  // Sync to colorState / styleGuide.colorPalette
});
```

**Why iro.js:**
- Pure canvas-based wheel (not DOM-heavy) — performs well in Lit shadow DOM
- Modular layout system — can compose wheel + sliders for tint/tone/shade
- `@color:change` event maps naturally to `colorState` updates
- No framework coupling — works inside Lit components via `firstUpdated()` lifecycle
- Small bundle size (~15KB)

---

## 4. Three.js Lighting Visualization

### Relevant Projects & Resources

| Project | Description |
|---------|-------------|
| **Three.js core lighting** | `AmbientLight`, `DirectionalLight`, `HemisphereLight`, `PointLight`, `SpotLight`, `RectAreaLight` — all with `*Helper` classes for visualization |
| **ASLS Studio** (open-source) | DMX lighting engine + visualizer built on Three.js. Fixture grouping, scene generation, effect engines. |
| **craftpixels/threejs-light-simulation** | GLTF model + HDRI environment + configurable lighting via dat.GUI |
| **mitchcamza/ThreeJS-Lighting-Showcase** | Interactive demo of all light types with parameter controls |
| **Three.js Demos** | `threejsdemos.com` — point light helper visualization, shadow camera inspection, spotlight target following mouse, noise-based flicker (handheld torch) |

### Proposed Integration for CineGen

```
Lighting Previs Panel (optional, future)
├── Three.js canvas scene
│   ├── Mannequin / object placeholder
│   ├── Key light (DirectionalLight)
│   ├── Fill light (HemisphereLight or soft DirectionalLight)
│   ├── Back light / rim light (SpotLight)
│   ├── Practical lights (PointLight, colored)
│   └── Gobo / cookie patterns (optional, texture-based)
├── Control panel (Lit overlay)
│   ├── Light presets: "Three-point", "Rembrandt", "Silhouette", "Chiaroscuro"
│   ├── Per-light controls: intensity, color, position (drag), falloff
│   ├── Color temperature slider (warm/cool)
│   └── Export to shot lighting parameters
└── Sync
    ├── Writes `lightingTechnique` + `atmosphereTags` to active shot
    └── Feeds into `buildCameraPrompt()`
```

### Integration Approach

1. Create a Lit wrapper component `<cinegen-lighting-previs>` that initializes a Three.js scene on mount.
2. Use `RectAreaLight` + `DirectionalLight` + `HemisphereLight` as the core film lighting toolkit.
3. Import Three.js dynamically (`import('three')`) when the Lighting panel opens.
4. Map Three.js light parameter changes → shot `lightingTechnique` and `atmosphereTags`.
5. Consider Three.js `EffectComposer` for post-processing (film grain, bloom, color grading preview).

### Critical: The 3D→AI Translation Bridge

**No video or image generation model accepts raw 3D scene data** (`.gltf`, `.obj`, JSON camera rigs, or scene graphs). This is a fundamental constraint documented across all major providers. The Three.js scene cannot be fed directly to any AI model.

Instead, the app must **translate 3D spatial intent into the two mediums models do accept**: rich text prompts and annotated reference images.

```
Three.js Scene (internal previs)
│
├── Camera position + FOV → "Medium shot, 50mm lens, slow dolly in"
├── Key light position + intensity → "Hard key light from upper left, 45°"
├── Fill light → "Soft fill at ¼ intensity, warm 4200K"
├── Rim/hair light → "Cool rim light from behind at 3200K"
├── Character positions → "Character A 2m left foreground, Character B 4m right background"
└── Set geometry → "Exposed brick wall behind, table center frame"
        │
        ▼
┌─────────────────────────────────────┐
│      9-Element Prompt Builder       │
│  (see §9 Prompt Assembly)           │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│  Annotated Reference Still          │
│  (render Three.js scene to 2D image,│
│   overlay arrows/masks for motion)  │
└─────────────────────────────────────┘
        │
        ▼
    AI Model
    (receives text prompt + annotated image, never raw 3D data)
```

**Implementation:**
- Three.js scene renders a "wireframe preview" to 2D canvas when the user triggers "Send to Generation"
- The 2D render includes: posed figures in correct positions, lighting direction indicators, camera frustum overlay
- This image becomes one of the reference slots in the generation call
- The Three.js parameters are simultaneously serialized into the 9-element prompt text

**Alternative annotation pathways:**
- Runway supports **Motion Brush** — user paints regions on a still to indicate motion direction
- Veo 3 supports **spatial prompting** — arrows and bounding boxes on reference images
- Kling supports **Elements binding** — circle a subject in a reference image to lock identity
- The app should offer a "Paint Motion" overlay tool on the Three.js render export

### Library Status

Three.js is **not yet a dependency** in the project. Add via `npm install three` and `npm install @types/three` when implementing the Lighting Previs panel. Use dynamic import to avoid increasing the main bundle.

---

## 6. Body Diagram / Mannequin for Wardrobe UI

### Candidate Libraries

| Library | Description | Best For |
|---------|-------------|----------|
| **Mannequin.js** (`boytchev/mannequin.js`) | Articulated human figure in pure JS/Canvas. Poses, joint articulation. ~15KB. | Blank body diagram, pose adjustment, proportion visualization |
| **Fabric.js** | Canvas library with object model, SVG support, event system, serialization. ~200KB. | Interactive clothing overlays, drag-drop garments onto body, serialization of layout state |
| **Konva.js** | 2D Canvas framework with layering, drag-and-drop, grouping, event handling. ~100KB. | Layered clothing configuration, hit detection on garment zones |
| **Three.js (GLTF humanoid)** | Load a 3D human model, apply clothing textures/meshes. | 3D mannequin with swappable garment meshes (future) |

### Proposed Wardrobe Panel UI

```
Wardrobe Panel
├── Body diagram canvas (Mannequin.js or Fabric.js)
│   ├── Male / Female toggle
│   ├── Blank figure with zone outlines (head, torso, arms, legs, feet)
│   ├── Drag clothing items onto zones
│   └── Layer order: base layer → outer layer → accessories
├── Clothing configuration controls
│   ├── Garment type selector (top, bottom, dress, outerwear, footwear, accessory)
│   ├── Color / pattern picker (iro.js wheel)
│   ├── Fit toggle (close, regular, loose)
│   ├── Fabric / texture reference image
│   └── Notes / description field
├── Character import
│   ├── Import characteristics from character module (height, build, era, style notes)
│   └── Auto-suggest garments from character description
├── Asset sources (three ways to apply)
│   ├── Drop zone — drag reference image onto body zone
│   ├── AI fetch — "Find costume references for this character"
│   └── AI generate — "Generate outfit based on description"
└── Export
    ├── Save to CharacterGuideEntry.references.costume[]
    └── Propagate to shot generation as character style anchor
```

### Recommended Approach

**Phase 1 (2D, Fabric.js):**
- Render a blank body outline (SVG or canvas drawing) as base layer.
- Use Fabric.js to create interactive "garment" objects that can be dragged/resized/rotated on top.
- Each garment stores: `type`, `color`, `pattern`, `zone`, `layerOrder`.
- Serialize state as JSON in `CharacterGuideEntry.references.costume[]`.

**Phase 2 (3D, Three.js):**
- Load a GLTF humanoid mesh with morph targets for body proportions.
- Apply garment meshes or textures programmatically.
- Expose lighting controls from the Lighting Previs panel.

---

### 6.1 Character Posing in Shots (Storyboard Blocking)

Mannequin.js is **effectively the only lightweight, embeddable JavaScript library for articulated figure posing**. The alternatives its docs list are:

| "Alternative" | Reality |
|---------------|---------|
| **SetPose.com** | A web product / SAAS, not an embeddable library |
| **Marionettes** (roipoussiere) | Similar concept, but both GitHub mirror and GitLab upstream are gone (404 / login-gated). Unmaintained. |
| **DIY Three.js + rigged GLTF** | Heavy, requires building all pose controls from scratch |

Mannequin.js is available on npm as `mannequin-js` (v5.2.3, last published ~2 years ago) and has a built-in posture editor demo. It renders as 2D on Canvas — no Three.js dependency for the basic case.

#### Proposed Integration: Shot Blocking with Mannequin.js

```
Storyboard Shot Blocking Panel
├── Mannequin.js canvas
│   ├── One or more posed figures per frame
│   ├── Joint-level control (torso angle, arm position, head direction, leg stance)
│   ├── Male / Female / Child figure types
│   └── Camera framing overlay (shot type boundary guides)
├── Pose controls
│   ├── Preset poses: standing, walking, sitting, pointing, crouching, running
│   ├── Save custom pose per character
│   └── Load pose from Character Hub (if character has a defined default stance)
├── Multi-figure scene
│   ├── Add/remove figures per shot
│   ├── Position figures in 2D scene space (depth layering)
│   └── Figure-to-figure interaction (facing, distance, eye line)
├── Export to generation
│   ├── Pose description → injected into `buildCameraPrompt()`
│   └── Silhouette overlay → saved as storyboard frame placeholder
└── Integration with shot config
    ├── Pose metadata stored in `SceneShot` (new `blocking` field or similar)
    └── Feeds into AI generation as blocking reference
```

**Value:** Before generating a storyboard frame, a filmmaker can pose silhouettes to establish blocking. The pose description flows into the generation prompt so the AI respects the intended staging — who faces where, arm gestures, sight lines, physical interaction. This bridges the gap between text-based "two-shot" and a fully generated frame that may not respect the director's blocking intent.

**Phase plan:**
- **Phase 1:** Single figure per shot, preset poses, pose → prompt text injection.
- **Phase 2:** Multi-figure scenes, custom pose save/load, figure positioning in frame.
- **Phase 3:** Camera frustum overlay (show what's in frame vs. off-screen), export blocking as a composited silhouette placeholder.

---

---

## 8. Department-Specific UI Recommendations

Each department subsection should have a custom mini-app interface within the panel bounds. Below are recommendations for each major department.

### 8.1 Wardrobe / Costume

| Element | Implementation |
|---------|---------------|
| Body diagram | Fabric.js + blank SVG body outline (male/female toggle) |
| Garment library | Grid of thumbnails (uploaded + AI-fetched) with drag-to-body |
| Garment config | Type selector, color wheel (iro.js), fit toggle, fabric reference |
| Character link | Import height, build, era, style notes from Character Hub |
| Three asset paths | Drop zone / AI fetch / AI generate (per requirement) |
| Reference storage | `CharacterGuideEntry.references.costume[]` |

### 8.2 Props

| Element | Implementation |
|---------|---------------|
| Prop catalog | Grid view with category filters (hand props, set dressing, consumables) |
| Per-prop detail | Name, description, reference images, quantity, scene assignment |
| Scene assignment | Multi-select scenes from script breakdown |
| AI fetch | "Find props matching this description" → Unsplash/Pexels search |
| AI generate | "Generate prop design" |
| Status tracking | Not started / Sourced / Built / Ready / In use |

### 8.3 Makeup / Hair

| Element | Implementation |
|---------|---------------|
| Face diagram | Front + profile face outline (Fabric.js overlay zones) |
| Makeup palette | Color wheel + swatch library for lip/eye/skin tones |
| Hair style selector | Visual library of hair styles (uploaded reference images) |
| Character link | Import complexion, era, character notes |
| Look cards | Side-by-side before/after, saved as makeup looks |
| Time tracker | Estimated application time per look |

### 8.4 Sound Department

| Element | Implementation |
|---------|---------------|
| Waveform editor | Wavesurfer.js with transport controls |
| Multi-track | Inspired by Waveform Playlist (dialogue, foley, music, SFX tracks) |
| Effects chain | Tone.js reverb/delay/EQ/compressor per track |
| Clip library | Uploaded audio files + AI-generated foley placeholders |
| Scene sync | Link sound clips to specific scenes or shots |
| Export | WAV/mp3 bounce of selected tracks or master |

### 8.5 Foley

| Element | Implementation |
|---------|---------------|
| Sound effects grid | Categorized library (footsteps, cloth rustle, doors, weather, etc.) |
| Recording | In-browser recording via `MediaRecorder` API |
| Waveform preview | Wavesurfer.js mini-waveform per clip |
| Scene assignment | Drag clip onto scene/shot in timeline |
| AI generate | "Generate foley for: character walking on gravel" → ElevenLabs Sound FX or similar audio gen API |
| **Audio is post-production** | Foley is generated separately from video and mixed in a DAW or the app's Sound Department panel. No video model generates diegetic sound accurately. Veo 3 generates ambient audio only. |

### 8.6 VFX

| Element | Implementation |
|---------|---------------|
| Shot list with VFX status | Per-shot VFX tracking (plate, keying, comp, render) |
| Reference plates | Image/video reference gallery for VFX style |
| **VFX metadata tags** | Per-shot annotations: `green-screen`, `rotoscoping`, `particle-simulation`, `matte-painting`, `set-extension`. These tag shots for post-production software (After Effects, Nuke, Fusion), not AI generation. |
| AI generate | "Generate VFX concept frame for this shot" (concept only, not production-grade compositing) |
| Compositing notes | Layer descriptions, software references, external tool handoff |

### 8.7 Color Grade

| Element | Implementation |
|---------|---------------|
| Color wheel | iro.js HSV wheel (primary, shadows, midtones, highlights) |
| Lift/Gamma/Gain | Three sliders with color picker |
| Tone controls | Tint, temperature, saturation, contrast sliders |
| Preset library | Saved color grade looks (film stocks, moods, genres) |
| Shot preview | Reference thumbnail showing grade applied |
| Export | Writes to `colorState` and `styleGuide.colorPalette` |

### 8.8 Color Presets

| Element | Implementation |
|---------|---------------|
| Preset grid | Thumbnail previews of saved color grades |
| Apply to scene | Select preset → apply to all shots in a scene |
| Apply to shot | Select preset → apply to individual shot |
| Custom mix | Blend between two presets (crossfade slider) |
| CC library import | Support LUT-style presets (`.cube` file import future) |

### 8.9 Editor / Edit Decision List

| Element | Implementation |
|---------|---------------|
| Timeline view | Scene-based timeline with shot thumbnails, **clips constrained to 5–10s segments** |
| **Chaining awareness** | Timeline shows "last frame carry-over" links between clips. When clip A ends, its last frame seeds clip B as start image. User can adjust overlap (default: 2 frames). |
| Cut list | EDL table: scene, shot, duration, notes |
| Assembly status | Missing frame / has frame / approved per shot |
| Notes per cut | Director/editor notes per edit point |
| **Extend clip** | "Extend" button on any generated clip: app grabs the last frame, regenerates +5–10s with the same prompt and refs, then **ffmpeg concatenates the extension onto the original**. The user sees one continuous clip with an updated duration — never separate segments. This matches the universal pattern across Runway, Kling, Luma, and Grok. |
| Export | Fountain-based EDL or standard CSV |

**Clip duration strategy:** Generate in 5–10 second segments (the reliable unit across all providers). For longer continuous shots, use overlap strategy: segment A (frames 0–120), segment B seeded by frame 115 of A (frames 115–235), crossfade transition. The Editor panel manages these overlaps automatically.

---

## 10. Video Editor Integration

### Vision: Rough Cut v1 → Fine Cut v1

The Editor section needs two tiers of video editing capability:

**Rough Cut v1 (MVP):**
- Sequence AI-generated clips on a timeline in shot order
- Simple cut/trim at clip boundaries
- Playback preview of assembled sequence
- No transitions, no layered effects, no audio mixing
- Export to a single MP4 via server-side ffmpeg

**Fine Cut v1 (Production):**
- Multi-track timeline (video, audio, text/captions, overlay)
- Transition effects between clips (crossfade, dissolve, cut)
- Per-clip trim handles (drag in/out points)
- Text overlay / title cards
- Sync audio tracks from Sound Department
- Browser-based or server-side export

### Candidate Technologies

| Library | Type | License | Stars | Timeline UI | Rendering | Lit Compat |
|---------|:----:|:-------:|:-----:|:-----------:|:---------:|:----------:|
| **Twick** (`@twick/studio`) | Full React SDK | SUL (free for apps) | ~500 | Built-in multi-track | Browser WebCodecs + server FFmpeg | Wrap in WC via `react-dom` |
| **Etro.js** | TypeScript rendering engine | GPL-3.0 | ~1.1k | No UI (programmatic) | Browser Canvas/WebGL | Native ES module |
| **ffmpeg.wasm** | FFmpeg in browser | MIT | ~14k | No UI | WASM-based transcoding | Native ES module |
| **IMG.LY CE.SDK** | Commercial SDK | Paid license | — | Professional multi-track | Browser + server | Framework-agnostic JS |
| **Remotion** | Programmatic React | Remotion License | ~20k | Optional paid timeline | Server-side Puppeteer | Wrap in WC |
| **Custom Canvas timeline** | Build from scratch | — | — | Custom Lit component | ffmpeg.wasm + WebCodecs | Native Lit |

### Recommended Stack for CineGen

**Rough Cut v1 — Custom Lit timeline + ffmpeg.wasm:**

```
Custom Lit Components             ffmpeg.wasm
┌──────────────────────────┐     ┌──────────────────┐
│  <cinegen-timeline>      │     │  concat clips     │
│  ├── Track row (video)   │ ──▶ │  trim boundaries  │
│  ├── Clip blocks         │     │  encode to MP4    │
│  └── Playhead + preview  │     └──────────────────┘
└──────────────────────────┘
```

The timeline component is a horizontal strip where each shot from the shot list appears as a draggable clip block. Clip width maps to duration. Drag to reorder, drag edges to trim. The preview player shows the assembled sequence. Export triggers ffmpeg.wasm to concatenate clips server-side (or in-browser for short sequences).

Core packages needed:
```
npm install @ffmpeg/ffmpeg @ffmpeg/util    # MIT, browser WASM ffmpeg
```

**Fine Cut v1 — Wrap Twick in a Lit Web Component or go custom:**

Option A (faster): Wrap `@twick/studio` React components inside a Lit web component using `react-dom`:
```typescript
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { TwickStudio, TimelineProvider, LivePlayerProvider } from '@twick/studio';

// Inside Lit component's firstUpdated():
const root = createRoot(this.renderRoot.querySelector('#editor-mount'));
root.render(
  createElement(LivePlayerProvider, null,
    createElement(TimelineProvider, { initialData: timelineData },
      createElement(TwickStudio, { studioConfig: config })
    )
  )
);
```

Option B (more control): Build a custom multi-track timeline using the Canvas API + ffmpeg.wasm for rendering. This avoids the React dependency but is significantly more work.

### Data Flow: Shot List → Timeline

```
SceneShot[] (from project data)
│
├── Each shot with: id, duration, sceneId, linkedFrameIds
├── Frame image URLs (from storyboard generation)
├── Audio clip IDs (from Sound Department, fine cut only)
└── Order from shot list (user-reorderable in Scenes & Shots)
        │
        ▼
Timeline Track
├── Track 0: Video — clip per shot, linked to frame image
├── Track 1: Audio — clip per sound assignment (fine cut)
└── Track 2: Text — title cards, captions (fine cut)
        │
        ▼
Export Pipeline
├── Rough Cut: Concat video clips in order, trim to shot durations
└── Fine Cut: Composite multi-track with transitions, mix audio, render
```

### ffmpeg.wasm Integration

```typescript
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const ffmpeg = new FFmpeg();

// Load WASM (lazy, only on export)
await ffmpeg.load({
  coreURL: await toBlobURL('/ffmpeg-core.js', 'text/javascript'),
  wasmURL: await toBlobURL('/ffmpeg-core.wasm', 'application/wasm'),
});

// Concat clips for rough cut
await ffmpeg.exec([
  '-f', 'concat',
  '-safe', '0',
  '-i', 'filelist.txt',
  '-c', 'copy',
  'output.mp4'
]);

// Read result
const data = await ffmpeg.readFile('output.mp4');
```

**Limitations:**
- ffmpeg.wasm is large (~30MB WASM file). Load dynamically only on export.
- Browser export is Chromium-only (WebCodecs). For Firefox/Safari, route through the server-side proxy.
- Long compilations (>5 min) may exceed browser tab memory. Server-side export is preferred for fine cut.

### Phase Plan

| Phase | Scope | Tech | Timeline |
|-------|-------|------|----------|
| **Rough Cut v1** | Single track, shot-order assembly, trim handles, MP4 export | Custom Lit `<cinegen-timeline>` + ffmpeg.wasm (server) | Current P1-P2 cycle |
| **Fine Cut v1** | Multi-track, transitions, text overlay, audio sync | Wrapped Twick or custom Canvas timeline | Post-P2 |

---

### 8.10 Scenes & Shots

| Element | Implementation |
|---------|---------------|
| Scene list | Numbered scenes from script, expandable |
| Per-scene shot grid | Coverage cards with shot type, angle, status badges |
| Shot timeline | Horizontal strip of shots in scene order |
| Shot config | Cinematography parameters (shot type, angle, lens, movement, lighting) |
| Prompt bar | Inline `buildCameraPrompt()` output per shot — 9-element prompt assembly (see §9) |
| Frame preview | Storyboard frame thumbnail per shot (text-placeholder if not generated) |
| **Image-to-video source** | The approved frame preview IS the image-to-video source anchor. All video generation starts from this still. "Generate Video" button → animates the frame with shot camera parameters. |

### 8.11 Camera / Lighting

| Element | Implementation |
|---------|---------------|
| Shot parameter panel | Dropdowns for shot type, angle, movement, lens, lighting technique |
| Style guide indicator | Shows current `styleGuide` color palette + lighting mood |
| Prompt builder | "Build Shot Prompt" → shows generated prompt with fallback |
| Three.js previs | (Future) 3D scene with configurable lights |
| Color palette | iro.js wheel for `colorState` update |

### 8.12 Storyboard

| Element | Implementation |
|---------|---------------|
| Frame grid | Shot-linked frames with thumbnails |
| Per-frame detail | Image, shot parameters, script link, duration |
| Animatic player | `cinegen-storyboard-animatic-player.ts` — sequential playback |
| Reference bank | Toggle individual reference images on/off per generation |
| Draft / Upload | Manual text-placeholder frames + image upload |
| Batch generate | "Draft Storyboards" from shot list |

### 8.13 Character Hub

| Element | Implementation |
|---------|---------------|
| Character cards | Grid of characters extracted from script |
| Per-character detail | Name, description, actor reference, costume references |
| Reference slots | Face, body, profile, three-quarter, close-up, costume[] |
| Drag-to-assign | Drag image onto slot → upload + write reference |
| AI fetch | "Find reference images for this character" → Unsplash/Pexels |
| AI generate | "Generate character concept art" |

### 8.14 Location Scout

| Element | Implementation |
|---------|---------------|
| Location cards | Grid of locations from script |
| Per-location detail | Name, description, reference plates |
| Reference slots | Plate images array |
| Drag-to-assign | Same pattern as Character Hub |
| AI fetch | "Find location references" |
| AI generate | "Generate location concept art" |

### 8.15 Production Office

| Element | Implementation |
|---------|---------------|
| Project overview | Scene count, shot count, completion percentage |
| Call sheet builder | Select date → auto-populate scenes/characters/locations |
| Status dashboard | Visual health of each department (enabled/configured/ready) |
| Production calendar | Date picker with shoot days, prep days, wrap |

---
## 9. Prompt Assembly Architecture

This is the app's central nervous system. Every generation — storyboard frame, shot visualization, mood board image, draft experiment, video clip — flows through a unified prompt builder that gathers data from every available project source.

### The 9-Element Prompt Structure

Per industry research (Runway, Kling, Veo, Sora prompting guides) and the internal `storyboard-generation-research.md`, a high-quality generation prompt requires 6–9 ordered elements:

```
[1] SUBJECT        — who/what (from character hub descriptions, not just names)
[2] ACTION         — what they're doing (from Fountain scriptLink + scene breakdown)
[3] PERFORMANCE    — emotional delivery, expression, acting direction (new: from shot notes or per-take selector)
[4] SCENE / ENV   — setting, time of day, weather (from location desc + breakdown)
[5] FRAMING       — shot type, camera angle (from shot config dropdowns)
[6] CAMERA MOVE   — dolly, track, crane, orbit (from shot config dropdowns)
[7] LENS/OPTICS   — focal length, DOF, anamorphic, film grain (from shot config + style guide)
[8] VISUAL STYLE  — pencil illustration, cinematic, monochrome (from frame notes + project treatment)
[9] LIGHTING      — lighting technique, atmosphere, color palette (from style guide + shot config)
[10] MOTION ENERGY — slow motion, static, handheld (from shot config + scene tone)
```

### Data Sources (priority order, most-specific-first)

| Priority | Source | Fields Used | Example |
|----------|--------|-------------|---------|
| 1 | Frame scriptLink | Fountain action/dialogue line | "Sarah pushes open the cafe door" |
| 2 | Linked shot metadata | `shotType`, `cameraAngle`, `cameraMovement`, `lens`, `lightingTechnique`, `composition`, `atmosphereTags` | "Low angle, dolly in, 35mm" |
| 3 | **Performance direction** | **New: `ShotTake.expression` / `ShotTake.emotion`** | **"determined, eyes narrowed, jaw clenched"** |
| 4 | Character Hub descriptions | `CharacterGuideEntry.desc` (not just name) | "Sarah — mid-30s, dark wavy hair, leather jacket" |
| 5 | Location Scout descriptions | `LocationGuideEntry.desc` | "Coffee shop — exposed brick, Edison bulbs" |
| 6 | Scene breakdown | `time`, `props`, `wardrobe`, `sfx` per scene | "NIGHT, umbrella, raincoat, rain" |
| 7 | Scene master notes | `scene.notes`, `scene.master.prompt` | "Keep atmosphere tense, minimal dialogue" |
| 8 | Project treatment | `genre`, `tone`, `notes` ("Notes for AI") | "Neo-noir thriller, desaturated, rain-slicked" |
| 9 | Style guide | `styleGuide.colorPalette`, `lightingMood` | "Cool blue shadows, warm amber pools" |
| 10 | Reference images | Up to 4 ref image URLs (character sheet, location plate, style ref) | `refImageUrls[]` |

### Expression Sheet & Performance Palette

Rather than generic emoji, the app uses an expression palette organized around the **Five Elements (Wuxing)** emotional framework. Each emotional category has a color identity, a set of expressions, and corresponding prompt descriptions. The element names are never shown — only the color coding and descriptive labels.

#### The Five Expression Categories

| Color | Category Label | Core Emotions | Prompt Language |
|-------|---------------|---------------|-----------------|
| 🟢 Green | **Growth & Drive** | Anger, Irritation, Assertion, Motivation, Frustration | "explosive anger, veins in neck, shouting" / "quiet determination, jaw set" |
| 🔴 Red | **Connection & Vitality** | Joy, Excitement, Laughter, Restlessness, Mania | "radiant smile, eyes crinkling with joy" / "manic energy, scattered focus" |
| 🟡 Yellow | **Center & Reflection** | Pensiveness, Worry, Overthinking, Care, Contemplation | "furrowed brow, lost in thought" / "nervous fidgeting, anxious glance" |
| ⚪ White | **Release & Discernment** | Grief, Sadness, Melancholy, Letting Go, Detachment | "tears streaming, hollow gaze" / "quiet sorrow, distant look" |
| 🔵 Blue | **Depth & Wisdom** | Fear, Terror, Stillness, Willpower, Paranoia | "eyes wide with terror, frozen" / "calm resolve, unshakeable will" |

#### Expression Palette UI

```
┌─ Performance ──────────────────────────────────┐
│                                                  │
│  Character Default: [Sarah]                      │
│  ← Inherited from Casting (can override)         │
│                                                  │
│  ┌─── Expression Grid ───────────────────────┐   │
│  │                                            │   │
│  │  🟢 Assertion     🟢 Frustration          │   │
│  │  🟢 Determination  🟢 Irritation          │   │
│  │                                            │   │
│  │  🔴 Joy           🔴 Excitement           │   │
│  │  🔴 Laughter      🔴 Restlessness         │   │
│  │                                            │   │
│  │  🟡 Contemplation 🟡 Worry                │   │
│  │  🟡 Overthinking  🟡 Care                 │   │
│  │                                            │   │
│  │  ⚪ Sadness       ⚪ Melancholy            │   │
│  │  ⚪ Detachment    ⚪ Sorrow                │   │
│  │                                            │   │
│  │  🔵 Fear          🔵 Terror                │   │
│  │  🔵 Stillness     🔵 Willpower             │   │
│  └────────────────────────────────────────────┘   │
│                                                  │
│  Selected: 🔴 Joy                                 │
│  Prompt desc: "radiant smile, eyes crinkling     │
│  with joy, warm open expression"                  │
│                                                  │
│  [Apply to Shot]  [Set as Character Default]     │
│                                                  │
└──────────────────────────────────────────────────┘
```

#### Beat Sequence: Emotional Arc Across a Shot

For longer shots or scenes, the user can drag expressions into a timeline strip to define emotional beats:

```
Shot: CU-SARAH-01  Duration: 8s
┌─── Beat Sequence ──────────────────────────────┐
│                                                 │
│  [🔵 Stillness] → [🟡 Worry] → [🔴 Fear] → [🟢 Determination]
│    0s─2s           2s─4s        4s─6s          6s─8s
│                                                 │
│  Resulting prompt:                              │
│  "...expression shifts from calm stillness to   │
│   nervous worry, then eyes widen with fear,     │
│   before settling into hard determination..."    │
│                                                 │
└─────────────────────────────────────────────────┘
```

Each beat generates a temporal prompt fragment in the PERFORMANCE element:
```
[0-2s] calm stillness, unshakeable resolve
[2-4s] nervous worry, furrowed brow, darting eyes
[4-6s] eyes widening in fear, sharp intake
[6-8s] determination hardens features, jaw sets
```

#### Character Default Expression Range

In Casting, each character defines a default "emotional range" — which categories they naturally fall into. This auto-populates the shot-level expression palette:

- **Sarah**: Default range 🟢 Growth & Drive + 🟡 Center & Reflection — her palette shows these categories prominently; other categories are available but collapsed
- **Marcus**: Default range 🔵 Depth & Wisdom + ⚪ Release & Discernment
- **Ensemble characters**: All categories available, no default bias

#### Data Storage

```typescript
interface CharacterExpressionRange {
  characterId: string;
  dominantCategories: ('growth' | 'connection' | 'center' | 'release' | 'depth')[];
  defaultExpression: string; // the prompt descriptor
}

interface ShotBeat {
  timeMs: number;        // start time of this beat in ms
  expression: string;    // prompt descriptor
  category: string;      // color category reference
  durationMs: number;    // how long this beat lasts
}
```

### Prompt Builder Architecture

```typescript
interface BuildPromptInput {
  frame: StoryboardFrame;
  shot: SceneShot;
  scene: SceneData;
  project: ProjectSnapshot;
}

interface GeneratedPrompt {
  text: string;           // The 10-element prompt, truncated to provider limit
  dimensions: { w, h };   // Derived from projectSettings.aspectRatio
  refImageUrls: string[]; // Up to 4, respecting provider limit
  sourceLog: string[];    // Which data sources contributed (for debugging)
}

function buildGenerationPrompt(input: BuildPromptInput): GeneratedPrompt {
  // 1. Gather text from all priority sources
  // 2. Assemble in 9-element order
  // 3. Truncate intelligently (prioritize elements 1-4 when under 4K chars)
  // 4. Select reference images respecting provider ref budget
  // 5. Log all sources for transparency
}
```

### Provider-Specific Prompt Adaptation

The Prompt Engineer Agent should maintain a prompt template library per provider:

| Provider | Style Notes |
|----------|-------------|
| **Runway Gen-4.5** | Prefers concise prompts (~1000 chars). Use explicit camera terms ("slow dolly in"). Motion Brush descriptions if available. |
| **Kling 3.0+** | Action + environment + camera. "Bind Subject" for character refs. Supports up to 4 refs via Elements. |
| **Veo 3.1** | Structured prompts with clear subject-action-setting. Spatial annotations (arrows, boxes) on reference images. |
| **Luma Ray 3** | Good with longer prompts (up to 5000 chars). Keyframe-based: first frame → last frame transitions. |

### Prompt Display & Iteration

Every generated prompt should be visible to the user before generation runs:
- Inline prompt bar on shot cards (already partially built as `buildCameraPrompt()` output)
- Editable text area so the filmmaker can override the assembled prompt
- Source attribution: "This prompt uses: Character Hub (Sarah desc), Scene Breakdown (NIGHT), Shot Config (Low angle)"
- After generation, store the used prompt on the frame so identical regeneration is possible

### Truncation Strategy

Provider character limits vary (1000–5000). When the assembled prompt exceeds the limit:
1. Keep elements [1] SUBJECT + [2] ACTION + [3] PERFORMANCE + [5] FRAMING (highest information density)
2. Summarize [8] VISUAL STYLE to a single keyword ("cinematic" → "cine")
3. Drop [10] MOTION ENERGY if scene is described as "static" (default motion)
4. Never truncate [9] LIGHTING — this is the most common consistency anchor across shots
5. Log what was truncated in `sourceLog`

---

### Three Asset Application Paths (per requirement)

Every section that accepts visual assets must support all three:

| Path | UX |
|------|----|
| **Drop zone** | Drag image from file system into the section → upload to server → write reference |
| **AI fetch** | Button "Find References" → query Unsplash/Pexels/Wikimedia → show options grid → user selects → auto-populates |
| **AI generate** | Button "Generate" → prompt dialog → result added as draft → user promotes or discards |

### Common "Mini-App" UI Structure for Each Section

```
┌─ Section Header ─────────────────────────────┐
│  █ Icon    Section Name    [⚙️ Parameters]   │
├─ Content Area (custom layout) ───────────────┤
│                                               │
│        ┌─────────────────────────────┐       │
│        │    Custom mini-app view     │       │
│        │    (body diagram, waveform, │       │
│        │     color wheel, timeline,  │       │
│        │     shot grid, etc.)        │       │
│        └─────────────────────────────┘       │
│                                               │
│  ┌─── Assets Bar ──────────────────────────┐  │
│  │ Drop zone  |  AI Fetch  |  AI Generate  │  │
│  └──────────────────────────────────────────┘  │
├─ Footer (status, counts) ────────────────────┤
│  Status: 5 assets · 3 assigned · 2 pending   │
└───────────────────────────────────────────────┘
```

The "Parameters" button in the header toggles to the existing parameter/settings view, matching the requirement: "the existing parameters views will be available."

---