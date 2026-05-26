/**
 * providerModelCatalog.js — Live provider model lists (cached) for routing & master list UI.
 *
 * Populated via API test / fetch (setupAssistant.fetchProviderModelsForModality).
 * Refreshed on app load for vendors with saved keys.
 *
 * ── NOTE ──
 * This file caches model metadata only (model IDs, labels, capabilities) — not
 * API keys. The cache is persisted via server-backed storageService.
 * Do NOT add direct browser-local persistence (localStorage/sessionStorage/
 * IndexedDB) so model metadata stays consistent across browser instances.
 * ─────────
 *
 * Each provider returns different metadata for audio model classification.
 * There is no universal standard. Industry practice per provider:
 *
 *   Together AI:
 *     GET /v1/models returns `type` enum: chat | language | code | image |
 *     embedding | moderation | rerank.  No `audio` type exists.
 *     CRITICAL: Together AI tags TTS models (cartesia/sonic-3, Kokoro-82M,
 *     orpheus-3b) with `type: "chat"` or `type: "language"` — their type
 *     enum has no `audio` value, so they use the closest general type.
 *     Our cascade must NOT exclude `chat`/`language`/`code` from audio
 *     filtering; only definitively non-audio types (video, image, embedding,
 *     moderation, rerank) should be excluded.
 *
 *   OpenAI / xAI:
 *     GET /v1/models returns {id, created, owned_by, object} — NO `type`
 *     field at all.  Audio models are identified purely by model ID prefixes:
 *     tts-1, tts-1-hd, gpt-4o-mini-tts, whisper-1, gpt-4o-transcribe, etc.
 *
 *   ElevenLabs:
 *     GET /v1/models returns boolean capability flags per model:
 *       can_do_text_to_speech, can_do_voice_conversion, can_use_style, etc.
 *     SFX (eleven_text_to_sound_v2) and Music (music_v1) are separate
 *     API endpoints NOT listed in /v1/models.
 *
 *   APIpie:
 *     Returns explicit type + subtype fields per model:
 *       type: "audio", subtype: "tts" | "stt" | "music" | "voice"
 *
 *   Google Gemini:
 *     GET /v1beta/models returns {name, displayName, description} — no
 *     type or capability field.  Audio capability is implied by model ID
 *     patterns (e.g., models containing "tts", "speech").
 *
 *   fal.ai:
 *     Models are organized by category query param (text-to-video,
 *     text-to-image, etc.).  Audio is not currently listed as a category.
 *
 *   Replicate:
 *     Model search returns {owner, name, ...} — no type/capability field.
 *     Audio is implied by search term ("text-to-speech").
 *
 *   Runway / Luma:
 *     Video-only providers — no audio models.
 *
 * ── Our cascade (modelMatchesAudioCapability) ────────────────────────────
 *
 *   1. Check model.type field (Together AI, APIpie, some providers)
 *   2. Check model.capabilities array (generic metadata)
 *   3. Check provider-specific boolean flags (ElevenLabs can_do_text_to_speech)
 *   4. Fall back to keyword matching on id + label (OpenAI/xAI, Gemini, generic)
 */

import { PROVIDER_MODEL_CATALOG_STORAGE_KEY } from '@/constants/storage-keys';
import { storageService } from '@/services/persistence';
import { ROUTING_MODALITIES } from '@/services/routing-modalities';

declare global {
  function getModelsForProviderModality(providerId: string, modalityKey: string): Array<{ id: string; label: string }>;
  function apiScopeForModality(modalityKey: string): string;
  function loadApiKeys(): { vendors: Array<{ providerId: string }> };
  function vendorHasKeyForScope(vendor: any, scope: string): boolean;
  function loadAiApiSettings(): { modalities: Record<string, { vendorId?: string; provider?: string; model?: string; modelLabel?: string }> };
  function saveAiApiSettings(settings: any): void;
  function vendorHasApiKey(vendor: any): boolean;
  var AI_API_PROVIDERS: Array<{ id: string; label: string }>;
}

const MODALITY_CHIP_LABELS: Record<string, string> = {
  llm:   'Text',
  image: 'Image',
  video: 'Video',
  audio: 'Sound'
};

