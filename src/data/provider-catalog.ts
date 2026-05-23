/**
 * Canonical provider catalog — single source of truth for all provider definitions.
 *
 * Previously scattered across:
 *   - setup-assistant-bundle.ts  (SA_PROVIDERS_BY_MODALITY, SA_PROVIDER_CATALOG)
 *   - ai-api-settings-bundle.ts  (AI_API_PROVIDERS, AI_API_MODEL_CATALOG)
 *   - api-keys-settings-bundle.ts (defaultProviderList, seed vendors)
 */

/* ── Master provider list ────────────────────────────────────────────────── */

export interface ProviderDefinition {
  id: string;
  label: string;
}

export const AI_API_PROVIDERS: ProviderDefinition[] = [
  { id: 'openai-compatible',      label: 'OpenAI-compatible (OpenAI, xAI, Azure, Groq, Together, Mistral, DeepSeek…)' },
  { id: 'anthropic-messages-api', label: 'Anthropic Messages API (Claude)' },
  { id: 'google-gemini-api',      label: 'Google AI / Vertex (Gemini, Imagen, Veo, TTS)' },
  { id: 'elevenlabs-api',         label: 'ElevenLabs (TTS, SFX, Music, Voice Cloning)' },
  { id: 'murf-api',               label: 'Murf AI (Studio TTS)' },
  { id: 'wellsaid-api',           label: 'WellSaid Labs (Enterprise TTS)' },
  { id: 'suno-api',               label: 'Suno (Music & Songs)' },
  { id: 'udio-api',               label: 'Udio (Music, Stems, Remixing)' },
  { id: 'minimax-api',            label: 'MiniMax (Video + Music-2)' },
  { id: 'fal-ai',                 label: 'fal.ai (Flux, Kling, WAN, SDXL, Minimax…)' },
  { id: 'replicate-api',          label: 'Replicate (hosted open-source models)' },
  { id: 'runway-api',             label: 'Runway ML (Gen-4.5)' },
  { id: 'luma-api',               label: 'Luma AI — Dream Machine (Ray3)' },
  { id: 'moss-api',               label: 'MOSS (Open/Local TTS & SFX)' },
  { id: 'stability-audio',        label: 'Stability AI (Stable Audio)' },
  { id: 'seedance-api',           label: 'Seedance (Unified Audio+Video)' },
  { id: 'generic-rest',           label: 'Generic REST (custom endpoint)' }
];

/* ── Per-modality provider subsets ──────────────────────────────────────── */

export interface ModalityProviderEntry {
  id: string;
  label: string;
}

export const PROVIDERS_BY_MODALITY: Record<string, ModalityProviderEntry[]> = {
  llm: [
    { id: 'openai-compatible',      label: 'OpenAI / xAI / Groq / Mistral / Together (OpenAI-compatible)' },
    { id: 'anthropic-messages-api', label: 'Anthropic (Claude)' },
    { id: 'google-gemini-api',      label: 'Google AI (Gemini)' },
    { id: 'replicate-api',          label: 'Replicate (Llama, etc.)' },
    { id: 'generic-rest',           label: 'Generic REST (custom endpoint)' },
  ],
  video: [
    { id: 'openai-compatible',      label: 'OpenAI-compatible (Together AI, etc.)' },
    { id: 'google-gemini-api',      label: 'Google AI (Veo 3.1)' },
    { id: 'fal-ai',                 label: 'fal.ai (Kling, WAN, Minimax)' },
    { id: 'runway-api',             label: 'Runway ML (Gen-4.5)' },
    { id: 'luma-api',               label: 'Luma AI (Ray 3)' },
    { id: 'replicate-api',          label: 'Replicate (custom)' },
    { id: 'generic-rest',           label: 'Generic REST (custom endpoint)' },
  ],
  image: [
    { id: 'openai-compatible',      label: 'OpenAI (DALL·E / GPT Image 2)' },
    { id: 'google-gemini-api',      label: 'Google AI (Imagen 4)' },
    { id: 'fal-ai',                 label: 'fal.ai (FLUX, Ideogram, Recraft)' },
    { id: 'luma-api',               label: 'Luma AI (Photon)' },
    { id: 'replicate-api',          label: 'Replicate (FLUX, SDXL)' },
    { id: 'generic-rest',           label: 'Generic REST (custom endpoint)' },
  ],
  audio: [
    { id: 'elevenlabs-api',         label: 'ElevenLabs (TTS, SFX, Music)' },
    { id: 'suno-api',               label: 'Suno (Music Generation)' },
    { id: 'udio-api',               label: 'Udio (Music Generation)' },
    { id: 'openai-compatible',      label: 'OpenAI / xAI (TTS-1, TTS-1 HD, Grok TTS)' },
    { id: 'google-gemini-api',      label: 'Google AI (Lyria music)' },
    { id: 'replicate-api',          label: 'Replicate (Bark)' },
    { id: 'generic-rest',           label: 'Generic REST (custom endpoint)' },
  ],
};

