import { emitAiInteractionLog } from '@/services/ai/interaction-log';
import { resolveVendorTarget } from '@/services/ai/provider-router';
import type { AiVendorRoute, CapabilityKey } from '@/services/ai/types';

type ParamEndpoint =
  | 'chat.completions'
  | 'images.generations'
  | 'audio.speech'
  | 'videos.xai'
  | 'videos.together'
  | 'videos.generic';

interface ParamPolicyArgs {
  capability: CapabilityKey;
  endpoint: ParamEndpoint;
  vendor: AiVendorRoute;
  model: string;
  body: Record<string, unknown>;
}

interface ParamPolicyResult {
  body: Record<string, unknown>;
  dropped: string[];
  normalized: string[];
}

function parseSize(size: string): { width: number; height: number } | null {
  const match = /^(\d+)x(\d+)$/i.exec(size.trim());
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

function toAspectRatio(width: number, height: number): string | null {
  if (width === height) return '1:1';
  if (width * 9 === height * 16) return '16:9';
  if (width * 16 === height * 9) return '9:16';
  if (width * 3 === height * 4) return '4:3';
  if (width * 4 === height * 3) return '3:4';
  return null;
}

function coerceTogetherResolution(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/p$/i, 'P');
}

function isTogetherKontextOrSchnellModel(modelId: string): boolean {
  const id = modelId.toLowerCase();
  return id.includes('kontext') || id.includes('schnell');
}

function sanitizeTogetherImageBody(body: Record<string, unknown>, model: string, result: ParamPolicyResult): void {
  const size = typeof body.size === 'string' ? body.size : '';
  const dims = size ? parseSize(size) : null;
  if (dims) {
    if (isTogetherKontextOrSchnellModel(model)) {
      const ratio = toAspectRatio(dims.width, dims.height);
      if (ratio) {
        body.aspect_ratio = ratio;
        result.normalized.push(`size -> aspect_ratio (${ratio})`);
      } else {
        body.width = dims.width;
        body.height = dims.height;
        result.normalized.push('size -> width/height');
      }
    } else {
      body.width = dims.width;
      body.height = dims.height;
      result.normalized.push('size -> width/height');
    }
    delete body.size;
  }

  if (body.response_format === 'b64_json') {
    body.response_format = 'base64';
    result.normalized.push('response_format b64_json -> base64');
  }

  if (typeof body.cfg_scale === 'number' && typeof body.guidance_scale !== 'number') {
    body.guidance_scale = body.cfg_scale;
    result.normalized.push('cfg_scale -> guidance_scale');
  }
  delete body.cfg_scale;
}

function sanitizeTogetherAudioBody(body: Record<string, unknown>, result: ParamPolicyResult): void {
  if (typeof body.speed === 'number') {
    delete body.speed;
    result.dropped.push('speed (Together TTS param mismatch)');
  }
  if (body.response_format === 'pcm') {
    body.response_format = 'raw';
    result.normalized.push('response_format pcm -> raw');
  }
}

function sanitizeTogetherVideoBody(model: string, body: Record<string, unknown>, result: ParamPolicyResult): void {
  const normalizedResolution = coerceTogetherResolution(body.resolution);
  if (normalizedResolution && normalizedResolution !== body.resolution) {
    body.resolution = normalizedResolution;
    result.normalized.push(`resolution -> ${normalizedResolution}`);
  }

  const modelId = model.toLowerCase();
  if (typeof body.guidance_scale === 'number' && modelId === 'minimax/video-01-director') {
    delete body.guidance_scale;
    result.dropped.push('guidance_scale (unsupported by minimax/video-01-director)');
  }
  if (modelId === 'minimax/video-01-director') {
    if (body.resolution && String(body.resolution).toUpperCase() !== '720P') {
      body.resolution = '720P';
      result.normalized.push('resolution -> 720P (model constraint)');
    }
  }
}

export function sanitizeParamPolicy(args: ParamPolicyArgs): ParamPolicyResult {
  const target = resolveVendorTarget(args.vendor);
  const body: Record<string, unknown> = { ...args.body };
  const result: ParamPolicyResult = { body, dropped: [], normalized: [] };

  Object.keys(body).forEach((key) => {
    const value = body[key];
    if (value === undefined || value === null || value === '') {
      delete body[key];
      result.dropped.push(`${key} (empty)`);
    }
  });

  if (target === 'together' && args.endpoint === 'images.generations') {
    sanitizeTogetherImageBody(body, args.model, result);
  }
  if (target === 'together' && args.endpoint === 'audio.speech') {
    sanitizeTogetherAudioBody(body, result);
  }
  if (target === 'together' && args.endpoint === 'videos.together') {
    sanitizeTogetherVideoBody(args.model, body, result);
  }
  if (target === 'xai' && args.endpoint === 'videos.xai') {
    if (typeof body.duration === 'number') {
      const bounded = Math.max(1, Math.min(15, Math.round(body.duration)));
      if (bounded !== body.duration) {
        body.duration = bounded;
        result.normalized.push(`duration clamped -> ${bounded}`);
      }
    }
  }

  return result;
}

export function emitParamPolicyLog(
  capability: CapabilityKey,
  endpoint: ParamEndpoint,
  vendor: AiVendorRoute,
  result: ParamPolicyResult
): void {
  if (!result.dropped.length && !result.normalized.length) return;
  if (result.normalized.length) {
    emitAiInteractionLog({
      capability,
      level: 'info',
      message: `↻ Param policy normalized (${endpoint}, ${vendor.name}): ${result.normalized.join(', ')}`,
    });
  }
  if (result.dropped.length) {
    emitAiInteractionLog({
      capability,
      level: 'info',
      message: `↻ Param policy dropped (${endpoint}, ${vendor.name}): ${result.dropped.join(', ')}`,
    });
  }
}
