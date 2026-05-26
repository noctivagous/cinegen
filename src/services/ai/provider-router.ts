import type { AiVendorRoute } from '@/services/ai/types';
import { resolveOpenAiCompatibleTarget } from '@/services/ai/openai-compatible-target';
import { defaultProxyTargetForProvider } from '@/constants/provider-registry.js';

export function providerTarget(providerId: string): string {
  return defaultProxyTargetForProvider(providerId);
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