function isVideoModelId(id: any): boolean {
  return /\/(video|veo|sora|kling|wan|hailuo|seedance|pixverse|vidu|i2v|t2v|r2v)/i.test(String(id || ''))
    || /video|sora|veo|kling|wan|runway|luma|minimax|seedance|pixverse|vidu|hailuo|i2v|t2v|r2v/i.test(String(id || ''));
}

function isImageModelId(id: any): boolean {
  return /dall-e|gpt-image|grok-imagine-image|image|imagen|flux|seedream|qwen-image|ideogram|stable-diffusion|dreamshaper|juggernaut|hidream/i.test(String(id || ''));
}

function isAudioModelId(id: any): boolean {
  return /^tts|whisper|orpheus|kokoro|sonic/i.test(String(id || ''))
    || /\/(tts|whisper|orpheus|kokoro|sonic|speech|voice|audio)/i.test(String(id || ''))
    || /deepgram|cartesia|rime|minimax\/speech/i.test(String(id || ''));
}

function cachedModelMatchesModality(model: any, modalityKey: any): boolean {
  const id = model?.id || '';
  const type = typeof model?.type === 'string' ? model.type.toLowerCase() : '';
  if (modalityKey === 'llm') {
    if (type === 'chat' || type === 'language' || type === 'code') return true;
    if (type === 'image' || type === 'audio' || type === 'video' || type === 'embedding' || type === 'moderation') return false;
    return !isImageModelId(id) && !isVideoModelId(id) && !isAudioModelId(id) && !/embedding|moderation/i.test(String(id));
  }
  if (modalityKey === 'image') return type === 'image' || isImageModelId(id);
  if (modalityKey === 'video') return type === 'video' || isVideoModelId(id);
  if (modalityKey === 'audio') return type === 'audio' || isAudioModelId(id);
  return true;
}

/* ── Storage ─────────────────────────────────────────────────────────────── */

export function loadProviderModelCatalog() {
  try {
    const raw = storageService.getItem(PROVIDER_MODEL_CATALOG_STORAGE_KEY);
    if (!raw) return { vendors: {} };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { vendors: {} };
    return { vendors: parsed.vendors && typeof parsed.vendors === 'object' ? parsed.vendors : {} };
  } catch (e: any) {
    return { vendors: {} };
  }
}

export function saveProviderModelCatalog(catalog: any) {
  try {
    storageService.setItem(PROVIDER_MODEL_CATALOG_STORAGE_KEY, JSON.stringify(catalog));
  } catch (e: any) {
    console.warn('CineGen: failed to persist provider model catalog.', e);
  }
}

export function getVendorCatalogRecord(vendorId: any) {
  const catalog = loadProviderModelCatalog();
  return catalog.vendors[vendorId] || null;
}

/* ── Cache read / write ──────────────────────────────────────────────────── */

/**
 * Get cached modality status for a vendor from the catalog.
 * Returns the status ('ok', 'ratelimit', 'err') and models if available.
 */
export function getCachedModalityStatus(vendorId: any, modalityKey: any) {
  const rec = getVendorCatalogRecord(vendorId);
  const mod = rec?.modalities?.[modalityKey];
  if (!mod) return null;
  return {
    status: mod.status,
    message: mod.message,
    models: mod.models || [],
    fetchedAt: mod.fetchedAt
  };
}

export function getCachedModelsForVendorModality(vendorId: any, modalityKey: any) {
  const rec = getVendorCatalogRecord(vendorId);
  const mod = rec?.modalities?.[modalityKey];
  if (!mod || !Array.isArray(mod.models) || !mod.models.length) return [];
  if (mod.status !== 'ok' && mod.status !== 'ratelimit') return [];
  return mod.models
    .filter((m: any) => cachedModelMatchesModality(m, modalityKey))
    .map((m: any) => ({
      id: m.id,
      label: m.label || m.id,
      voices: Array.isArray(m.voices) ? m.voices : []
    }));
}

/**
 * Provider-specific cascade for audio sub-capability matching.
 *
 * Determines whether a model belongs to a given audio sub-capability
 * (tts / sfx / music) using API metadata where available, with keyword
 * fallback for providers whose APIs don't return type/capability info.
 *
 * Cascade order:
 *   1. model.type field  — Together AI `type` enum, APIpie `type`/`subtype`
 *   2. model.capabilities array — generic per-model capability metadata
 *   3. Provider-specific boolean flags — ElevenLabs `can_do_text_to_speech`
 *   4. Keyword matching on id + label — OpenAI/xAI, Google Gemini, generic
 */
