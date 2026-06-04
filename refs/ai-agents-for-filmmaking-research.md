# AI Agents for Filmmaking — Research & Architecture Recommendations (2025–2026)

> Research scope: how autonomous / agentic AI systems can operate within a video-making app like CineGen, in light of model limitations (5–10 s reliable clip length, no true 3D scene input, prompt-driven control, consistency challenges). What agent roles make sense, how they should orchestrate, and where human-in-the-loop is mandatory.


---

## 1. The Core Tension: What Agents Promise vs. What Models Deliver

### Promise
End-to-end autonomous filmmaking: input a concept → receive a finished film.

### Reality (as of mid-2026)
- Video models reliably produce **5–10 second clips**. Longer generations suffer from morphing, physics breakage, and character drift.
- **No structured 3D scene input.** Agents cannot hand a model a JSON scene graph with camera rigs and object transforms.
- **Prompts are the primary control surface.** Every shot must be translated into rich natural language (or annotated stills + text).
- **Consistency is hard won.** Character identity, costume, lighting, and set design decay across clips unless aggressively managed via reference images, shared seeds, and locked style descriptors.
- **Audio is fragmented.** TTS, SFX, and music are separate models; only Veo 3 generates ambient sound natively.
- **Post-production is not solved.** Stitching, transitions, color correction, and precise audio sync still require traditional tooling.

### Agent Design Principle
> Agents should **orchestrate, translate, and iterate** — not blindly generate. They must understand model constraints and design workflows that stay within them, surfacing decision points to the human director rather than hiding them.

---

## 2. Proven Multi-Agent Film Architectures

### 2.1 ViMax (HKUDS / University of Hong Kong)

**Concept:** 12 specialized agents collaborating like a real film crew.

**Agent Roles:**
- **Screenwriter** — story/script generation
- **Storyboard Artist** — shot planning, visual breakdown
- **Character Extractor** — identity extraction, face/body references
- **Reference Image Selector** — curates style-locked stills
- **Director / Producer** — orchestration, quality gates
- **Video Generator** — dispatches to diffusion models
- **(plus additional support agents for prompt engineering, consistency auditing, etc.)**

**Key Insight:** The framework treats video generation not as a single call but as a **production pipeline** with handoffs between creative roles. It generates multi-shot videos by explicitly managing character references and shot-to-shot transitions.

**Relevance to CineGen:** The role breakdown maps directly to app modules. The app itself can host these agents as discrete services.

### 2.2 FilmAgent (SIGGRAPH Asia 2024)

**Concept:** LLM-based agents operating in a **3D virtual sandbox** (Unity/Unreal-like environment).

**Agent Roles:**
- **Director** — high-level vision, shot approval, creative direction
- **Screenwriter** — dialogue, scene structure, beat sheets
- **Actor** — performance blocking, emotion beats, movement
- **Cinematographer** — camera placement, movement, lens choice, framing

**Workflow Stages:**
1. **Idea Development** — brainstorm → structured story outline
2. **Scriptwriting** — dialogue + character actions
3. **Pre-visualization** — blocking in 3D sandbox (this is the key differentiator)
4. **Shot Execution** — camera/lens parameters exported to render or generative model

**Key Insight:** FilmAgent uses a **3D sandbox as an intermediate representation**. Agents reason about space, camera position, and blocking in a structured environment *before* any generative model is invoked. The 3D scene is then rendered or used to generate reference images/video.

**Relevance to CineGen:** This validates the idea of a **scene layout / blocking designer** inside the app. Even though video models don't accept 3D data directly, agents can plan in 3D, export annotated stills + camera motion prompts, and use those as generative inputs.

### 2.3 HoloCine (Research, 2025)

**Concept:** Holistic generation of cinematic multi-shot long video narratives from a single text prompt.

**Innovation:** Generates minute-long sequences with **character consistency, environment continuity, and narrative coherence** in a single holistic pass — not clip-by-clip stitching.

**Technique:**
- Global story planning before local frame generation.
- Cross-shot spatial logic (ShotVerse-Bench dataset calibrated into unified coordinate system).
- Character identity preserved via feature injection and subject-driven self-attention across shots.

