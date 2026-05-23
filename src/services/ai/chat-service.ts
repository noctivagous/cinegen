import { proxyJsonRequest } from '@/services/ai/ai-request-client';
import { emitParamPolicyLog, sanitizeParamPolicy } from '@/services/ai/param-policy';
import type { AiJsonResult, AiVendorRoute } from '@/services/ai/types';

export interface ChatRequest {
  vendor: AiVendorRoute;
  model: string;
  prompt: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  signal?: AbortSignal;
}

export class ChatService {
  async generate(request: ChatRequest): Promise<AiJsonResult<any>> {
    const messages = request.system
      ? [
          { role: 'system', content: request.system },
          { role: 'user', content: request.prompt },
        ]
      : [{ role: 'user', content: request.prompt }];

    const body: Record<string, unknown> = {
      model: request.model,
      messages,
      max_tokens: request.maxTokens ?? 500,
      temperature: request.temperature ?? 0.7,
    };

    if (typeof request.topP === 'number' && request.topP !== 1.0) body.top_p = request.topP;
    if (typeof request.frequencyPenalty === 'number' && request.frequencyPenalty !== 0) {
      body.frequency_penalty = request.frequencyPenalty;
    }
    if (typeof request.presencePenalty === 'number' && request.presencePenalty !== 0) {
      body.presence_penalty = request.presencePenalty;
    }
    if (Array.isArray(request.stop) && request.stop.length) body.stop = request.stop;

    const policy = sanitizeParamPolicy({
      capability: 'text',
      endpoint: 'chat.completions',
      vendor: request.vendor,
      model: request.model,
      body,
    });
    emitParamPolicyLog('text', 'chat.completions', request.vendor, policy);

    return proxyJsonRequest<any>({
      capability: 'text',
      path: '/v1/chat/completions',
      body: policy.body,
      vendor: request.vendor,
      signal: request.signal,
    });
  }
}
