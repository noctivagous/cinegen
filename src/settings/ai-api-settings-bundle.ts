/**
 * aiApiSettings.js — App-wide AI routing and model catalog.
 *
 * Modalities: llm | image | video | audio
 * Providers: openai-compatible | anthropic-messages-api | google-gemini-api |
 *            elevenlabs-api | fal-ai | replicate-api | runway-api | luma-api |
 *            generic-rest
 *
 * ── CRITICAL NOTE ──
 * AI routing settings contain vendor/provider selections that reveal which
 * external services the app is configured to use. In a collaborative deployment
 * these MUST be persisted server-side via the dedicated /api/settings/routing
 * endpoint. The storageService calls here are server-backed; do NOT add direct
 * browser local persistence APIs (localStorage/sessionStorage/IndexedDB).
 * ───────────────────
 */

import { AI_API_SETTINGS_STORAGE_KEY } from '@/constants/storage-keys';
import { registerModal } from '@/services/modal-manager';
import { AI_API_PROVIDERS } from '@/data/provider-catalog';
import { storageService } from '@/services/persistence';
import {
  mergeRoutingModelOptions,
  listProvidersWithKeyForModality,
  ensureRoutingModelDefaults,
  getCachedVoicesForVendorAudioModel,
} from '@/services/provider-model-catalog';
import { closeAllToolbarSplitMenus } from '@/services/toolbar-split-service';
import { refreshAllProviderCatalogsOnLoad } from '@/services/provider-catalog-refresh';
import {
  _apiKeysDraftReset,
  apiKeysListCredentialCandidates,
  getDraft,
  initServerKeyStore,
  populateApiKeysForm,
  refreshAiApiModalityGating,
  saveApiKeysModalInternal,
} from '@/settings/api-keys-settings-bundle';
import { closeAiAssistModal, closeGuideModal } from '@/toolbar/toolbar-modals-service';
import {
  closeProjectSettingsModal,
  closeProjectsModal,
  closeSettingsModal,
} from '@/toolbar/toolbar-project-modals-service';

declare global {
  function populateAiApiCredentialSelects(): void;
  function updateModelStatusIndicators(): void;
  function getModelsForProviderModality(providerId: string, modalityKey: string): Array<{ id: string; label: string }>;
  function formatCapsText(caps: any): string;
}

function _el(id: string): any {
  return document.getElementById(id);
}

const AI_API_STORAGE_KEY = AI_API_SETTINGS_STORAGE_KEY;

/* ── Modalities ──────────────────────────────────────────────────────────── */

const AI_API_MODALITIES = [
  { key: 'llm',   label: 'Language (LLM)',               icon: 'fa-solid fa-comments' },
  { key: 'image', label: 'Image',                        icon: 'fa-solid fa-image' },
  { key: 'video', label: 'Video',                        icon: 'fa-solid fa-film' },
  { key: 'audio', label: 'Audio (TTS · Music · SFX)',    icon: 'fa-solid fa-headphones' }
];

/* ── Providers ───────────────────────────────────────────────────────────── */

/* AI_API_PROVIDERS is now imported from @/data/provider-catalog */

/* ── Model catalog ───────────────────────────────────────────────────────── */
/*
 * Capabilities are UI hints for display; confirm exact limits with each API.
 * Video models: maxDurationSec, resolutions, aspects, fps, notes
 * Image models: maxSidePx, aspects, notes
 * LLM models: maxOutputTokens, notes
 * Audio models: types (tts | sfx | music | voice-clone), notes
 */

