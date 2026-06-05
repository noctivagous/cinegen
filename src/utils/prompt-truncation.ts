export const PROVIDER_PROMPT_LIMITS = {
  'runway': { maxChars: 1000, maxRefs: 3, notes: 'Concise, motion-focused prompts best' },
  'luma': { maxChars: 5000, maxRefs: 3, notes: 'Longer prompts OK up to 5000' },
  'kling': { maxChars: Infinity, maxRefs: 4, notes: 'No strict limit, multi-step structure helps' },
  'veo': { maxChars: 5000, maxRefs: 3, notes: 'Structured with clear subject-action-setting' },
  'pika': { maxChars: 1000, maxRefs: 3, notes: 'Brevity key, under 200 chars ideal' },
  'seedance': { maxChars: 5000, maxRefs: 9, notes: 'Keep under 200 words for best results' },
  'sora': { maxChars: 1000, maxRefs: 0, notes: 'Similar to Runway style' },
} as const;

export type ProviderId = keyof typeof PROVIDER_PROMPT_LIMITS;

export interface PromptElement {
  position: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  name: string;
  text: string;
  source: string;
}

export interface TruncationResult {
  text: string;
  sourceLog: string[];
}

export function getProviderLimit(providerId: string): number {
  const limit = PROVIDER_PROMPT_LIMITS[providerId as ProviderId];
  return limit?.maxChars ?? 3800;
}

export function getProviderRefLimit(providerId: string): number {
  const limit = PROVIDER_PROMPT_LIMITS[providerId as ProviderId];
  return limit?.maxRefs ?? 4;
}

export function truncateToProviderLimit(
  elements: PromptElement[],
  limit: number,
): TruncationResult {
  const sourceLog: string[] = [];
  const ordered = [...elements].sort((a, b) => a.position - b.position);

  let fullText = ordered.map(e => e.text).filter(Boolean).join(' ');

  if (fullText.length <= limit) {
    for (const el of ordered) {
      if (el.text) sourceLog.push(`${el.name}: ${el.source}`);
    }
    return { text: fullText, sourceLog };
  }

  const kept: PromptElement[] = [];
  const truncated: string[] = [];

  const priorityElements = ordered.filter(
    e => [1, 2, 3, 5].includes(e.position)
  );

  const lightingElement = ordered.find(e => e.position === 9);
  const motionElement = ordered.find(e => e.position === 10);
  const visualStyleElement = ordered.find(e => e.position === 8);
  const otherElements = ordered.filter(
    e => ![1, 2, 3, 5, 8, 9, 10].includes(e.position)
  );

  for (const el of priorityElements) {
    if (el.text) {
      kept.push(el);
      sourceLog.push(`${el.name}: ${el.source}`);
    }
  }

  if (lightingElement?.text) {
    kept.push(lightingElement);
    sourceLog.push(`${lightingElement.name}: ${lightingElement.source}`);
  } else {
    truncated.push('[9] LIGHTING');
  }

  for (const el of otherElements) {
    if (el.text) {
      kept.push(el);
      sourceLog.push(`${el.name}: ${el.source}`);
    }
  }

  if (visualStyleElement?.text) {
    const summarized = visualStyleElement.text.length > 60
      ? `${visualStyleElement.text.slice(0, 57)}...`
      : visualStyleElement.text;
    kept.push({ ...visualStyleElement, text: summarized });
    sourceLog.push(`${visualStyleElement.name}: ${visualStyleElement.source} (summarized)`);
  }

  if (motionElement?.text && !motionElement.text.toLowerCase().includes('static')) {
    kept.push(motionElement);
    sourceLog.push(`${motionElement.name}: ${motionElement.source}`);
  } else if (motionElement?.text) {
    truncated.push('[10] MOTION ENERGY (dropped — static scene)');
  }

  let result = kept.map(e => e.text).filter(Boolean).join(' ');

  if (result.length > limit) {
    result = result.slice(0, limit - 3) + '...';
    truncated.push('Final hard truncation at limit');
  }

  for (const t of truncated) {
    sourceLog.push(`TRUNCATED: ${t}`);
  }

  return { text: result, sourceLog };
}
