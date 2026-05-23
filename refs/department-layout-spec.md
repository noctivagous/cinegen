# Department Layout Spec — CineGen Production Departments (2026)

> Reorganizes the CineGen UI around real-world filmmaking departments. Each department owns a tailored workspace with its own toolbar, panels, reference libraries, and agent integration. This bridges the user's mental model of a physical film crew to the app's AI-assisted pipeline.

---

## 1. Design Philosophy

### Mental Model Match
Filmmakers think in departments. A Director of Photography does not look in the same place as a Costume Designer. By organizing the app into departments, functions become discoverable by role rather than by abstract feature name.

### Agent-to-Department Mapping
Each department houses the UI surface for one or more agents from the agent architecture (`ai-agents-for-filmmaking-research.md`). The department is the **human face** of the agent swarm.

### Existing Code Reuse
This is a **reorganization**, not a rewrite. Current panels (`cinegen-script-editor`, `cinegen-storyboard`, `cinegen-camera-lighting-view`, `cinegen-casting-view`, `cinegen-breakdown-view`, `cinegen-assets-panel`, `cinegen-location-scout`, `cinegen-timeline`, etc.) are reassigned to departments. Department shells provide navigation, shared toolbars, and context-aware sidebars.

---

## 2. Department Overview

| Department | Head of Department | Primary Agents | Existing Panels / Features |
|------------|-------------------|----------------|--------------------------|
| **Production Office** | Producer / AD | Script Agent, Storyboard Agent | Script Editor, Breakdown Sheets, Shot List, Treatment, Overview |
| **Cinematography** | Director of Photography | Prompt Engineer Agent, Generation Agent (Model Router), Consistency Auditor Agent | Camera/Lighting View, Storyboard, Scene Coverage, Motion References, Spatial Annotation |
| **Production Design** | Production Designer | Location/Set Agent | Location Scout, Sets, Wardrobe, Props, Art Direction |
| **Casting** | Casting Director | Character/Casting Agent | Casting View, Character Sheets, Voice Casting, Performance Notes |
| **Sound Department** | Sound Supervisor / Mixer | Audio Agent | Production Sound, ADR, Foley, SFX, Music/Score, Temp Mix |
| **Post Production** | Editor / Colorist | Sequence Assembly Agent, Finish/Color Agent | Timeline, Rough Cut, Color Grade, VFX, Export |
| **AI Director** | Director (human) | Orchestrator, Consistency Auditor, Review Gate | Generation Queue, Review Dashboard, Cost Tracking, Model Routing |

---

## 3. Global Navigation Structure

### Department Switcher (Toolbar or Sidebar)

A persistent department switcher replaces the current flat view hierarchy. It appears as a toolbar segment or sidebar section header list:

```
┌─────────────────────────────────────────────┐
│  [🏢] Production Office  │  [🎥] Cinematography  │  [🎨] Production Design  │
│  [🎭] Casting  │  [🔊] Sound  │  [✂️] Post Production  │  [🤖] AI Director  │
└─────────────────────────────────────────────┘
```

- Each department button shows a **status dot** when agents have pending tasks or review items in that department.
- Keyboard shortcuts: `Cmd/Ctrl + Shift + [1-7]` to switch departments.
- Department selection persists per project in `localStorage`.

### Department Shell Template

Each department workspace follows a common shell with department-specific content:

```
┌──────────────────────────────────────────────────────────────┐
│  Department Toolbar (department-specific actions)            │
├──────────────┬───────────────────────────────┬───────────────┤
│              │                               │               │
│  Department  │   Main Workspace              │  Inspector  │
│  Sidebar     │   (panels specific to dept)   │  (context-   │
│  (reference  │                               │  aware)      │
│   library,   │                               │               │
│   queues)    │                               │               │
│              │                               │               │
└──────────────┴───────────────────────────────┴───────────────┘
```

---

## 4. Per-Department Specifications

### 4.1 Production Office

**Role:** Script, breakdown, scheduling, shot list, treatment. The planning phase.

**Layout:**