export const AI_API_MODEL_CATALOG = {

  'openai-compatible': {
    llm: [
      { id: 'gpt-4.1',       label: 'GPT-4.1',           caps: { maxOutputTokens: 32768 } },
      { id: 'gpt-4.1-mini',  label: 'GPT-4.1 mini',      caps: { maxOutputTokens: 16384 } },
      { id: 'gpt-4o',        label: 'GPT-4o',             caps: { maxOutputTokens: 16384 } },
      { id: 'gpt-4o-mini',   label: 'GPT-4o mini',        caps: { maxOutputTokens: 16384 } },
      { id: 'o3-mini',       label: 'o3-mini (reasoning)', caps: { maxOutputTokens: 65536, notes: 'Chain-of-thought reasoning model.' } },
      { id: 'grok-3',        label: 'Grok-3 (xAI)',       caps: { maxOutputTokens: 131072, notes: 'Set base URL to https://api.x.ai/v1' } },
      { id: 'custom-llm',    label: 'Custom model id',    caps: { notes: 'Set base URL and model id for your endpoint.' } }
    ],
    image: [
      { id: 'gpt-image-2', label: 'GPT Image 2 (gpt-image-2)', caps: { maxSidePx: 2048, aspects: ['1:1', '16:9', '9:16'], notes: 'Best prompt accuracy and text rendering.' } },
      { id: 'dall-e-3',    label: 'DALL·E 3',                  caps: { maxSidePx: 1792, aspects: ['1:1', '16:9', '9:16'] } }
    ],
    video: [],
    audio: [
      { id: 'tts-1',                 label: 'TTS-1 (standard)',         caps: { types: ['tts'], notes: 'Low latency, 6 voices.' } },
      { id: 'tts-1-hd',              label: 'TTS-1 HD (high quality)',  caps: { types: ['tts'], notes: 'Higher quality, slightly slower.' } },
    ]
  },

  'anthropic-messages-api': {
    llm: [
      { id: 'claude-opus-4-5',           label: 'Claude Opus 4.5',       caps: { maxOutputTokens: 32768, notes: 'Most capable, slowest.' } },
      { id: 'claude-sonnet-4-5',         label: 'Claude Sonnet 4.5',     caps: { maxOutputTokens: 16384 } },
      { id: 'claude-haiku-4-5',          label: 'Claude Haiku 4.5',      caps: { maxOutputTokens: 8192,  notes: 'Fastest, lowest cost.' } },
      { id: 'claude-3-5-sonnet-latest',  label: 'Claude 3.5 Sonnet',     caps: { maxOutputTokens: 8192 } },
      { id: 'claude-3-5-haiku-latest',   label: 'Claude 3.5 Haiku',      caps: { maxOutputTokens: 8192 } }
    ],
    image: [],
    video: [],
    audio: []
  },

  'google-gemini-api': {
    llm: [
      { id: 'gemini-2.5-pro-preview',  label: 'Gemini 2.5 Pro (preview)', caps: { maxOutputTokens: 65536 } },
      { id: 'gemini-2.5-flash',        label: 'Gemini 2.5 Flash',         caps: { maxOutputTokens: 65536 } },
      { id: 'gemini-2.0-flash',        label: 'Gemini 2.0 Flash',         caps: { maxOutputTokens: 8192 } },
      { id: 'gemini-2.0-flash-lite',   label: 'Gemini 2.0 Flash-Lite',    caps: { maxOutputTokens: 8192,  notes: 'Lowest cost Gemini option.' } }
    ],
    image: [
      { id: 'imagen-4-generate',  label: 'Imagen 4',        caps: { maxSidePx: 2048, aspects: ['1:1', '16:9', '4:3'], notes: 'Via Google AI or Vertex AI.' } },
      { id: 'imagen-3-generate',  label: 'Imagen 3',        caps: { maxSidePx: 1536, aspects: ['1:1', '16:9'] } }
    ],
    video: [
      { id: 'veo-3.1-generate',  label: 'Veo 3.1 (Google)',  caps: { maxDurationSec: 60,  resolutions: ['1080p', '4K'], aspects: ['16:9', '9:16'], fps: [24], notes: 'Best overall quality. Via Vertex AI or Gemini API (restricted preview).' } },
      { id: 'veo-2.0-generate',  label: 'Veo 2.0 (Google)',  caps: { maxDurationSec: 8,   resolutions: ['720p', '1080p'], aspects: ['16:9'], fps: [24] } }
    ],
    audio: [
      { id: 'gemini-tts-pro', label: 'Gemini TTS Pro', caps: { types: ['tts'], notes: 'Native in LTX, fast contextual integration.' } },
      { id: 'lyria-generate', label: 'Lyria (music, experimental)', caps: { types: ['music'], notes: 'Via Vertex AI / Google DeepMind. Preview access.' } }
    ]
  },

  'elevenlabs-api': {
    llm:   [],
    image: [],
    video: [],
    audio: [
      { id: 'eleven_v3',               label: 'Eleven v3 (TTS primary)',          caps: { types: ['tts'], notes: 'Ultra-realistic, emotional prosody, voice cloning, multilingual dubbing.' } },
      { id: 'eleven_flash_v2_5',       label: 'Flash v2.5 (TTS, low latency)',   caps: { types: ['tts'], notes: 'Fastest generation, ideal for real-time.' } },
      { id: 'eleven_multilingual_v2',  label: 'Multilingual v2 (TTS, high quality)', caps: { types: ['tts'], notes: '29 languages, highest quality voice output.' } },
      { id: 'eleven_turbo_v2_5',       label: 'Turbo v2.5 (TTS, balanced)',      caps: { types: ['tts'], notes: 'Speed/quality balance for streaming.' } },
      { id: 'text-to-sound-effects-v2',label: 'Sound Effects v2 (SFX)',          caps: { types: ['sfx'], notes: 'Top text-to-SFX, high-fidelity, cinematic, royalty-free.' } },
      { id: 'eleven-music-v1',         label: 'Music (ElevenLabs)',               caps: { types: ['music'], notes: 'Seamless integration with voices & SFX.' } }
    ]
  },

  'fal-ai': {
    llm:   [],
    image: [
      { id: 'fal-ai/flux-pro/v1.1',            label: 'FLUX 1.1 Pro',                   caps: { maxSidePx: 2048, aspects: ['1:1', '16:9', '9:16', '4:3'], notes: 'Best photorealism on fal.ai.' } },
      { id: 'fal-ai/flux/dev',                 label: 'FLUX.1 Dev',                     caps: { maxSidePx: 1024, notes: 'Open-weight dev model.' } },
      { id: 'fal-ai/flux/schnell',             label: 'FLUX.1 Schnell (fast)',           caps: { maxSidePx: 1024, notes: 'Fastest FLUX variant.' } },
      { id: 'fal-ai/stable-diffusion-3.5-large', label: 'Stable Diffusion 3.5 Large',   caps: { maxSidePx: 1024 } },
      { id: 'fal-ai/ideogram/v3',              label: 'Ideogram v3',                    caps: { notes: 'Best for text rendering in images.' } },
      { id: 'fal-ai/recraft-v3',               label: 'Recraft V3',                     caps: { notes: 'SVG and style-consistent design work.' } }
    ],
    video: [
      { id: 'fal-ai/kling-video/v2.6/standard/text-to-video', label: 'Kling 2.6 (text-to-video)', caps: { maxDurationSec: 120, resolutions: ['720p', '1080p'], aspects: ['16:9', '9:16', '1:1'], fps: [24, 30], notes: 'Longest clips in class (up to 2 min). ByteDance / Kuaishou.' } },
      { id: 'fal-ai/kling-video/v1.6/standard/text-to-video', label: 'Kling 1.6 (text-to-video)', caps: { maxDurationSec: 30, resolutions: ['720p'], aspects: ['16:9'] } },
      { id: 'fal-ai/minimax/video-01',                        label: 'Minimax / Hailuo Video-01',  caps: { maxDurationSec: 6,   resolutions: ['720p'], aspects: ['16:9'], notes: 'Strong motion quality.' } },
      { id: 'fal-ai/wan/t2v-1.3b',                           label: 'WAN T2V 1.3B (fast)',        caps: { maxDurationSec: 5,   resolutions: ['480p', '720p'], aspects: ['16:9'], fps: [16] } }
    ],
    audio: []
  },

  'replicate-api': {
    llm: [
      { id: 'meta/meta-llama-3.3-70b-instruct', label: 'Llama 3.3 70B Instruct', caps: { maxOutputTokens: 8192 } },
      { id: 'custom-llm', label: 'Custom model (owner/name)',  caps: { notes: 'Use owner/model:version format.' } }
    ],
    image: [
      { id: 'black-forest-labs/flux-1.1-pro', label: 'FLUX 1.1 Pro (BFL)',  caps: { maxSidePx: 2048 } },
      { id: 'stability-ai/sdxl',              label: 'Stable Diffusion XL', caps: {} },
      { id: 'custom-image',                   label: 'Custom model (owner/name)', caps: {} }
    ],
    video: [
      { id: 'custom-video', label: 'Custom model (owner/name)', caps: { notes: 'Use owner/model:version format.' } }
    ],
    audio: [
      { id: 'suno-ai/bark',  label: 'Bark (TTS / expressive)',  caps: { types: ['tts'], notes: 'Expressive multilingual TTS.' } },
      { id: 'custom-audio',  label: 'Custom model (owner/name)', caps: {} }
    ]
  },

  'runway-api': {
    llm:   [],
    image: [],
    video: [
      { id: 'gen4_5_turbo', label: 'Gen-4.5 Turbo',  caps: { maxDurationSec: 10, resolutions: ['720p', '1080p'], aspects: ['16:9', '9:16', '1:1'], fps: [24], notes: 'Fastest Gen-4.5. #1 benchmark 2026.' } },
      { id: 'gen4_5',       label: 'Gen-4.5',         caps: { maxDurationSec: 16, resolutions: ['720p', '1080p'], aspects: ['16:9', '9:16', '1:1'], fps: [24], notes: 'Full quality, motion brushes, scene consistency.' } },
      { id: 'gen3_alpha',   label: 'Gen-3 Alpha',     caps: { maxDurationSec: 10, resolutions: ['720p'], aspects: ['16:9'] } }
    ],
    audio: []
  },

  'luma-api': {
    llm:   [],
    image: [
      { id: 'photon-1',       label: 'Photon-1 (image)',       caps: { notes: 'Luma image generation model.' } },
      { id: 'photon-flash-1', label: 'Photon Flash-1 (fast)',  caps: {} }
    ],
    video: [
      { id: 'ray-3',       label: 'Ray 3 (Dream Machine)',    caps: { maxDurationSec: 10, resolutions: ['720p', '1080p'], aspects: ['16:9', '9:16', '1:1'], fps: [24], notes: 'Strong atmospheric motion and mood. Image-to-video excels.' } },
      { id: 'ray-3-fast',  label: 'Ray 3 Fast',              caps: { maxDurationSec: 10, resolutions: ['720p'], aspects: ['16:9'] } },
      { id: 'ray-2',       label: 'Ray 2',                   caps: { maxDurationSec: 8,  resolutions: ['720p'], aspects: ['16:9'] } }
    ],
    audio: []
  },

  'murf-api': {
    llm: [], image: [], video: [],
    audio: [
      { id: 'murf-studio-tts', label: 'Studio TTS (primary)', caps: { types: ['tts'], notes: 'Studio-quality, script-friendly production.' } },
      { id: 'murf-voice-clone', label: 'Voice Cloning', caps: { types: ['tts'], notes: 'Custom voice cloning.' } }
    ]
  },

  'wellsaid-api': {
    llm: [], image: [], video: [],
    audio: [
      { id: 'wellsaid-enterprise', label: 'Enterprise TTS', caps: { types: ['tts'], notes: 'Enterprise-licensed voices, great consistency.' } }
    ]
  },

  'suno-api': {
    llm: [], image: [], video: [],
    audio: [
      { id: 'suno-v5', label: 'Suno v5', caps: { types: ['music'], notes: 'Best overall for full songs, vocals, emotional tracks from script cues.' } }
    ]
  },

  'udio-api': {
    llm: [], image: [], video: [],
    audio: [
      { id: 'udio-v2', label: 'Udio', caps: { types: ['music'], notes: 'Superior control, remixing, stems, precise scene fitting.' } }
    ]
  },

  'minimax-api': {
    llm: [], image: [], video: [],
    audio: [
      { id: 'minimax-music-2', label: 'Music-2', caps: { types: ['music'], notes: 'Strong cinematic/ambient.' } }
    ]
  },

  'moss-api': {
    llm: [], image: [], video: [],
    audio: [
      { id: 'moss-tts', label: 'MOSS-TTS', caps: { types: ['tts'], notes: 'High-fidelity cloning & long-form dialogue (open/local).' } },
      { id: 'moss-sfx', label: 'MOSS-SoundEffect', caps: { types: ['sfx'], notes: 'Controllable duration & broad categories.' } }
    ]
  },

  'stability-audio': {
    llm: [], image: [], video: [],
    audio: [
      { id: 'stable-audio-2', label: 'Stable Audio 2', caps: { types: ['sfx', 'music'], notes: 'Atmospheric & Foley support.' } }
    ]
  },

  'seedance-api': {
    llm: [], image: [], video: [],
    audio: [
      { id: 'seedance-2', label: 'Seedance 2.0', caps: { types: ['tts', 'sfx', 'music'], notes: 'Unified audio + video gen (dialogue, SFX, music).' } }
    ]
  },

  'generic-rest': {
    llm:   [{ id: 'custom-llm',   label: 'Custom model id', caps: { notes: 'You supply endpoint + schema.' } }],
    image: [{ id: 'custom-image', label: 'Custom model id', caps: { notes: 'You supply endpoint + schema.' } }],
    video: [{ id: 'custom-video', label: 'Custom model id', caps: { maxDurationSec: 10, resolutions: ['480p', '720p', '1080p'], aspects: ['16:9', '9:16', '1:1'], fps: [24, 30], notes: 'Declare limits matching your server.' } }],
    audio: [{ id: 'custom-audio', label: 'Custom model id', caps: { types: ['tts', 'sfx', 'music'], notes: 'You supply endpoint + schema.' } }]
  }
};