/* ── Setup-wizard catalog structure ───────────────────────────────────── */

export interface SaCatalogRow {
  slotId: string;
  name: string;
  providerId: string;
  baseUrl?: string;
  blurb: string;
  matchNames?: string[];
}

export interface SaCatalogSection {
  num: string;
  title: string;
  desc: string;
  rows?: SaCatalogRow[];
  groups?: Array<{ label: string; rows: SaCatalogRow[] }>;
}

export const SA_PROVIDER_CATALOG: SaCatalogSection[] = [
  {
    num: '1',
    title: 'Frontier / Closed Model Providers',
    desc: 'These develop and host their own proprietary high-capability models. They set the quality benchmark for reasoning, multimodal, and specialized tasks.',
    rows: [
      { slotId: 'openai',    name: 'OpenAI',    providerId: 'openai-compatible',      blurb: 'GPT models for text, image, and multimodal tasks.', matchNames: ['OpenAI'] },
      { slotId: 'anthropic', name: 'Anthropic', providerId: 'anthropic-messages-api', blurb: 'Claude models for advanced reasoning and text generation.', matchNames: ['Anthropic (Claude)'] },
      { slotId: 'google',    name: 'Google',    providerId: 'google-gemini-api',      blurb: 'Gemini models for text, image, and video generation.', matchNames: ['Google AI (Gemini / Veo)'] },
      { slotId: 'xai',       name: 'xAI',       providerId: 'openai-compatible',      baseUrl: 'https://api.x.ai/v1', blurb: 'Grok models for reasoning and text generation.', matchNames: ['xAI (Grok)'] },
    ],
  },
  {
    num: '2',
    title: 'Open-Weight Inference Providers',
    desc: 'They host and optimize open-source or open-weight models (Llama, Qwen, DeepSeek, etc.) for speed, cost, and scale. Ideal for production and customization.',
    rows: [
      { slotId: 'together',   name: 'Together AI',   providerId: 'openai-compatible', baseUrl: 'https://api.together.xyz/v1', blurb: 'Broad catalog, fine-tuning, serverless.', matchNames: ['Together AI'] },
      { slotId: 'fireworks',  name: 'Fireworks AI',  providerId: 'openai-compatible', baseUrl: 'https://api.fireworks.ai/inference/v1', blurb: 'High-speed inference optimization.' },
      { slotId: 'groq',       name: 'Groq',          providerId: 'openai-compatible', baseUrl: 'https://api.groq.com/openai/v1', blurb: 'Ultra-low latency via custom hardware (LPUs).', matchNames: ['Groq'] },
    ],
  },
  {
    num: '3',
    title: 'Aggregators & Routers (LLM Gateways)',
    desc: 'Unified access layer that routes requests across multiple underlying providers. Great for experimentation, fallbacks, cost optimization, and single-API simplicity.',
    rows: [
      { slotId: 'openrouter', name: 'OpenRouter', providerId: 'openai-compatible', baseUrl: 'https://openrouter.ai/api/v1', blurb: 'Marketplace with 300+ models, benchmarks, and easy switching.' },
    ],
  },
  {
    num: '4',
    title: 'Specialized / Niche Providers',
    desc: 'Providers focused on media generation (video, image, audio) or specialized workflows.',
    groups: [
      {
        label: 'Media',
        rows: [
          { slotId: 'replicate', name: 'Replicate', providerId: 'replicate-api', blurb: 'Media generation and deployment.', matchNames: ['Replicate'] },
          { slotId: 'fal',       name: 'fal.ai',    providerId: 'fal-ai',          blurb: 'Media generation and deployment.', matchNames: ['fal.ai (Flux / Kling)'] },
          { slotId: 'luma',      name: 'Luma AI',   providerId: 'luma-api',        blurb: 'Dream Machine for high-quality video generation.', matchNames: ['Luma AI (Dream Machine)'] },
          { slotId: 'runway',    name: 'Runway ML', providerId: 'runway-api',      blurb: 'Gen-4.5 for video generation and editing.', matchNames: ['Runway ML'] },
          { slotId: 'midjourney', name: 'Midjourney', providerId: 'generic-rest', blurb: 'AI image generation — connect via a compatible REST API proxy.', matchNames: ['Midjourney'] },
          { slotId: 'elevenlabs', name: 'ElevenLabs (Audio)', providerId: 'elevenlabs-api', blurb: 'Industry-leading TTS, voice cloning, SFX, and music.', matchNames: ['ElevenLabs (Audio)'] },
          { slotId: 'suno',      name: 'Suno',      providerId: 'suno-api',      baseUrl: 'https://api.sunoapi.org', blurb: 'AI music generation via sunoapi.org.', matchNames: ['Suno'] },
          { slotId: 'udio',      name: 'Udio',      providerId: 'udio-api',      baseUrl: 'https://udioapi.pro/api/v2', blurb: 'AI music generation via udioapi.pro.', matchNames: ['Udio'] },
        ],
      },
      {
        label: 'Hubs',
        rows: [
          { slotId: 'huggingface', name: 'Hugging Face Inference', providerId: 'openai-compatible', baseUrl: 'https://api-inference.huggingface.co/v1', blurb: 'Massive open model hub.' },
        ],
      },
    ],
  },
  {
    num: '5',
    title: 'Enterprise',
    desc: 'Enterprise-grade endpoints with enhanced security and compliance.',
    rows: [
      { slotId: 'azure',  name: 'Azure',  providerId: 'openai-compatible', blurb: 'Azure OpenAI Service — set your resource endpoint as the base URL in the Models step.', matchNames: ['Azure OpenAI'] },
      { slotId: 'amazon', name: 'Amazon', providerId: 'generic-rest', blurb: 'Amazon Bedrock and other enterprise endpoints — set a custom base URL when assigning models.' },
    ],
  },
];

