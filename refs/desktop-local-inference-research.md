# Desktop Packaging & Local AI Inference — Research & Architecture (2025–2026)

> How to ship CineGen, in a later release but not at first, as a lightweight desktop app (lighter than Electron) and what it takes to support local open-source AI model inference on users' high-end GPUs (future feature).

---

## Part 1: Lightweight Desktop Packaging

### 1.1 The Electron Problem

Electron bundles Chromium + Node.js with every app. For CineGen this means:
- **Bundle size:** ~150–250 MB baseline before your code.
- **Memory:** Each app instance runs a full browser engine.
- **Startup time:** Slower than native due to Chromium boot.
- **Security surface:** Shipping a browser engine requires regular Chromium updates.

### 1.2 Recommended: Tauri 2.x

**Why Tauri wins for CineGen:**

| Factor | Electron | Tauri 2.x |
|--------|----------|-----------|
| Bundle size | ~150–250 MB | **~3–15 MB** (your code + WebView) |
| Memory footprint | High (full Chromium) | Low (system WebView) |
| Backend language | Node.js (bundled) | Rust (compiled, tiny) |
| Frontend compatibility | Any | Any (Vite, React, Vue, Lit, vanilla) |
| Mobile support | No | **Yes (iOS, Android)** |
| Security model | Node.js in renderer | IPC bridge + capability-based permissions |
| Auto-updater | Built-in | Built-in (plugin) |
| Code signing | Supported | Supported |
| Mature ecosystem | Very mature | Mature enough (stable 2.0 as of late 2024) |

**Tauri Architecture for CineGen:**

```
┌─────────────────────────────────────────────┐
│  System Native WebView (WKWebView /         │
│  WebView2 / WebKitGTK)                      │
│  └─ Your Vite-built frontend (Lit + TS)    │
├─────────────────────────────────────────────┤
│  Tauri Rust Core (IPC bridge, FS access,   │
│   native APIs, process spawning)            │
├─────────────────────────────────────────────┤
│  Sidecar: Node.js backend (packaged,       │
│   self-contained binary via pkg/nexe)       │
│   └─ Your existing backends/ code           │
└─────────────────────────────────────────────┘
```

**Key Tauri concepts for this project:**

1. **Frontend URL / dev server:** Tauri 2.x supports pointing the WebView at a Vite dev server during development (`devUrl` in `tauri.conf.json`), and at the built `dist/` files in production. Your existing `npm run dev` workflow stays intact.

2. **Node.js as a sidecar:** Tauri has an official guide for bundling a Node.js app as a sidecar process. Your existing `backends/` server (MCP server, proxy, API routes) can run as a spawned binary that the Rust core starts/stops and communicates with via HTTP/WebSocket. The user does not need Node.js installed.
   - Use `pkg` or `nexe` to bundle the Node.js backend into a single executable.
   - Tauri's `sidecar` config declares the binary; the Rust core manages its lifecycle.
   - The frontend talks to the sidecar via localhost HTTP (same as today) or via Tauri's IPC if tighter integration is needed.

3. **Tauri Commands:** For native operations (file picker, FS access, spawning external processes, native menus), write Rust "commands" that the frontend calls via IPC. This is more secure than giving the frontend direct Node.js access.

**Migration effort from current stack:**

| Area | Current | Tauri | Effort |
|------|---------|-------|--------|
| Frontend build | Vite → `dist/` | Vite → `dist/` | **None** |
| Dev server | `vite` on :5173 | `vite` + Tauri dev | **Minimal** |
| Backend | `node backends/mcp-server.js` | Sidecar binary | **Medium** (bundle Node app) |
| File system | Direct via Node | Tauri FS APIs or sidecar | **Medium** |
| Window chrome | HTML/CSS | HTML/CSS (with optional native title bar) | **None** |
| Auto-update | Custom or none | Tauri updater plugin | **Low** |

**Recommended approach for CineGen:**