```
┌──────────────────────────────────────────────────────────────┐
│  [New Scene] [Parse Script] [Breakdown] [Export] [AI Coach]  │
├──────────────┬───────────────────────────────┬───────────────┤
│              │  Script Editor (left)         │  Scene        │
│  PROJECT     │  ─────────────────────────    │  Inspector    │
│  TREE        │  Storyboard (right)           │  (treatment,  │
│  (scenes,    │  ─────────────────────────    │  breakdown,  │
│   sections)  │  OR: Split view               │  shot list)   │
│              │                               │               │
│              │  [AI Assist: Suggest coverage │               │
│              │   pickups, storyboard pass]   │               │
│              │                               │               │
└──────────────┴───────────────────────────────┴───────────────┘
```

**Toolbar Actions:**
- `New Scene` — create scene node in project tree.
- `Parse Script` — Fountain → extract entities (characters, props, locations).
- `Breakdown` — generate breakdown sheet for selected scene.
- `Export` — Fountain, CSV breakdown, PDF schedule.
- `AI Coach` — opens AI Assist modal with script-coach context.

**Sidebar Content:**
- Project tree (scenes in shooting order vs. story order toggle).
- Stripboard / schedule view (when implemented).
- Shot list for selected scene.

**Inspector Content:**
- Treatment form (`cinegen-treatment-panel`).
- Breakdown table (`cinegen-breakdown-view`).
- Scene metadata (INT/EXT, time, location).

**Agent Integration:**
- **Script Agent:** parses Fountain, suggests edits, extracts entities.
- **Storyboard Agent:** drafts frames from script context.
- Human review gates at: shot list approval, breakdown approval.

---

### 4.2 Cinematography

**Role:** Shot design, camera movement, lighting, generation, coverage planning.

**Layout:**

```
┌──────────────────────────────────────────────────────────────┐
│  [Shot Library] [Camera Presets] [Build Prompt] [Generate]   │
│  [Ref Video] [Motion Brush] [Model: Runway ▼] [Queue: 3]  │
├──────────────┬───────────────────────────────┬───────────────┤
│              │  Shot Designer / Composer     │  Shot         │
│  SHOT        │  ─────────────────────────    │  Inspector    │
│  LIBRARY     │  - Camera angle selector      │  (prompt,     │
│  (saved      │  - Movement preset buttons    │   generation  │
│   setups)    │  - Lens / depth of field      │   status,     │
│              │  - Lighting mood picker       │   takes)      │
│  REFERENCE   │  - Spatial annotation canvas  │               │
│  IMAGES      │    (arrows, masks on still)   │               │
│  (character, │  - Prompt preview bar         │               │
│   set refs)  │                               │               │
│              │  Storyboard Grid (coverage)   │               │
│  MOTION      │  ─────────────────────────    │               │
│  REFERENCES  │  Master | Shot A | Shot B... │               │
│  (videos)    │                               │               │
│              │  [AI Assist: Regenerate,      │               │
│              │   Suggest alternate angles]   │               │
│              │                               │               │
└──────────────┴───────────────────────────────┴───────────────┘
```

**Toolbar Actions:**
- `Shot Library` — saved camera setups (dolly-in close-up, tracking medium, etc.).
- `Camera Presets` — dropdown of shot types (wide, medium, close-up, OTS, insert).
- `Build Prompt` — assembles prompt from UI selections (replaces current `buildCameraPrompt`).
- `Generate` — dispatch to Generation Agent with model routing.
- `Ref Video` — attach motion reference video (Kling-style motion transfer).
- `Motion Brush` — region-based motion annotation (Runway-style).
- `Model` — provider selector dropdown (Runway, Kling, Veo, Seedance) with shot-type-aware default.
- `Queue` — pending generation jobs indicator.

**Sidebar Content:**
- **Shot Library** — user-saved and preset shot configurations.
- **Reference Images** — character bibles + set references for the active scene.
- **Motion References** — video clips for motion transfer.

**Inspector Content:**
- Generated shot prompt text (editable).
- Generation status (queued / generating / complete / failed).
- Take browser (all generations for this shot, star best take).
- Consistency audit results (flagged issues: morphing, lighting mismatch).