/* ── Flattened slots helper ─────────────────────────────────────────────── */

export function getSaProviderSlots(): SaCatalogRow[] {
  const slots: SaCatalogRow[] = [];
  SA_PROVIDER_CATALOG.forEach((section) => {
    if (section.rows) slots.push(...section.rows);
    if (section.groups) section.groups.forEach((g) => slots.push(...g.rows));
  });
  return slots;
}

/* ── Seed vendor definitions for API-keys settings ─────────────────────── */

export interface SeedVendorDef {
  name: string;
  providerId: string;
}

export const SEED_VENDOR_DEFINITIONS: SeedVendorDef[] = [
  { name: 'OpenAI',                      providerId: 'openai-compatible' },
  { name: 'Anthropic (Claude)',           providerId: 'anthropic-messages-api' },
  { name: 'Google AI (Gemini / Veo)',     providerId: 'google-gemini-api' },
  { name: 'xAI (Grok)',                   providerId: 'openai-compatible' },
  { name: 'ElevenLabs (Audio)',           providerId: 'elevenlabs-api' },
  { name: 'fal.ai (Flux / Kling)',        providerId: 'fal-ai' },
  { name: 'Runway ML',                    providerId: 'runway-api' },
  { name: 'Luma AI (Dream Machine)',      providerId: 'luma-api' },
  { name: 'Azure OpenAI',                 providerId: 'openai-compatible' },
  { name: 'Groq',                         providerId: 'openai-compatible' },
  { name: 'Together AI',                  providerId: 'openai-compatible' },
  { name: 'Mistral AI',                   providerId: 'openai-compatible' },
  { name: 'DeepSeek',                     providerId: 'openai-compatible' },
  { name: 'Replicate',                    providerId: 'replicate-api' }
];

/* ── Default provider list (minimal fallback) ──────────────────────────── */

export function getDefaultProviderList(): ProviderDefinition[] {
  if (typeof window.getAiApiProviderList === 'function') {
    return window.getAiApiProviderList();
  }
  return AI_API_PROVIDERS.filter((p) =>
    [
      'openai-compatible',
      'anthropic-messages-api',
      'google-gemini-api',
      'elevenlabs-api',
      'fal-ai',
      'replicate-api',
      'runway-api',
      'luma-api',
      'generic-rest',
    ].includes(p.id)
  );
}
