import { html, nothing } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { customElement, state } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import { getCachedVoicesForVendorAudioModel, loadProviderModelCatalog } from '@/services/provider-model-catalog';
import { subscribeAiInteractionLog } from '@/services/ai/interaction-log';
import { ChatService } from '@/services/ai/chat-service';
import { ImageGenerationService } from '@/services/ai/image-generation-service';
import { VideoGenerationService } from '@/services/ai/video-generation-service';
import { AudioGenerationService } from '@/services/ai/audio-generation-service';

type ModKey = 'llm' | 'image' | 'video' | 'audio';

interface VendorInfo { id: string; name: string; providerId: string; slotId?: string; baseUrl?: string; }
interface ModelEntry { id: string; label: string; }

const VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer', 'eve'];
const SIZES = ['1024x1024', '1792x1024', '1024x1792', '768x1344', '1344x768', '1536x1536'];
const ASPECT_RATIOS = ['16:9', '9:16', '4:3', '3:4', '1:1', '21:9', '1280:720', '720:1280'];
const VIDEO_DURATIONS = ['3', '5', '8', '10', '15'];
const VIDEO_RESOLUTIONS = ['480p', '720p', '1080p'];
const RESPONSE_FORMATS = ['mp3', 'opus', 'aac', 'flac'];
const AUDIO_SPEEDS = ['0.5', '0.75', '1.0', '1.25', '1.5', '2.0'];
const QUALITY_OPTIONS = ['standard', 'hd'];
const STYLE_OPTIONS = ['vivid', 'natural'];
const RANDOM_PROMPTS = [
  'A cat wearing a detective hat solves a mystery.',
  'A neon-lit alley where a violinist performs to a crowd of robots.',
  'A vintage train crossing a snowy mountain pass at sunrise.',
  'An astronaut watering plants in a tiny moon greenhouse.',
  'A bustling floating market in the clouds at golden hour.',
  'A pirate captain bargaining with a dragon over treasure maps.',
  'A cozy cabin interior during a thunderstorm, cinematic lighting.',
  'A time traveler arriving in a 1920s jazz club.',
  'A samurai walking through a field of glowing fireflies.',
  'A futuristic city park where drones plant trees.',
  'A tiny bakery run by mice in a storybook village.',
  'A bioluminescent coral forest beneath a glass-domed city.',
  'A noir detective monologue in a rainy downtown diner.',
  'A high-speed chase on hover bikes through narrow streets.',
  'A medieval library with floating books and candlelight.',
  'A child and a friendly giant building a kite on a hill.',
  'A surreal desert with giant clocks melting in the sand.',
  'A wildlife documentary style shot of foxes in urban ruins.',
  'A superhero quietly commuting on a crowded subway.',
  'A robot chef preparing ramen in a midnight food stall.',
  'A fantasy blacksmith forging a sword powered by lightning.',
  'A peaceful Japanese garden reflected in still water at dawn.',
  'A heist planning board covered in photos, strings, and notes.',
  'A cyberpunk rooftop garden during light rain.',
  'A lighthouse keeper spotting strange lights offshore.',
  'A courtroom drama scene with intense cross-examination.',
  'A stop-motion clay animation style parade of animals.',
  'A whale swimming through the sky above a city skyline.',
  'A gritty boxing gym training montage with dramatic shadows.',
  'A quiet bookstore where characters step out of the novels.',
  'A race car pit crew in a near-future electric championship.',
  'A haunted carnival at dusk with flickering neon signs.',
  'A mountain village festival with lanterns and music.',
  'A scientist presenting a breakthrough in a packed auditorium.',
  'A fantasy tavern where adventurers trade quest stories.',
  'A police radio dispatch scene with escalating urgency.',
  'A chef plating a Michelin-level dessert in macro detail.',
  'A nature timelapse of flowers blooming after rainfall.',
  'A post-apocalyptic convoy crossing a salt flat at sunset.',
  'A cozy rainy-day cafe ambience with soft jazz and warm light.',
];

const chatService = new ChatService();
const imageService = new ImageGenerationService();
const videoService = new VideoGenerationService();
const audioService = new AudioGenerationService();

