import {
  assetLibrary,
  breakdownData,
  currentSceneData,
  getActiveProjectSettings,
  projectTreatment,
  sceneReferenceOverrides,
  storyboardFrames,
  storyboardReferenceBank,
} from '@/data/project-data';
import { colorState } from '@/color/color-state';
import { cameraLightingData, cameraLightingSelections } from '@/camera/camera-lighting-bundle';
import { getSceneDetail, getShotForFrame, sceneIdFromStoryboardFrame } from '@/workspace/shot-frame-bridge';
import { getTreatmentForVisualAI } from '@/workspace/treatment-form-service';
import type { StoryboardFrame, StoryboardReferenceSlot } from '@/storyboard/storyboard-types';
import type { SceneDetail } from '@/workspace/scene-types';

const MAX_PROMPT_LENGTH = 3800;
export const STORYBOARD_STYLE_PROMPT =
  'Pencil illustration of film frame, monochrome linework, cinematic composition, clear subject blocking, practical shot intent, no photorealism.';

/** Pixel sizes aligned to 16px grid (required by Together FLUX and similar APIs). */
const ASPECT_RATIO_TO_SIZE: Record<string, string> = {
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

const ASPECT_RATIO_TO_OPENAI_SIZE: Record<string, string> = {
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

/** Derive WxH from aspect ratio with long edge 1024, dimensions on a 16px grid. */
function sizeFromAspectRatio(aspectRatio: string): string | null {
  const parts = aspectRatio.split(':').map((p) => Number(p.trim()));
  if (parts.length !== 2 || !parts.every((n) => Number.isFinite(n) && n > 0)) return null;
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

function truncatePrompt(prompt: string, maxLen = MAX_PROMPT_LENGTH): string {
  if (prompt.length <= maxLen) return prompt;
  return prompt.slice(0, maxLen - 3) + '...';
}

function extractStoryboardStyleFromNotes(notes?: string): string | undefined {
  if (!notes) return undefined;
  const match = notes.match(/style\s*:\s*(.+)/i);
  return match?.[1]?.trim();
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

function getCameraLightingSelectionsText(): string {
  const parts: string[] = [];
  for (const [sectionKey, abbr] of Object.entries(cameraLightingSelections)) {
    if (!abbr) continue;
    const section = cameraLightingData[sectionKey];
    if (!section) continue;
    const item = section.items.find((i) => i.abbr === abbr);
    if (item) parts.push(item.name);
  }
  return parts.join(', ');
}

function getBreakdownRowForScene(sceneId: string): Record<string, string> | undefined {
  if (!Array.isArray(breakdownData)) return undefined;
  const sceneNum = String(sceneId).replace(/\D/g, '');
  return breakdownData.find((row: unknown) => {
    if (!row || typeof row !== 'object') return false;
    const r = row as Record<string, string>;
    const rowScene = String(r.scene ?? '').replace(/\D/g, '');
    return rowScene === sceneNum;
  });
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
      const idx = merged.findIndex((s) => s.label.toLowerCase() === slot.label.toLowerCase());
      if (idx >= 0) merged[idx] = { ...merged[idx], ...slot };
      else merged.push(slot);
    }
    effective[cat] = merged;
  }
  return effective;
}

function getReferenceDescriptorText(sceneKey: string): string {
  const effective = resolveEffectiveReferences(sceneKey);
  const bits: string[] = [];
  const charNames = effective.characters.slice(0, 2).map((s) => s.label).join(', ');
  if (charNames) bits.push(`Consistent character appearance reference: ${charNames}.`);
  const loc = effective.locations[0]?.label;
  if (loc) {
    const locDesc = getAssetDescription('locations', loc);
    if (locDesc) bits.push(`Primary location reference: ${loc} — ${locDesc}.`);
    else bits.push(`Primary location reference: ${loc}.`);
  }
  const env = effective.interiors[0]?.label || effective.exteriors[0]?.label;
  if (env) bits.push(`Environment reference: ${env}.`);
  return bits.join(' ');
}

export function getReferenceImageUrls(sceneKey: string): string[] {
  const effective = resolveEffectiveReferences(sceneKey);
  const urls: string[] = [];
  for (const cat of Object.keys(effective) as ReferenceCategory[]) {
    for (const slot of effective[cat]) {
      if (slot.imageUrl) urls.push(slot.imageUrl);
    }
  }
  return urls;
}

/** Check if a word appears as a whole word in text (not part of another word). */
function isWordInText(word: string, text: string): boolean {
  const lowerWord = word.toLowerCase();
  const lowerText = text.toLowerCase();
  let idx = lowerText.indexOf(lowerWord);
  while (idx !== -1) {
    const before = idx === 0 ? ' ' : lowerText[idx - 1];
    const after = idx + lowerWord.length >= lowerText.length ? ' ' : lowerText[idx + lowerWord.length];
    if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) {
      return true;
    }
    idx = lowerText.indexOf(lowerWord, idx + 1);
  }
  return false;
}

function findMentionedEntities(text: string): Array<{ category: string; name: string; desc?: string }> {
  const results: Array<{ category: string; name: string; desc?: string }> = [];
  if (!text) return results;

  for (const cat of ['characters', 'locations', 'props', 'vehicles', 'wardrobe', 'effects'] as const) {
    const bucket = (assetLibrary as Record<string, unknown>)[cat];
    if (!Array.isArray(bucket)) continue;
    for (const item of bucket) {
      if (!item || typeof item !== 'object') continue;
      const it = item as Record<string, string>;
      const name = it.name || it.label;
      if (!name) continue;
      if (isWordInText(name, text)) {
        const desc = it.desc || it.description;
        results.push({ category: cat, name, desc });
      }
    }
  }
  return results;
}

/**
 * Build a rich, 9-element cinematic prompt for a storyboard frame using all
 * available project data (treatment, scene detail, asset library, breakdown,
 * camera/lighting selections, and reference bank).
 */
export function buildStoryboardPrompt(frame: StoryboardFrame): StoryboardPromptResult {
  const settings = getActiveProjectSettings();
  const aspectRatio = (settings?.aspectRatio as string) || '16:9';
  const size = getSizeForAspectRatio(aspectRatio);
  const openaiSize = getOpenaiSizeForAspectRatio(aspectRatio);

  const sceneId = sceneIdFromStoryboardFrame(frame);
  const scene = getSceneDetail(sceneId);
  const shot = frame.shotId != null ? getShotForFrame(frame) : null;

  const treatment = getTreatmentForVisualAI();
  const cameraText = getCameraLightingSelectionsText();
  const breakdownRow = getBreakdownRowForScene(sceneId);
  const refsText = getReferenceDescriptorText(sceneId);
  const refImageUrls = getReferenceImageUrls(sceneId).slice(0, 4);

  // Collect all frame context for entity matching
  const frameContext = `${frame.label || ''} ${frame.scriptLink || ''} ${frame.notes || ''} ${shot?.label || ''} ${shot?.scriptLink || ''} ${scene?.notes || ''}`;
  const mentionedEntities = findMentionedEntities(frameContext);

  // Build 9-element prompt (priority 1 = most important)
  const elements: { priority: number; text: string }[] = [];

  // 1. Subject & Action
  const actionParts: string[] = [];
  if (shot?.label && shot.label !== frame.label) {
    actionParts.push(shot.label);
  }
  if (frame.scriptLink) {
    actionParts.push(frame.scriptLink);
  }
  if (frame.label && !actionParts.some((p) => p.toLowerCase().includes(frame.label!.toLowerCase()))) {
    actionParts.push(frame.label);
  }
  if (actionParts.length) {
    elements.push({ priority: 1, text: actionParts.join('. ') + '.' });
  }

  // 2. Characters with descriptions
  const charEntries = mentionedEntities.filter((e) => e.category === 'characters');
  if (charEntries.length) {
    const charTexts = charEntries.map((c) => (c.desc ? `${c.name} (${c.desc})` : c.name));
    elements.push({ priority: 2, text: `Characters: ${charTexts.join(', ')}.` });
  }

  // 3. Location & Environment
  const locParts: string[] = [];
  if (scene?.title) locParts.push(scene.title);
  if (breakdownRow?.location) locParts.push(`Location: ${breakdownRow.location}`);
  if (breakdownRow?.time) locParts.push(`Time: ${breakdownRow.time}`);
  if (locParts.length) {
    elements.push({ priority: 3, text: locParts.join('. ') + '.' });
  }

  // 4. Props, wardrobe, SFX
  const propEntries = mentionedEntities.filter((e) => ['props', 'wardrobe', 'vehicles', 'effects'].includes(e.category));
  const propParts: string[] = [];
  if (propEntries.length) {
    const propTexts = propEntries.map((p) => (p.desc ? `${p.name} (${p.desc})` : p.name));
    propParts.push(`Production elements: ${propTexts.join(', ')}`);
  }
  if (breakdownRow?.sfx) propParts.push(`SFX: ${breakdownRow.sfx}`);
  if (propParts.length) {
    elements.push({ priority: 4, text: propParts.join('. ') + '.' });
  }

  // 5. Shot framing & camera
  const cameraParts: string[] = [];
  if (shot?.type) cameraParts.push(`Shot type: ${shot.type}`);
  if (cameraText) cameraParts.push(cameraText);
  if (scene?.lightingOverride) cameraParts.push(`Lighting: ${scene.lightingOverride}`);
  if (cameraParts.length) {
    elements.push({ priority: 5, text: cameraParts.join(', ') + '.' });
  }

  // 6. Master shot intent
  if (scene?.master?.prompt) {
    elements.push({ priority: 6, text: `Master intent: ${scene.master.prompt}.` });
  }

  // 7. Visual style (treatment + frame override + per-scene overrides)
  const styleParts: string[] = [];
  const styleFromNotes = extractStoryboardStyleFromNotes(frame.notes);
  if (styleFromNotes) {
    styleParts.push(styleFromNotes);
  } else {
    styleParts.push(STORYBOARD_STYLE_PROMPT);
  }
  if (treatment.genre) styleParts.push(`Genre: ${treatment.genre}`);
  if (scene?.visualToneOverride) {
    styleParts.push(`Tone: ${scene.visualToneOverride}`);
  } else if (treatment.tone) {
    styleParts.push(`Tone: ${treatment.tone}`);
  }
  if (treatment.notes) styleParts.push(treatment.notes);
  const scenePalette = scene?.colorOverride;
  const activePalette = scenePalette?.length ? scenePalette : colorState.getPalette();
  if (activePalette.length) {
    styleParts.push(`Color palette: ${activePalette.join(', ')}`);
  }
  if (styleParts.length) {
    elements.push({ priority: 7, text: styleParts.join('. ') + '.' });
  }

  // 8. Scene notes (director's intent)
  if (scene?.notes) {
    elements.push({ priority: 8, text: `Director's notes: ${scene.notes}.` });
  }

  // 9. Reference bank consistency
  if (refsText) {
    elements.push({ priority: 9, text: refsText });
  }

  // Assemble by priority and truncate if needed
  elements.sort((a, b) => a.priority - b.priority);
  let prompt = elements.map((e) => e.text).join(' ');
  prompt = truncatePrompt(prompt);

  return {
    prompt,
    size,
    openaiSize,
    refImageUrls,
  };
}

/**
 * Build an enriched prompt for a reference-bank slot (character, location,
 * environment). Uses the slot's own label + prompt, enriched with asset
 * descriptions and project treatment context.
 */
export function buildReferenceSlotPrompt(slot: StoryboardReferenceSlot): string {
  const treatment = getTreatmentForVisualAI();
  const parts: string[] = [];

  // Entity name
  parts.push(slot.label);

  // User's own prompt/description for the slot
  if (slot.prompt && slot.prompt !== slot.label) {
    parts.push(slot.prompt);
  }

  // Asset library description enrichment
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

  // Visual style
  const styleFromNotes = extractStoryboardStyleFromNotes(slot.notes);
  if (styleFromNotes) {
    parts.push(styleFromNotes);
  } else {
    parts.push(STORYBOARD_STYLE_PROMPT);
  }

  // Treatment context
  if (treatment.genre) parts.push(`Genre: ${treatment.genre}`);
  if (treatment.tone) parts.push(`Tone: ${treatment.tone}`);
  if (treatment.notes) parts.push(treatment.notes);

  return truncatePrompt(parts.join('. '));
}

/**
 * Backfill generatedPrompt for all existing storyboard frames that don't have one.
 * Called once after project load. Safe to call multiple times (idempotent).
 */
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
