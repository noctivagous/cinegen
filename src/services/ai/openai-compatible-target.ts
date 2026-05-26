export interface OpenAiCompatibleTargetInput {
  slotId?: string;
  name?: string;
  baseUrl?: string;
}

const SLOT_TARGETS: Record<string, string> = {
  xai: 'xai',
  groq: 'groq',
  together: 'together',
  mistral: 'mistral',
  deepseek: 'deepseek',
  openai: 'openai',
};

function normalized(value: string | undefined): string {
  return (value || '').toLowerCase();
}

export function resolveOpenAiCompatibleTarget(input: OpenAiCompatibleTargetInput): string | null {
  const slotId = normalized(input.slotId);
  const name = normalized(input.name);
  const baseUrl = normalized(input.baseUrl);

  if (slotId && SLOT_TARGETS[slotId]) return SLOT_TARGETS[slotId];

  if (name.includes('xai') || name.includes('x.ai') || baseUrl.includes('x.ai')) return 'xai';
  if (name.includes('groq') || baseUrl.includes('api.groq.com') || baseUrl.includes('groq.com')) return 'groq';
  if (
    name.includes('together') ||
    baseUrl.includes('api.together.xyz') ||
    baseUrl.includes('api.together.ai') ||
    baseUrl.includes('together.xyz') ||
    baseUrl.includes('together.ai')
  ) {
    return 'together';
  }
  if (name.includes('mistral') || baseUrl.includes('api.mistral.ai') || baseUrl.includes('mistral.ai')) return 'mistral';
  if (name.includes('deepseek') || baseUrl.includes('api.deepseek.com') || baseUrl.includes('deepseek.com')) return 'deepseek';
  if (baseUrl.includes('api.openai.com')) return 'openai';

  return null;
}