**Agent Integration:**
- **Prompt Engineer Agent:** translates UI selections into provider-specific optimized prompts.
- **Generation Agent:** routes to optimal model, manages queue, handles retries/fallbacks.
- **Consistency Auditor Agent:** compares output against references, flags drift.
- **Spatial Annotation Agent:** translates drawn arrows/masks into model-specific parameters.

**Special UI Elements:**
- **Spatial Annotation Canvas:** Overlays arrows, masks, and motion paths on the storyboard still. Outputs: annotated image + motion description text.
- **Camera Path Designer:** Simple 2.5D blocking (top-down view) for spatial relationships. Exports annotated still + prompt text (not raw 3D data).

---

### 4.3 Production Design

**Role:** Locations, sets, props, wardrobe, art direction, visual atmosphere.

**Layout:**

```
┌──────────────────────────────────────────────────────────────┐
│  [Location Scout] [Set Builder] [Wardrobe] [Props] [Art Dir] │
├──────────────┬───────────────────────────────┬───────────────┤
│              │  Active Sub-Department        │  Detail       │
│  LOCATION    │  ─────────────────────────    │  Inspector    │
│  LIST        │                               │  (editing     │
│  (scouted,   │  [Location Scout Grid]        │   form for    │
│   approved)  │  OR [Set Design Canvas]         │   selected    │
│              │  OR [Wardrobe Grid]             │   item)       │
│  ASSET       │  OR [Prop Library]              │               │
│  CATEGORIES  │  OR [Art Direction Moodboard] │               │
│  (tabs)      │                               │               │
│              │                               │               │
│  [AI Assist: │                               │               │
│   Suggest     │                               │               │
│   wardrobe    │                               │               │
│   for scene]  │                               │               │
│              │                               │               │
└──────────────┴───────────────────────────────┴───────────────┘
```

**Toolbar Actions:**
- `Location Scout` — browse/search location library, generate AI location concepts.
- `Set Builder` — design set layout (simplified 2D floor plan → reference stills).
- `Wardrobe` — manage costume sets, link to characters, track continuity.
- `Props` — prop library, hand props vs. set dressing.
- `Art Dir` — color palette, texture references, moodboard.
- `AI Assist` — suggest wardrobe/props for selected scene based on script context.

**Sub-Departments (Tab-like or sidebar sub-navigation):**

| Sub-Dept | Purpose | Existing Code | New Needed |
|----------|---------|-------------|------------|
| **Location Scout** | Find/browse locations, AI generate concepts | `cinegen-location-scout` | Location detail view with references |
| **Sets** | Set design, floor plan, set dressing | — | Set builder canvas |
| **Wardrobe** | Costumes per character, outfit tracking, continuity | `cinegen-breakdown-view` (wardrobe col), `scriptInfoWardrobe` | Wardrobe grid + outfit composer |
| **Props** | Prop inventory, hand props vs. dressing | `cinegen-assets-panel` (props tab) | Prop detail with scene links |
| **Art Direction** | Color palette, texture, moodboard | — | Moodboard canvas |

**Sidebar Content:**
- Location list with search/filter.
- Asset category tabs (characters, locations, props, vehicles, effects) from `cinegen-assets-panel`.

**Inspector Content:**
- Detail form for selected item (location details, prop description, wardrobe notes).
- Scene assignments (which scenes use this item).
- Reference image gallery.
- Continuity tracker (e.g., "Character X wears outfit Y in scenes 3, 7, 12").

**Agent Integration:**
- **Location/Set Agent:** maintains environment references, suggests set dressing.
- **Character Agent:** (partial overlap with Casting) maintains costume continuity.
- Human review gates at: location approval, wardrobe approval per character.

---

### 4.4 Casting

**Role:** Character creation, reference images, voice casting, performance direction.

**Layout:**