1. **Phase 1 (Immediate):** Keep the web app as-is. Add a Tauri wrapper with minimal Rust code. The backend runs as a sidecar. Goal: ship a desktop app with a ~5–10 MB installer instead of 200 MB.
2. **Phase 2 (Later):** Gradually migrate native operations from the Node sidecar to Rust Tauri commands (file dialogs, OS integration, GPU detection).

---

### 1.3 Alternative: Wails (Go Backend)

**Overview:** Wails is like Tauri but uses Go instead of Rust for the native backend.

**Pros:**
- Go is easier to learn than Rust for teams without Rust expertise.
- Excellent binary size (small).
- Good cross-platform support (Windows, macOS, Linux).

**Cons:**
- Ecosystem smaller than Tauri.
- No mobile support (desktop only).
- Less security tooling (no capability-based permission model like Tauri).

**Verdict:** If your team is comfortable with Rust or willing to learn, **Tauri is the better bet** due to mobile support and security model. If Go is preferred, Wails is viable but means rewriting the backend in Go.

---

### 1.4 Alternative: Neutralinojs

**Overview:** Uses the system's existing web browser library (WebView2 on Windows, WebKit on macOS, WebKitGTK on Linux) without bundling Chromium. Much lighter than Electron.

**Pros:**
- Very small bundle size.
- Simple API.

**Cons:**
- Less mature than Tauri.
- No mobile support.
- Weaker security model (no capability system).
- Smaller community and plugin ecosystem.

**Verdict:** Tauri has overtaken Neutralinojs in every dimension. Not recommended for new projects in 2026.

---

### 1.5 Comparison Matrix

| Framework | Bundle Size | Mobile | Backend Lang | Maturity | Best For |
|-----------|-------------|--------|--------------|----------|----------|
| **Tauri 2.x** | ~3–15 MB | Yes | Rust | High | **New projects, web dev teams** |
| Electron | ~150–250 MB | No | Node.js | Very High | Teams heavily invested in Electron |
| Wails | ~5–20 MB | No | Go | Medium | Go-focused teams |
| Neutralinojs | ~2–5 MB | No | Node.js/JS | Low | Minimal bundle at all costs |

---

## Part 2: Local AI Model Inference

### 2.1 What Users Want

"Run open-source models on my high-end GPU without calling APIs."

This breaks down into:
- **Text/LLM inference:** Script analysis, prompt generation, dialogue editing.
- **Image generation:** Storyboard stills, character references, concept art.
- **Video generation:** Shot generation, motion transfer.
- **Audio generation:** TTS, SFX, music (least mature locally).

### 2.2 The Hardware Reality

**What "high-end GPU" means in 2026:**

| GPU Tier | VRAM | Capable Of |
|----------|------|-----------|
| **Entry (RTX 3060, 8 GB)** | 8–12 GB | Small LLMs (7B quantized), SD 1.5 / SDXL (image), short video clips at low res |
| **Mid (RTX 4070 Ti, RTX 3090)** | 12–24 GB | LLMs up to 30B quantized, FLUX.1 (image), LTX-2 / Wan 2.1 (video at 512×768) |
| **High (RTX 4090, RTX 5090)** | 24–32 GB | LLMs up to 70B quantized, FLUX.2, LTX-2 4K video, multiple models concurrently |
| **Workstation (A100, RTX 6000 Ada)** | 48–80 GB | Full-precision models, batch generation, training/fine-tuning |

**Key constraint:** Video models are VRAM-hungry. LTX-2 at 512×768 needs ~12–16 GB. At 4K it needs 24+ GB. Most users will need to generate at lower resolution and upscale.

---

### 2.3 Local Inference Stack Options

#### A. LLM / Text Inference

| Tool | Best For | How It Works |
|------|----------|-------------|
| **Ollama** | End-user ease of use | Runs as a daemon. Pull models via CLI. Exposes OpenAI-compatible HTTP API. Great for integration. |
| **llama.cpp** | Maximum control, minimal footprint | C++ inference engine. Bindings for many languages. Supports GGUF quantization. |
| **LM Studio** | GUI-first local LLM exploration | Desktop app with GUI. Exposes local API server. Good for non-technical users. |
| **vLLM** | Server-grade throughput | Python server. Optimized for batching and throughput. Best for multi-user or background services. |