**Key Insight:** The frontier is moving toward **holistic / global planning** rather than 
greedy clip-by-clip generation. Agents should plan the entire sequence first, then generate with shared context.

**Relevance to CineGen:** The app's agent layer should maintain a **global sequence context** 
(character bank, style guide, shot list) that every generation call references — not treat 
each shot as an isolated prompt.

---

## 3. Agent Roles That Map to a Filmmaking App

Based on the architectures above and practical production needs, the following agent roles 
should exist inside CineGen:

### Pre-Production Agents

| Agent | Responsibility | Human Checkpoint |
|-------|---------------|------------------|
| **Script Agent** | Parses screenplay (Fountain), extracts scenes, shots, dialogue, action lines. Generates shot list with purpose statements. | Approve shot list; edit extractions. |
| **Storyboard Agent** | Generates key-frame stills for every shot. Ensures framing, composition, and visual style match director's intent. Uses locked style seeds. | Approve/reject/regenerate stills. |
| **Casting / Character Agent** | Maintains character sheets: face references, body references, costume, age, emotional range. Generates multi-angle references. | Approve character bible; lock references. |
| **Location / Set Agent** | Maintains environment references. Ensures set dressing, lighting, and atmosphere are consistent across scenes. | Approve location bibles. |
| **Pre-vis Agent** | (Future / advanced) Blocks scenes in simplified 3D. Exports camera trajectories and spatial relationships as prompt text + annotated stills. | Adjust blocking; approve camera paths. |

### Production Agents

| Agent | Responsibility | Human Checkpoint |
|-------|---------------|------------------|
| **Prompt Engineer Agent** | Translates shot metadata (subject, action, framing, camera, lens, style, lighting, motion) into model-specific optimized prompts. Adapts for Runway vs Kling vs Veo syntax. | Review/adjust prompts before generation. |
| **Generation Agent** | Dispatches generation jobs to provider APIs. Manages queues, retries, rate limits, and fallback models. Tracks cost per shot. | Monitor progress; cancel/regenerate. |
| **Consistency Auditor Agent** | Compares generated clip against character/set references. Flags morphing, drift, lighting mismatch, costume errors. | Review flagged shots; approve/reject. |
| **Motion Transfer Agent** | Manages reference-video workflows (Kling-style). Uploads motion reference, applies to new subjects. | Approve motion match. |
| **Spatial Annotation Agent** | Interprets user-drawn arrows/masks on storyboard stills. Translates to model-specific spatial prompting or motion-brush parameters. | Preview annotation effect. |

### Post-Production Agents

| Agent | Responsibility | Human Checkpoint |
|-------|---------------|------------------|
| **Sequence Assembly Agent** | Stitches approved clips into timeline. Handles transitions, pacing, and basic continuity. | Edit timeline; refine pacing. |
| **Audio Agent** | Generates dialogue (TTS), SFX descriptions, and music cues. Syncs audio to picture. Mixes levels. | Approve voice casting; adjust mix. |
| **Color / Finish Agent** | Applies consistent color grading across clips. Detects exposure/lighting shifts between shots. | Approve grade; manual corrections. |
| **VFX / Compositing Agent** | Identifies shots needing cleanup (removing artifacts, stabilizing, upscaling). Dispatches to inpainting/upscaling tools. | Review VFX shots. |

---

## 4. Orchestration Patterns

### 4.1 The Review Gate Pattern

Every agent output passes through a **human review gate** before downstream agents consume it. This prevents error propagation.

```
Script Agent → [HUMAN: Approve Shot List] →
Storyboard Agent → [HUMAN: Approve Stills] →
Prompt Engineer Agent → [HUMAN: Approve Prompts] →
Generation Agent → Consistency Auditor Agent → [HUMAN: Approve/Reject Clip] →
Sequence Assembly Agent → [HUMAN: Edit Timeline] →
Audio Agent → [HUMAN: Mix Approval] →
Finish Agent
```

**Why this matters:** Autonomous pipelines that skip review gates produce "soulless polish" (as noted in real-world autonomous filmmaking experiments). The human director's taste is the final quality arbiter.

### 4.2 The Global Context Lock Pattern

All agents read from and write to a **shared production context**:

```typescript
interface ProductionContext {
  projectId: string;
  styleGuide: StyleGuide;           // locked lighting, lens, color palette
  characterBible: Character[];      // reference images, descriptions
  locationBible: Location[];        // set references, atmosphere
  shotList: Shot[];                 // global shot list with dependencies
  approvedClips: Clip[];            // clips that passed review
  generationLog: GenerationEvent[];  // for cost tracking, debugging
}
```

- The **Storyboard Agent** locks style seeds into the context.
- The **Prompt Engineer Agent** reads character/location bibles to inject references.
- The **Consistency Auditor Agent** compares generated frames against the character bible.
- The **Sequence Assembly Agent** respects shot dependencies (e.g., shot 3 must use the last frame of shot 2 as its start image).

### 4.3 The Fallback & Model Routing Pattern

The **Generation Agent** should not be hardcoded to one model. It should:

1. Accept a **shot type tag** (e.g., `control-heavy`, `motion-transfer`, `reliable-default`, `audio-native`).
2. Route to the optimal provider:
   - `control-heavy` → Runway (Motion Brush, Advanced Camera Controls)
   - `motion-transfer` → Kling (reference video movement)
   - `reliable-default` → Veo 3.1 (prompt adherence, safety)
   - `audio-native` → Veo 3 (ambient sound generation)
   - `image-to-video` → Seedance 2.0 or Kling (cinematic from stills)
3. If a generation fails (content policy, model error, quality below threshold), automatically retry with fallback model and log the event.

### 4.4 The Iterative Refinement Loop

Agents should support **debug loops** — not just one-shot generation:

```
Generate → Audit → Flag Issue → Diagnose (which element failed?) →
Adjust Prompt / Reference / Parameters → Regenerate → Re-audit
```

Example: Consistency Auditor flags "character's jacket changed from leather to denim." The agent diagnoses that the prompt lacked costume specificity, enriches the prompt with "black leather jacket," and regenerates using the locked character reference image.

---

## 5. Handling Specific Model Limitations via Agent Design

### 5.1 The 5–10 Second Clip Constraint

**Agent Strategy:**
- Plan shots in **5–10 second units** by default.
- For longer continuous shots, use an **overlap strategy**: generate segment A (frames 0–120), segment B using frame 115 of A as the seed image (frames 115–235), then crossfade.
- The **Sequence Assembly Agent** manages overlap frames and transitions; the human editor approves the stitch.

**Never** ask a model for a 60-second clip and hope for the best.

### 5.2 No True 3D Scene Input

**Agent Strategy:**
- The **Pre-vis Agent** (or a simplified blocking tool) lets the user arrange characters and camera in 2.5D / 3D space.
- The agent **exports** this as:
  1. An annotated still (with arrows for motion, masks for regions).
  2. A rich text prompt describing spatial relationships and camera movement.
  3. Optional: a depth map or normal map as an auxiliary image (where supported by research/tooling).
- The video model receives the annotated still + prompt, not the raw scene graph.

### 5.3 Prompt-Driven Control

**Agent Strategy:**
- The **Prompt Engineer Agent** maintains a **prompt template library** per provider.
- It translates structured shot metadata (dropdown selections in the UI) into provider-specific optimal phrasing.
- Example mappings:
  - UI: `Camera = "Dolly In"` → Runway: `"Slow dolly-in, shallow depth of field"` → Kling: `"Camera pushes forward gently, background blurs"`
- Agents should **version prompts** and correlate them with output quality for continuous improvement.

### 5.4 Character & Set Consistency

**Agent Strategy:**
- **Character Agent** generates and locks a `character_id` with 4–8 reference images (front, profile, ¾, close-up face, full body, costume detail).
- Every generation call for that character includes the reference image set as an input (where the model API supports it) or as a strongly weighted prompt description.
- **Consistency Auditor Agent** runs a visual comparison (embedding similarity or manual review) between generated frames and reference images.
- Drift beyond threshold → flag for regeneration with stronger reference weighting.

### 5.5 Audio Fragmentation

**Agent Strategy:**
- The **Audio Agent** operates as a **post-production mixer**, not a real-time generator.
- It requests:
  - Dialogue clips from ElevenLabs (per line, per character voice).
  - SFX events from ElevenLabs Sound FX or a library (timed to picture).
  - Music stems from Suno / Udio / ElevenLabs Music (aligned to scene emotion beats).