```
┌──────────────────────────────────────────────────────────────┐
│  [New Character] [Import Refs] [Voice Cast] [AI Generate]    │
├──────────────┬───────────────────────────────┬───────────────┤
│              │  Character Roster / Detail    │  Character    │
│  CHARACTER   │  ─────────────────────────    │  Inspector    │
│  LIST        │                               │  (multi-angle  │
│  (roles,     │  Grid of character cards:     │   refs,       │
│   extras)    │  - Name, role, status         │   voice,      │
│              │  - Thumbnail face reference   │   notes)      │
│  VOICE       │                               │               │
│  LIBRARY     │  Selected character detail:   │               │
│  (TTS voices)│  - Face reference (front)     │               │
│              │  - Body reference (full)      │               │
│  AI          │  - ¾ view, profile, close-up  │               │
│  SUGGESTIONS │  - Costume references         │               │
│  (for scene) │  - Voice sample               │               │
│              │  - Performance notes          │               │
│              │                               │               │
│              │  [AI Assist: Generate multi-  │               │
│              │   angle references, suggest   │               │
│              │   voice casting]              │               │
│              │                               │               │
└──────────────┴───────────────────────────────┴───────────────┘
```

**Toolbar Actions:**
- `New Character` — create character entry.
- `Import Refs` — upload reference images for a character.
- `Voice Cast` — assign TTS voice (ElevenLabs voice ID) to character.
- `AI Generate` — generate multi-angle reference images from description.
- `AI Assist` — suggest character design, voice casting, performance direction for scene.

**Sidebar Content:**
- Character list with role tags (protagonist, antagonist, supporting, extra).
- Voice library (ElevenLabs voices with preview).
- AI suggestions for active scene (e.g., "Scene 3 needs a bartender — generate?").

**Inspector Content:**
- Multi-angle reference image gallery (front, profile, ¾, full body, close-up).
- Voice assignment + sample playback.
- Physical description, age, personality notes.
- Costume links (to Production Design wardrobe).
- Scene appearances list.

**Agent Integration:**
- **Character/Casting Agent:** generates and locks character sheets, manages multi-angle references.
- Human review gates at: character design approval, voice casting approval.

**Data Model:**
```typescript
interface CharacterBibleEntry {
  id: string;
  name: string;
  role: 'protagonist' | 'antagonist' | 'supporting' | 'extra';
  references: {
    face: string;      // image URL
    body: string;
    profile: string;
    threeQuarter: string;
    closeUp: string;
    costume: string[];
  };
  voice: {
    provider: 'elevenlabs';
    voiceId: string;
    previewUrl: string;
  } | null;
  physicalDescription: string;
  performanceNotes: string;
  sceneAppearances: string[];  // scene IDs
}
```

---

### 4.5 Sound Department

**Role:** Dialogue (TTS), ambient sound, SFX, music, mixing.

**Layout:**

```
┌──────────────────────────────────────────────────────────────┐
│  [Record] [Import] [TTS] [SFX] [Music] [Mix] [Export Stems]  │
├──────────────┬───────────────────────────────┬───────────────┤
│              │  Multi-Track Timeline         │  Track / Clip │
│  SOUND       │  ─────────────────────────    │  Inspector    │
│  CATEGORIES  │                               │  (properties, │
│  (sub-dept   │  ┌─ Production Sound ─────┐   │   generation  │
│   tabs)      │  │  [clip] [clip] [gap]   │   │   params)     │
│              │  ├─ ADR ─────────────────┤   │               │
│  SCENE       │  │  [line1] [line2]       │   │               │
│  DIALOGUE    │  ├─ Foley ───────────────┤   │               │
│  (script     │  │  [footsteps] [door]    │   │               │
│   lines)     │  ├─ SFX ─────────────────┤   │               │
│              │  │  [explosion] [ ambience│   │               │
│  MUSIC       │  ├─ Music / Score ───────┤   │               │
│  CUES        │  │  [theme A] [theme B]   │   │               │
│  (themes,    │  └─ Temp Mix ────────────┘   │               │
│   stems)     │                               │               │
│              │  [AI Assist: Spot music,      │               │
│              │   generate SFX for scene]     │               │
│              │                               │               │
└──────────────┴───────────────────────────────┴───────────────┘
```

**Sub-Departments (Tabs):**

| Sub-Dept | Purpose | Tools |
|----------|---------|-------|
| **Production Sound** | On-set dialogue, ambience | Import audio, noise reduction |
| **ADR** | Automated Dialogue Replacement | TTS generation (ElevenLabs), lip-sync preview |
| **Foley** | Performed sound effects | Library + AI generation descriptions |
| **SFX** | Sound design, effects | ElevenLabs Sound FX, library browser |
| **Music / Score** | Score, themes, stems | Suno / Udio / ElevenLabs Music integration |
| **Temp Mix** | Rough mix, level balancing | Multi-track timeline, basic faders |

