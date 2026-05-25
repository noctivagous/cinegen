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

const IMAGE_DIM_ALIGNMENT = 16;
const IMAGE_DIM_MIN = 64;

function snapImageDimension(value: number): number {
  const snapped = Math.round(value / IMAGE_DIM_ALIGNMENT) * IMAGE_DIM_ALIGNMENT;
  return Math.max(IMAGE_DIM_MIN, snapped);
}

function parseSize(size: string): { width: number; height: number } | null {
  const match = /^(\d+)x(\d+)$/i.exec(size.trim());
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

/** Snap width/height to multiples of 16 (Together FLUX and similar image APIs). */
export function alignImageDimensions(width: number, height: number): { width: number; height: number } {
  return {
    width: snapImageDimension(width),
    height: snapImageDimension(height),
  };
}

function toAspectRatio(width: number, height: number): string | null {
  if (width === height) return '1:1';
  if (width * 9 === height * 16) return '16:9';
  if (width * 16 === height * 9) return '9:16';
  if (width * 3 === height * 4) return '4:3';
  if (width * 4 === height * 3) return '3:4';
  if (width * 2 === height * 3) return '2:3';
  if (width * 3 === height * 2) return '3:2';
  if (width === height * 2) return '2:1';
  if (width * 2 === height) return '1:2';
  return null;
}

/** Nearest xAI-supported aspect_ratio from pixel dimensions (docs.x.ai images API). */
function toXaiAspectRatio(width: number, height: number): string {
  const exact = toAspectRatio(width, height);
  if (exact) return exact;
  const r = width / height;
  if (r >= 1.9) return '2:1';
  if (r >= 1.65) return '16:9';
  if (r >= 1.4) return '3:2';
  if (r >= 1.15) return '4:3';
  if (r >= 0.92) return '1:1';
  if (r >= 0.72) return '3:4';
  if (r >= 0.58) return '9:16';
  if (r >= 0.5) return '2:3';
  return '9:16';
}

function sanitizeXaiImageBody(body: Record<string, unknown>, result: ParamPolicyResult): void {
  const size = typeof body.size === 'string' ? body.size : '';
  const dims = size ? parseSize(size) : null;
  if (dims) {
    body.aspect_ratio = toXaiAspectRatio(dims.width, dims.height);
    result.normalized.push(`size -> aspect_ratio (${body.aspect_ratio})`);
    delete body.size;
  } else if (typeof body.width === 'number' && typeof body.height === 'number') {
    body.aspect_ratio = toXaiAspectRatio(body.width, body.height);
    result.normalized.push(`width/height -> aspect_ratio (${body.aspect_ratio})`);
    delete body.width;
    delete body.height;
  }

  if (body.quality === 'hd' && !body.resolution) {
    body.resolution = '2k';
    result.normalized.push('quality hd -> resolution 2k');
  }

  const unsupported = [
    'size',
    'quality',
    'style',
    'negative_prompt',
    'seed',
    'num_inference_steps',
    'cfg_scale',
    'guidance_scale',
    'width',
    'height',
  ];
  for (const key of unsupported) {
    if (!(key in body)) continue;
    delete body[key];
    result.dropped.push(`${key} (unsupported by xAI images API)`);
  }
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
        const aligned = alignImageDimensions(dims.width, dims.height);
        body.width = aligned.width;
        body.height = aligned.height;
        result.normalized.push('size -> width/height (aligned)');
      }
    } else {
      const aligned = alignImageDimensions(dims.width, dims.height);
      body.width = aligned.width;
      body.height = aligned.height;
      if (aligned.width !== dims.width || aligned.height !== dims.height) {
        result.normalized.push(
          `size -> width/height (${dims.width}x${dims.height} -> ${aligned.width}x${aligned.height}, 16px grid)`
        );
      } else {
        result.normalized.push('size -> width/height');
      }
    }
    delete body.size;
  }

  if (typeof body.width === 'number' && typeof body.height === 'number') {
    const aligned = alignImageDimensions(body.width, body.height);
    if (aligned.width !== body.width || aligned.height !== body.height) {
      body.width = aligned.width;
      body.height = aligned.height;
      result.normalized.push(`width/height aligned to 16px grid -> ${aligned.width}x${aligned.height}`);
    }
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
  if (target === 'xai' && args.endpoint === 'images.generations') {
    sanitizeXaiImageBody(body, result);
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