export function modelMatchesAudioCapability(model: any, capability: string, providerId?: string): boolean {
  const id = model?.id || '';
  const label = model?.label || '';
  const type = typeof model?.type === 'string' ? model.type.toLowerCase() : '';

  // 1. Check model.type field (Together AI, APIpie, some OpenAI-compatible)
  if (type) {
    if (type === capability) return true;
    if (capability === 'tts' && ['tts', 'voice', 'speech'].includes(type)) return true;
    if (capability === 'sfx' && ['sfx', 'sound_effect'].includes(type)) return true;
    if (capability === 'music' && type === 'music') return true;
    // Known non-audio types — exclude so we don't fall through to keywords
    // Note: Together AI tags ALL models (including TTS) with `chat`/`language` type
    // because their `type` enum has no `audio` value.  Do NOT exclude those.
    if (['video', 'image', 'embedding', 'moderation', 'rerank'].includes(type)) return false;
  }

  // 2. Check model.capabilities array (generic metadata)
  if (model.capabilities && Array.isArray(model.capabilities)) {
    if (model.capabilities.includes(capability)) return true;
  }

  // 3. Provider-specific boolean flags
  if (providerId === 'elevenlabs-api') {
    if (capability === 'tts' && model.can_do_text_to_speech === true) return true;
    // For SFX/Music on ElevenLabs, fall through to keyword matching
    // (eleven_text_to_sound_v2 is identified by ID keywords; music_v1 is a separate endpoint)
  }

  // 4. Keyword fallback (OpenAI/xAI, Google Gemini, generic OpenAI-compatible)
  const text = `${label} ${id}`.toLowerCase();
  const keywords: Record<string, string[]> = {
    tts: ['tts', 'speech', 'voice', 'speak', 'sonic', 'aura', 'cartesia', 'rime', 'kokoro', 'orpheus', 'minimax'],
    sfx: ['sfx', 'sound', 'effect', 'ambient', 'noise', 'foley'],
    music: ['music', 'song', 'melody', 'composition', 'suno', 'udio/', 'stability']
  };
  const kwList = keywords[capability] || [];
  return kwList.some((kw) => text.includes(kw.toLowerCase()));
}

/**
 * Get cached audio models filtered by capability.
 * Uses modelMatchesAudioCapability cascade (type → capabilities → boolean flags → keywords).
 */
export function getCachedAudioModelsByCapability(vendorId: any, capability: any) {
  const rec = getVendorCatalogRecord(vendorId);
  const mod = rec?.modalities?.audio;
  if (!mod || !Array.isArray(mod.models) || !mod.models.length) return [];
  if (mod.status !== 'ok' && mod.status !== 'ratelimit') return [];

  const providerId = rec?.providerId || '';

  return mod.models
    .filter((m: any) => modelMatchesAudioCapability(m, capability, providerId))
    .map((m: any) => ({
      id: m.id,
      label: m.label || m.id,
      voices: Array.isArray(m.voices) ? m.voices : []
    }));
}

export function getCachedVoicesForVendorAudioModel(vendorId: string, modelId: string): string[] {
  if (!vendorId || !modelId) return [];
  const rec = getVendorCatalogRecord(vendorId);
  const mod = rec?.modalities?.audio;
  if (!mod || !Array.isArray(mod.models)) return [];
  const row = mod.models.find((m: any) => m?.id === modelId);
  if (!row || !Array.isArray(row.voices)) return [];
  return row.voices
    .map((v: any) => String(v || '').trim())
    .filter(Boolean);
}

function isCustomPlaceholderModelId(id: string): boolean {
  return /^custom(-|$)/i.test(id) || id === 'custom';
}

export function setVendorModalityCatalog(vendorId: any, providerId: any, modalityKey: any, fetchResult: any) {
  const catalog = loadProviderModelCatalog();
  if (!catalog.vendors[vendorId]) {
    catalog.vendors[vendorId] = { providerId, testedAt: 0, modalities: {} };
  }
  const entry = catalog.vendors[vendorId];
  entry.providerId = providerId;
  entry.testedAt = Date.now();
  const status = fetchResult?.ok ? 'ok' : (fetchResult?.rateLimit ? 'ratelimit' : 'err');
  entry.modalities[modalityKey] = {
    status,
    message: fetchResult?.message || '',
    models: Array.isArray(fetchResult?.models) ? fetchResult.models.slice(0, 80) : [],
    fetchedAt: Date.now()
  };
  saveProviderModelCatalog(catalog);
  return entry.modalities[modalityKey];
}

