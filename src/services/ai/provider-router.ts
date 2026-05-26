import type { AiVendorRoute } from '@/services/ai/types';
import { resolveOpenAiCompatibleTarget } from '@/services/ai/openai-compatible-target';

const TARGET_MAP: Record<string, string> = {
  'openai-compatible': 'openai',
  'anthropic-messages-api': 'anthropic',
  'google-gemini-api': 'google',
  'elevenlabs-api': 'elevenlabs',
  'fal-ai': 'fal',
  'runway-api': 'runway',
  'luma-api': 'luma',
  'replicate-api': 'replicate',
};

export function providerTarget(providerId: string): string {
  return TARGET_MAP[providerId] || 'custom';
}

export function resolveVendorTarget(vendor: AiVendorRoute): string {
  const openAiCompatibleTarget =
    vendor.providerId === 'openai-compatible'
      ? resolveOpenAiCompatibleTarget(vendor)
      : null;
  return openAiCompatibleTarget ?? providerTarget(vendor.providerId);
}

export function buildProxyHeaders(vendor: AiVendorRoute): Record<string, string> {
  const resolvedTarget = resolveVendorTarget(vendor);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Cinegen-Target': resolvedTarget,
  };
  if (vendor.baseUrl) {
    headers['X-Cinegen-Base-Url'] = vendor.baseUrl;
  }
  return headers;
}

export function proxyPath(path: string): string {
  return path.startsWith('/proxy') ? path : `/proxy${path.startsWith('/') ? path : `/${path}`}`;
}
