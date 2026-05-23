# AI Video Production Research — Model Capabilities & Best Practices (2025–2026)

> Research scope: image, sound (TTS / SFX / music), and video generation models for cinematic / narrative video projects. What they enable today, how control is expressed, spatial awareness, prompting strategies, and what a video-making app should surface.

---

## 1. Video Model Landscape (Text-to-Video & Image-to-Video)

### Leading Models (as of mid-2025 / early 2026)

| Model | Maker | Key Strength | Max Length | Notable Controls |
|-------|-------|-------------|------------|------------------|
| **Veo 3.1** | Google | Safest overall; strong prompt adherence; native audio generation | ~8–10 s (typical) | Spatial prompting (visual annotations), camera presets |
| **Kling 3.0** | Kuaishou | "AI Director" era; best value; strong motion transfer | Up to 2 min (Kling 1.6) | Motion brush, reference video for movement transfer, 3D VAE backbone |
| **Runway Gen-4 / Gen-4.5** | Runway | Best control layer; Motion Brush; Advanced Camera Controls; Director Mode | 5–10 s typical | Multi Motion Brush, 3D camera controls (dolly, pan, tilt, orbit), region-based motion |
| **Seedance 2.0** | ByteDance | Hottest image-to-video; structured/cinematic from stills | Short clips | Strong image adherence, cinematic motion |
| **Sora 2** | OpenAI | Spatial awareness, eye contact, hand gestures, filmic depth of field | Variable | Story-led workflows, strong character consistency |
| **Luma Dream Machine / Ray** | Luma | Fast iteration; depth-aware video-to-video; angle changes | 5 s clips | Depth-aware reconstruction, camera motion from video input |
| **Pika** | Pika Labs | Expressive stylization; lip-sync | Short | Region-based control, style transfer |

### Core Architecture Trend
Diffusion Transformer (DiT) + 3D Variational Autoencoder (3D VAE) is the dominant stack (Kling 3.0, Sora, Veo). The 3D VAE encodes spatiotemporal information jointly, which enables better motion coherence and spatial reasoning than older 2D-diffusion-based video models.

---

## 2. What Video Models Enable Today

### Inputs
- **Text prompt** — primary control. Models parse cinematographic vocabulary.
- **Image(s)** — starting frame (image-to-video) or style reference. Strongly preferred over text-only for consistency.
- **Reference video** — motion transfer (Kling’s signature feature), style transfer.
- **Visual annotations / masks / brushes** — region-specific control (Runway Motion Brush, Veo spatial prompting, Scenario diagrams).
- **Camera control parameters** — explicit UI presets (Runway, Kling) or prompt-described trajectories.

### Outputs
- 5–10 second clips are the reliable production unit. Some models stretch to 30–120 s, but quality/motion coherence decays.
- Resolutions: 480p–1080p common; 4K possible with AI upscaling (Topaz, etc.).
- **Veo 3** generates native audio (ambient sound, not full mix), which is still rare.

### Key Capabilities Unlocked
1. **Image-to-video is the dominant professional workflow.** Generating a high-quality still first (Midjourney, Seedream, ImagineArt, FLUX) then animating it dramatically reduces hallucinations and gives director-level control.
2. **Motion transfer.** Upload a 3–30 second reference video; the model transfers movement onto a new character/subject (Kling).
3. **Character consistency across shots.** Still imperfect, but improving via reference-image seeding and model-specific consistency tools.
4. **Camera motion simulation.** Models can emulate dolly, crane, tracking, orbit, aerial, handheld — but this is *simulated* from learned depth, not true 3D rendering.

---

## 3. Spatial Awareness & 3D Scene Parameters

### Can You Feed 3D Scene Parameters?

**Short answer: Not directly as a structured 3D scene file.** No consumer video model accepts a `.obj`, `.fbx`, glTF, or a JSON scene graph with camera position, object transforms, and lighting rigs. However, several *approximate* pathways exist:

1. **Prompt-described 3D spatial relationships.**
   - Models understand relational language: *"A is to the left of B," "camera pushes past foreground rocks to reveal the valley beyond," "subject exits frame right."*
   - Sora 2 is noted for "spatial awareness between subjects" and natural depth-of-field.
   - The 3D VAE architecture learns *implicit* 3D from 2D video data; it does not expose an explicit 3D representation.