**Toolbar Actions:**
- `Record` — microphone input (when supported).
- `Import` — import audio files.
- `TTS` — generate dialogue line from script using character's assigned voice.
- `SFX` — generate sound effect from text description.
- `Music` — generate music cue from emotion/style description.
- `Mix` — auto-balance levels across tracks.
- `Export Stems` — export individual tracks or mixed output.

**Sidebar Content:**
- Scene dialogue list (script lines needing audio).
- Music cue list with emotion/time mapping.
- SFX event list (timed to picture).

**Inspector Content:**
- Selected clip properties (source, generation parameters, duration).
- TTS: text, voice, speed, emotion settings.
- SFX: description, variation, intensity.
- Music: style, tempo, mood, length.

**Agent Integration:**
- **Audio Agent:** generates dialogue, SFX, music; assembles timeline; suggests music spots based on dramatic beats.
- Human review gates at: voice casting approval, music cue approval, mix approval.

---

### 4.6 Post Production

**Role:** Editing, color grading, VFX, finishing, export.

**Layout:**

```
┌──────────────────────────────────────────────────────────────┐
│  [Import] [AI Assemble] [Auto-Color] [Export] [EDL]          │
├──────────────┬───────────────────────────────┬───────────────┤
│              │  Timeline Editor              │  Clip /       │
│  MEDIA       │  ─────────────────────────    │  Effect       │
│  POOL        │                               │  Inspector    │
│  (approved   │  [ Scene 1 ] [ Scene 2 ] ...   │               │
│   clips,     │  │ clipA │ clipB │ clipC │   │               │
│   takes)     │  └───────┴───────┴───────┘   │               │
│              │                               │               │
│  SCENE       │  [AI Assist: Suggest B-roll,  │               │
│  SEQUENCES   │   fix jump cut, trim to      │               │
│  (rough,     │   target duration]            │               │
│   fine)      │                               │               │
│              │                               │               │
│  COLOR       │                               │               │
│  PRESETS     │                               │               │
│              │                               │               │
└──────────────┴───────────────────────────────┴───────────────┘
```

**Toolbar Actions:**
- `Import` — import external footage/audio.
- `AI Assemble` — auto-string-out from approved takes in scene order.
- `Auto-Color` — apply consistent grade across clips.
- `Export` — render final output (MP4, ProRes, etc.).
- `EDL` — export edit decision list for handoff.

**Sidebar Content:**
- Media pool (approved clips organized by scene).
- Scene sequences (rough cut, fine cut versions).
- Color presets (mood-based grades: noir, golden hour, desaturated, etc.).

**Inspector Content:**
- Clip properties (in/out points, speed, transition).
- Color grading controls (lift/gamma/gain or simple mood presets).
- VFX flags (clips needing cleanup).
- Audio track assignment.

**Agent Integration:**
- **Sequence Assembly Agent:** places clips, suggests transitions, detects continuity errors.
- **Finish/Color Agent:** applies consistent grading, detects lighting shifts.
- Human review gates at: rough cut approval, fine cut approval, color approval.

---

### 4.7 AI Director (Review & Orchestration Dashboard)

**Role:** Human director oversight of all agent operations. Review queue, generation status, cost tracking, model routing decisions.

**Layout:**

```
┌──────────────────────────────────────────────────────────────┐
│  [Queue] [Review] [Cost] [Models] [Settings] [Logs]        │
├──────────────┬───────────────────────────────┬───────────────┤
│              │  Active Review / Queue          │  Generation   │
│  REVIEW      │  ─────────────────────────    │  Detail       │
│  QUEUE       │                               │  Inspector    │
│  (pending    │  [Shot 3A — Awaiting Review]   │  (prompt,     │
│   approvals) │    ┌─────────────────┐        │   reference   │
│              │    │  [generated clip] │        │   images,     │
│  GENERATION  │    └─────────────────┘        │   audit       │
│  STATUS      │    Approve / Reject / Regen     │   results)    │
│  (per dept)  │                               │               │
│              │  [Shot 3B — Generating...]      │               │
│  COST        │    Progress: ████████░░ 80%     │               │
│  TRACKING    │    Model: Kling 3.0             │               │
│              │                               │               │
│  MODEL       │  [AI Director Notes:            │               │
│  ROUTING     │   "Consistency auditor flagged   │               │
│  RULES       │    lighting mismatch. Suggest    │               │
│              │    regenerating with locked      │               │
│              │    style seed."]                 │               │
│              │                               │               │
└──────────────┴───────────────────────────────┴───────────────┘
```