/** Persist primary modality plus any pre-categorized lists from a single models API call. */
export function applyVendorCatalogFetchResult(
  vendorId: string,
  providerId: string,
  primaryModality: string,
  fetchResult: {
    ok?: boolean;
    rateLimit?: boolean;
    message?: string;
    models?: Array<{ id: string; label?: string; type?: string }>;
    _categorized?: Record<string, Array<{ id: string; label?: string; type?: string }>>;
  }
): void {
  setVendorModalityCatalog(vendorId, providerId, primaryModality, fetchResult);
  const cat = fetchResult._categorized;
  if (!cat || typeof cat !== 'object') return;
  for (const [modalityKey, models] of Object.entries(cat)) {
    if (modalityKey === primaryModality) continue;
    if (!Array.isArray(models) || !models.length) continue;
    setVendorModalityCatalog(vendorId, providerId, modalityKey, {
      ok: fetchResult.ok,
      rateLimit: fetchResult.rateLimit,
      message: fetchResult.message || '',
      models,
    });
  }
}

export function vendorCatalogHasLiveModels(vendorId: any) {
  const rec = getVendorCatalogRecord(vendorId);
  if (!rec?.modalities) return false;
  return ROUTING_MODALITIES.some((mod) => {
    const m = rec.modalities[mod];
    return m && (m.status === 'ok' || m.status === 'ratelimit') && Array.isArray(m.models) && m.models.length > 0;
  });
}

/* ── Model lists for routing dropdowns ───────────────────────────────────── */

export function mergeRoutingModelOptions(providerId: any, modalityKey: any, vendorId: any) {
  const live = vendorId ? getCachedModelsForVendorModality(vendorId, modalityKey) : [];
  const staticList = typeof getModelsForProviderModality === 'function'
    ? getModelsForProviderModality(providerId, modalityKey)
    : [];
  const seen = new Set();
  const out = [];

  live.forEach((m: any) => {
    if (!m?.id || seen.has(m.id)) return;
    seen.add(m.id);
    out.push({ id: m.id, label: m.label || m.id });
  });

  // When a specific credential/vendor has live models, treat that as authoritative.
  // This prevents generic provider-family placeholders (e.g. OpenAI image models)
  // from bleeding into vendor-specific lists (e.g. Together AI).
  const includeStatic = !vendorId || live.length === 0;
  if (includeStatic) {
    staticList.forEach((m: any) => {
      if (!m?.id || seen.has(m.id) || /^custom(-|$)/i.test(m.id)) return;
      seen.add(m.id);
      out.push({ id: m.id, label: m.label || m.id });
    });
  }

  if (!out.length && staticList.length && !vendorId) {
    const fallback = staticList.find((m: any) => m?.id && !isCustomPlaceholderModelId(m.id));
    if (fallback) out.push({ id: fallback.id, label: fallback.label || fallback.id });
  }

  return out;
}

export function listProvidersWithKeyForModality(modalityKey: any) {
  const providerIds = new Set<string>();
  if (typeof loadApiKeys === 'function') {
    loadApiKeys().vendors.forEach((v: any) => {
      const configured =
        typeof (window as any).vendorIsConfigured === 'function'
          ? (window as any).vendorIsConfigured(v)
          : typeof vendorHasApiKey === 'function'
            ? vendorHasApiKey(v)
            : Boolean(String(v?.apiKey || '').trim());
      if (configured && v.providerId) providerIds.add(v.providerId);
    });
  }
  if (typeof AI_API_PROVIDERS === 'undefined') return [];
  const list = AI_API_PROVIDERS.filter((p) => providerIds.has(p.id));
  return list.length ? list : AI_API_PROVIDERS.map((p) => ({ id: p.id, label: p.label }));
}

/* ── Default model selection ─────────────────────────────────────────────── */

