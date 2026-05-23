import { proxyBinaryRequest } from '@/services/ai/ai-request-client';
import { emitParamPolicyLog, sanitizeParamPolicy } from '@/services/ai/param-policy';
import type { AiVendorRoute } from '@/services/ai/types';

export interface AudioRequest {
  vendor: AiVendorRoute;
  model: string;
  input: string;
  voice?: string;
  responseFormat?: string;
  speed?: number;
  signal?: AbortSignal;
}

export class AudioGenerationService {
  async generate(request: AudioRequest): Promise<{ response: Response; blob?: Blob; errorText?: string }> {
    const body: Record<string, unknown> = {
      model: request.model,
      input: request.input,
      voice: request.voice ?? 'alloy',
      response_format: request.responseFormat ?? 'mp3',
      speed: request.speed ?? 1.0,
    };

    const policy = sanitizeParamPolicy({
      capability: 'audio',
      endpoint: 'audio.speech',
      vendor: request.vendor,
      model: request.model,
      body,
    });
    emitParamPolicyLog('audio', 'audio.speech', request.vendor, policy);

    return proxyBinaryRequest({
      capability: 'audio',
      path: '/v1/audio/speech',
      body: policy.body,
      vendor: request.vendor,
      signal: request.signal,
    });
  }
}