2. **Depth-aware video-to-video (Luma / video input).**
   - Luma AI reconstructs depth from input video and can generate new angles while preserving spatial layout. This is closest to true 3D reasoning.
   - Research direction (Map2Video, DreamCinema): combining free camera movement with 3D characters and environment-aware refinement.

3. **Camera trajectory extraction from video.**
   - Academic work shows 3D reconstruction on source videos → extracted camera paths → used as training signals or conditioning. Not yet a standard production feature.

4. **Motion diagrams / storyboard arrows → video (Veo spatial prompting, Scenario).**
   - You can paint arrows or regions on a still image to indicate where things should move. The model interprets these as motion priors.

### Bottom Line for an App
- You **cannot** give a video model a JSON object with `(camera: {x,y,z,fov}, objects: [...])` and expect reliable results today.
- You **can** translate 3D scene parameters into:
  - **Rich text prompts** (see §4).
  - **Annotated reference images** (arrows, masks, depth hints).
  - **Reference videos** for camera motion style.
  - **Depth maps / normal maps** as auxiliary inputs (supported by some research/tooling pipelines, but not mainstream model APIs).

---

## 4. Prompting Strategies: Camera, Framing, Expressions, Motion

### Prompt Structure That Works

A high-quality video prompt typically contains 6–9 ordered elements:

1. **Subject** — who/what is in the shot.
2. **Action** — what they are doing (verb-rich).
3. **Scene / Environment** — setting, time of day, weather.
4. **Framing / Shot Type** — wide shot, medium shot, close-up, extreme close-up.
5. **Camera Movement** — dolly in/out, tracking, crane up/down, orbit, handheld, aerial.
6. **Lens / Optical Effects** — shallow depth of field, anamorphic flare, motion blur, rack focus.
7. **Visual Style** — cinematic, documentary, anime, stop-motion, film grain.
8. **Lighting / Atmosphere** — golden hour, neon bounce, soft natural light, chiaroscuro.
9. **Motion Speed / Energy** — slow motion, fast motion blur, static, timelapse.

### Camera Movement Vocabulary (Model-Responsive)

Models respond to technical cinematography terms. Avoid vague phrases like *"make it look cool."*

- **Dolly In / Out** — camera moves toward/away from subject. Good for emotional beats.
- **Tracking Shot** — camera moves with subject. *"Side tracking shot of a runner."*
- **Crane / Jib Shot** — sweeping vertical movement. *"Crane shot rising to reveal the city skyline."*
- **Orbit / Arc Shot** — camera circles subject. Adds energy and reveals spatial depth.
- **Pan / Tilt** — horizontal / vertical rotation from fixed position.
- **Handheld / Documentary** — adds kinetic energy, imperfection.
- **Aerial / Drone** — bird’s-eye or elevated perspective.
- **Fixed / Static** — no camera movement; subject moves through frame.
- **Dolly Zoom (Vertigo Effect)** — conflicting zoom + dolly creates unsettling depth distortion.
- **Rack Focus** — shift focus from foreground to background (or reverse).

**Tip:** Combining opposing motions (e.g., *"slow dolly-in while background drifts past"*) forces the model to generate depth and parallax, improving 3D illusion.

### Expression & Performance Control

- Use explicit emotional descriptors: *"determined expression," "eyes widening in fear," "subtle smirk."*
- Close-up prompts benefit from micro-detail: *"ending in a tight close-up on her eyes just before she takes the shot."*
- Eye contact and hand gestures are noted strengths of Sora 2; other models may distort hands or gaze direction.

### Style Descriptors (Runway Gen-4 tip)
Append or prepend style descriptors for:
- Motion speed (`slow motion`, `fast motion blur`).
- General movement style (`live action`, `smooth animation`, `stop motion`).
- Aesthetic (`cinematic`, `film grain`, `anamorphic lens`).

---

## 5. Audio: TTS, SFX, and Music