**Toolbar Actions:**
- `Queue` — view all pending generation jobs.
- `Review` — enter review mode for flagged items.
- `Cost` — per-project, per-scene, per-shot cost tracking.
- `Models` — configure default model routing rules per shot type.
- `Settings` — agent behavior settings (auto-retry thresholds, review gate strictness).
- `Logs` — agent decision trail for debugging.

**Sidebar Content:**
- Review queue grouped by department.
- Generation status board (running / queued / complete / failed).
- Cost dashboard (provider spend, per-shot cost).

**Inspector Content:**
- Full generation detail: prompt text, reference images, model used, parameters.
- Consistency audit report (what matched, what drifted).
- Cost of this generation.
- Agent decision trail (why this model was chosen, what fallback was used).

**Agent Integration:**
- **Orchestrator:** manages workflow state machine, review gates.
- **Consistency Auditor:** presents findings for human review.
- All agents report status here. This is the **mission control** layer.

---

## 5. Shared Components & Data Models

### 5.1 Department Shell Component

A new Lit component wraps each department:

```typescript
// components/layout/cinegen-department-shell.ts
@customElement('cinegen-department-shell')
class CinegenDepartmentShell extends CgLightElement {
  @property() departmentId: DepartmentId;
  @property() activeSubDepartment?: string;

  // Renders:
  // - Department toolbar (actions from department config)
  // - Sidebar (reference library from production context)
  // - Main workspace (swapped view panels)
  // - Inspector (context-aware detail panel)
}
```

### 5.2 Department Configuration

```typescript
// data/department-config.ts
interface DepartmentConfig {
  id: DepartmentId;
  label: string;
  icon: string;
  color: string;              // theme color for department
  toolbarActions: ToolbarAction[];
  sidebarPanels: SidebarPanelConfig[];
  inspectorPanels: InspectorPanelConfig[];
  subDepartments?: SubDepartmentConfig[];
  agentIds: string[];         // which agents operate here
}

const DEPARTMENTS: DepartmentConfig[] = [
  {
    id: 'production-office',
    label: 'Production Office',
    icon: 'fa-building',
    color: '#4a90d9',
    toolbarActions: ['newScene', 'parseScript', 'breakdown', 'export', 'aiCoach'],
    sidebarPanels: ['projectTree', 'stripboard', 'shotList'],
    inspectorPanels: ['treatment', 'breakdown', 'sceneMeta'],
    agentIds: ['script-agent', 'storyboard-agent'],
  },
  {
    id: 'cinematography',
    label: 'Cinematography',
    icon: 'fa-camera',
    color: '#e74c3c',
    toolbarActions: ['shotLibrary', 'cameraPresets', 'buildPrompt', 'generate', 'refVideo', 'motionBrush', 'modelSelector'],
    sidebarPanels: ['shotLibrary', 'referenceImages', 'motionReferences'],
    inspectorPanels: ['shotPrompt', 'generationStatus', 'takeBrowser', 'consistencyAudit'],
    agentIds: ['prompt-engineer', 'generation-agent', 'consistency-auditor', 'spatial-annotation'],
  },
  // ... etc for each department
];
```

### 5.3 Production Context (Shared State)

All departments read from the same production context (as defined in agent research):

```typescript
interface ProductionContext {
  projectId: string;
  styleGuide: StyleGuide;
  characterBible: CharacterBibleEntry[];
  locationBible: LocationBibleEntry[];
  wardrobeBible: WardrobeEntry[];
  propLibrary: PropEntry[];
  shotList: Shot[];
  approvedClips: Clip[];
  generationQueue: GenerationJob[];
  reviewQueue: ReviewItem[];
  audioTracks: AudioTrack[];
  timeline: TimelineSequence;
  generationLog: GenerationEvent[];
}
```

