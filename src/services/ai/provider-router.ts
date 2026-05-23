import type { AiVendorRoute } from '@/services/ai/types';

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

function targetFromVendorDetails(vendor: AiVendorRoute): string | null {
  if (vendor.providerId !== 'openai-compatible') return null;
  const slotId = (vendor.slotId || '').toLowerCase();
  const name = (vendor.name || '').toLowerCase();
  const baseUrl = (vendor.baseUrl || '').toLowerCase();

  if (slotId === 'xai') return 'xai';
  if (slotId === 'groq') return 'groq';
  if (slotId === 'together') return 'together';
  if (slotId === 'mistral') return 'mistral';
  if (slotId === 'deepseek') return 'deepseek';
  if (slotId === 'openai') return 'openai';

  if (name.includes('xai') || name.includes('x.ai') || baseUrl.includes('x.ai')) return 'xai';
  if (name.includes('groq') || baseUrl.includes('api.groq.com')) return 'groq';
  if (name.includes('together') || baseUrl.includes('api.together.xyz')) return 'together';
  if (name.includes('mistral') || baseUrl.includes('api.mistral.ai')) return 'mistral';
  if (name.includes('deepseek') || baseUrl.includes('api.deepseek.com')) return 'deepseek';

  return null;
}

export function resolveVendorTarget(vendor: AiVendorRoute): string {
  return targetFromVendorDetails(vendor) ?? providerTarget(vendor.providerId);
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
