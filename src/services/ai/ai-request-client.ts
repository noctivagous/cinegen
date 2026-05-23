import { emitAiInteractionLog } from '@/services/ai/interaction-log';
import { buildProxyHeaders, proxyPath } from '@/services/ai/provider-router';
import type { AiJsonResult, AiVendorRoute, CapabilityKey } from '@/services/ai/types';

interface JsonRequestArgs {
  capability: CapabilityKey;
  path: string;
  body: unknown;
  vendor: AiVendorRoute;
  bodyLogLimit?: number;
  signal?: AbortSignal;
}

interface BinaryRequestArgs {
  capability: CapabilityKey;
  path: string;
  body: unknown;
  vendor: AiVendorRoute;
  errorLogLimit?: number;
  signal?: AbortSignal;
}

function safeStringify(payload: unknown): string {
  try {
    return JSON.stringify(payload);
  } catch {
    return '[unserializable payload]';
  }
}

export async function proxyJsonRequest<T>({
  capability,
  path,
  body,
  vendor,
  bodyLogLimit = 500,
  signal,
}: JsonRequestArgs): Promise<AiJsonResult<T>> {
  const bodyStr = safeStringify(body);
  emitAiInteractionLog({
    capability,
    level: 'info',
    message: `→ POST ${path} [${vendor.name}]\n   ${bodyStr}`,
  });

  try {
    const response = await fetch(proxyPath(path), {
      method: 'POST',
      headers: buildProxyHeaders(vendor),
      body: bodyStr,
      signal,
    });

    emitAiInteractionLog({
      capability,
      level: response.ok ? 'info' : 'error',
      message: `← ${response.status} ${response.ok ? 'OK' : 'ERROR'} [${vendor.name}]`,
    });

    const rawText = await response.text();
    const truncated = rawText.slice(0, bodyLogLimit);
    emitAiInteractionLog({
      capability,
      level: response.ok ? 'info' : 'error',
      message: `← body: ${truncated || '[empty body]'}`,
    });

    let data: T | null = null;
    if (rawText) {
      try {
        data = JSON.parse(rawText) as T;
      } catch {
        data = null;
      }
    }

    return { response, data, rawText };
  } catch (error: any) {
    emitAiInteractionLog({
      capability,
      level: 'error',
      message: `✗ ${error?.message || 'Network error'}`,
    });
    throw error;
  }
}

export async function proxyBinaryRequest({
  capability,
  path,
  body,
  vendor,
  errorLogLimit = 200,
  signal,
}: BinaryRequestArgs): Promise<{ response: Response; blob?: Blob; errorText?: string }> {
  const bodyStr = safeStringify(body);
  emitAiInteractionLog({
    capability,
    level: 'info',
    message: `→ POST ${path} [${vendor.name}]\n   ${bodyStr}`,
  });

  try {
    const response = await fetch(proxyPath(path), {
      method: 'POST',
      headers: buildProxyHeaders(vendor),
      body: bodyStr,
      signal,
    });

    emitAiInteractionLog({
      capability,
      level: response.ok ? 'info' : 'error',
      message: `← ${response.status} ${response.ok ? 'OK' : 'ERROR'} [${vendor.name}]`,
    });

    if (response.ok) {
      const blob = await response.blob();
      emitAiInteractionLog({
        capability,
        level: 'info',
        message: `← audio blob (${blob.size} bytes)`,
      });
      return { response, blob };
    }

    const errorText = await response.text().catch(() => '');
    emitAiInteractionLog({
      capability,
      level: 'error',
      message: `← error: ${errorText.slice(0, errorLogLimit) || response.statusText}`,
    });
    return { response, errorText };
  } catch (error: any) {
    emitAiInteractionLog({
      capability,
      level: 'error',
      message: `✗ ${error?.message || 'Network error'}`,
    });
    throw error;
  }
}
