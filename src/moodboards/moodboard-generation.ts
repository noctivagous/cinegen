/**
 * Mood board generative media.
 * Wires into AI services for quick image/video/sound/text generation
 * using mood-board-specific provider preferences.
 */

import { addMoodBoardItem, type MoodBoard, type MoodBoardItemType } from '@/data/project-data';
import { loadPreferences } from '@/services/preferences';

export type GenerateMoodBoardItemOptions = {
  boardId: string;
  type: MoodBoardItemType;
  prompt: string;
  label?: string;
};

function getProviderForType(type: MoodBoardItemType): string {
  const prefs = loadPreferences();
  switch (type) {
    case 'image': return prefs.moodBoardImageProvider || '';
    case 'video': return prefs.moodBoardVideoProvider || '';
    case 'sound': return prefs.moodBoardAudioProvider || '';
    case 'text': return prefs.moodBoardLLMProvider || '';
  }
}

export function getGenerationPromptPlaceholder(type: MoodBoardItemType): string {
  switch (type) {
    case 'image': return 'Describe the image you want to generate...';
    case 'video': return 'Describe the video clip...';
    case 'sound': return 'Describe the sound or audio...';
    case 'text': return 'Enter text or description...';
  }
}

/** Button label for grid generate action from active type tab (`all` → generic). */
export function getGenerateButtonLabel(typeFilter: string): string {
  switch (typeFilter) {
    case 'image':
      return 'Generate Image...';
    case 'video':
      return 'Generate Video...';
    case 'sound':
      return 'Generate Sound...';
    case 'text':
      return 'Generate Text...';
    default:
      return 'Generate Item...';
  }
}

function generateId(): string {
  return `mbg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Queue a mood board generation job.
 * Returns a placeholder item that will be updated when generation completes.
 */
export function queueMoodBoardGeneration(opts: GenerateMoodBoardItemOptions): { itemId: string } | null {
  const provider = getProviderForType(opts.type);
  if (!provider) {
    console.warn('[moodboard-generation] No provider configured for type:', opts.type);
  }

  const itemId = generateId();
  const label = opts.label || `Generated ${opts.type}`;

  const result = addMoodBoardItem(opts.boardId, {
    type: opts.type,
    label,
    source: opts.prompt,
    active: true,
    notes: `Generated via ${provider || 'no provider'} | Prompt: ${opts.prompt}`,
    order: Date.now(),
    metadata: {
      prompt: opts.prompt,
      provider,
      generatedAt: Date.now(),
      status: provider ? 'queued' : 'skipped',
    },
  });

  if (!result) return null;

  if (provider) {
    const event = new CustomEvent('moodboard-generation-queued', {
      detail: { boardId: opts.boardId, itemId: result.id, type: opts.type, prompt: opts.prompt, provider },
    });
    window.dispatchEvent(event);
  }

  return { itemId: result.id };
}
