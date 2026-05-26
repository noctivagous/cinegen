import { escHtml } from '@/utils/html';
import { resolveOpenAiCompatibleTarget } from '@/services/ai/openai-compatible-target';

/**
 * Provider connection tests and model-list fetch routines.
 *
 * All external API calls are routed through the backend proxy (/proxy/...)
 * so API keys never leave the server. For initial connection tests where
 * the user has typed a key but not yet saved it, the key is sent in the
 * Authorization header (ephemeral, not stored in the browser).
 */

const PROXY_BASE = '';

/* ── Public dispatcher ─────────────────────────────────────────────────── */

/**
 * Attempt to list models for a provider.
 * Returns { ok, rateLimit, message, models: [{id, label}] }
 */

export async function saFetchModels(providerId: any, key: any, baseUrl: any, mod: any, signal: any) {
  const timeout = 12000;
  const tController = new AbortController();
  const timer = setTimeout(() => tController.abort(), timeout);
  const combinedSignal = saCombineSignals(signal, tController.signal);

  try {
    let result;
    switch (providerId) {
      case 'openai-compatible': {
        const target = resolveOpenAiCompatibleTarget({ baseUrl }) ?? 'openai';
        result = await proxiedFetchModels(key, baseUrl || 'https://api.openai.com/v1', target, combinedSignal, mod);
        break;
      }
      case 'anthropic-messages-api':
        result = await proxiedFetchModels(key, 'https://api.anthropic.com', 'anthropic', combinedSignal, mod);
        break;
      case 'google-gemini-api':
        result = await proxiedGetModels(key, 'https://generativelanguage.googleapis.com', 'google', 'v1beta/models', combinedSignal);
        break;
      case 'elevenlabs-api':
        result = await proxiedFetchModels(key, 'https://api.elevenlabs.io', 'elevenlabs', combinedSignal, mod);
        break;
      case 'fal-ai':
        result = await saFetchFalModels(key, mod, combinedSignal);
        break;
      case 'runway-api':
        result = await saFetchRunway(key, mod, combinedSignal);
        break;
      case 'luma-api':
        result = await saFetchLuma(key, mod, combinedSignal);
        break;
      case 'replicate-api':
        result = await saFetchReplicate(key, mod, combinedSignal);
        break;
      default:
        result = await saFetchGenericPing(providerId, key, baseUrl, mod, combinedSignal);
        break;
    }
    clearTimeout(timer);
    return result;
  } catch (e: any) {
    clearTimeout(timer);
    throw e;
  }
}

/* ── Utilities ───────────────────────────────────────────────────────────── */

export function saCombineSignals(s1: any, s2: any) {
  const controller = new AbortController();
  const abort = (reason: any) => { try { controller.abort(reason); } catch {} };
  if (s1) { if (s1.aborted) { abort(s1.reason); } else { s1.addEventListener('abort', () => abort(s1.reason), { once: true }); } }
  if (s2) { if (s2.aborted) { abort(s2.reason); } else { s2.addEventListener('abort', () => abort(s2.reason), { once: true }); } }
  return controller.signal;
}

/**
 * Safely parse a response body as JSON. Returns `fallback` (default `{}`)
 * on any parse failure so callers never throw "Unexpected token" errors.
 */
async function safeRespJson(resp: any, fallback?: any) {
  try {
    return await resp.json();
  } catch {
    return fallback !== undefined ? fallback : {};
  }
}

/** True if key is a real (unmasked, non-empty) value worth sending to the proxy */
function isRealKey(key: any) {
  return typeof key === 'string' && key.length > 4 && key !== '••••••••';
}

/** Build proxy fetch headers: target is required, auth only if key is real */
function proxyHeaders(target: string, key?: any) {
  const h: Record<string, string> = { 'X-Cinegen-Target': target };
  if (isRealKey(key)) h['Authorization'] = key.startsWith('Bearer ') ? key : `Bearer ${key}`;
  if (key && typeof key === 'string' && key.startsWith('Key ')) h['Authorization'] = key;
  return h;
}