### Text-to-Speech (TTS) / Voice
- **ElevenLabs** — market leader for realistic TTS and voice cloning. v3 voices support emotional range, multilingual, and low-latency streaming.
- Use cases: narration, character dialogue, ADR replacement.
- Best practice: clone a voice from clean source audio; keep scripts under ~30 s per generation for best sync.

### Sound Effects (SFX)
- **ElevenLabs Sound FX** — text-to-sound-effect. Describe the sound (e.g., *"heavy metal door slamming in a concrete hallway with reverb"*).
- **Stable Audio, AudioLDM** — generative ambient and event sounds.
- Integration: SFX layers are added in post-production; no video model currently generates perfect diegetic audio synchronized to action.

### Music Generation
- **Suno v5** — most polished vocal tracks, genre conventions. 44.1 kHz output. Weak at rap/spoken word.
- **Udio** — strongest at genre fidelity (*"blues rock"* gives textbook blues rock). Inpainting for sectional editing. Locked sharing ecosystem as of early 2026.
- **ElevenLabs Music** — launched Aug 2025. Best vocal realism, fewer editing tools.
- **AIVA, Beatoven, Stable Audio** — instrumental/ambient focused.

### Pipeline Recommendation
- Generate instrumental score with Suno / Udio / ElevenLabs Music.
- Generate SFX with ElevenLabs Sound FX or library (Artlist, Epidemic Sound).
- Generate dialogue/voiceover with ElevenLabs.
- Mix in a DAW or video editor. No single AI tool handles full audio post yet.

---

## 6. Production Pipeline Best Practices

### The Storyboard-First Workflow (Recommended)

Traditional film structure still applies:

```
Script → Storyboard (still images) → Pre-vis / Animatic → AI Video Clips → Edit → Audio Post
```

1. **Script / Scene Breakdown** — define each shot’s purpose.
2. **Generate Storyboard Stills** — use Midjourney, Seedream, ImagineArt, FLUX. These are the *visual contract*.
3. **Animate Stills to Video** — image-to-video with Kling, Seedance, Runway, or Veo. The model’s job is simplified to "move existing pixels."
4. **Review / Iterate** — fix framing, motion, or character drift before committing.
5. **Edit & Composite** — stitch clips; handle transitions, color correction, and audio in an NLE or AI video editor.

### Why Image-to-Video Beats Text-to-Video for Narrative Work
- Dramatically fewer hallucinations.
- Consistent character, costume, and set design.
- Director can approve the frame *before* motion is applied.
- Ability to use the same still across multiple motion variations (A/B camera moves).

### Consistency Techniques
- **Seed / reference image lock** — reuse the same source image across related clips.
- **Lighting & camera language lock** — use identical style descriptors on every prompt in a scene.
- **Character sheets / multiple angles** — generate front/side/profile stills; use as references.
- **LTX Studio / integrated platforms** — built-in character consistency tools, script-to-storyboard-to-video pipelines.

### Clip Length Strategy
- Generate in **5–10 second segments** (the reliable unit).
- Extend by generating the next segment from the last frame of the previous (overlap 1–2 frames).
- Accept that long continuous shots (>15 s) still suffer from morphing, drift, or physics breaking.

---

## 7. What a Video-Making App Should Utilize

### Core Features to Surface

| Domain | Feature | Rationale |
|--------|---------|-----------|
| **Pre-production** | Script editor with shot extraction | Natural language → shot list (Subject, Action, Framing, Camera, Style, Time, Audio). |
| **Pre-production** | Storyboard panel with still generation | Generate key frames; approve before motion. |
| **Pre-production** | Shot list / scene database | Track shot purpose, camera, duration, audio cues. |
| **Generation** | Image-to-video as default path | Better consistency and control than text-to-video. |
| **Generation** | Prompt builder / templating | Structured fields for the 9-element prompt (subject, action, scene, framing, camera, lens, style, lighting, motion). |
| **Generation** | Camera motion presets | Dropdown / icons for dolly, track, crane, orbit, handheld, aerial — mapped to prompt text. |
| **Generation** | Reference image / video attachment | Seed image + motion reference video (Kling-style). |
| **Generation** | Spatial annotation tools | Arrow/mask overlay on storyboard stills to indicate motion paths (translate to model-specific spatial prompting where supported). |
| **Generation** | Multi-clip batching with shared seed/style | Ensures visual coherence across a scene. |
| **Post-production** | Timeline / sequence editor | Stitch 5–10 s clips; handle transitions; sync audio. |
| **Post-production** | Audio track layers | Separate tracks for dialogue (ElevenLabs), SFX, music. |
| **Post-production** | Character / asset library | Re-use approved stills, voices, and music themes. |