function parseAvailableVoices(errorText: string): string[] {
  if (!errorText) return [];
  const match = errorText.match(/Available voices:\s*([^\n"}]+)/i);
  if (!match?.[1]) return [];
  return match[1]
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function buildVendorList(): VendorInfo[] {
  const catalog = loadProviderModelCatalog();
  const vendorIds = Object.keys(catalog.vendors || {});
  if (!vendorIds.length) return [];

  const out: VendorInfo[] = [];
  const keyCache = new Map<string, any>();

  if (typeof (window as any).loadApiKeys === 'function') {
    const keys = (window as any).loadApiKeys();
    if (keys?.vendors) {
      for (const v of keys.vendors) {
        if (v.id) keyCache.set(v.id, v);
      }
    }
  }

  for (const vid of vendorIds) {
    const rec = catalog.vendors[vid];
    if (!rec?.modalities) continue;
    const keyRec = keyCache.get(vid);
    const name = keyRec?.name || rec.providerId || vid;
    const slotId = keyRec?.slotId || '';
    const baseUrl = keyRec?.baseUrl || '';
    out.push({ id: vid, name, providerId: rec.providerId, slotId, baseUrl });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function modelsForVendorAndModality(vendorId: string, modKey: string): ModelEntry[] {
  const catalog = loadProviderModelCatalog();
  const rec = catalog.vendors?.[vendorId];
  if (!rec?.modalities) return [];

  if (modKey === 'audio') {
    const audio = rec.modalities.audio;
    if (!audio || (audio.status !== 'ok' && audio.status !== 'ratelimit') || !Array.isArray(audio.models)) return [];
    return audio.models.map((m: any) => ({ id: m.id, label: m.label || m.id }));
  }

  const mod = rec.modalities[modKey];
  if (!mod || (mod.status !== 'ok' && mod.status !== 'ratelimit') || !Array.isArray(mod.models)) return [];
  return mod.models.map((m: any) => ({ id: m.id, label: m.label || m.id }));
}

@customElement('cinegen-debug-modal-body')
export class CinegenDebugModalBody extends CgLightElement {
  @state() private prompt = 'A cat wearing a detective hat solves a mystery.';
  @state() private logLines: string[] = [];

  // Text parameters
  @state() private textVendorId = '';
  @state() private textModelId = '';
  @state() private textMaxTokens = '500';
  @state() private textTemperature = '0.7';
  @state() private textTopP = '1.0';
  @state() private textFrequencyPenalty = '0';
  @state() private textPresencePenalty = '0';
  @state() private textStopSequences = '';

  // Image parameters
  @state() private imageVendorId = '';
  @state() private imageModelId = '';
  @state() private imageCount = '1';
  @state() private imageSize = '1024x1024';
  @state() private imageQuality = 'standard';
  @state() private imageStyle = 'vivid';
  @state() private imageNegativePrompt = '';
  @state() private imageSeed = '';
  @state() private imageSteps = '25';
  @state() private imageCfgScale = '7.5';

  // Video parameters
  @state() private videoVendorId = '';
  @state() private videoModelId = '';
  @state() private videoDuration = '5';
  @state() private videoAspectRatio = '16:9';
  @state() private videoResolution = '480p';
  @state() private videoSeed = '';
  @state() private videoCfgScale = '0.5';

  // Audio parameters
  @state() private audioVendorId = '';
  @state() private audioModelId = '';
  @state() private audioVoice = 'alloy';
  @state() private audioSpeed = '1.0';
  @state() private audioResponseFormat = 'mp3';

  // Results
  @state() private textResult = '';
  @state() private imageResult = '';
  @state() private videoResult = '';
  @state() private audioResult = '';

  // Loading states
  @state() private textBusy = false;
  @state() private imageBusy = false;
  @state() private videoBusy = false;
  @state() private audioBusy = false;
  @state() private videoProgress: number | null = null;
  @state() private videoProgressStatus = '';

  // Collapsible sections
  @state() private textParamsOpen = true;
  @state() private imageParamsOpen = true;
  @state() private videoParamsOpen = true;
  @state() private audioParamsOpen = true;
  @state() private showLog = true;
  @state() private _vendorKey = 0;
  private _unsubscribeLog?: () => void;
  private _textAbort?: AbortController;
  private _imageAbort?: AbortController;
  private _videoAbort?: AbortController;
  private _audioAbort?: AbortController;

  private _randomPrompt(): string {
    const idx = Math.floor(Math.random() * RANDOM_PROMPTS.length);
    return RANDOM_PROMPTS[idx] || RANDOM_PROMPTS[0];
  }

  private _loadRandomPrompt(): void {
    this.prompt = this._randomPrompt();
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._loadRandomPrompt();
    this._autoLoadFromSettings();
    this._ensureSelectionsFromCatalog();
    if (!this._unsubscribeLog) {
      this._unsubscribeLog = subscribeAiInteractionLog((event) => {
        this._log(event.message);
      });
    }
    setTimeout(() => {
      if (!this.textVendorId) {
        this._autoLoadFromSettings();
        this._ensureSelectionsFromCatalog();
        this._vendorKey++; // force re-render even if vendor IDs haven't changed
      }
    }, 500);
  }

  disconnectedCallback(): void {
    this._unsubscribeLog?.();
    this._unsubscribeLog = undefined;
    super.disconnectedCallback();
  }

  private _autoLoadFromSettings(): void {
    const routing: any = (window as any).loadAiApiSettings?.();
    if (!routing?.modalities) return;
    const vendors = buildVendorList();

    const tryLookup = (mod: string): { vendorId: string; modelId: string } => {
      const cfg = routing.modalities[mod];
      if (!cfg) return { vendorId: '', modelId: '' };
      let vendorId = cfg.vendorId || '';
      if (!vendorId) {
        const byProv = vendors.find((v) => v.providerId === cfg.provider);
        if (byProv) vendorId = byProv.id;
      }
      if (!vendorId) vendorId = vendors[0]?.id || '';
      const models = modelsForVendorAndModality(vendorId, mod);
      return { vendorId, modelId: cfg.model && models.some((m) => m.id === cfg.model) ? cfg.model : (models[0]?.id || '') };
    };

    const llm = tryLookup('llm');
    this.textVendorId = llm.vendorId;
    this.textModelId = llm.modelId;

    const img = tryLookup('image');
    this.imageVendorId = img.vendorId;
    this.imageModelId = img.modelId;

    const vid = tryLookup('video');
    this.videoVendorId = vid.vendorId;
    this.videoModelId = vid.modelId;

    const aud = tryLookup('audio');
    this.audioVendorId = aud.vendorId || llm.vendorId;
    this.audioModelId = aud.modelId;
    this.audioVoice = routing.modalities.audio?.voice || this.audioVoice;
  }

  private get vendors(): VendorInfo[] { return buildVendorList(); }

  private vendorById(id: string): VendorInfo | undefined {
    return this.vendors.find((v) => v.id === id);
  }

  private audioVoiceOptions(vendorId: string, modelId: string): string[] {
    const fetched = getCachedVoicesForVendorAudioModel(vendorId, modelId);
    return fetched.length ? fetched : VOICES;
  }

  private ensureAudioVoiceSelection(vendorId: string, modelId: string): void {
    const options = this.audioVoiceOptions(vendorId, modelId);
    if (!options.length) return;
    if (!options.includes(this.audioVoice)) {
      this.audioVoice = options[0];
    }
  }

  private _ensureSelectionForModality(mod: ModKey): void {
    const currentVendorId = mod === 'llm'
      ? this.textVendorId
      : mod === 'image'
        ? this.imageVendorId
        : mod === 'video'
          ? this.videoVendorId
          : this.audioVendorId;

    const compatible = this.compatibleVendors(mod);
    const validVendorId = compatible.some((v) => v.id === currentVendorId)
      ? currentVendorId
      : (compatible[0]?.id || '');
    const models = validVendorId ? modelsForVendorAndModality(validVendorId, mod) : [];

    const currentModelId = mod === 'llm'
      ? this.textModelId
      : mod === 'image'
        ? this.imageModelId
        : mod === 'video'
          ? this.videoModelId
          : this.audioModelId;

    const validModelId = models.some((m) => m.id === currentModelId)
      ? currentModelId
      : (models[0]?.id || '');

    if (mod === 'llm') {
      if (this.textVendorId !== validVendorId) this.textVendorId = validVendorId;
      if (this.textModelId !== validModelId) this.textModelId = validModelId;
    } else if (mod === 'image') {
      if (this.imageVendorId !== validVendorId) this.imageVendorId = validVendorId;
      if (this.imageModelId !== validModelId) this.imageModelId = validModelId;
    } else if (mod === 'video') {
      if (this.videoVendorId !== validVendorId) this.videoVendorId = validVendorId;
      if (this.videoModelId !== validModelId) this.videoModelId = validModelId;
    } else {
      if (this.audioVendorId !== validVendorId) this.audioVendorId = validVendorId;
      if (this.audioModelId !== validModelId) this.audioModelId = validModelId;
      this.ensureAudioVoiceSelection(validVendorId, validModelId);
    }
  }

  private _ensureSelectionsFromCatalog(): void {
    this._ensureSelectionForModality('llm');
    this._ensureSelectionForModality('image');
    this._ensureSelectionForModality('video');
    this._ensureSelectionForModality('audio');
  }

  private compatibleVendors(modKey: string): VendorInfo[] {
    const cat = loadProviderModelCatalog();
    return this.vendors.filter((v) => {
      const rec = cat.vendors?.[v.id];
      if (!rec?.modalities) return false;
      const key = modKey === 'audio' ? 'audio' : modKey;
      const mod = rec.modalities[key];
      return mod && (mod.status === 'ok' || mod.status === 'ratelimit') && Array.isArray(mod.models) && mod.models.length > 0;
    });
  }

  private vendorModels(modKey: string, vendorId: string): ModelEntry[] {
    return modelsForVendorAndModality(vendorId, modKey);
  }

  private _log(msg: string): void {
    if (!this.showLog) this.showLog = true;
    this.logLines = [...this.logLines, `[${new Date().toLocaleTimeString()}] ${msg}`];
    if (this.logLines.length > 200) this.logLines = this.logLines.slice(-200);
  }

  /* ── Generation Methods ─────────────────────────────────────────── */

  private async generateText() {
    const v = this.vendorById(this.textVendorId);
    if (!v || !this.textModelId) {
      this._log('✗ Text generation blocked: select a provider and model first.');
      return;
    }
    this.textBusy = true;
    this.textResult = 'Generating...';
    this._textAbort?.abort();
    this._textAbort = new AbortController();
    try {
      const result = await chatService.generate({
        vendor: v,
        model: this.textModelId,
        prompt: this.prompt,
        maxTokens: parseInt(this.textMaxTokens) || 500,
        temperature: parseFloat(this.textTemperature) || 0.7,
        topP: parseFloat(this.textTopP),
        frequencyPenalty: parseFloat(this.textFrequencyPenalty),
        presencePenalty: parseFloat(this.textPresencePenalty),
        stop: this.textStopSequences.split(',').map((s) => s.trim()).filter(Boolean),
        signal: this._textAbort.signal,
      });
      const { response, data } = result;
      if (response.ok && data?.choices?.[0]?.message?.content) {
        this.textResult = data.choices[0].message.content;
      } else {
        this.textResult = `HTTP ${response.status}: ${data?.error?.message || result.rawText || JSON.stringify(data)}`;
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        this.textResult = 'Generation canceled.';
      } else {
        this.textResult = `Network error: ${e.message}`;
      }
    } finally {
      this._textAbort = undefined;
      this.textBusy = false;
    }
  }

  private async generateImage() {
    const v = this.vendorById(this.imageVendorId);
    if (!v || !this.imageModelId) {
      this._log('✗ Image generation blocked: select a provider and model first.');
      return;
    }
    this.imageBusy = true;
    this.imageResult = 'Generating...';
    this._imageAbort?.abort();
    this._imageAbort = new AbortController();
    try {
      const result = await imageService.generate({
        vendor: v,
        model: this.imageModelId,
        prompt: this.prompt,
        count: parseInt(this.imageCount) || 1,
        size: this.imageSize,
        negativePrompt: this.imageNegativePrompt || undefined,
        seed: this.imageSeed ? parseInt(this.imageSeed) : undefined,
        numInferenceSteps: this.imageSteps ? parseInt(this.imageSteps) : undefined,
        cfgScale: this.imageCfgScale ? parseFloat(this.imageCfgScale) : undefined,
        quality: this.imageQuality as 'standard' | 'hd',
        style: this.imageStyle as 'vivid' | 'natural',
        signal: this._imageAbort.signal,
      });
      const { response, data } = result;
      if (response.ok && data?.data?.[0]) {
        const imgs = data.data.map((img: any) => {
          if (img.b64_json) return `<img src="data:image/png;base64,${img.b64_json}" style="max-width:100%;max-height:280px;border-radius:6px;margin-bottom:4px" alt="Generated">`;
          if (img.url) return `<img src="${img.url}" style="max-width:100%;max-height:280px;border-radius:6px;margin-bottom:4px" alt="Generated">`;
          return '';
        }).filter(Boolean).join('');
        this.imageResult = imgs || 'No image data returned';
      } else {
        this.imageResult = `HTTP ${response.status}: ${data?.error?.message || result.rawText || JSON.stringify(data)}`;
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        this.imageResult = 'Generation canceled.';
      } else {
        this.imageResult = `Network error: ${e.message}`;
      }
    } finally {
      this._imageAbort = undefined;
      this.imageBusy = false;
    }
  }

  private async generateVideo() {
    const v = this.vendorById(this.videoVendorId);
    if (!v || !this.videoModelId) {
      this._log('✗ Video generation blocked: select a provider and model first.');
      return;
    }
    this.videoBusy = true;
    this.videoResult = 'Generating...';
    this.videoProgress = 0;
    this.videoProgressStatus = 'queued';
    this._videoAbort?.abort();
    this._videoAbort = new AbortController();
    try {
      const result = await videoService.generate({
        vendor: v,
        model: this.videoModelId,
        prompt: this.prompt,
        duration: parseInt(this.videoDuration) || 5,
        aspectRatio: this.videoAspectRatio || undefined,
        resolution: this.videoResolution || '480p',
        seed: this.videoSeed ? parseInt(this.videoSeed) : undefined,
        cfgScale: this.videoCfgScale ? parseFloat(this.videoCfgScale) : undefined,
        signal: this._videoAbort.signal,
        onProgress: ({ status, progress }) => {
          this.videoProgressStatus = status || 'pending';
          this.videoProgress = typeof progress === 'number' ? progress : null;
        },
      });
      const { response, data } = result;
      if (response.ok && data?.data?.[0]) {
        const clip = data.data[0];
        if (clip.video?.url || clip.url) {
          const url = clip.video?.url || clip.url;
          this.videoResult = `<video controls style="max-width:100%;max-height:280px;border-radius:6px"><source src="${url}" type="video/mp4"></video>`;
        } else {
          this.videoResult = JSON.stringify(clip);
        }
      } else {
        this.videoResult = `HTTP ${response.status}: ${data?.error?.message || result.rawText || JSON.stringify(data)}`;
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        this.videoResult = 'Generation canceled.';
      } else {
        this.videoResult = `Network error: ${e.message}`;
      }
    } finally {
      this._videoAbort = undefined;
      this.videoBusy = false;
    }
  }

  private async generateAudio() {
    const v = this.vendorById(this.audioVendorId);
    if (!v || !this.audioModelId) {
      this._log('✗ Audio generation blocked: select a provider and model first.');
      return;
    }
    this.audioBusy = true;
    this.audioResult = 'Generating...';
    this._audioAbort?.abort();
    this._audioAbort = new AbortController();
    try {
      let voice = this.audioVoice;
      for (let attempt = 0; attempt < 2; attempt++) {
        const { response, blob, errorText } = await audioService.generate({
          vendor: v,
          model: this.audioModelId,
          input: this.prompt,
          voice,
          responseFormat: this.audioResponseFormat,
          speed: parseFloat(this.audioSpeed) || 1.0,
          signal: this._audioAbort.signal,
        });
        if (response.ok && blob) {
          this.audioVoice = voice;
          const url = URL.createObjectURL(blob);
          this.audioResult = `<audio controls style="width:100%" src="${url}"></audio>`;
          break;
        }

        const availableVoices = parseAvailableVoices(errorText || '');
        const shouldRetryWithAvailableVoice =
          attempt === 0 &&
          response.status === 400 &&
          availableVoices.length > 0 &&
          !availableVoices.includes(voice);

        if (shouldRetryWithAvailableVoice) {
          voice = availableVoices[0];
          this._log(`↻ Retrying audio with supported voice "${voice}".`);
          continue;
        }

        this.audioResult = `HTTP ${response.status}: ${errorText || response.statusText}`;
        break;
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        this.audioResult = 'Generation canceled.';
      } else {
        this.audioResult = `Network error: ${e.message}`;
      }
    } finally {
      this._audioAbort = undefined;
      this.audioBusy = false;
    }
  }

  /* ── Event Handlers ─────────────────────────────────────────────── */

  private _onProviderChange(mod: ModKey, value: string) {
    const nextModelId = this.vendorModels(mod, value)[0]?.id || '';
    if (mod === 'llm') { this.textVendorId = value; this.textModelId = nextModelId; this.textResult = ''; }
    else if (mod === 'image') { this.imageVendorId = value; this.imageModelId = nextModelId; this.imageResult = ''; }
    else if (mod === 'video') { this.videoVendorId = value; this.videoModelId = nextModelId; this.videoResult = ''; }
    else {
      this.audioVendorId = value;
      this.audioModelId = nextModelId;
      this.audioResult = '';
      this.ensureAudioVoiceSelection(value, nextModelId);
    }
  }

  private _onModelChange(mod: ModKey, value: string) {
    if (mod === 'llm') this.textModelId = value;
    else if (mod === 'image') this.imageModelId = value;
    else if (mod === 'video') this.videoModelId = value;
    else {
      this.audioModelId = value;
      this.ensureAudioVoiceSelection(this.audioVendorId, value);
    }
  }

  private _onGenClick(mod: ModKey, vendorId: string, modelId: string) {
    if (mod === 'llm') {
      this.textVendorId = vendorId;
      this.textModelId = modelId;
      this.generateText();
    } else if (mod === 'image') {
      this.imageVendorId = vendorId;
      this.imageModelId = modelId;
      this.generateImage();
    } else if (mod === 'video') {
      this.videoVendorId = vendorId;
      this.videoModelId = modelId;
      this.generateVideo();
    } else {
      this.audioVendorId = vendorId;
      this.audioModelId = modelId;
      this.generateAudio();
    }
  }

  private _onCancelClick(mod: ModKey) {
    if (mod === 'llm') this._textAbort?.abort();
    else if (mod === 'image') this._imageAbort?.abort();
    else if (mod === 'video') this._videoAbort?.abort();
    else this._audioAbort?.abort();
    this._log(`⏹ ${mod.toUpperCase()} generation canceled by user.`);
  }

  private _toggleParams(mod: string) {
    if (mod === 'llm') this.textParamsOpen = !this.textParamsOpen;
    else if (mod === 'image') this.imageParamsOpen = !this.imageParamsOpen;
    else if (mod === 'video') this.videoParamsOpen = !this.videoParamsOpen;
    else this.audioParamsOpen = !this.audioParamsOpen;
  }

  private _clearLog() { this.logLines = []; }

  /* ── Templates ──────────────────────────────────────────────────── */

  render() {
    return html`
      <div class="debug-modal-body panel-content" style="flex:1;display:flex;flex-direction:column;min-height:0;overflow-y:auto;overflow-x:hidden">
        <p class="debug-info" style="flex-shrink:0">
          <i class="fa-solid fa-circle-info"></i>
          Tests each modality with the currently selected provider and model.
        </p>

        <!-- Two-column row: Prompt + Log -->
        <div class="debug-top-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:4px 16px;flex-shrink:0;min-height:0">
          <!-- Left: Prompt -->
          <div class="debug-prompt-col" style="display:flex;flex-direction:column">
            <div class="flex items-center justify-between mb-1">
              <label class="debug-prompt-label" for="debug-prompt-input" style="font-size:11px;font-weight:600;margin-bottom:0">
                <i class="fa-solid fa-pen"></i> Prompt / TTS text
              </label>
              <button
                type="button"
                class="toolbar-btn text-xs"
                style="padding:1px 6px;font-size:10px"
                @click=${this._loadRandomPrompt}
                title="Load a random prompt"
              >
                Random Prompt
              </button>
            </div>
            <textarea id="debug-prompt-input" class="cg-field debug-prompt-input" rows="4"
              placeholder="Enter a prompt for generation..."
              @input=${(e: Event) => { this.prompt = (e.target as HTMLTextAreaElement).value; }}
            >${this.prompt}</textarea>
          </div>
          <!-- Right: AI Interaction Log -->
          <div class="debug-log-col" style="display:flex;flex-direction:column">
            <div class="debug-log-header flex items-center gap-2 mb-1 cursor-pointer" @click=${() => { this.showLog = !this.showLog; }}>
              <i class="fa-solid ${this.showLog ? 'fa-chevron-down' : 'fa-chevron-right'} text-xs"></i>
              <span class="text-xs font-semibold"><i class="fa-solid fa-list mr-1"></i>AI Interaction Log (${this.logLines.length})</span>
              ${this.logLines.length > 0 ? html`<button type="button" class="toolbar-btn text-xs" @click=${this._clearLog} style="margin-left:auto;padding:1px 6px;font-size:10px">Clear</button>` : nothing}
            </div>
            ${this.showLog ? html`
              <textarea class="cg-field debug-log-textarea" readonly
                style="width:100%;flex:1;min-height:120px;font-family:monospace;font-size:11px;resize:vertical"
                .value=${this.logLines.join('\n')}
              ></textarea>
            ` : html`
              <div class="debug-log-empty text-xs" style="color:var(--text-dim);flex:1;display:flex;align-items:center;justify-content:center;border:1px dashed var(--border-dark);border-radius:4px;min-height:80px">
                Click Generate to populate the log
              </div>
            `}
          </div>
        </div>

        <!-- Multi-column output area -->
        <div class="debug-outputs-grid grid grid-cols-4 gap-4 p-4" style="flex-shrink:0">
          ${this._renderOutputColumn('llm', 'Text', 'fa-comment')}
          ${this._renderOutputColumn('image', 'Image', 'fa-image')}
          ${this._renderOutputColumn('video', 'Video', 'fa-video')}
          ${this._renderOutputColumn('audio', 'Audio', 'fa-music')}
        </div>

        <!-- Parameters Sections -->
        <div class="debug-params-section p-4" style="flex-shrink:0">
          ${this._renderTextParams()}
          ${this._renderImageParams()}
          ${this._renderVideoParams()}
          ${this._renderAudioParams()}
        </div>
      </div>
    `;
  }

  private _renderOutputColumn(mod: string, label: string, icon: string) {
    const isText = mod === 'llm';
    const isImage = mod === 'image';
    const isVideo = mod === 'video';
    const isAudio = mod === 'audio';

    const result = isText ? this.textResult : isImage ? this.imageResult : isVideo ? this.videoResult : this.audioResult;
    const busy = isText ? this.textBusy : isImage ? this.imageBusy : isVideo ? this.videoBusy : this.audioBusy;
    const vendorId = isText ? this.textVendorId : isImage ? this.imageVendorId : isVideo ? this.videoVendorId : this.audioVendorId;
    const modelId = isText ? this.textModelId : isImage ? this.imageModelId : isVideo ? this.videoModelId : this.audioModelId;

    const compatible = this.compatibleVendors(mod);
    const hasVendor = compatible.some((v) => v.id === vendorId);
    const validVendorId = hasVendor ? vendorId : (compatible[0]?.id || '');
    const models = validVendorId ? modelsForVendorAndModality(validVendorId, mod) : [];
    const validModelId = models.some((m) => m.id === modelId) ? modelId : (models[0]?.id || '');
    const genDisabled = (!validVendorId || !models.length || busy) ? true : false;
    const genBusyIcon = busy ? 'fa-circle-notch fa-spin' : icon;

    return html`
      <div class="debug-output-column flex flex-col gap-2">
        <div class="flex items-center justify-between mb-1">
          <span class="text-sm font-semibold"><i class="fa-solid ${icon} mr-1"></i>${label}</span>
          ${busy
            ? html`<button type="button" class="toolbar-btn toolbar-btn--shape-soft text-xs"
                @click=${() => this._onCancelClick(mod as ModKey)} title="Cancel generation">
                <i class="fa-solid fa-stop"></i>
              </button>`
            : html`<button type="button" class="toolbar-btn toolbar-btn--shape-soft text-xs"
                ?disabled=${genDisabled} @click=${() => this._onGenClick(mod as ModKey, validVendorId, validModelId)}>
                <i class="fa-solid ${genBusyIcon}"></i>
              </button>`}
        </div>
        ${busy ? html`
          <div class="debug-progress-wrap" style="display:flex;flex-direction:column;gap:4px">
            <span class="text-[10px]" style="color:var(--text-dim)">
              ${isVideo
                ? `Video ${this.videoProgressStatus || 'pending'}${typeof this.videoProgress === 'number' ? ` (${Math.max(0, Math.min(100, Math.round(this.videoProgress)))}%)` : ''}`
                : `Generating ${label.toLowerCase()}...`}
            </span>
            ${isVideo && typeof this.videoProgress === 'number'
              ? html`<progress aria-label="Video generation progress" max="100" .value=${Math.max(0, Math.min(100, Math.round(this.videoProgress)))} style="width:100%;height:8px"></progress>`
              : html`<progress aria-label="Generation in progress" style="width:100%;height:8px"></progress>`}
          </div>
        ` : nothing}
        <div class="debug-output-area flex-1 border rounded p-2 min-h-[200px] overflow-auto"
          style="border-color:var(--border-color, #333); background:var(--bg-base, #0a0a0a)">
          ${result ? html`<div class="debug-result">${isText ? html`<pre class="text-xs whitespace-pre-wrap">${result}</pre>` : html`${unsafeHTML(result)}`}</div>` : nothing}
          ${busy && !result ? html`<div class="flex items-center justify-center h-full text-[var(--text-dim)]"><i class="fa-solid fa-spinner fa-spin"></i> Generating...</div>` : nothing}
          ${!busy && !result ? html`<div class="flex items-center justify-center h-full text-[var(--text-dim)] text-sm">Click generate to start</div>` : nothing}
        </div>
        <select class="cg-nspopup text-xs w-full"
          @change=${(e: Event) => this._onProviderChange(mod as ModKey, (e.target as HTMLSelectElement).value)}>
          ${!compatible.length ? html`<option value="">— No providers —</option>` :
            compatible.map((v) => html`<option value="${v.id}" ?selected=${v.id === validVendorId}>${v.name}</option>`)}
        </select>
        <select class="cg-nspopup text-xs w-full"
          @change=${(e: Event) => this._onModelChange(mod as ModKey, (e.target as HTMLSelectElement).value)}>
          ${!models.length ? html`<option value="">— No models —</option>` :
            models.map((m) => html`<option value="${m.id}" ?selected=${m.id === validModelId}>${m.label}</option>`)}
        </select>
        ${isVideo ? html`
          <div class="debug-quick-params grid grid-cols-3 gap-1">
            <select class="cg-nspopup text-xs w-full" title="Duration"
              @change=${(e: Event) => { this.videoDuration = (e.target as HTMLSelectElement).value; }}>
              ${VIDEO_DURATIONS.map((d) => html`<option value="${d}" ?selected=${this.videoDuration === d}>${d}s</option>`)}
            </select>
            <select class="cg-nspopup text-xs w-full" title="Aspect ratio"
              @change=${(e: Event) => { this.videoAspectRatio = (e.target as HTMLSelectElement).value; }}>
              ${ASPECT_RATIOS.map((r) => html`<option value="${r}" ?selected=${this.videoAspectRatio === r}>${r}</option>`)}
            </select>
            <select class="cg-nspopup text-xs w-full" title="Resolution"
              @change=${(e: Event) => { this.videoResolution = (e.target as HTMLSelectElement).value; }}>
              ${VIDEO_RESOLUTIONS.map((r) => html`<option value="${r}" ?selected=${this.videoResolution === r}>${r}</option>`)}
            </select>
          </div>
        ` : nothing}
        ${isAudio ? html`
          <div class="debug-quick-params grid grid-cols-2 gap-1">
            <select class="cg-nspopup text-xs w-full" title="Voice"
              @change=${(e: Event) => { this.audioVoice = (e.target as HTMLSelectElement).value; }}>
              ${this.audioVoiceOptions(validVendorId, validModelId).map((v) => html`<option value="${v}" ?selected=${this.audioVoice === v}>${v}</option>`)}
            </select>
            <select class="cg-nspopup text-xs w-full" title="Speed"
              @change=${(e: Event) => { this.audioSpeed = (e.target as HTMLSelectElement).value; }}>
              ${AUDIO_SPEEDS.map((s) => html`<option value="${s}" ?selected=${this.audioSpeed === s}>${s}x</option>`)}
            </select>
          </div>
        ` : nothing}
      </div>
    `;
  }

  private _renderTextParams() {
    return html`
      <div class="debug-params-block mb-4">
        <div class="debug-params-header flex items-center gap-2 mb-2 cursor-pointer" @click=${() => this._toggleParams('llm')}>
          <i class="fa-solid ${this.textParamsOpen ? 'fa-chevron-down' : 'fa-chevron-right'} text-xs"></i>
          <span class="text-sm font-semibold"><i class="fa-solid fa-comment mr-1"></i>Text Parameters</span>
        </div>
        ${this.textParamsOpen ? html`
          <div class="grid grid-cols-2 gap-2 ml-4">
            <div class="flex flex-col gap-1">
              <label class="text-xs">Max Tokens</label>
              <input class="cg-field text-xs" type="number" min="1" max="32768" .value=${this.textMaxTokens}
                @change=${(e: Event) => { this.textMaxTokens = (e.target as HTMLInputElement).value; }}>
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs">Temperature</label>
              <input class="cg-field text-xs" type="number" min="0" max="2" step="0.1" .value=${this.textTemperature}
                @change=${(e: Event) => { this.textTemperature = (e.target as HTMLInputElement).value; }}>
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs">Top P</label>
              <input class="cg-field text-xs" type="number" min="0" max="1" step="0.01" .value=${this.textTopP}
                @change=${(e: Event) => { this.textTopP = (e.target as HTMLInputElement).value; }}>
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs">Frequency Penalty</label>
              <input class="cg-field text-xs" type="number" min="0" max="2" step="0.1" .value=${this.textFrequencyPenalty}
                @change=${(e: Event) => { this.textFrequencyPenalty = (e.target as HTMLInputElement).value; }}>
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs">Presence Penalty</label>
              <input class="cg-field text-xs" type="number" min="0" max="2" step="0.1" .value=${this.textPresencePenalty}
                @change=${(e: Event) => { this.textPresencePenalty = (e.target as HTMLInputElement).value; }}>
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs">Stop Sequences</label>
              <input class="cg-field text-xs" type="text" .value=${this.textStopSequences}
                @change=${(e: Event) => { this.textStopSequences = (e.target as HTMLInputElement).value; }}
                placeholder="comma,separated">
            </div>
          </div>
        ` : nothing}
      </div>
    `;
  }

  private _renderImageParams() {
    return html`
      <div class="debug-params-block mb-4">
        <div class="debug-params-header flex items-center gap-2 mb-2 cursor-pointer" @click=${() => this._toggleParams('image')}>
          <i class="fa-solid ${this.imageParamsOpen ? 'fa-chevron-down' : 'fa-chevron-right'} text-xs"></i>
          <span class="text-sm font-semibold"><i class="fa-solid fa-image mr-1"></i>Image Parameters</span>
        </div>
        ${this.imageParamsOpen ? html`
          <div class="grid grid-cols-3 gap-2 ml-4">
            <div class="flex flex-col gap-1">
              <label class="text-xs">Count</label>
              <input class="cg-field text-xs" type="number" min="1" max="10" .value=${this.imageCount}
                @change=${(e: Event) => { this.imageCount = (e.target as HTMLInputElement).value; }}>
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs">Size</label>
              <select class="cg-nspopup text-xs" .value=${this.imageSize}
                @change=${(e: Event) => { this.imageSize = (e.target as HTMLSelectElement).value; }}>
                ${SIZES.map((s) => html`<option value="${s}" ?selected=${this.imageSize === s}>${s}</option>`)}
              </select>
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs">Quality</label>
              <select class="cg-nspopup text-xs" .value=${this.imageQuality}
                @change=${(e: Event) => { this.imageQuality = (e.target as HTMLSelectElement).value; }}>
                ${QUALITY_OPTIONS.map((q) => html`<option value="${q}" ?selected=${this.imageQuality === q}>${q}</option>`)}
              </select>
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs">Style</label>
              <select class="cg-nspopup text-xs" .value=${this.imageStyle}
                @change=${(e: Event) => { this.imageStyle = (e.target as HTMLSelectElement).value; }}>
                ${STYLE_OPTIONS.map((s) => html`<option value="${s}" ?selected=${this.imageStyle === s}>${s}</option>`)}
              </select>
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs">Seed</label>
              <input class="cg-field text-xs" type="number" min="0" max="4294967295" .value=${this.imageSeed}
                @change=${(e: Event) => { this.imageSeed = (e.target as HTMLInputElement).value; }}>
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs">Steps</label>
              <input class="cg-field text-xs" type="number" min="1" max="150" .value=${this.imageSteps}
                @change=${(e: Event) => { this.imageSteps = (e.target as HTMLInputElement).value; }}>
            </div>
            <div class="flex flex-col gap-1 col-span-2">
              <label class="text-xs">Negative Prompt</label>
              <input class="cg-field text-xs" type="text" .value=${this.imageNegativePrompt}
                @change=${(e: Event) => { this.imageNegativePrompt = (e.target as HTMLInputElement).value; }}
                placeholder="What to avoid...">
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs">CFG Scale</label>
              <input class="cg-field text-xs" type="number" min="0" max="20" step="0.5" .value=${this.imageCfgScale}
                @change=${(e: Event) => { this.imageCfgScale = (e.target as HTMLInputElement).value; }}>
            </div>
          </div>
        ` : nothing}
      </div>
    `;
  }

  private _renderVideoParams() {
    return html`
      <div class="debug-params-block mb-4">
        <div class="debug-params-header flex items-center gap-2 mb-2 cursor-pointer" @click=${() => this._toggleParams('video')}>
          <i class="fa-solid ${this.videoParamsOpen ? 'fa-chevron-down' : 'fa-chevron-right'} text-xs"></i>
          <span class="text-sm font-semibold"><i class="fa-solid fa-video mr-1"></i>Video Parameters</span>
        </div>
        ${this.videoParamsOpen ? html`
          <div class="grid grid-cols-2 gap-2 ml-4">
            <div class="flex flex-col gap-1">
              <label class="text-xs">Duration (seconds)</label>
              <input class="cg-field text-xs" type="number" min="2" max="60" .value=${this.videoDuration}
                @change=${(e: Event) => { this.videoDuration = (e.target as HTMLInputElement).value; }}>
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs">Aspect Ratio</label>
              <select class="cg-nspopup text-xs" .value=${this.videoAspectRatio}
                @change=${(e: Event) => { this.videoAspectRatio = (e.target as HTMLSelectElement).value; }}>
                ${ASPECT_RATIOS.map((r) => html`<option value="${r}" ?selected=${this.videoAspectRatio === r}>${r}</option>`)}
              </select>
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs">Seed</label>
              <input class="cg-field text-xs" type="number" min="0" max="4294967295" .value=${this.videoSeed}
                @change=${(e: Event) => { this.videoSeed = (e.target as HTMLInputElement).value; }}>
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs">CFG Scale</label>
              <input class="cg-field text-xs" type="number" min="0" max="10" step="0.1" .value=${this.videoCfgScale}
                @change=${(e: Event) => { this.videoCfgScale = (e.target as HTMLInputElement).value; }}>
            </div>
          </div>
        ` : nothing}
      </div>
    `;
  }

  private _renderAudioParams() {
    const voiceOptions = this.audioVoiceOptions(this.audioVendorId, this.audioModelId);
    return html`
      <div class="debug-params-block mb-4">
        <div class="debug-params-header flex items-center gap-2 mb-2 cursor-pointer" @click=${() => this._toggleParams('audio')}>
          <i class="fa-solid ${this.audioParamsOpen ? 'fa-chevron-down' : 'fa-chevron-right'} text-xs"></i>
          <span class="text-sm font-semibold"><i class="fa-solid fa-music mr-1"></i>Audio Parameters</span>
        </div>
        ${this.audioParamsOpen ? html`
          <div class="grid grid-cols-2 gap-2 ml-4">
            <div class="flex flex-col gap-1">
              <label class="text-xs">Voice</label>
              <select class="cg-nspopup text-xs" .value=${this.audioVoice}
                @change=${(e: Event) => { this.audioVoice = (e.target as HTMLSelectElement).value; }}>
                ${voiceOptions.map((v) => html`<option value="${v}" ?selected=${this.audioVoice === v}>${v}</option>`)}
              </select>
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs">Speed</label>
              <input class="cg-field text-xs" type="number" min="0.25" max="4" step="0.25" .value=${this.audioSpeed}
                @change=${(e: Event) => { this.audioSpeed = (e.target as HTMLInputElement).value; }}>
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs">Response Format</label>
              <select class="cg-nspopup text-xs" .value=${this.audioResponseFormat}
                @change=${(e: Event) => { this.audioResponseFormat = (e.target as HTMLSelectElement).value; }}>
                ${RESPONSE_FORMATS.map((f) => html`<option value="${f}" ?selected=${this.audioResponseFormat === f}>${f}</option>`)}
              </select>
            </div>
          </div>
        ` : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cinegen-debug-modal-body': CinegenDebugModalBody;
  }
}