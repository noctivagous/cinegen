import { proxyJsonRequest } from '@/services/ai/ai-request-client';
import { emitAiInteractionLog } from '@/services/ai/interaction-log';
import { emitParamPolicyLog, sanitizeParamPolicy } from '@/services/ai/param-policy';
import { buildProxyHeaders, proxyPath } from '@/services/ai/provider-router';
import type { AiJsonResult, AiVendorRoute } from '@/services/ai/types';

export interface VideoRequest {
  vendor: AiVendorRoute;
  model: string;
  prompt: string;
  duration?: number;
  aspectRatio?: string;
  resolution?: string;
  seed?: number;
  cfgScale?: number;
  signal?: AbortSignal;
  onProgress?: (update: { status: string; progress: number | null }) => void;
}

export class VideoGenerationService {
  private _camelToSnake(value: string): string {
    return value
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/-/g, '_')
      .toLowerCase();
  }

  private _extractTogetherUnsupportedParam(result: AiJsonResult<any>): string | null {
    const status = String(result.data?.status || '').toLowerCase();
    if (status !== 'failed') return null;
    const message = String(result.data?.error?.message || result.rawText || '');
    const match = message.match(/Unsupported use of ['"]([^'"]+)['"] parameter/i);
    if (!match?.[1]) return null;
    const raw = String(match[1]).trim();
    if (!raw) return null;
    return this._camelToSnake(raw);
  }

  private _isTogetherInvalidSecondsFailure(result: AiJsonResult<any>): boolean {
    const status = String(result.data?.status || '').toLowerCase();
    if (status !== 'failed') return false;
    const message = String(result.data?.error?.message || result.rawText || '').toLowerCase();
    return message.includes('seconds') && (message.includes('invalid value') || message.includes('unsupported'));
  }

  private _isXaiVendor(vendor: AiVendorRoute): boolean {
    const slotId = (vendor.slotId || '').toLowerCase();
    const name = (vendor.name || '').toLowerCase();
    const baseUrl = (vendor.baseUrl || '').toLowerCase();
    return (
      slotId === 'xai' ||
      name.includes('xai') ||
      name.includes('x.ai') ||
      baseUrl.includes('x.ai')
    );
  }

  private _isTogetherVendor(vendor: AiVendorRoute): boolean {
    const slotId = (vendor.slotId || '').toLowerCase();
    const name = (vendor.name || '').toLowerCase();
    const baseUrl = (vendor.baseUrl || '').toLowerCase();
    return (
      slotId === 'together' ||
      name.includes('together') ||
      baseUrl.includes('together.ai') ||
      baseUrl.includes('together.xyz')
    );
  }

  private async _proxyGetJson(path: string, vendor: AiVendorRoute, signal?: AbortSignal): Promise<AiJsonResult<any>> {
    emitAiInteractionLog({
      capability: 'video',
      level: 'info',
      message: `→ GET ${path} [${vendor.name}]`,
    });
    const response = await fetch(proxyPath(path), {
      method: 'GET',
      headers: buildProxyHeaders(vendor),
      signal,
    });
    emitAiInteractionLog({
      capability: 'video',
      level: response.ok ? 'info' : 'error',
      message: `← ${response.status} ${response.ok ? 'OK' : 'ERROR'} [${vendor.name}]`,
    });
    const rawText = await response.text();
    emitAiInteractionLog({
      capability: 'video',
      level: response.ok ? 'info' : 'error',
      message: `← body: ${rawText.slice(0, 300) || '[empty body]'}`,
    });
    let data: any = null;
    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch {
        data = null;
      }
    }
    return { response, data, rawText };
  }

  private _normalizedVideoResult(url: string, raw: unknown, response: Response): AiJsonResult<any> {
    const data = { data: [{ video: { url }, url }] };
    return { response, data, rawText: typeof raw === 'string' ? raw : JSON.stringify(raw || data) };
  }

  private async _sleep(ms: number, signal?: AbortSignal): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      const onAbort = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      if (signal) {
        if (signal.aborted) {
          onAbort();
          return;
        }
        signal.addEventListener('abort', onAbort);
      }
    });
  }

  private async _generateXaiVideo(request: VideoRequest): Promise<AiJsonResult<any>> {
    const body: Record<string, unknown> = {
      model: request.model,
      prompt: request.prompt,
      duration: request.duration ?? 5,
      aspect_ratio: request.aspectRatio ?? '16:9',
      resolution: request.resolution ?? '480p',
    };
    const policy = sanitizeParamPolicy({
      capability: 'video',
      endpoint: 'videos.xai',
      vendor: request.vendor,
      model: request.model,
      body,
    });
    emitParamPolicyLog('video', 'videos.xai', request.vendor, policy);

    const create = await proxyJsonRequest<any>({
      capability: 'video',
      path: '/v1/videos/generations',
      body: policy.body,
      vendor: request.vendor,
      bodyLogLimit: 300,
      signal: request.signal,
    });
    if (!create.response.ok) return create;
    const requestId = create.data?.request_id;
    if (!requestId) return create;
    request.onProgress?.({ status: 'pending', progress: 0 });
    for (let i = 0; i < 30; i++) {
      const poll = await this._proxyGetJson(`/v1/videos/${requestId}`, request.vendor, request.signal);
      if (!poll.response.ok) return poll;
      const status = String(poll.data?.status || '').toLowerCase();
      const progressRaw = poll.data?.progress;
      const progress = typeof progressRaw === 'number' ? progressRaw : null;
      request.onProgress?.({ status, progress });
      if (status === 'done') {
        const url = poll.data?.video?.url || poll.data?.url || '';
        if (url) return this._normalizedVideoResult(url, poll.data, poll.response);
        return poll;
      }
      if (status === 'failed' || status === 'expired') return poll;
      await this._sleep(3000, request.signal);
    }
    return {
      response: create.response,
      data: { error: { message: 'Timed out waiting for xAI video generation.' } },
      rawText: '{"error":{"message":"Timed out waiting for xAI video generation."}}',
    };
  }

  private async _generateTogetherVideo(request: VideoRequest): Promise<AiJsonResult<any>> {
    const body: Record<string, unknown> = {
      model: request.model,
      prompt: request.prompt,
      seconds: String(request.duration ?? 5),
    };
    if (request.aspectRatio) body.ratio = request.aspectRatio;
    if (request.resolution) body.resolution = request.resolution;
    if (typeof request.seed === 'number') body.seed = request.seed;
    if (typeof request.cfgScale === 'number') body.guidance_scale = request.cfgScale;
    const policy = sanitizeParamPolicy({
      capability: 'video',
      endpoint: 'videos.together',
      vendor: request.vendor,
      model: request.model,
      body,
    });
    emitParamPolicyLog('video', 'videos.together', request.vendor, policy);

    let requestBody: Record<string, unknown> = { ...policy.body };
    let create = await proxyJsonRequest<any>({
      capability: 'video',
      path: '/v2/videos',
      body: requestBody,
      vendor: request.vendor,
      bodyLogLimit: 300,
      signal: request.signal,
    });
    if (!create.response.ok) return create;

    for (let attempts = 0; attempts < 3; attempts++) {
      const createStatus = String(create.data?.status || '').toLowerCase();
      if (createStatus !== 'failed' && createStatus !== 'cancelled') break;

      const unsupportedParam = this._extractTogetherUnsupportedParam(create);
      if (unsupportedParam && Object.prototype.hasOwnProperty.call(requestBody, unsupportedParam)) {
        delete requestBody[unsupportedParam];
        emitAiInteractionLog({
          capability: 'video',
          level: 'info',
          message: `↻ Retrying Together video without ${unsupportedParam} (unsupported by model).`,
        });
        create = await proxyJsonRequest<any>({
          capability: 'video',
          path: '/v2/videos',
          body: requestBody,
          vendor: request.vendor,
          bodyLogLimit: 300,
          signal: request.signal,
        });
        if (!create.response.ok) return create;
        continue;
      }

      if (this._isTogetherInvalidSecondsFailure(create)) {
        emitAiInteractionLog({
          capability: 'video',
          level: 'error',
          message: '⚠ Together model rejected the requested seconds value. Keeping your selected duration (no silent fallback to provider default).',
        });
        break;
      }
      break;
    }
    const createStatus = String(create.data?.status || '').toLowerCase();
    if (createStatus === 'failed' || createStatus === 'cancelled') {
      request.onProgress?.({ status: createStatus, progress: null });
      return create;
    }

    const directUrl = create.data?.outputs?.video_url;
    if (directUrl) return this._normalizedVideoResult(directUrl, create.data, create.response);

    const jobId = create.data?.id;
    if (!jobId) return create;
    request.onProgress?.({ status: 'queued', progress: null });

    for (let i = 0; i < 60; i++) {
      const poll = await this._proxyGetJson(`/v2/videos/${jobId}`, request.vendor, request.signal);
      if (!poll.response.ok) return poll;
      const status = String(poll.data?.status || '').toLowerCase();
      request.onProgress?.({ status, progress: null });
      if (status === 'completed') {
        const url = poll.data?.outputs?.video_url;
        if (url) return this._normalizedVideoResult(url, poll.data, poll.response);
        return poll;
      }
      if (status === 'failed' || status === 'cancelled') return poll;
      await this._sleep(3000, request.signal);
    }
    return {
      response: create.response,
      data: { error: { message: 'Timed out waiting for Together video generation.' } },
      rawText: '{"error":{"message":"Timed out waiting for Together video generation."}}',
    };
  }

  async generate(request: VideoRequest): Promise<AiJsonResult<any>> {
    if (this._isXaiVendor(request.vendor)) {
      return this._generateXaiVideo(request);
    }
    if (this._isTogetherVendor(request.vendor)) {
      return this._generateTogetherVideo(request);
    }

    const body: Record<string, unknown> = {
      model: request.model,
      prompt: request.prompt,
      duration: request.duration ?? 5,
    };

    if (request.aspectRatio) body.ratio = request.aspectRatio;
    if (typeof request.seed === 'number') body.seed = request.seed;
    if (typeof request.cfgScale === 'number') body.cfg_scale = request.cfgScale;

    const policy = sanitizeParamPolicy({
      capability: 'video',
      endpoint: 'videos.generic',
      vendor: request.vendor,
      model: request.model,
      body,
    });
    emitParamPolicyLog('video', 'videos.generic', request.vendor, policy);

    return proxyJsonRequest<any>({
      capability: 'video',
      path: '/v1/video/generations',
      body: policy.body,
      vendor: request.vendor,
      bodyLogLimit: 300,
      signal: request.signal,
    });
  }
}