/* ── Default settings ────────────────────────────────────────────────────── */

const AI_API_DEFAULT_SETTINGS = {
  modalities: {
    llm:   { provider: 'openai-compatible',  model: '', fallbackModel: '', baseUrl: '', vendorId: '', modelLabel: '' },
    image: { provider: 'openai-compatible',  model: '', fallbackModel: '', baseUrl: '', vendorId: '', modelLabel: '' },
    video: { provider: 'generic-rest',       model: '', fallbackModel: '', baseUrl: '', vendorId: '', modelLabel: '' },
    audio: { provider: 'elevenlabs-api',     model: '', fallbackModel: '', baseUrl: '', vendorId: '', modelLabel: '', voice: '' }
  },
  requests: { timeoutSeconds: 120, maxRetries: 2, maxConcurrency: 4 },
  diagnostics: { logLevel: 'off' }
};

/* ── Server key badge + hint ─────────────────────────────────────────────── */

function applyServerKeysBadge() {
  const badge = _el('server-keys-badge');
  if (!badge) return;
  badge.className = 'status-mode-badge status-mode-badge--secured';
  badge.innerHTML = '<i class="fa-solid fa-server" aria-hidden="true"></i> SERVER KEYS';
  badge.title = 'Keys are managed by backend env files — click to configure';
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function getModelsForProviderModality(providerId: any, modalityKey: any) {
  const catalog = AI_API_MODEL_CATALOG as Record<string, any>;
  const prov = catalog[providerId];
  if (!prov) return [{ id: 'custom', label: 'Custom model id', caps: {} }];
  const list = prov[modalityKey];
  return Array.isArray(list) && list.length ? list : [{ id: 'custom', label: 'Custom model id', caps: {} }];
}

function getModelEntry(providerId: any, modalityKey: any, modelId: any) {
  return getModelsForProviderModality(providerId, modalityKey).find((m) => m.id === modelId) || null;
}

/** User-facing model name — never returns generic "Custom model id" placeholders. */
function labelFromModelSelect(selectEl: any, modelId: any) {
  if (!selectEl || !modelId) return '';
  const opt = [...selectEl.options].find((o) => o.value === modelId);
  return opt?.textContent?.trim() || '';
}

export function getAiApiModelDisplayLabel(providerId: any, modalityKey: any, modelId: any, storedLabel: any) {
  const saved = typeof storedLabel === 'string' ? storedLabel.trim() : '';
  if (saved && !/^custom(\b|[-_])/i.test(saved) && saved.toLowerCase() !== 'custom model id') {
    return saved;
  }
  if (!modelId) return '';
  const entry = getModelEntry(providerId, modalityKey, modelId);
  if (entry?.label && !/^custom(\b|[-_])/i.test(entry.label) && entry.label.toLowerCase() !== 'custom model id') {
    return entry.label;
  }
  if (/^custom(-|$)/i.test(modelId) || modelId === 'custom') return '';
  const tail = modelId.includes('/') ? modelId.split('/').pop() : modelId;
  return tail
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatCapsText(caps: any) {
  if (!caps || typeof caps !== 'object') return '—';
  const p = [];
  if (caps.maxDurationSec != null) p.push(`max ~${caps.maxDurationSec}s`);
  if (Array.isArray(caps.resolutions) && caps.resolutions.length) p.push(`res: ${caps.resolutions.join(', ')}`);
  if (Array.isArray(caps.aspects) && caps.aspects.length) p.push(`aspect: ${caps.aspects.join(', ')}`);
  if (Array.isArray(caps.fps) && caps.fps.length) p.push(`fps: ${caps.fps.join(', ')}`);
  if (caps.maxSidePx != null) p.push(`max side ~${caps.maxSidePx}px`);
  if (caps.maxOutputTokens != null) p.push(`max tokens ~${caps.maxOutputTokens}`);
  if (Array.isArray(caps.types) && caps.types.length) p.push(`supports: ${caps.types.join(' · ')}`);
  if (caps.notes) p.push(caps.notes);
  return p.length ? p.join(' · ') : 'No preset limits — verify with provider.';
}

function fillSelect(selectEl: any, options: any, selectedId: any, includeEmpty: any, emptyLabel?: any) {
  if (!selectEl) return;
  selectEl.replaceChildren();
  if (includeEmpty) {
    const o = document.createElement('option');
    o.value = ''; o.textContent = emptyLabel || 'None';
    selectEl.appendChild(o);
  }
  options.forEach((opt: any) => {
    const o = document.createElement('option');
    o.value = opt.id; o.textContent = opt.label;
    selectEl.appendChild(o);
  });
  const exists = [...selectEl.options].some((x) => x.value === selectedId);
  selectEl.value = exists ? selectedId : (selectEl.options[0]?.value || '');
}

/* ── Settings persistence ────────────────────────────────────────────────── */

function mergeAiApiSettings(raw: any) {
  const base = JSON.parse(JSON.stringify(AI_API_DEFAULT_SETTINGS));
  if (!raw || typeof raw !== 'object') return base;
  const m = { ...base, ...raw };
  m.modalities = { ...base.modalities, ...(raw.modalities || {}) };
  ['llm', 'image', 'video', 'audio'].forEach((k) => {
    m.modalities[k] = { ...base.modalities[k], ...(raw.modalities?.[k] || {}) };
    if (typeof m.modalities[k].vendorId !== 'string') m.modalities[k].vendorId = '';
    if (typeof m.modalities[k].modelLabel !== 'string') m.modalities[k].modelLabel = '';
    if (k === 'audio' && typeof m.modalities[k].voice !== 'string') m.modalities[k].voice = '';
  });
  m.requests    = { ...base.requests,    ...(raw.requests    || {}) };
  m.diagnostics = { ...base.diagnostics, ...(raw.diagnostics || {}) };
  const allowProv = new Set(AI_API_PROVIDERS.map((p) => p.id));
  ['llm', 'image', 'video', 'audio'].forEach((k) => {
    if (!allowProv.has(m.modalities[k].provider)) m.modalities[k].provider = base.modalities[k].provider;
    const prov   = m.modalities[k].provider;
    const models = getModelsForProviderModality(prov, k);
    const ids    = new Set(models.map((x) => x.id));
    if (m.modalities[k].fallbackModel && !ids.has(m.modalities[k].fallbackModel)) m.modalities[k].fallbackModel = '';
    if (m.modalities[k].fallbackModel === m.modalities[k].model) m.modalities[k].fallbackModel = '';
  });
  sanitizeAiApiVendorIdsInModalities(m);
  return m;
}

function sanitizeAiApiVendorIdsInModalities(m: any) {
  ['llm', 'image', 'video', 'audio'].forEach((k) => {
    const prov = m.modalities[k].provider;
    const opts: Array<{ id: string; name?: string }> = apiKeysListCredentialCandidates(prov, k) || [];
    let vid = typeof m.modalities[k].vendorId === 'string' ? m.modalities[k].vendorId : '';
    if (!opts.some((o) => o.id === vid)) vid = opts.length === 1 ? opts[0].id : '';
    m.modalities[k].vendorId = vid;
  });
}

/* ── Cached server fetch for loadAiApiSettings ────────────────────────────── */
let _routingServerCache: string | null = null;
let _routingCacheTime = 0;
const ROUTING_CACHE_TTL = 5000; // 5 seconds

function _fetchRoutingFromServer(): string | null {
  const now = Date.now();
  if (_routingServerCache && now - _routingCacheTime < ROUTING_CACHE_TTL) {
    return _routingServerCache;
  }
  try {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/settings/routing', false);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.send();
    if (xhr.status === 200) {
      _routingServerCache = xhr.responseText;
      _routingCacheTime = now;
      return _routingServerCache;
    }
  } catch { /* server unavailable */ }
  _routingServerCache = null;
  return null;
}

export function loadAiApiSettings() {
  const serverRaw = _fetchRoutingFromServer();

  const localRaw = storageService.getItem(AI_API_STORAGE_KEY);

  // Merge: server data wins at the field level within each modality,
  // storageService cache fills any missing modalities
  let merged;
  if (serverRaw && localRaw) {
    const local = JSON.parse(localRaw);
    const server = JSON.parse(serverRaw);
    // Deep merge: for each modality, server fields override local fields
    merged = mergeAiApiSettings({
      ...local,
      modalities: {
        ...local.modalities,
        ...Object.fromEntries(
          Object.entries(server.modalities || {}).map(([k, v]) => [
            k,
            { ...((local.modalities as any)?.[k] || {}), ...(v as any) },
          ])
        ),
      },
    });
  } else {
    merged = mergeAiApiSettings(serverRaw ? JSON.parse(serverRaw) : (localRaw ? JSON.parse(localRaw) : null));
  }

  // Cache merged result locally
  try { storageService.setItem(AI_API_STORAGE_KEY, JSON.stringify(merged)); } catch { /* noop */ }

  let repaired = false;
  ['llm', 'image', 'video', 'audio'].forEach((k) => {
    if (!merged.modalities[k]) {
      merged.modalities[k] = { provider: '', model: '', modelLabel: '', vendorId: '', baseUrl: '' };
      repaired = true;
    } else {
      const m = merged.modalities[k];
      if (typeof m.vendorId !== 'string') { m.vendorId = ''; repaired = true; }
      if (typeof m.baseUrl !== 'string') { m.baseUrl = ''; repaired = true; }
    }
  });
  if (repaired) {
    try { storageService.setItem(AI_API_STORAGE_KEY, JSON.stringify(merged)); }
    catch (e) { /* ok */ }
  }
  return merged;
}

export function saveAiApiSettings(next: any) {
  const merged = mergeAiApiSettings(next);
  const mergedStr = JSON.stringify(merged);
  // Keep in-memory routing cache hot with the latest local mutation so
  // status-bar reads reflect provider/model changes immediately.
  _routingServerCache = mergedStr;
  _routingCacheTime = Date.now();
  try { storageService.setItem(AI_API_STORAGE_KEY, JSON.stringify(merged)); }
  catch (e) { console.warn('CineGen: failed to persist AI API settings.', e); }
  // Sync to server (fire-and-forget)
  try {
    fetch('/api/settings/routing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: mergedStr,
    }).catch(() => { /* server unavailable */ });
  } catch { /* noop */ }
  return merged;
}

export async function clearAiApiRouting() {
  _routingServerCache = null;
  _routingCacheTime = 0;
  try { storageService.removeItem(AI_API_STORAGE_KEY); } catch { /* noop */ }
  try {
    await fetch('/api/settings/routing', { method: 'DELETE' });
  } catch { /* server unavailable */ }
}

/* ── Form population ─────────────────────────────────────────────────────── */

export function populateAiApiCredentialSelects() {
  const s = loadAiApiSettings();
  AI_API_MODALITIES.forEach(({ key }) => {
    const sel     = _el(`ai-api-credential-${key}`);
    const provSel = _el(`ai-api-provider-${key}`);
    if (!sel || !provSel) return;
    const providerId = provSel.value;
    const vendors = apiKeysListCredentialCandidates(providerId, key);
    sel.replaceChildren();
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = vendors.length ? 'Select credential…' : 'No providers with key for this modality';
    sel.appendChild(empty);
    vendors.forEach((v: any) => {
      const o = document.createElement('option');
      o.value = v.id; o.textContent = v.name || v.id;
      sel.appendChild(o);
    });
    const want   = s.modalities[key].vendorId || '';
    const exists = [...sel.options].some((x) => x.value === want);
    sel.value = exists ? want : '';
  });
}

export function refreshModalityModelOptions(modalityKey: any, settings: any) {
  const provSel  = _el(`ai-api-provider-${modalityKey}`);
  const modelSel = _el(`ai-api-model-${modalityKey}`);
  const fbSel    = _el(`ai-api-fallback-${modalityKey}`);
  const credSel  = _el(`ai-api-credential-${modalityKey}`);
  if (!provSel || !modelSel || !fbSel) return;
  const providerId = provSel.value;
  const mcfg       = settings.modalities[modalityKey];
  const vendorId   = credSel?.value || mcfg.vendorId || '';
  const models     = typeof mergeRoutingModelOptions === 'function'
    ? mergeRoutingModelOptions(providerId, modalityKey, vendorId)
    : getModelsForProviderModality(providerId, modalityKey);

  let selectedModel = mcfg.model || '';
  const modelIds = new Set(models.map((m) => m.id));
  if (!selectedModel || !modelIds.has(selectedModel)) {
    selectedModel = models[0]?.id || '';
    if (selectedModel) {
      mcfg.model = selectedModel;
      mcfg.modelLabel = models[0]?.label || getAiApiModelDisplayLabel(providerId, modalityKey, selectedModel, '');
    }
  }

  fillSelect(modelSel, models, selectedModel, false);
  fillSelect(fbSel, models, mcfg.fallbackModel, true, 'None (no fallback)');
  updateCapabilityReadout(modalityKey, providerId, modelSel.value);
  if (modalityKey === 'audio') {
    refreshAudioVoiceOptions(settings);
  }
}

function refreshAudioVoiceOptions(settings: any) {
  const voiceSel = _el('ai-api-voice-audio');
  const modelSel = _el('ai-api-model-audio');
  if (!voiceSel || !modelSel) return;
  const mcfg = settings?.modalities?.audio || {};
  const vendorId = String(_el('ai-api-credential-audio')?.value || mcfg.vendorId || '');
  const modelId = String(modelSel.value || mcfg.model || '');
  const voices = vendorId && modelId ? getCachedVoicesForVendorAudioModel(vendorId, modelId) : [];
  const options = voices.map((v) => ({ id: v, label: v }));
  const selected = voices.includes(mcfg.voice) ? mcfg.voice : (voices[0] || '');
  fillSelect(voiceSel, options, selected, true, voices.length ? 'Auto (provider default)' : 'No fetched voices');
  voiceSel.disabled = options.length === 0;
  mcfg.voice = selected;
}

function updateCapabilityReadout(modalityKey: any, providerId: any, modelId: any) {
  const el = _el(`ai-api-caps-${modalityKey}`);
  if (!el) return;
  const entry = getModelEntry(providerId, modalityKey, modelId);
  el.textContent = entry ? formatCapsText(entry.caps) : '—';
}

export function populateAiApiSettingsForm() {
  const s = loadAiApiSettings();

  AI_API_MODALITIES.forEach(({ key }) => {
    const provSel = _el(`ai-api-provider-${key}`);
    const providers = typeof listProvidersWithKeyForModality === 'function'
      ? listProvidersWithKeyForModality(key)
      : AI_API_PROVIDERS.map((p) => ({ id: p.id, label: p.label }));
    if (provSel) fillSelect(provSel, providers, s.modalities[key].provider, false);
  });

  populateAiApiCredentialSelects();

  if (typeof ensureRoutingModelDefaults === 'function') ensureRoutingModelDefaults(false);
  AI_API_MODALITIES.forEach(({ key }) => refreshModalityModelOptions(key, s));

  const ts = _el('ai-api-timeout-seconds');
  const mr = _el('ai-api-max-retries');
  const mc = _el('ai-api-max-concurrency');
  if (ts) ts.value = String(s.requests.timeoutSeconds ?? 120);
  if (mr) mr.value = String(s.requests.maxRetries ?? 2);
  if (mc) mc.value = String(s.requests.maxConcurrency ?? 4);

  const log = _el('ai-api-log-level');
  if (log) log.value = s.diagnostics.logLevel || 'off';

  AI_API_MODALITIES.forEach(({ key }) => {
    const url = _el(`ai-api-baseurl-${key}`);
    if (url) url.value = s.modalities[key].baseUrl || '';
  });

  refreshAudioVoiceOptions(s);
  refreshAiApiModalityGating();

  syncServerKeysUiHint();
}

function readAiApiSettingsFromForm() {
  const modalities: Record<string, any> = {};
  AI_API_MODALITIES.forEach(({ key }) => {
    const prov     = _el(`ai-api-provider-${key}`)?.value || (AI_API_DEFAULT_SETTINGS.modalities as Record<string, any>)[key].provider;
    const model    = _el(`ai-api-model-${key}`)?.value || '';
    let fallback   = _el(`ai-api-fallback-${key}`)?.value || '';
    if (fallback === model) fallback = '';
    const baseUrl  = String(_el(`ai-api-baseurl-${key}`)?.value || '').trim();
    const vendorId = String(_el(`ai-api-credential-${key}`)?.value || '').trim();
    const modelSel   = _el(`ai-api-model-${key}`);
    let modelLabel   = labelFromModelSelect(modelSel, model);
    if (!modelLabel) modelLabel = getAiApiModelDisplayLabel(prov, key, model, '');
    const voice = key === 'audio' ? String(_el('ai-api-voice-audio')?.value || '') : '';
    modalities[key] = { provider: prov, model, fallbackModel: fallback, baseUrl, vendorId, modelLabel, voice };
  });
  const timeoutSeconds  = Math.min(3600, Math.max(10,  parseInt(_el('ai-api-timeout-seconds')?.value || '120', 10) || 120));
  const maxRetries      = Math.min(10,   Math.max(0,   parseInt(_el('ai-api-max-retries')?.value    || '2',   10) || 0));
  const maxConcurrency  = Math.min(32,   Math.max(1,   parseInt(_el('ai-api-max-concurrency')?.value || '4',  10) || 1));
  const logLevel        = _el('ai-api-log-level')?.value || 'off';
  return { modalities, requests: { timeoutSeconds, maxRetries, maxConcurrency }, diagnostics: { logLevel } };
}

/* ── Modal init ──────────────────────────────────────────────────────────── */

export function initAiProvidersModalOnce() {
  const modal = _el('ai-providers-modal');
  if (!modal || modal.dataset.cgAiProvidersInit === '1') return;
  modal.dataset.cgAiProvidersInit = '1';

  /* Provider-change listeners for routing selects */
  AI_API_MODALITIES.forEach(({ key }) => {
    const prov = _el(`ai-api-provider-${key}`);
    prov?.addEventListener('change', () => {
      populateAiApiCredentialSelects();
      const settings = loadAiApiSettings();
      const credSel  = _el(`ai-api-credential-${key}`);
      if (credSel) {
        const vendors = apiKeysListCredentialCandidates(prov.value, key);
        if (vendors.length === 1) credSel.value = vendors[0].id;
      }
      settings.modalities[key].provider = prov.value;
      refreshModalityModelOptions(key, settings);
      saveAiApiSettings(settings);
    });
    const cred = _el(`ai-api-credential-${key}`);
    cred?.addEventListener('change', () => {
      const settings = loadAiApiSettings();
      settings.modalities[key].vendorId = cred.value;
      refreshModalityModelOptions(key, settings);
      saveAiApiSettings(settings);
    });
    const model = _el(`ai-api-model-${key}`);
    model?.addEventListener('change', () => {
      const providerId = _el(`ai-api-provider-${key}`)?.value;
      const settings = loadAiApiSettings();
      settings.modalities[key].model = model.value;
      settings.modalities[key].modelLabel = labelFromModelSelect(model, model.value)
        || getAiApiModelDisplayLabel(providerId, key, model.value, '');
      updateCapabilityReadout(key, providerId, model.value);
      if (key === 'audio') refreshAudioVoiceOptions(settings);
      saveAiApiSettings(settings);
    });
  });

  const audioVoice = _el('ai-api-voice-audio');
  audioVoice?.addEventListener('change', () => {
    const settings = loadAiApiSettings();
    settings.modalities.audio.voice = audioVoice.value || '';
    saveAiApiSettings(settings);
  });

  const tabSeg = modal.querySelector('[data-segmented="aip-settings-tabs"]');
  if (tabSeg) {
    tabSeg.querySelectorAll('[data-aip-tab]').forEach((btn: any) => {
      btn.addEventListener('click', () => {
        switchAiProvidersSection(btn.getAttribute('data-aip-tab') || 'providers');
      });
    });
  }
}

function switchAiProvidersSection(tabId: any) {
  const tab = tabId === 'models' ? 'models' : 'providers';
  const seg = document.querySelector('[data-segmented="aip-settings-tabs"]');
  if (seg) {
    seg.querySelectorAll('[data-aip-tab]').forEach((btn) => {
      const active = btn.getAttribute('data-aip-tab') === tab;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }
  const providersPanel = _el('aip-panel-providers');
  const modelsPanel = _el('aip-panel-models');
  if (providersPanel) providersPanel.hidden = tab !== 'providers';
  if (modelsPanel) modelsPanel.hidden = tab !== 'models';
}

function switchAiProvidersModality(modalityKey: any) {
  switchAiProvidersSection('models');
  const map: Record<string, string> = { llm: 'llm', text: 'llm', image: 'image', video: 'video', audio: 'audio', sound: 'audio' };
  const key = map[modalityKey] || modalityKey;
  const fieldset = _el(`ai-api-fieldset-${key}`);
  fieldset?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  fieldset?.querySelector('details')?.setAttribute?.('open', 'open');
}

function syncServerKeysUiHint() {
  const hint = _el('ai-providers-storage-hint');
  if (hint) {
    hint.textContent =
      'Primary keys live in backends/.env. Providers with env keys appear automatically; optional browser keys override for testing.';
  }
  const saveHint = _el('ai-providers-save-hint');
  if (saveHint && !saveHint.textContent?.startsWith('Saved')) {
    saveHint.textContent = 'Routing applies to storyboards, debug, and all AI services.';
  }
  applyServerKeysBadge();
}

/* ── Open / Close / Save ─────────────────────────────────────────────────── */

export async function openAiProvidersModal(sectionOrModality?: any) {
  initAiProvidersModalOnce();
  closeAllToolbarSplitMenus();
  closeGuideModal();
  closeProjectsModal();
  closeSettingsModal();
  closeAiAssistModal();
  closeProjectSettingsModal();

  await initServerKeyStore();

  populateApiKeysForm();
  populateAiApiSettingsForm();

  void refreshAllProviderCatalogsOnLoad().then(() => populateAiApiSettingsForm());

  const draft = getDraft();
  const vendor = draft?.vendors?.find((v: any) => v.id === draft.selectedVendorId);
  if (vendor) {
    import('@/components/settings/cinegen-provider-catalog-sync')
      .then(({ refreshSelectedVendorCatalog }) => refreshSelectedVendorCatalog(vendor))
      .then(() => populateAiApiSettingsForm());
  }

  syncServerKeysUiHint();

  const modal = _el('ai-providers-modal');
  if (!modal) return;
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');

  if (sectionOrModality === 'models' || sectionOrModality === 'providers') {
    switchAiProvidersSection(sectionOrModality);
  } else if (sectionOrModality && typeof switchAiProvidersModality === 'function') {
    switchAiProvidersModality(sectionOrModality);
  } else {
    switchAiProvidersSection('providers');
  }

  _el('api-keys-detail-name')?.focus?.();
}

export function closeAiProvidersModal() {
  _apiKeysDraftReset();
  const modal = _el('ai-providers-modal');
  if (!modal || modal.hidden) return;
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
}

export async function saveAiProvidersModal() {
  saveApiKeysModalInternal();

  const next = readAiApiSettingsFromForm();
  saveAiApiSettings(next);

  await initServerKeyStore();
  applyServerKeysBadge();

  const hint = _el('ai-providers-save-hint');
  if (hint) hint.textContent = 'Saved.';

  sanitizeAiApiVendorIdsInStoredSettings();
  populateAiApiSettingsForm();
  if (typeof updateModelStatusIndicators === 'function') updateModelStatusIndicators();

  void refreshAllProviderCatalogsOnLoad();
}

/* ── Backward-compat aliases (other files still call these) ──────────────── */

export function sanitizeAiApiVendorIdsInStoredSettings() {
  const cur = loadAiApiSettings();
  saveAiApiSettings(cur);
}

function openAiApiSettingsModal()  { void openAiProvidersModal(); }
function closeAiApiSettingsModal() { closeAiProvidersModal(); }
function saveAiApiSettingsModal()  { void saveAiProvidersModal(); }


export function registerAiProvidersModal(): void {
  registerModal({ id: 'ai-providers-modal' });
}

export function installAiApiSettingsBundleGlobals(): void {
  const w = window as unknown as Record<string, unknown>;
  w.AI_API_PROVIDERS = AI_API_PROVIDERS;
  w.AI_API_MODEL_CATALOG = AI_API_MODEL_CATALOG;
  w.applyServerKeysBadge = applyServerKeysBadge;
  w.getModelsForProviderModality = getModelsForProviderModality;
  w.getModelEntry = getModelEntry;
  w.labelFromModelSelect = labelFromModelSelect;
  w.getAiApiModelDisplayLabel = getAiApiModelDisplayLabel;
  w.formatCapsText = formatCapsText;
  w.fillSelect = fillSelect;
  w.mergeAiApiSettings = mergeAiApiSettings;
  w.sanitizeAiApiVendorIdsInModalities = sanitizeAiApiVendorIdsInModalities;
  w.loadAiApiSettings = loadAiApiSettings;
  w.saveAiApiSettings = saveAiApiSettings;
  w.clearAiApiRouting = clearAiApiRouting;
  w.populateAiApiCredentialSelects = populateAiApiCredentialSelects;
  w.refreshModalityModelOptions = refreshModalityModelOptions;
  w.updateCapabilityReadout = updateCapabilityReadout;
  w.populateAiApiSettingsForm = populateAiApiSettingsForm;
  w.readAiApiSettingsFromForm = readAiApiSettingsFromForm;
  w.initAiProvidersModalOnce = initAiProvidersModalOnce;
  w.switchAiProvidersSection = switchAiProvidersSection;
  w.switchAiProvidersModality = switchAiProvidersModality;
  w.syncServerKeysUiHint = syncServerKeysUiHint;
  w.openAiProvidersModal = openAiProvidersModal;
  w.closeAiProvidersModal = closeAiProvidersModal;
  w.saveAiProvidersModal = saveAiProvidersModal;
  w.openAiApiSettingsModal = openAiApiSettingsModal;
  w.closeAiApiSettingsModal = closeAiApiSettingsModal;
  w.saveAiApiSettingsModal = saveAiApiSettingsModal;
  w.getAiApiProviderList = function getAiApiProviderList() {
    return AI_API_PROVIDERS.map((p) => ({ id: p.id, label: p.label }));
  };
  w.getAiApiModelCaps = function getAiApiModelCaps(providerId: any, modalityKey: any, modelId: any) {
    const entry = getModelEntry(providerId, modalityKey, modelId);
    return entry ? entry.caps : null;
  };
  w.sanitizeAiApiVendorIdsInStoredSettings = sanitizeAiApiVendorIdsInStoredSettings;

  applyServerKeysBadge();
}
