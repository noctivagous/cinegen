/**
 * Canonical provider runtime registry used by both frontend routing helpers
 * and backend proxy wiring.
 */
export const PROVIDER_RUNTIME_REGISTRY = [
  {
    slotId: 'openai',
    name: 'OpenAI',
    providerId: 'openai-compatible',
    proxyTarget: 'openai',
    envKey: 'OPENAI_API_KEY',
    envBaseUrlKey: 'OPENAI_BASE_URL',
    defaultBaseUrl: 'https://api.openai.com',
    authHeader: 'Bearer',
  },
  {
    slotId: 'anthropic',
    name: 'Anthropic (Claude)',
    providerId: 'anthropic-messages-api',
    proxyTarget: 'anthropic',
    envKey: 'ANTHROPIC_API_KEY',
    defaultBaseUrl: 'https://api.anthropic.com',
    authHeader: 'x-api-key',
  },
  {
    slotId: 'google',
    name: 'Google AI (Gemini / Veo)',
    providerId: 'google-gemini-api',
    proxyTarget: 'google',
    envKey: 'GOOGLE_API_KEY',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
    authHeader: 'Bearer',
  },
  {
    slotId: 'elevenlabs',
    name: 'ElevenLabs (Audio)',
    providerId: 'elevenlabs-api',
    proxyTarget: 'elevenlabs',
    envKey: 'ELEVENLABS_API_KEY',
    defaultBaseUrl: 'https://api.elevenlabs.io',
    authHeader: 'xi-api-key',
  },
  {
    slotId: 'fal',
    name: 'fal.ai (Flux / Kling)',
    providerId: 'fal-ai',
    proxyTarget: 'fal',
    envKey: 'FAL_KEY',
    defaultBaseUrl: 'https://fal.run',
    authHeader: 'Key',
  },
  {
    slotId: 'replicate',
    name: 'Replicate',
    providerId: 'replicate-api',
    proxyTarget: 'replicate',
    envKey: 'REPLICATE_API_TOKEN',
    defaultBaseUrl: 'https://api.replicate.com',
    authHeader: 'Bearer',
  },
  {
    slotId: 'runway',
    name: 'Runway ML',
    providerId: 'runway-api',
    proxyTarget: 'runway',
    envKey: 'RUNWAY_API_KEY',
    envBaseUrlKey: 'RUNWAY_BASE_URL',
    defaultBaseUrl: 'https://api.dev.runwayml.com',
    authHeader: 'Bearer',
  },
  {
    slotId: 'luma',
    name: 'Luma AI (Dream Machine)',
    providerId: 'luma-api',
    proxyTarget: 'luma',
    envKey: 'LUMA_API_KEY',
    defaultBaseUrl: 'https://api.lumalabs.ai',
    authHeader: 'Bearer',
  },
  {
    slotId: 'xai',
    name: 'xAI (Grok)',
    providerId: 'openai-compatible',
    proxyTarget: 'xai',
    envKey: 'XAI_API_KEY',
    defaultBaseUrl: 'https://api.x.ai',
    authHeader: 'Bearer',
  },
  {
    slotId: 'together',
    name: 'Together AI',
    providerId: 'openai-compatible',
    proxyTarget: 'together',
    envKey: 'TOGETHER_API_KEY',
    envBaseUrlKey: 'TOGETHER_BASE_URL',
    defaultBaseUrl: 'https://api.together.xyz',
    authHeader: 'Bearer',
  },
  {
    slotId: 'groq',
    name: 'Groq',
    providerId: 'openai-compatible',
    proxyTarget: 'groq',
    envKey: 'GROQ_API_KEY',
    envBaseUrlKey: 'GROQ_BASE_URL',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    authHeader: 'Bearer',
  },
  {
    slotId: 'mistral',
    name: 'Mistral AI',
    providerId: 'openai-compatible',
    proxyTarget: 'mistral',
    envKey: 'MISTRAL_API_KEY',
    envBaseUrlKey: 'MISTRAL_BASE_URL',
    defaultBaseUrl: 'https://api.mistral.ai/v1',
    authHeader: 'Bearer',
  },
  {
    slotId: 'deepseek',
    name: 'DeepSeek',
    providerId: 'openai-compatible',
    proxyTarget: 'deepseek',
    envKey: 'DEEPSEEK_API_KEY',
    envBaseUrlKey: 'DEEPSEEK_BASE_URL',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    authHeader: 'Bearer',
  },
  {
    slotId: 'custom',
    name: 'Custom',
    providerId: 'generic-rest',
    proxyTarget: 'custom',
    envKey: 'CUSTOM_API_KEY',
    envBaseUrlKey: 'CUSTOM_BASE_URL',
    defaultBaseUrl: '',
    authHeader: 'Bearer',
  },
];

export function providerRuntimeByProxyTarget() {
  return Object.fromEntries(
    PROVIDER_RUNTIME_REGISTRY.map((row) => [row.proxyTarget, row]),
  );
}

export function providerRuntimeBySlotId() {
  return Object.fromEntries(
    PROVIDER_RUNTIME_REGISTRY.map((row) => [row.slotId, row]),
  );
}

export function defaultProxyTargetForProvider(providerId) {
  const hit = PROVIDER_RUNTIME_REGISTRY.find((row) => row.providerId === providerId);
  return hit ? hit.proxyTarget : 'custom';
}