export function ensureRoutingModelDefaults(persist: any) {
  if (typeof loadAiApiSettings !== 'function' || typeof saveAiApiSettings !== 'function') return false;
  const settings = loadAiApiSettings();
  let changed = false;

  ROUTING_MODALITIES.forEach((key: any) => {
    const mcfg = settings.modalities[key];
    if (!mcfg) return;
    const vendorId = mcfg.vendorId || '';
    const models = mergeRoutingModelOptions(mcfg.provider, key, vendorId);
    if (!models.length) return;

    const ids = new Set(models.map((x: any) => x.id));
    if (mcfg.model && ids.has(mcfg.model)) return;

    const pick = models[0];
    if (!pick?.id) return;

    mcfg.model = pick.id;
    mcfg.modelLabel = pick.label || pick.id;
    changed = true;
  });

  if (changed && persist !== false) saveAiApiSettings(settings);
  return changed;
}

/* ── Fetch / refresh (typed service; Lit Task host in settings components) ─ */

import {
  refreshAllProviderCatalogsOnLoad,
  refreshVendorCatalog,
} from '@/services/provider-catalog-refresh';

export { refreshAllProviderCatalogsOnLoad, refreshVendorCatalog };

/* ── Master list: sort + modality chips ──────────────────────────────────── */

export function vendorUsedInRouting(vendorId: any) {
  if (typeof loadAiApiSettings !== 'function') return false;
  const ai = loadAiApiSettings();
  return ROUTING_MODALITIES.some((mod) => ai.modalities[mod]?.vendorId === vendorId);
}

export function vendorMasterSortScore(vendor: any) {
  let score = 0;
  if (vendorCatalogHasLiveModels(vendor.id)) score += 1000;
  if (vendorUsedInRouting(vendor.id)) score += 200;
  if ((typeof vendorHasApiKey === 'function' && vendorHasApiKey(vendor))
    || (typeof vendorHasKeyForScope === 'function' && vendorHasKeyForScope(vendor, 'language'))) {
    score += 50;
  }
  return score;
}

export function sortVendorsForMasterList(vendors: any) {
  return [...vendors].sort((a: any, b: any) => {
    const diff = vendorMasterSortScore(b) - vendorMasterSortScore(a);
    if (diff !== 0) return diff;
    return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
  });
}

export function getVendorModalityChips(vendor: any) {
  const chipMap = new Map();

  const rec = getVendorCatalogRecord(vendor.id);
  if (rec?.modalities) {
    ROUTING_MODALITIES.forEach((mod) => {
      const data = rec.modalities[mod];
      if (data && (data.status === 'ok' || data.status === 'ratelimit') && data.models?.length) {
        chipMap.set(mod, MODALITY_CHIP_LABELS[mod]);
      }
    });
  }

  if (typeof loadAiApiSettings === 'function') {
    const ai = loadAiApiSettings();
    ROUTING_MODALITIES.forEach((mod) => {
      if (ai.modalities[mod]?.vendorId === vendor.id) chipMap.set(mod, MODALITY_CHIP_LABELS[mod]);
    });
  }

  return ROUTING_MODALITIES
    .filter((mod) => chipMap.has(mod))
    .map((mod) => ({ key: mod, label: chipMap.get(mod) }));
}

export function installProviderModelCatalogGlobals(): void {
  const w = window as unknown as Record<string, unknown>;
  w.loadProviderModelCatalog = loadProviderModelCatalog;
  w.modelMatchesAudioCapability = modelMatchesAudioCapability;
  w.getCachedModelsForVendorModality = getCachedModelsForVendorModality;
  w.getCachedAudioModelsByCapability = getCachedAudioModelsByCapability;
  w.getCachedVoicesForVendorAudioModel = getCachedVoicesForVendorAudioModel;
  w.getCachedModalityStatus = getCachedModalityStatus;
  w.setVendorModalityCatalog = setVendorModalityCatalog;
  w.applyVendorCatalogFetchResult = applyVendorCatalogFetchResult;
  w.mergeRoutingModelOptions = mergeRoutingModelOptions;
  w.listProvidersWithKeyForModality = listProvidersWithKeyForModality;
  w.ensureRoutingModelDefaults = ensureRoutingModelDefaults;
  w.refreshVendorCatalog = refreshVendorCatalog;
  w.refreshAllProviderCatalogsOnLoad = refreshAllProviderCatalogsOnLoad;
  w.sortVendorsForMasterList = sortVendorsForMasterList;
  w.getVendorModalityChips = getVendorModalityChips;
  w.vendorCatalogHasLiveModels = vendorCatalogHasLiveModels;
}