function saUniqueStrings(values: any[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values || []) {
    const v = String(raw || '').trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

async function saFetchVoicesForAudioTarget(target: string, key: any, baseUrl: string, signal: any): Promise<string[]> {
  try {
    const headers = proxyHeaders(target, key);
    const base = (baseUrl || '').replace(/\/$/, '');
    if (base && base !== 'https://api.openai.com') {
      headers['X-Cinegen-Base-Url'] = base;
    }
    const resp = await fetch(`${PROXY_BASE}/proxy/v1/audio/voices`, { signal, headers });
    if (!resp.ok) return [];
    const data = await safeRespJson(resp, {});
    const raw =
      (Array.isArray(data?.voices) && data.voices) ||
      (Array.isArray(data?.data) && data.data) ||
      [];
    const names = raw.map((row: any) => {
      if (typeof row === 'string') return row;
      return row?.id || row?.name || row?.voice || '';
    });
    return saUniqueStrings(names);
  } catch {
    return [];
  }
}

function saAttachVoicesToModels(models: Array<{ id: string; label: string }>, voices: string[]) {
  if (!voices.length) return models;
  return models.map((m) => ({ ...m, voices }));
}

/* ── Proxied generic fetch for /v1/models endpoints ──────────────────────── */

async function proxiedFetchModels(key: any, baseUrl: any, target: string, signal: any, mod?: string) {
  const base = (baseUrl || '').replace(/\/$/, '');
  const isTogether = base.includes('api.together.ai') || base.includes('together.xyz');
  const url = `${PROXY_BASE}/proxy/v1/models`;
  let resp;
  try {
    const headers = proxyHeaders(target, key);
    if (base && base !== 'https://api.openai.com') {
      headers['X-Cinegen-Base-Url'] = base;
    }
    resp = await fetch(url, { signal, headers });
  } catch (e: any) {
    if (e.name === 'AbortError') throw e;
    return { ok: false, rateLimit: false, message: saCorsHint(e.message), models: [] };
  }

  if (resp.status === 401 || resp.status === 403) return { ok: false, rateLimit: false, message: `Authentication failed (HTTP ${resp.status}). Check your API key.`, models: [] };
  if (resp.status === 503) return { ok: false, rateLimit: false, message: 'No API key configured. Add the key in Settings → AI Models.', models: [] };
  if (resp.status === 429) return { ok: true, rateLimit: true, message: `Rate limited (${resp.status}).`, models: [] };
  if (!resp.ok) return { ok: false, rateLimit: false, message: `HTTP ${resp.status} — ${resp.statusText}`, models: [] };

  const data = await safeRespJson(resp, {});
  const raw  = Array.isArray(data) ? data : (Array.isArray(data.data) ? data.data : []);

  /* ── Pre-categorize fetched models into ALL modalities ────────────────────── */
  /*
   * Providers' /v1/models endpoints typically return ALL their models in one list.
   * Instead of filtering for just the requested `mod`, we categorize into every
   * modality and return the complete set so the caller can cache everything.
   * This means testing LLM also caches audio models → coverage step just reads
   * from storage without needing a separate audio test or auto-detection logic.
   */
  const MODALITIES = ['llm', 'image', 'video', 'audio'] as const;
  const categorized: Record<string, any[]> = {};

  // Together AI video models are hardcoded (not in /v1/models response)
  if (isTogether) {
    categorized.video = saTogetherVideoModels();
  }

  // xAI audio models: merge hardcoded fallback with any API-discovered ones
  if (target === 'xai') {
    const xaiAudioApi = raw.map(saNormalizeOpenAiModelRow).filter(Boolean)
      .filter((m: any) => saIsAudioModelId(m.id) || /grok/i.test(m.id));
    const xaiHardcoded = saXaiAudioModels();
    if (!xaiAudioApi.length) {
      categorized.audio = xaiHardcoded;
    } else {
      const seen = new Set(xaiAudioApi.map((m: any) => m.id));
      const merged = [...xaiAudioApi];
      for (const m of xaiHardcoded) {
        if (!seen.has(m.id)) merged.push(m);
      }
      categorized.audio = merged;
    }
  }

  // Fill in any empty categories via standard filter
  MODALITIES.forEach((m) => {
    if (!categorized[m]) {
      categorized[m] = saFilterOpenAIModels(raw, m);
    }
  });

  if ((mod === 'audio' || categorized.audio?.length) && (target === 'openai' || target === 'xai' || target === 'together' || target === 'elevenlabs' || target === 'groq' || target === 'mistral' || target === 'deepseek')) {
    const voices = await saFetchVoicesForAudioTarget(target, key, base, signal);
    if (voices.length && Array.isArray(categorized.audio)) {
      categorized.audio = saAttachVoicesToModels(categorized.audio as Array<{ id: string; label: string }>, voices);
    }
  }

  return {
    ok: true,
    rateLimit: false,
    message: '',
    models:
      (mod && mod === 'audio' && Array.isArray(categorized.audio)
        ? categorized.audio
        : (mod && categorized[mod])) || categorized.llm || [],
    _categorized: categorized,
  };
}

async function proxiedGetModels(key: any, _baseUrl: any, target: string, path: string, signal: any) {
  const url = `${PROXY_BASE}/proxy/${path}`;
  let resp;
  try {
    resp = await fetch(url, { signal, headers: proxyHeaders(target, key) });
  } catch (e: any) {
    if (e.name === 'AbortError') throw e;
    return { ok: false, rateLimit: false, message: saCorsHint(e.message), models: [] };
  }

  if (resp.status === 401 || resp.status === 403) return { ok: false, rateLimit: false, message: `Authentication failed (HTTP ${resp.status}). Check your API key.`, models: [] };
  if (resp.status === 503) return { ok: false, rateLimit: false, message: 'No API key configured.', models: [] };
  if (resp.status === 429) return { ok: true, rateLimit: true, message: `Rate limited (${resp.status}).`, models: [] };
  if (!resp.ok) return { ok: false, rateLimit: false, message: `HTTP ${resp.status} — ${resp.statusText}`, models: [] };

  const data = await safeRespJson(resp, {});
  const raw  = Array.isArray(data.models) ? data.models : [];
  return { ok: true, rateLimit: false, message: '', models: raw.slice(0, 30).map((m: any) => ({ id: (m.name || '').replace(/^models\//, ''), label: m.displayName || m.name })) };
}

/* ── Model filtering ──────────────────────────────────────────────────────── */
/*
 * Audio modality filtering respects API metadata where available:
 *
 * Cascade used here (for modality-level filtering, NOT sub-capability):
 *   1. Check model.type field — Together AI returns explicit `type` per model
 *   2. Fall back to ID-based heuristics — OpenAI/xAI models have NO `type` field
 *      in /v1/models; ElevenLabs uses boolean flags (can_do_text_to_speech)
 *
 * Sub-capability partitioning (TTS vs SFX vs Music) is handled by
 * modelMatchesAudioCapability() in provider-model-catalog.ts.
 */

function saNormalizeOpenAiModelRow(m: any) {
  const id = m && (m.id || m.name);
  if (!id) return null;
  return { id, label: m.display_name || m.displayName || m.label || id, type: typeof m.type === 'string' ? m.type.toLowerCase() : '' };
}

function saIsVideoModelId(id: any) {
  return /\/(video|veo|sora|kling|wan|hailuo|seedance|pixverse|vidu|i2v|t2v|r2v)/i.test(id)
    || /video|sora|veo|kling|wan|runway|luma|minimax|seedance|pixverse|vidu|hailuo|i2v|t2v|r2v/i.test(id);
}

function saIsImageModelId(id: any) {
  return /dall-e|gpt-image|grok-imagine-image|image|imagen|flux|seedream|qwen-image|ideogram|stable-diffusion|dreamshaper|juggernaut|hidream/i.test(id);
}

function saIsAudioModelId(id: any) {
  return /tts|whisper|orpheus|kokoro|sonic|speech|voice|audio/i.test(id)
    || /deepgram|cartesia|rime|minimax\/speech/i.test(id);
}

function saFilterOpenAIModels(raw: any, mod: any) {
  const entries = raw.map(saNormalizeOpenAiModelRow).filter(Boolean);
  if (mod === 'llm') {
    return entries.filter((m: any) => {
      if (m.type === 'chat' || m.type === 'language' || m.type === 'code') return true;
      if (m.type === 'image' || m.type === 'audio' || m.type === 'video' || m.type === 'embedding' || m.type === 'moderation') return false;
      if (saIsImageModelId(m.id) || saIsVideoModelId(m.id) || saIsAudioModelId(m.id)) return false;
      return !/embedding|moderation/i.test(m.id);
    }).slice(0, 60);
  }
  if (mod === 'image') {
    return entries.filter((m: any) => {
      if (m.type === 'image') return true;
      return saIsImageModelId(m.id);
    }).slice(0, 60);
  }
  // Audio modality filtering:
  //   1. model.type === 'audio' (Together AI never returns this; APIpie does)
  //   2. ID-based heuristics (OpenAI/xAI have NO type field in /v1/models;
  //      ElevenLabs uses can_do_text_to_speech boolean — captured by saIsAudioModelId)
  // Sub-capability partitioning (tts/sfx/music) happens later via getCachedAudioModelsByCapability
  if (mod === 'audio') {
    return entries.filter((m: any) => {
      if (m.type === 'audio') return true;
      return saIsAudioModelId(m.id);
    }).slice(0, 60);
  }
  if (mod === 'video') {
    return entries.filter((m: any) => m.type === 'video' || saIsVideoModelId(m.id)).slice(0, 60);
  }
  return entries.map((m: any) => ({ id: m.id, label: m.label })).slice(0, 20);
}

/* ── Together AI (video models not in GET /v1/models) ────────────────────── */

function saTogetherVideoModels() {
  return [
    { id: 'minimax/video-01-director', label: 'MiniMax 01 Director' },
    { id: 'minimax/hailuo-02', label: 'MiniMax Hailuo 02' },
    { id: 'google/veo-2.0', label: 'Google Veo 2.0' },
    { id: 'google/veo-3.0', label: 'Google Veo 3.0' },
    { id: 'google/veo-3.0-audio', label: 'Google Veo 3.0 + Audio' },
    { id: 'google/veo-3.0-fast', label: 'Google Veo 3.0 Fast' },
    { id: 'google/veo-3.0-fast-audio', label: 'Google Veo 3.0 Fast + Audio' },
    { id: 'ByteDance/Seedance-1.0-lite', label: 'ByteDance Seedance 1.0 Lite' },
    { id: 'ByteDance/Seedance-1.0-pro', label: 'ByteDance Seedance 1.0 Pro' },
    { id: 'ByteDance/Seedance-2.0', label: 'ByteDance Seedance 2.0' },
    { id: 'pixverse/pixverse-v5', label: 'PixVerse v5' },
    { id: 'pixverse/pixverse-v5.6', label: 'PixVerse v5.6' },
    { id: 'pixverse/pixverse-v6', label: 'PixVerse v6' },
    { id: 'kwaivgI/kling-2.1-master', label: 'Kling 2.1 Master' },
    { id: 'kwaivgI/kling-2.1-standard', label: 'Kling 2.1 Standard' },
    { id: 'kwaivgI/kling-2.1-pro', label: 'Kling 2.1 Pro' },
    { id: 'kwaivgI/kling-2.0-master', label: 'Kling 2.0 Master' },
    { id: 'kwaivgI/kling-1.6-standard', label: 'Kling 1.6 Standard' },
    { id: 'kwaivgI/kling-1.6-pro', label: 'Kling 1.6 Pro' },
    { id: 'Wan-AI/Wan2.2-I2V-A14B', label: 'Wan 2.2 I2V' },
    { id: 'Wan-AI/Wan2.2-T2V-A14B', label: 'Wan 2.2 T2V' },
    { id: 'Wan-AI/wan2.7-t2v', label: 'Wan 2.7 T2V' },
    { id: 'Wan-AI/wan2.7-i2v', label: 'Wan 2.7 I2V' },
    { id: 'Wan-AI/wan2.7-r2v', label: 'Wan 2.7 R2V' },
    { id: 'vidu/vidu-2.0', label: 'Vidu 2.0' },
    { id: 'vidu/vidu-q1', label: 'Vidu Q1' },
    { id: 'vidu/vidu-q3', label: 'Vidu Q3' },
    { id: 'vidu/vidu-q3-turbo', label: 'Vidu Q3 Turbo' },
    { id: 'openai/sora-2', label: 'OpenAI Sora 2' },
    { id: 'openai/sora-2-pro', label: 'OpenAI Sora 2 Pro' },
    { id: 'alibaba/happyhorse-1.0-t2v', label: 'HappyHorse 1.0 T2V' },
  ];
}

function saXaiAudioModels() {
  return [
    { id: 'grok-tts', label: 'Grok TTS' },
    { id: 'grok-audio', label: 'Grok Audio' },
  ];
}

/* ── Anthropic ──────────────────────────────────────────────────────────── */

// Handled by proxiedFetchModels with target 'anthropic'

/* ── Google Gemini ──────────────────────────────────────────────────────── */

// Handled by proxiedGetModels with target 'google'

/* ── ElevenLabs ──────────────────────────────────────────────────────────── */

// Handled by proxiedFetchModels with target 'elevenlabs'

/* ── Provider-specific static model lists ──────────────────────────────── */

function saRunwayApiVideoModels() {
  return [
    { id: 'gen4.5', label: 'Gen-4.5 (text or image → video)' },
    { id: 'gen4_turbo', label: 'Gen-4 Turbo (image → video)' },
    { id: 'gen4_aleph', label: 'Gen-4 Aleph (video + text/image → video)' },
    { id: 'act_two', label: 'Act Two (character performance)' },
    { id: 'veo3', label: 'Veo 3 (text or image → video)' },
    { id: 'veo3.1', label: 'Veo 3.1 (text or image → video)' },
    { id: 'veo3.1_fast', label: 'Veo 3.1 Fast (text or image → video)' },
  ];
}

function saLumaApiVideoModels() {
  return [
    { id: 'ray-1-6', label: 'Ray 1.6' },
    { id: 'ray-2', label: 'Ray 2' },
    { id: 'ray-flash-2', label: 'Ray 2 Flash' },
    { id: 'ray-3', label: 'Ray 3' },
    { id: 'ray-3-fast', label: 'Ray 3 Fast' },
  ];
}

/* ── fal.ai ─────────────────────────────────────────────────────────────── */

async function saFetchFalModels(key: any, mod: any, signal: any) {
  const categoriesByMod: Record<string, string[]> = {
    video: ['text-to-video', 'image-to-video', 'video-to-video'],
    image: ['text-to-image', 'image-to-image'],
    llm: [], audio: [],
  };
  const categories = categoriesByMod[mod] || [];
  if (!categories.length) {
    return { ok: false, rateLimit: false, message: 'fal.ai does not list models for this modality.', models: [] };
  }
  const seen = new Set<string>();
  const models: Array<{ id: string; label: string }> = [];
  for (const category of categories) {
    const url = `${PROXY_BASE}/proxy/v1/models?category=${encodeURIComponent(category)}&status=active&limit=50`;
    let resp;
    try {
      resp = await fetch(url, { signal, headers: proxyHeaders('fal', key) });
    } catch (e: any) {
      if (e.name === 'AbortError') throw e;
      return { ok: false, rateLimit: false, message: saCorsHint(e.message), models: [] };
    }
    if (resp.status === 401 || resp.status === 403) {
      return { ok: false, rateLimit: false, message: `Authentication failed (HTTP ${resp.status}). Check your fal.ai API key.`, models: [] };
    }
    if (resp.status === 503) return { ok: false, rateLimit: false, message: 'fal API key not configured. Add it in Settings.', models: [] };
    if (resp.status === 429) return { ok: true, rateLimit: true, message: `Rate limited (${resp.status}).`, models: [] };
    if (!resp.ok) continue;
    const data = await safeRespJson(resp, {});
    (Array.isArray(data.models) ? data.models : []).forEach((row: any) => {
      const id = row.endpoint_id || row.id;
      if (!id || seen.has(id)) return;
      seen.add(id);
      models.push({ id, label: row.metadata?.display_name || id });
    });
  }
  if (!models.length) {
    return { ok: false, rateLimit: false, message: `No ${mod} models returned from fal.ai.`, models: [] };
  }
  return { ok: true, rateLimit: false, message: '', models: models.slice(0, 60) };
}

/* ── Runway ML ──────────────────────────────────────────────────────────── */

async function saFetchRunway(key: any, mod: any, signal: any) {
  if (mod !== 'video') {
    return { ok: false, rateLimit: false, message: 'Runway API is video-only in CineGen.', models: [] };
  }
  try {
    const resp = await fetch(`${PROXY_BASE}/proxy/v1/tasks?limit=1`, {
      signal,
      headers: { ...proxyHeaders('runway', key), 'X-Runway-Version': '2024-11-06' },
    });
    if (resp.status === 401 || resp.status === 403) {
      return { ok: false, rateLimit: false, message: `Authentication failed (HTTP ${resp.status}). Check your Runway API key.`, models: [] };
    }
    if (resp.status === 503) return { ok: false, rateLimit: false, message: 'Runway API key not configured.', models: [] };
    if (resp.status === 429) return { ok: true, rateLimit: true, message: `Rate limited (${resp.status}).`, models: [] };
    if (resp.status >= 500) return { ok: false, rateLimit: false, message: `Runway API error (HTTP ${resp.status}).`, models: [] };
    return { ok: true, rateLimit: false, message: '', models: saRunwayApiVideoModels() };
  } catch (e: any) {
    if (e.name === 'AbortError') throw e;
    return { ok: false, rateLimit: false, message: saCorsHint(e.message), models: [] };
  }
}

/* ── Luma AI ────────────────────────────────────────────────────────────── */

async function saFetchLuma(key: any, mod: any, signal: any) {
  if (mod !== 'video') {
    return { ok: false, rateLimit: false, message: 'Luma Dream Machine API is video-only in CineGen.', models: [] };
  }
  try {
    const resp = await fetch(`${PROXY_BASE}/proxy/dream-machine/v1/generations?limit=1`, {
      signal,
      headers: proxyHeaders('luma', key),
    });
    if (resp.status === 401 || resp.status === 403) {
      return { ok: false, rateLimit: false, message: `Authentication failed (HTTP ${resp.status}). Check your Luma API key.`, models: [] };
    }
    if (resp.status === 503) return { ok: false, rateLimit: false, message: 'Luma API key not configured.', models: [] };
    if (resp.status === 429) return { ok: true, rateLimit: true, message: `Rate limited (${resp.status}).`, models: [] };
    if (resp.status >= 500) return { ok: false, rateLimit: false, message: `Luma API error (HTTP ${resp.status}).`, models: [] };
    return { ok: true, rateLimit: false, message: '', models: saLumaApiVideoModels() };
  } catch (e: any) {
    if (e.name === 'AbortError') throw e;
    return { ok: false, rateLimit: false, message: saCorsHint(e.message), models: [] };
  }
}

/* ── Replicate ───────────────────────────────────────────────────────────── */

async function saFetchReplicate(key: any, mod: any, signal: any) {
  const q = ({ video: 'text-to-video', image: 'text-to-image', llm: 'llm', audio: 'text-to-speech' } as Record<string, string>)[mod] || mod;
  try {
    const resp = await fetch(`${PROXY_BASE}/proxy/v1/models?search=${encodeURIComponent(q)}`, {
      signal,
      headers: proxyHeaders('replicate', key),
    });
    if (resp.status === 401 || resp.status === 403) {
      return { ok: false, rateLimit: false, message: `Authentication failed (HTTP ${resp.status}). Check your Replicate token.`, models: [] };
    }
    if (resp.status === 503) return { ok: false, rateLimit: false, message: 'Replicate API token not configured.', models: [] };
    if (resp.status === 429) return { ok: true, rateLimit: true, message: `Rate limited (${resp.status}).`, models: [] };
    if (!resp.ok) {
      const ping = await fetch(`${PROXY_BASE}/proxy/v1/collections`, { signal, headers: proxyHeaders('replicate', key) });
      if (ping.status === 401 || ping.status === 403) {
        return { ok: false, rateLimit: false, message: `Authentication failed (HTTP ${ping.status}). Check your Replicate token.`, models: [] };
      }
      if (ping.ok) {
        return { ok: true, rateLimit: false, message: 'Connected — Replicate model search unavailable; use owner/name format.', models: [] };
      }
      return { ok: false, rateLimit: false, message: `HTTP ${resp.status}`, models: [] };
    }
    const data = await safeRespJson(resp, {});
    const models = (Array.isArray(data.results) ? data.results : [])
      .map((m: any) => {
        const owner = m.owner || m.username || '';
        const name = m.name || '';
        const id = owner && name ? `${owner}/${name}` : (m.id || name);
        return id ? { id, label: id } : null;
      })
      .filter(Boolean)
      .slice(0, 40);
    return { ok: true, rateLimit: false, message: '', models };
  } catch (e: any) {
    if (e.name === 'AbortError') throw e;
    return { ok: false, rateLimit: false, message: saCorsHint(e.message), models: [] };
  }
}

/* ── Generic / catch-all ─────────────────────────────────────────────────── */

async function saFetchGenericPing(providerId: any, key: any, baseUrl: any, mod: any, signal: any) {
  if (providerId === 'fal-ai') return saFetchFalModels(key, mod, signal);
  if (providerId === 'runway-api') return saFetchRunway(key, mod, signal);
  if (providerId === 'luma-api') return saFetchLuma(key, mod, signal);
  if (providerId === 'replicate-api') return saFetchReplicate(key, mod, signal);

  if (providerId === 'generic-rest' && baseUrl) {
    const url = `${PROXY_BASE}/proxy/v1/models`;
    try {
      const headers: Record<string, string> = { 'X-Cinegen-Target': 'custom' };
      if (isRealKey(key)) headers['Authorization'] = `Bearer ${key}`;
      if (baseUrl) headers['X-Cinegen-Base-Url'] = baseUrl;
      const resp = await fetch(url, { signal, headers });
      if (resp.status === 401 || resp.status === 403) return { ok: false, rateLimit: false, message: `Authentication failed (HTTP ${resp.status}).`, models: [] };
      if (resp.status === 503) return { ok: false, rateLimit: false, message: 'API key not configured.', models: [] };
      if (resp.status === 429) return { ok: true, rateLimit: true, message: `Rate limited (${resp.status}).`, models: [] };
      if (!resp.ok) return { ok: false, rateLimit: false, message: `HTTP ${resp.status} — ${resp.statusText}`, models: [] };
      const data = await safeRespJson(resp, {});
      const raw  = Array.isArray(data) ? data : (Array.isArray(data.data) ? data.data : (Array.isArray(data.models) ? data.models : []));
      const models = saFilterOpenAIModels(raw.map((m: any) => ({ id: m.id || m.name })), mod);
      return { ok: true, rateLimit: false, message: '', models };
    } catch (e: any) {
      if (e.name === 'AbortError') throw e;
      return { ok: false, rateLimit: false, message: saCorsHint(e.message), models: [] };
    }
  }

  const valid = key && key.length > 8 && key !== '••••••••';
  return valid
    ? { ok: true, rateLimit: false, message: 'Key saved — no model listing endpoint for this provider.', models: [] }
    : { ok: false, rateLimit: false, message: 'No API key configured for this provider. Add it in Settings.', models: [] };
}

/* ── Error helpers ───────────────────────────────────────────────────────── */

function saCorsHint(originalMessage: any) {
  if (!originalMessage) return 'Network error — could not reach the API.';
  const lower = originalMessage.toLowerCase();
  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('cors')) {
    return 'Could not reach the proxy. Verify your web server is running.';
  }
  return `Network error: ${originalMessage}`;
}

/* ── Model helpers (used by wizard UI) ───────────────────────────────────── */

export function saGetCatalogModels(providerId: any, mod: any) {
  const w = window as unknown as Record<string, unknown>;
  const catalog = w.AI_API_MODEL_CATALOG as Record<string, Record<string, Array<{ id: string; label: string }>>> | undefined;
  if (!catalog) return [{ id: 'custom', label: 'Custom model id' }];
  const prov = catalog[providerId];
  if (!prov) return [{ id: 'custom', label: 'Custom model id' }];
  const list = prov[mod === 'llm' ? 'llm' : mod];
  if (!Array.isArray(list) || !list.length) return [{ id: 'custom', label: 'Custom model id' }];
  return list.map((m: any) => ({ id: m.id, label: m.label }));
}

export function saMergeModels(listed: any, catalog: any) {
  const seen = new Set();
  const result = [];
  if (listed && listed.length) {
    for (const m of listed.slice(0, 60)) {
      if (!seen.has(m.id)) { seen.add(m.id); result.push(m); }
    }
  }
  if (catalog && catalog.length) {
    for (const m of catalog.slice(0, 60)) {
      if (!seen.has(m.id)) { seen.add(m.id); result.push(m); }
    }
  }
  return result;
}

export function saResolveModelLabel(s: any, mod: any) {
  if (!s?.modelId) return '';
  if (s.modelLabel) return s.modelLabel;
  const mSel = document.getElementById(`sa-model-${mod}`);
  const w = window as unknown as Record<string, unknown>;
  if (mSel && typeof w.labelFromModelSelect === 'function') {
    const fromSel = (w.labelFromModelSelect as Function)(mSel, s.modelId);
    if (fromSel) return fromSel as string;
  }
  const listed = (s.listedModels || []).find((m: any) => m.id === s.modelId);
  if (listed?.label) return listed.label;
  if (typeof w.getAiApiModelDisplayLabel === 'function') {
    return (w.getAiApiModelDisplayLabel as Function)(s.providerId, mod, s.modelId, '') as string;
  }
  return s.modelId;
}

export function saModelCaps(providerId: any, mod: any, modelId: any) {
  const w = window as unknown as Record<string, unknown>;
  const catalog = w.AI_API_MODEL_CATALOG as Record<string, Record<string, Array<{ id: string; caps?: { notes?: string } }>>> | undefined;
  if (!catalog || !modelId) return '';
  const prov  = catalog[providerId];
  if (!prov) return '';
  const modKey = mod === 'llm' ? 'llm' : mod;
  const entry  = (prov[modKey] || []).find((m: any) => m.id === modelId);
  if (!entry || !entry.caps) return '';
  if (typeof w.formatCapsText === 'function') {
    return (w.formatCapsText as Function)(entry.caps) as string;
  }
  return entry.caps.notes || '';
}

export function saStatusHtml(s: any) {
  if (!s.status) return '<i class="fa-solid fa-circle-info"></i> Not tested yet.';
  if (s.status === 'testing')   return '<i class="fa-solid fa-circle-notch fa-spin"></i> Testing…';
  if (s.status === 'ok') {
    const count = s.listedModels?.length || 0;
    const timeStr = s.fetchedAt ? ` loaded ${saFormatDateTime(s.fetchedAt)}` : '';
    return `<i class="fa-solid fa-circle-check"></i> Connected.${count ? ` ${count} model${count !== 1 ? 's' : ''} listed.${timeStr}` : ''}`;
  }
  if (s.status === 'ratelimit') return '<i class="fa-solid fa-circle-check"></i> Rate limited — key looks valid.';
  if (s.status === 'cors')      return `<i class="fa-solid fa-circle-exclamation"></i> ${escHtml(s.statusMsg || 'Network error.')}`;
  return `<i class="fa-solid fa-circle-xmark"></i> ${escHtml(s.statusMsg || 'Error.')}`;
}

function saFormatDateTime(timestamp: any) {
  if (!timestamp) return '';
  try { return new Date(timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  catch { return ''; }
}