**Recommendation for CineGen:**

1. **Primary:** **Ollama** as a sidecar. It is the most "app-like" experience for end users. Your app can:
   - Check if Ollama is installed (`ollama --version`).
   - Auto-install or guide install if missing.
   - Pull required models on first run (`ollama pull llama3.1:8b`, `ollama pull qwen2.5`).
   - Talk to `http://localhost:11434/api/generate` (same as OpenAI API).

2. **Fallback:** Bundle `llama.cpp` server binary for users who want minimal overhead.

#### B. Image / Video / Diffusion Inference

| Tool | Best For | How It Works |
|------|----------|-------------|
| **ComfyUI** | Local image/video generation | Node-based GUI + API. Modular pipeline builder. Supports SDXL, FLUX, LTX-2, Wan, HunyuanVideo. |
| **Diffusers (Hugging Face)** | Programmatic Python pipelines | Python library. Good for custom pipelines but requires Python environment. |
| **InvokeAI** | User-friendly local image gen | Desktop app with canvas. Less programmable than ComfyUI. |
| **Stability SDK / Local** | Specific Stable Diffusion models | Vendor-specific tooling. |

**Recommendation for CineGen:**

1. **Primary:** **ComfyUI as a sidecar/service.** ComfyUI has a powerful HTTP API. Your app can:
   - Detect if ComfyUI is running on `localhost:8188`.
   - Provide one-click install (ComfyUI Portable for Windows, or script for macOS/Linux).
   - Submit workflows as JSON (your app constructs the node graph programmatically).
   - Poll for results and download generated images/videos.

2. **Key insight from research:** ComfyUI is the "llama.cpp equivalent for image/video." It is the dominant local inference engine for diffusion models. NVIDIA actively optimizes for it (RTX AI Garage, NVFP8 support).

3. **Workflow strategy:** Pre-built ComfyUI workflows per generation type:
   - `storyboard-still.json` — text → image (SDXL/FLUX).
   - `character-reference.json` — text + seed → consistent character angles.
   - `image-to-video.json` — image → 5s video (LTX-2 / Wan).
   - `motion-transfer.json` — image + motion reference → video.
   - `upscale.json` — low-res → 4K (Real-ESRGAN + RTX VSR).

#### C. Audio Inference (TTS, SFX, Music)

| Tool | Best For | Status |
|------|----------|--------|
| **Piper** | Fast local TTS | Lightweight, good quality, runs on CPU or GPU. |
| **Kokoro** | High-quality local TTS | Small model, excellent quality, ONNX-based. |
| **StyleTTS 2 / XTTS** | Voice cloning | Requires more VRAM, good cloning quality. |
| **Riffusion / Stable Audio** | Music/SFX | Open weights exist but music quality lags behind Suno/Udio. |

**Recommendation for CineGen:**
- **TTS:** Use **Kokoro** or **Piper** as local TTS sidecars. Good enough for narration and dialogue.
- **SFX/Music:** Local open-source music generation is still behind cloud APIs. Recommend cloud APIs (ElevenLabs, Suno) as default, with local as optional.

---

### 2.4 Integration Architecture: Local + Cloud Hybrid

```
┌─────────────────────────────────────────────────────────────┐
│  CineGen Desktop App (Tauri wrapper + Vite frontend)        │
│  ├─ UI: Lit + TypeScript                                    │
│  ├─ Tauri Rust Core: IPC, FS, process management            │
│  └─ Node.js Sidecar: API routing, project persistence        │
├─────────────────────────────────────────────────────────────┤
│  AI Provider Router (inside Node sidecar)                    │
│  ├─ CLOUD providers: OpenAI, Runway, Kling, Veo,            │
│  │   ElevenLabs, Suno, Udio                                 │
│  ├─ LOCAL providers:                                        │
│  │   ├─ Ollama (LLM) → localhost:11434                     │
│  │   ├─ ComfyUI (image/video) → localhost:8188            │
│  │   └─ Kokoro/Piper (TTS) → localhost:PORT                │
│  └─ Routing logic per modality:                            │
│      "Use local if available and sufficient VRAM,           │
│       else cloud with user consent"                         │
├─────────────────────────────────────────────────────────────┤
│  Local Inference Services (spawned by Tauri/app)             │
│  ├─ ollama serve                                            │
│  ├─ python ComfyUI/main.py --listen 8188                  │
│  └─ kokoro-server (or piper)                                │
└─────────────────────────────────────────────────────────────┘
```