- The agent assembles these on a multi-track timeline. Lip-sync is manual or tool-assisted (not generative) as of 2026.

---

## 6. Agentic Video Editing & Post-Production

### The a16z Thesis (2026)
> "2025 was the year of video. 2026 is the year we let agents edit it."

Vision models can now **understand** video content at scale. Agents can:
- **Ingest** raw footage (generated clips, stock, live action).
- **Analyze** content: identify shots, detect faces, track characters, read emotion, detect scene boundaries.
- **Decide** editorial structure: pacing, cut points, J-cuts, L-cuts, match cuts.
- **Execute** in an editing timeline API (Avid, DaVinci Resolve, or internal timeline engine).

### Practical Agentic Editing Features for CineGen

1. **Auto-assembly from shot list:** Given an approved shot list and generated clips, the agent places clips on a timeline in order, applies default transitions, and sets clip durations to match the script's action beats.
2. **Continuity repair:** Agent detects jump cuts, eyeline mismatches, or lighting shifts. Suggests alternate takes, insert shots, or color correction.
3. **Music spotting:** Agent analyzes emotion curve of the sequence. Suggests music cue in/out points based on dramatic beats.
4. **B-roll insertion:** Agent identifies exposition-heavy dialogue and suggests cutaways from the asset library.
5. **Length targeting:** Agent can compress or expand a sequence to hit a target duration by adjusting clip pacing, suggesting trims, or generating additional coverage.

---

## 7. Human-in-the-Loop: Where Directors Must Stay in Control

Based on real-world autonomous filmmaking experience (e.g., *Daisy*, 2025 horror film; ViMax experiments; a16z analysis), the following decisions should **never** be fully automated:

| Decision | Why Human |
|----------|-----------|
| **Final shot selection** | Taste, timing, and subtext are the role of the person. |
| **Performance/emotion beats** | AI generates motion; it doesn't feel dramatic irony. |
| **Sound design intent** | What you hear vs. what you see creates meaning. |
| **Color grading mood** | Aesthetic judgment, not a solvable optimization. |
| **Pacing of the edit** | Rhythm is emotional, not algorithmic. |
| **Casting / character design** | Identity representation, diversity, creative vision. |
| **Legal/ethical content review** | Copyright, likeness rights, harmful content. |

**Agent Design Rule:** Every agent should expose its reasoning (the "why" 
behind a suggestion) and offer alternatives, not just a single output.

---

## 8. Recommended Architecture for CineGen

### Agent Layer Stack

```
┌─────────────────────────────────────────────┐
│  UI / Director Dashboard                       │
│  (Review gates, approvals, overrides)        │
├─────────────────────────────────────────────┤
│  Orchestrator (State Machine)                │
│  (Manages workflow stages, gates, context)   │
├─────────────────────────────────────────────┤
│  Agent Swarm                                   │
│  ├─ Script Agent                               │
│  ├─ Storyboard Agent                           │
│  ├─ Character / Casting Agent                  │
│  ├─ Location / Set Agent
|  ├─ Production Design Agent                  │
│  ├─ Cinematographer - Lighting, Camera, Production of Video. 
│  ├─ Prompt Engineer Agent                      │
│  ├─ Generation Agent (Model Router)            │
│  ├─ Consistency Auditor Agent                  │
│  ├─ Sequence Assembly Agent                    │
│  ├─ Sound Agent - Production of Audio                              │
│  └─ Finish / Color Agent                       │
├─────────────────────────────────────────────┤
│  Shared Production Context (Store)             │
│  (Style guide, bibles, shot list, clips)     │
├─────────────────────────────────────────────┤
│  Provider APIs                               │
│  (Runway, Kling, Veo, Seedance, ElevenLabs,   │
│   Suno, Udio, Midjourney, etc.)              │
└─────────────────────────────────────────────┘
```

### Implementation Notes

- **Orchestrator** should be a deterministic state machine, not an LLM. Use LLMs for creative generation, not for workflow control.
- **Agents communicate via events** (e.g., `shot.approved`, `clip.generated`, `audit.failed`) rather than direct coupling.
- **Production Context** should be persisted (project file / database) so that agent work survives reloads.
- **Generation Agent** must handle provider-specific rate limits, cost tracking, and content-policy retry logic.
- **Consistency Auditor** can start as a simple embedding-similarity check + human review queue. Over time, add fine-tuned vision classifiers.