### Control Abstractions the App Can Provide

Since models do not accept raw 3D scene data, the app should act as a **translator layer**:

- **Scene layout designer** → exports annotated still + text prompt.
- **Camera path designer** → exports prompt text (e.g., *"Slow dolly out combined with a crane shot rising smoothly"*) + optional motion reference video.
- **Character emotion selector** → maps to expression descriptors in prompt.
- **Lighting preset picker** → maps to atmospheric text (golden hour, noir, etc.).

### API / Provider Strategy
- Support multiple backends (Kling, Runway, Veo, Seedance) — no single model wins every shot type.
- Allow per-shot model selection (Runway for control, Kling for motion transfer, Veo for reliability).
- Cache generated stills and clips aggressively; generations are expensive and slow.

---

## 8. Key Limitations (Honest Assessment)

- **No true 3D scene graph input.** You cannot hand a model a structured scene and expect deterministic spatial results.
- **Physics & temporal coherence.** Objects may morph, hands may distort, backgrounds may drift across long generations.
- **Audio sync.** Only Veo 3 generates native ambient audio; lip-sync and precise diegetic sound are not solved generatively.
- **Character consistency across long sequences.** Requires heavy reference-image discipline and manual curation.
- **Legal / copyright.** Training data provenance is contested; commercial usage terms vary by provider.

---

## Sources & References

- Runway Gen-4 Prompting Guide — https://help.runwayml.com/hc/en-us/articles/39789879462419
- Runway Gen-3 Alpha Research — https://runwayml.com/research/introducing-gen-3-alpha
- Runway 3D Camera Controls (VentureBeat) — https://venturebeat.com/ai/runway-goes-3d-with-new-ai-video-camera-controls-for-gen-3-alpha-turbo
- Kling 3.0 "AI Director" — https://flowith.io/blog/kling-3-ai-director-era/
- Veo 3 Spatial Prompting (Scenario) — https://help.scenario.com/en/articles/spatial-prompting-for-videos-generation/
- Luma Depth-Aware Video-to-Video — https://lumalabs.ai/video-to-video/add-dynamic-camera-motion-using-video-to-video-ai-editing
- AI Camera Shots Guide (Artlist) — https://artlist.io/blog/camera-shots-ai/
- AI Camera Movement Prompts (LetsEnhance) — https://letsenhance.io/blog/all/ai-video-camera-movements/
- Kling Prompt Guide (Leonardo.Ai) — https://leonardo.ai/news/kling-ai-prompts
- Veo 3 Prompt Guide (Leonardo.Ai) — https://leonardo.ai/news/mastering-prompts-for-veo-3
- Autonomous AI Filmmaking Pipeline (Medium) — https://medium.com/@jengas/dissecting-an-autonomous-ai-filmmaking-pipeline-0197b7a69636
- AI Filmmaking Workflow (601 Media) — https://www.601media.com/ai-film-workflow-from-script-to-final-cut-no-camera-no-crew/
- AI Video Production Workflow (Ability.ai) — https://www.ability.ai/blog/ai-video-production-workflow
- ElevenLabs v3 / SFX / Music (ProVideo Coalition) — https://www.provideocoalition.com/ai-tools-elevenlabs-v3-voices-sfx-eleven-music/
- Suno vs Udio vs ElevenLabs (Undetectr) — https://undetectr.com/blog/best-ai-music-generators-2026
- Best AI Video Models 2026 (UlazAI) — https://ulazai.com/ai-video-models-guide-2025/
- AI Video Generation Comparison (Lushbinary) — https://lushbinary.com/blog/ai-video-generation-sora-veo-kling-seedance-comparison/

---

*Document compiled: 2026-05-22*