### 2.5 GPU Detection & Capability Management

**Critical:** Your app needs to know what GPU the user has before deciding whether to use local inference.

**GPU Detection approaches:**

1. **Tauri + Rust:** Use Rust crates (`nvml-wrapper` for NVIDIA, `amdgpu-sysfs` for AMD) to query GPU name, VRAM, driver version. Expose via Tauri command to frontend.
2. **Node sidecar:** Use `systeminformation` npm package or spawn `nvidia-smi` / `rocm-smi` to get GPU info.
3. **Python (ComfyUI context):** `torch.cuda.get_device_properties()`.

**Capability matrix your app should maintain:**

```typescript
interface GpuProfile {
  vendor: 'nvidia' | 'amd' | 'intel' | 'apple';
  model: string;
  vramGb: number;
  computeCapability?: string;  // CUDA compute capability
  supportsCuda: boolean;
  supportsMps: boolean;       // Apple Metal
  supportsRocm: boolean;       // AMD ROCm
  maxImageResolution: number;  // e.g., 1024, 2048
  maxVideoResolution: string;   // e.g., "512x768", "1024x1024"
  concurrentModels: number;    // how many models fit in VRAM at once
  recommendedQuantization: 'Q4_K_M' | 'Q5_K_M' | 'Q8_0' | 'FP16';
}
```

**Dynamic routing logic:**

```
User requests: "Generate storyboard still for Scene 3"
App checks:
  1. Is ComfyUI running? (poll localhost:8188)
  2. What GPU profile do we have?
     - If VRAM >= 12 GB and model (FLUX/SDXL) is downloaded:
         → Route to LOCAL (ComfyUI)
     - Else:
         → Route to CLOUD (Runway/Seedance/Veo)
         → Show toast: "Using cloud generation — local GPU insufficient for FLUX."
```

---

### 2.6 Model Distribution & Management

**The challenge:** Diffusion models are 5–50 GB each. You cannot bundle them in the app installer.

**Solutions:**

| Approach | Pros | Cons |
|----------|------|------|
| **On-demand download** | Minimal installer size | First use is slow; needs bandwidth |
| **Optional model pack** | Users choose what to install | Complex installer; disk space |
| **Cloud cache + local store** | Hybrid approach | Requires cloud infrastructure |
| **Ollama-style model registry** | Standardized, versioned | Only works for Ollama; ComfyUI uses manual checkpoint management |

**Recommended approach for CineGen:**

1. **Installer:** Ship only the app (~10 MB) + ComfyUI engine (~500 MB portable with no models).
2. **First-run model setup wizard:**
   - Detect GPU → suggest appropriate models.
   - Show disk space requirements.
   - Download checkpoints via ComfyUI Manager or direct HTTP (Hugging Face, Civitai).
   - Cache in `~/.cinegen/models/` (or OS-appropriate app data dir).
3. **Model manager UI:**
   - List installed models with VRAM usage.
   - One-click install/uninstall.
   - Update notifications when new versions available.

---

### 2.7 Technology Requirements Summary

To support local inference, CineGen needs:

| Component | Technology | Responsibility |
|-----------|-----------|--------------|
| **Desktop shell** | Tauri 2.x | App wrapper, native APIs, sidecar management |
| **Node backend** | Sidecar via `pkg` | API routing, project data, provider routing |
| **LLM inference** | Ollama sidecar | Text generation, script analysis |
| **Image/video inference** | ComfyUI sidecar | Diffusion-based generation |
| **TTS inference** | Kokoro / Piper sidecar | Local voice generation |
| **GPU detection** | Rust `nvml-wrapper` + Node `systeminformation` | Hardware profiling |
| **Model management** | Custom + ComfyUI Manager | Download, cache, version |
| **Workflow engine** | JSON ComfyUI workflows | Pre-built pipelines per generation type |

---

## Part 3: Implementation Roadmap

### Phase 1: Tauri Wrapper (Immediate — Low Risk)
- Add `src-tauri/` with minimal Rust code.
- Configure `tauri.conf.json` to point at Vite dev server and `dist/` build.
- Bundle Node backend as sidecar.
- Ship desktop app with no changes to AI provider layer.

### Phase 2: Local LLM (Medium Effort)
- Detect Ollama installation.
- Auto-install guide or bundled Ollama.
- Add "Local" option to text AI provider selector.
- Use Ollama OpenAI-compatible API.

### Phase 3: Local Image/Video (High Effort)
- Detect ComfyUI / guide install.
- Build JSON workflow library for storyboard, character, I2V, motion transfer.
- GPU detection → capability-based routing.
- Model manager UI for checkpoint download.

### Phase 4: Local Audio (Low Priority)
- Add Kokoro/Piper TTS as optional local provider.
- SFX/music remain cloud-primary until local models improve.

---

## Part 4: Key Sources & References

- **Tauri 2.0 Stable Release** — https://v2.tauri.app/blog/tauri-20/
- **Tauri Architecture** — https://v2.tauri.app/concept/architecture/
- **Tauri + Vite** — https://v2.tauri.app/start/frontend/vite/
- **Node.js as a Tauri sidecar** — https://v2.tauri.app/learn/sidecar-nodejs/
- **Tauri vs Electron 2026** — https://tech-insider.org/tauri-vs-electron-2026/
- **Electron vs Tauri comparison (DoltHub)** — https://www.dolthub.com/blog/2025-11-13-electron-vs-tauri/
- **Web-to-desktop framework comparison** — https://github.com/Elanis/web-to-desktop-framework-comparison
- **Top 5 Electron alternatives 2026** — https://teamdev.com/mobrowser/blog/top-5-electron-alternatives-in-2026/
- **NVIDIA RTX + ComfyUI for video** — https://blogs.nvidia.com/blog/rtx-ai-garage-ces-2026-open-models-video-generation/
- **NVIDIA ComfyUI tutorial** — https://blogs.nvidia.com/blog/rtx-ai-garage-comfyui-tutorial/
- **ComfyUI Portable/Local** — https://docs.comfy.org/installation/comfyui_portable_windows
- **ComfyUI GitHub** — https://github.com/Comfy-Org/ComfyUI
- **Ollama local LLM guide 2026** — https://daily.dev/blog/running-llms-locally-ollama-llama-cpp-self-hosted-ai-developers
- **llama.cpp guide** — https://www.clarifai.com/blog/ilama.cpp
- **Local LLMs complete guide** — https://www.sitepoint.com/local-llms-complete-guide/
- **NVIDIA open-source AI tools for RTX** — https://developer.nvidia.com/blog/open-source-ai-tool-upgrades-speed-up-llm-and-diffusion-models-on-nvidia-rtx-pcs
- **Local AI image/video generation 2026** — https://hardwarepedia.com/blog/local-ai-image-video-generation-guide-2026
- **Run LLMs locally (Nerd Level Tech)** — https://nerdleveltech.com/running-llms-locally-the-complete-2025-guide
- **llama.cpp equivalent for image/video (Reddit discussion)** — https://www.reddit.com/r/LocalLLaMA/comments/1pv022d/what_is_llamacpp_equivalent_for_image_video_gen/
- **LTX-2 on RTX (NVIDIA)** — https://blogs.nvidia.com/blog/rtx-ai-garage-flux-ltx-video-comfyui-gdc/

---

*Document compiled: 2026-05-22*