The context is reactive: changes in Production Design (new prop) immediately appear in Cinematography's reference sidebar.

---

## 6. Migration Path from Current Layout

### Current State
Views are organized by functional area: Pre-Production, Scenes, Production Design, Sound, Assembly. Switching happens via project tree selection or toolbar actions. Panels are monolithic (`cinegen-workspace` hosts all views).

### Migration Steps

| Step | Action | Files Affected |
|------|--------|---------------|
| 1 | **Create `DepartmentId` type and `DEPARTMENTS` config** | `data/department-config.ts` (new) |
| 2 | **Build `cinegen-department-shell`** | `components/layout/cinegen-department-shell.ts` (new) |
| 3 | **Wire department switcher in toolbar** | `components/layout/cinegen-toolbar.ts` |
| 4 | **Migrate existing panels into department views** | `components/panels/` — reassign `view-*` IDs to department namespaces |
| 5 | **Add sub-department tabs to Production Design, Sound** | New components: `cinegen-wardrobe-panel`, `cinegen-sfx-panel`, etc. |
| 6 | **Build Cinematography shot designer** | New: spatial annotation canvas, camera path designer, prompt builder |
| 7 | **Build AI Director dashboard** | New: `cinegen-ai-director-panel` with queue, review, cost views |
| 8 | **Connect Production Context to all departments** | `stores/` — reactive shared state |
| 9 | **Deprecate old flat view routing** | `workspace/view-routing.ts` — replace with department-aware routing |

### Backward Compatibility
- Existing `switchView()` calls map to department + view:
  ```typescript
  // Old: switchView('camera-lighting', 'Camera & Lighting')
  // New: switchDepartment('cinematography', { subView: 'shot-designer' })
  ```
- `WORKSPACE_SECTION_CLASSES` theme system can be extended to department themes.

---

## 7. Open Questions

1. **Should departments be lockable?** (e.g., "only Cinematography tools visible during shoot days")
2. **Should agents have avatars/personas?** (e.g., "Cinematography Agent" appears as a DP icon in the sidebar)
3. **How granular is sub-department navigation?** Tabs within workspace, or separate sidebar entries?
4. **Should the Sound Department timeline be the same component as Post Production timeline?** (shared `cinegen-timeline` with different track templates)
5. **Mobile / collapsed sidebar behavior?** Departments may have many sub-departments; how to collapse gracefully?

---

## 8. Files to Create / Modify

### New Files
- `source/src/data/department-config.ts` — department definitions, toolbar actions, agent mappings
- `source/src/components/layout/cinegen-department-shell.ts` — department wrapper component
- `source/src/components/layout/cinegen-department-switcher.ts` — toolbar segment control
- `source/src/components/panels/cinegen-wardrobe-panel.ts` — wardrobe grid + outfit composer
- `source/src/components/panels/cinegen-sfx-panel.ts` — sound effects library + generator
- `source/src/components/panels/cinegen-music-panel.ts` — music cue management
- `source/src/components/panels/cinegen-ai-director-panel.ts` — review queue, generation status, cost
- `source/src/components/panels/cinegen-shot-designer.ts` — shot composer + spatial annotation
- `source/src/stores/production-context.ts` — reactive shared production state

### Modified Files
- `source/src/components/layout/cinegen-toolbar.ts` — add department switcher
- `source/src/components/layout/cinegen-app.ts` — host department shell
- `source/src/components/panels/cinegen-workspace.ts` — delegate to department shell
- `source/src/workspace/view-routing.ts` — department-aware routing
- `source/src/toolbar/toolbar-data.ts` — department toolbar action definitions
- `source/src/data/project-data.ts` — extend with department-scoped data

---

## 9. Relationship to Other Research Docs

- **`ai-video-production-research.md`** — defines model capabilities/limits that shape what each department's agent can realistically do.
- **`ai-agents-for-filmmaking-research.md`** — defines agent roles that map 1:1 to departments in this spec.
- This doc bridges the two: **agents need a UI home, and departments are that home.**

---

*Document version: 2026-05-22*
