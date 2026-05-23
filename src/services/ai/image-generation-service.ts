import { proxyJsonRequest } from '@/services/ai/ai-request-client';
import { emitParamPolicyLog, sanitizeParamPolicy } from '@/services/ai/param-policy';
import type { AiJsonResult, AiVendorRoute } from '@/services/ai/types';

export interface ImageRequest {
  vendor: AiVendorRoute;
  model: string;
  prompt: string;
  count?: number;
  size?: string;
  negativePrompt?: string;
  seed?: number;
  numInferenceSteps?: number;
  cfgScale?: number;
  quality?: 'standard' | 'hd';
  style?: 'vivid' | 'natural';
  signal?: AbortSignal;
}

export class ImageGenerationService {
  async generate(request: ImageRequest): Promise<AiJsonResult<any>> {
    const body: Record<string, unknown> = {
      model: request.model,
      prompt: request.prompt,
      n: request.count ?? 1,
      size: request.size ?? '1024x1024',
      response_format: 'b64_json',
    };

    if (request.negativePrompt) body.negative_prompt = request.negativePrompt;
    if (typeof request.seed === 'number') body.seed = request.seed;
    if (typeof request.numInferenceSteps === 'number') body.num_inference_steps = request.numInferenceSteps;
    if (typeof request.cfgScale === 'number') body.cfg_scale = request.cfgScale;
    if (request.quality && request.quality !== 'standard') body.quality = request.quality;
    if (request.style && request.style !== 'vivid') body.style = request.style;

    const policy = sanitizeParamPolicy({
      capability: 'image',
      endpoint: 'images.generations',
      vendor: request.vendor,
      model: request.model,
      body,
    });
    emitParamPolicyLog('image', 'images.generations', request.vendor, policy);

    return proxyJsonRequest<any>({
      capability: 'image',
      path: '/v1/images/generations',
      body: policy.body,
      vendor: request.vendor,
      bodyLogLimit: 300,
      signal: request.signal,
    });
  }
}