---

## 9. Technology Recommendations for a Self-Contained Repository

A core design goal for CineGen is that the repository must remain **self-contained** — it should not hard-depend on any specific third-party cloud service to function. The agent layer must be able to run entirely offline or against locally-hosted models. Below are the researched options for achieving this.

### 9.1 Primary Recommendation: Mastra

**Mastra** (https://mastra.ai / https://github.com/mastra-ai/mastra) is an open-source TypeScript framework for building AI agents and workflows, maintained by the team behind Gatsby. It is released under the **Apache License 2.0**.

**Why Mastra fits CineGen:**

- **TypeScript-native** — No Python bridge or cross-language boundary required. It integrates directly into the existing Vite + Node backend stack.
- **Local model support via Ollama** — Mastra's model router supports 3,300+ models across 94 providers, but it also connects directly to a locally running Ollama instance. This means the entire agent layer can operate offline with models like Mistral, Llama, Qwen, or Gemma running on the user's own hardware.
- **Self-hostable storage** — Mastra supports multiple storage backends including **LibSQL/Turso** (default), **PostgreSQL**, **MongoDB**, and file-based SQLite. For a self-contained deployment, SQLite or LibSQL keeps everything local without requiring an external database server.
- **Built-in primitives** — Agents, deterministic workflows, tools with Zod schemas, structured output, memory (conversation history + semantic recall), and MCP server integration are all included. This covers every pattern described in Sections 3–6.
- **No vendor lock-in** — The core framework is fully open source. Enterprise features (RBAC, Mastra Cloud) are segregated into `ee/` directories and are not required for production use.

**Self-contained architecture with Mastra:**

```
CineGen Repository

source/
├── backends/          (Node proxy server + Mastra agent layer)
│   └── agents/
│       ├── script-agent.ts
│       ├── storyboard-agent.ts
│       ├── generation-agent.ts
│       └── orchestrator.ts
├── .cine projects/    (local project files — Production Context store)
└── FUTURE: ollama/            (local LLM runtime, user-managed)
```

- The agent layer runs as part of the existing `backends/` Node server.
- It connects to `http://localhost:11434` (Ollama) by default, but can be pointed to any local or remote endpoint via environment variables.
- Production Context (style guide, character bibles, shot lists) is persisted to the local project file or a SQLite database — no external database service required.

**Running entirely offline:**

```typescript
// Example: agent configured for local Ollama with no cloud dependency
import { Agent } from '@mastra/core/agent';

const scriptAgent = new Agent({
  id: 'script-agent',
  name: 'Script Agent',
  instructions: 'Parse Fountain screenplays and extract structured shot lists.',
  model: {
    provider: 'ollama',
    name: 'mistral',   // or any locally pulled model
    baseUrl: 'http://localhost:11434',
  },
  tools: { parseFountain, extractScenes, generateShotList },
});
```

### 9.2 Alternative: Vercel AI SDK + Custom Orchestrator

If Mastra's full feature set is more than needed, a lighter-weight option is to use the **Vercel AI SDK** (which Mastra itself delegates to under the hood) directly. This provides the model abstraction layer (`generateText`, `streamText`, `generateObject`) and tool-calling mechanics without the additional Mastra abstractions.

**When to choose this:**

- You want a thinner dependency footprint.
- You plan to build your own orchestrator (state machine) and only need the LLM interaction layer.
- You want maximum control over agent loops and memory implementation.

Trade-off: You give up Mastra's built-in workflow engine, observability hooks, and Studio debugging UI. For CineGen's complexity (10+ agent roles, review gates, global context), Mastra's higher-level primitives likely save more implementation effort than they cost in bundle size.

### 9.3 Alternative: LocalAI + LocalAGI (Maximum Independence)

For the most strictly self-contained setup — where even the AI SDK layer is avoided — **LocalAI** (self-hosted inference runtime with an OpenAI-compatible API) paired with **LocalAGI** adds autonomous agent capabilities. Together they form a complete local stack with zero external dependencies.

**When to choose this:**

- The app must function in fully air-gapped environments.
- You want to avoid any framework dependency and keep the agent logic entirely in-house.
- You are willing to trade ecosystem maturity (fewer tools, less documentation) for maximum independence.

Trade-off: LocalAGI has a smaller ecosystem and less tooling than Mastra. It is better suited for simple agentic tasks than the complex multi-role filmmaking pipeline described in this document.

### 9.4 Decision Matrix

| Criterion | Mastra | Vercel AI SDK (custom) | LocalAI + LocalAGI |
|-----------|--------|------------------------|--------------------|
| TypeScript-native | Yes | Yes | No (Go backend) |
| License | Apache 2.0 | MIT | MIT |
| Local/offline capable | Yes (via Ollama) | Yes (via Ollama) | Yes (native) |
| Built-in workflows | Yes | No | Basic |
| Built-in memory/RAG | Yes | No | Limited |
| Multi-agent orchestration | Yes (supervisor pattern) | Build your own | Limited |
| MCP support | Yes | No | No |
| Studio / debugging UI | Yes | No | No |
| Community / ecosystem | Large (22k+ stars) | Large | Small |
| Bundle / complexity | Medium | Low | Low |

### 9.5 Recommended Path for CineGen

1. **Adopt Mastra** as the agent framework. It provides the right balance of TypeScript integration, built-in patterns, and local model support.
2. **Default to Ollama** for LLM inference. Document how users can pull models (e.g., `ollama pull mistral`, `ollama pull llama3.2`) so the app works out of the box without API keys.
3. **Keep provider APIs optional**. The Generation Agent (model router) should support local models as first-class citizens, with cloud providers (Runway, Kling, Veo, etc.) as opt-in configurations via environment variables.
4. **Persist Production Context locally**. Use SQLite/LibSQL for agent memory and workflow state, anchored to the project file. This ensures agent work survives reloads without requiring an external database service.
5. **Bundle Mastra in `backends/`**. The agent layer ships as part of the existing Node backend. It runs alongside the proxy server, not as a separate microservice, keeping the deployment model simple.

---

## 10. Key Sources & References

- **Mastra** — https://mastra.ai / https://github.com/mastra-ai/mastra — TypeScript AI agent framework.
- **ViMax** (HKUDS) — https://github.com/HKUDS/ViMax — Agentic video generation with 12 specialized agents.
- **FilmAgent** (SIGGRAPH Asia 2024) — https://arxiv.org/abs/2501.12909 — Multi-agent film automation in 3D virtual spaces.
- **HoloCine** — https://arxiv.org/html/2510.20822v1 — Holistic multi-shot long video with character consistency.
- **ShotVerse** — https://arxiv.org/html/2603.11421v1 — Cinematic camera control for multi-shot video creation.
- **a16z: It's Time for Agentic Video Editing** — https://a16z.com/its-time-for-agentic-video-editing/
- **Agentic Video Editing (Cutback)** — https://cutback.video/blog/what-is-agentic-video-editing
- **Luma Agents** — https://bonega.ai/en/blog/luma-agents-agentic-video-editing-ai-directing-2026
- **Avid + Google Cloud Agentic AI** — https://www.googlecloudpresscorner.com/2026-04-16-Avid-and-Google-Cloud-Announce-Partnership-to-Bring-Agentic-AI-to-Media-Production
- **Filmustage AI Agents in Pre-Production** — https://filmustage.com/blog/how-ai-agents-are-rewiring-film-pre-production/
- **Autonomous AI Filmmaking Pipeline** — https://medium.com/@jengas/dissecting-an-autonomous-ai-filmmaking-pipeline-0192b7a69636
- **Multi-Shot Character Consistency** — https://arxiv.org/html/2412.07750v1
- **AI Multi-Shot Video Character Consistency** — https://www.aimagicx.com/blog/ai-multi-shot-video-character-consistency-2026
- **LocalAI + LocalAGI** — https://localai.io / https://github.com/mudler/LocalAI — Fully self-hosted LLM and agent stack.
- **Vercel AI SDK** — https://sdk.vercel.ai/docs — Lightweight AI SDK for TypeScript.

---

*Document compiled: 2026-05-22*
