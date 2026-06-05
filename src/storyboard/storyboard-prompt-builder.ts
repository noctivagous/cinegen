import {
  assetLibrary,
  breakdownData,
  getActiveProjectSettings,
  projectTreatment,
  sceneReferenceOverrides,
  storyboardFrames,
  storyboardReferenceBank,
} from '@/data/project-data';
import { getSceneDetail, getShotForFrame, sceneIdFromStoryboardFrame } from '@/workspace/shot-frame-bridge';
import { getTreatmentForVisualAI } from '@/workspace/treatment-form-service';
import type { StoryboardFrame, StoryboardReferenceSlot } from '@/storyboard/storyboard-types';
import { build10ElementPrompt } from '@/services/prompt-engineer-service';
import type { ProjectSnapshot } from '@/services/prompt-engineer-service';

const MAX_PROMPT_LENGTH = 3800;
export const STORYBOARD_STYLE_PROMPT =
  'Pencil illustration of film frame, monochrome linework, cinematic composition, clear subject blocking, practical shot intent, no photorealism.';

/** Pixel sizes aligned to 16px grid (required by Together FLUX and similar APIs). */
export const ASPECT_RATIO_TO_SIZE: Record<string, string> = {
  '16:9': '1024x576',
  '9:16': '576x1024',
  '1:1': '1024x1024',
  '21:9': '1024x432',
  '2.39:1': '1024x432',
  '2.00:1': '1024x512',
  '1.85:1': '1024x544',
  '4:3': '1024x768',
  '1.37:1': '1024x752',
};

export const ASPECT_RATIO_TO_OPENAI_SIZE: Record<string, string> = {
  '16:9': '1792x1024',
  '9:16': '1024x1792',
  '1:1': '1024x1024',
  '21:9': '1792x1024',
  '2.39:1': '1792x1024',
  '2.00:1': '1792x1024',
  '1.85:1': '1792x1024',
  '4:3': '1024x1024',
  '1.37:1': '1024x1024',
};

export interface StoryboardPromptResult {
  prompt: string;
  size: string;
  openaiSize: string;
  refImageUrls: string[];
}

type ReferenceCategory = 'characters' | 'locations' | 'interiors' | 'exteriors';

const SIZE_ALIGN = 16;
const SIZE_MIN = 64;

function snapStoryboardDimension(value: number): number {
  return Math.max(SIZE_MIN, Math.round(value / SIZE_ALIGN) * SIZE_ALIGN);
}

function sizeFromAspectRatio(aspectRatio: string): string | null {
  const parts = aspectRatio.split(':').map(p => Number(p.trim()));
  if (parts.length !== 2 || !parts.every(n => Number.isFinite(n) && n > 0)) return null;
  const [wR, hR] = parts;
  if (wR >= hR) {
    const width = 1024;
    const height = snapStoryboardDimension(Math.round((width * hR) / wR));
    return `${width}x${height}`;
  }
  const height = 1024;
  const width = snapStoryboardDimension(Math.round((height * wR) / hR));
  return `${width}x${height}`;
}

function getSizeForAspectRatio(aspectRatio?: string): string {
  if (!aspectRatio) return '1024x1024';
  return ASPECT_RATIO_TO_SIZE[aspectRatio] || sizeFromAspectRatio(aspectRatio) || '1024x1024';
}

function getOpenaiSizeForAspectRatio(aspectRatio?: string): string {
  if (!aspectRatio) return '1024x1024';
  return ASPECT_RATIO_TO_OPENAI_SIZE[aspectRatio] || '1024x1024';
}

function getAssetDescription(category: string, name: string): string | undefined {
  const bucket = (assetLibrary as Record<string, unknown>)[category];
  if (!Array.isArray(bucket)) return undefined;
  for (const item of bucket) {
    if (!item || typeof item !== 'object') continue;
    const it = item as Record<string, string>;
    if ((it.name || '').toLowerCase() === name.toLowerCase() || (it.label || '').toLowerCase() === name.toLowerCase()) {
      return it.desc || it.description;
    }
  }
  return undefined;
}

function resolveEffectiveReferences(sceneKey: string) {
  const bank = storyboardReferenceBank;
  const overrides = (sceneReferenceOverrides as Record<string, Partial<typeof bank>>)[sceneKey];
  const effective: Record<ReferenceCategory, StoryboardReferenceSlot[]> = {
    characters: [],
    locations: [],
    interiors: [],
    exteriors: [],
  };
  for (const cat of Object.keys(effective) as ReferenceCategory[]) {
    const base = bank[cat] || [];
    const override = overrides?.[cat] || [];
    const merged = [...base];
    for (const slot of override) {
      const idx = merged.findIndex(s => s.label.toLowerCase() === slot.label.toLowerCase());
      if (idx >= 0) merged[idx] = { ...merged[idx], ...slot };
      else merged.push(slot);
    }
    effective[cat] = merged.filter(s => s.enabled !== false);
  }
  return effective;
}

export function getReferenceImageUrls(sceneKey: string): string[] {
  const effective = resolveEffectiveReferences(sceneKey);
  const catKeys = Object.keys(effective) as ReferenceCategory[];
  const urls: string[] = [];
  for (const cat of catKeys) {
    for (const slot of effective[cat]) {
      if (slot.imageUrl) urls.push(slot.imageUrl);
    }
  }
  return urls;
}

function extractStoryboardStyleFromNotes(notes?: string): string | undefined {
  if (!notes) return undefined;
  const match = notes.match(/style\s*:\s*(.+)/i);
  return match?.[1]?.trim();
}

function buildProjectSnapshot(): ProjectSnapshot {
  const settings = getActiveProjectSettings();
  const treatment = getTreatmentForVisualAI();
  return {
    genre: treatment.genre,
    tone: treatment.tone,
    notes: treatment.notes,
    aspectRatio: (settings?.aspectRatio as string) || '16:9',
    characterGuide: [],
    locationGuide: [],
    breakdownData: Array.isArray(breakdownData) ? breakdownData as Record<string, string>[] : undefined,
  };
}

export function buildStoryboardPrompt(frame: StoryboardFrame): StoryboardPromptResult {
  const sceneId = sceneIdFromStoryboardFrame(frame);
  const scene = getSceneDetail(sceneId);
  const shot = frame.shotId != null ? getShotForFrame(frame) : null;

  const snapshot = buildProjectSnapshot();
  const aspectRatio = snapshot.aspectRatio || '16:9';
  const size = getSizeForAspectRatio(aspectRatio);
  const openaiSize = getOpenaiSizeForAspectRatio(aspectRatio);

  if (!scene || !shot) {
    const fallback = `${frame.label || ''} ${frame.scriptLink || ''} ${frame.notes || ''}`.trim() || STORYBOARD_STYLE_PROMPT;
    return { prompt: fallback, size, openaiSize, refImageUrls: [] };
  }

  const result = build10ElementPrompt({ frame, shot, scene, projectSnapshot: snapshot });
  return {
    prompt: result.text,
    size,
    openaiSize,
    refImageUrls: result.refImageUrls,
  };
}

export function buildReferenceSlotPrompt(slot: StoryboardReferenceSlot): string {
  const treatment = getTreatmentForVisualAI();
  const parts: string[] = [];
  parts.push(slot.label);
  if (slot.prompt && slot.prompt !== slot.label) {
    parts.push(slot.prompt);
  }
  const categoryMap: Record<string, string> = {
    characters: 'characters',
    locations: 'locations',
    interiors: 'locations',
    exteriors: 'locations',
  };
  const assetCat = categoryMap[slot.category];
  if (assetCat) {
    const desc = getAssetDescription(assetCat, slot.label);
    if (desc) parts.push(desc);
  }
  const styleFromNotes = extractStoryboardStyleFromNotes(slot.notes);
  if (styleFromNotes) {
    parts.push(styleFromNotes);
  } else {
    parts.push(STORYBOARD_STYLE_PROMPT);
  }
  if (treatment.genre) parts.push(`Genre: ${treatment.genre}`);
  if (treatment.tone) parts.push(`Tone: ${treatment.tone}`);
  if (treatment.notes) parts.push(treatment.notes);
  const text = parts.join('. ');
  return text.length <= MAX_PROMPT_LENGTH ? text : text.slice(0, MAX_PROMPT_LENGTH - 3) + '...';
}

export function backfillStoryboardPrompts(): number {
  let count = 0;
  if (!Array.isArray(storyboardFrames)) return 0;
  for (const frame of storyboardFrames as StoryboardFrame[]) {
    if (!frame.generatedPrompt && !frame.userPromptOverride) {
      try {
        const result = buildStoryboardPrompt(frame);
        frame.generatedPrompt = result.prompt;
        count++;
      } catch {
        // Skip frames that can't be resolved (missing scene, etc.)
      }
    }
  }
  return count;
}
