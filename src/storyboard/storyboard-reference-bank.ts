import {
  storyboardReferenceBank,
  sceneReferenceOverrides,
  referenceGenerationStatus,
} from '@/data/project-data';
import {
  buildReferenceSlotPrompt,
  STORYBOARD_STYLE_PROMPT,
} from '@/storyboard/storyboard-prompt-builder';
import { generateFrameImage } from '@/storyboard/storyboard-generation-service';
import { updateInspector } from '@/components/panels/cinegen-inspector';
import { getCurrentScriptText } from '@/script/fountain-bundle';
import { storageService } from '@/services/persistence';
import { STORYBOARD_REFERENCE_STORAGE_KEY } from '@/constants/storage-keys';
import { emitAiInteractionLog } from '@/services/ai/interaction-log';
import { CG_STORYBOARD_REFERENCES_CHANGED } from '@/events/shell-events';

// ==================== TYPES ====================

export type ReferenceCategory = 'characters' | 'locations' | 'interiors' | 'exteriors';
export interface StoryboardReferenceSlot {
  id: string;
  category: ReferenceCategory;
  label: string;
  prompt: string;
  imageUrl?: string;
  notes?: string;
  locked?: boolean;
  enabled?: boolean;
  source: 'ai' | 'user';
  updatedAt?: string;
}

export const REFERENCE_CATEGORIES: ReferenceCategory[] = ['characters', 'locations', 'interiors', 'exteriors'];
const STORYBOARD_REFERENCE_KEY = STORYBOARD_REFERENCE_STORAGE_KEY;

// ==================== HELPERS ====================

export function emitStoryboardRunLog(event: string, payload: Record<string, unknown>): void {
  emitAiInteractionLog({
    capability: 'image',
    level: 'info',
    message: `🧪 Storyboard ${event}: ${JSON.stringify(payload)}`,
  });
}

export function sceneKeyFromCurrentScene(): string {
  return window.currentSceneId || 'scene1';
}

export function currentSceneNumber(): string {
  const id = window.currentSceneId;
  return id ? String(parseInt(id.replace('scene', ''), 10)) : '1';
}

export function extractSceneHeading(script: string, sceneNum: number): string {
  const headings = script.match(/^((?:INT\.|EXT\.|INT\/EXT\.|EST\.)\s*.*)$/gim);
  if (!headings || headings.length < sceneNum) return '';
  return headings[sceneNum - 1] || '';
}

export function extractSceneBodyLines(script: string, sceneNum: number): string[] {
  const headings = [...script.matchAll(/^((?:INT\.|EXT\.|INT\/EXT\.|EST\.)\s*.*)$/gim)];
  if (!headings.length) return [];
  const idx = Math.min(sceneNum - 1, headings.length - 1);
  const start = (headings[idx]?.index ?? 0) + (headings[idx]?.[0]?.length ?? 0);
  const end = headings[idx + 1]?.index ?? script.length;
  return script.slice(start, end).split('\n').map((l) => l.trim()).filter(Boolean);
}

// ==================== CORE ====================

export function syncReferenceGateControls(): void {
  const sceneKey = sceneKeyFromCurrentScene();
  const script = getCurrentScriptText();
  const heading = extractSceneHeading(script, Number(currentSceneNumber()));
  const gate = validateRequiredReferenceSlots(sceneKey, heading);
  const status =
    (window as any).referenceGenerationStatus === 'generating'
      ? 'Generating references'
      : gate.ok
        ? 'Ready'
        : 'References required';

  const badge = document.getElementById('storyboard-reference-gate-status');
  if (badge) badge.textContent = status;
  const inline = document.getElementById('storyboard-reference-gate-status-inline');
  if (inline) inline.textContent = status;
  const btn = document.getElementById('generate-scene-frames-btn') as HTMLButtonElement | null;
  if (btn) {
    const generating = (window as any).referenceGenerationStatus === 'generating';
    btn.disabled = generating;
    btn.title = gate.ok
      ? 'Generate scene frames'
      : `Will auto-fill references first (${gate.reason || 'references required'})`;
  }
}

export function normalizedReferenceBank(): Record<ReferenceCategory, StoryboardReferenceSlot[]> {
  const bank = storyboardReferenceBank as Record<string, unknown>;
  for (const category of REFERENCE_CATEGORIES) {
    if (!Array.isArray(bank[category])) bank[category] = [];
  }
  return bank as Record<ReferenceCategory, StoryboardReferenceSlot[]>;
}

export function saveReferenceState(): void {
  storageService.setItem(
    STORYBOARD_REFERENCE_KEY,
    JSON.stringify({
      referenceBank: storyboardReferenceBank,
      sceneReferenceOverrides,
      referenceGenerationStatus,
    })
  );
  window.dispatchEvent(new CustomEvent(CG_STORYBOARD_REFERENCES_CHANGED));
  syncReferenceGateControls();
}

export function hydrateReferenceStateFromStorage(): void {
  const raw = storageService.getItem(STORYBOARD_REFERENCE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.referenceBank && typeof parsed.referenceBank === 'object') {
      Object.assign(storyboardReferenceBank as Record<string, unknown>, parsed.referenceBank);
    }
    if (parsed?.sceneReferenceOverrides && typeof parsed.sceneReferenceOverrides === 'object') {
      Object.assign(sceneReferenceOverrides as Record<string, unknown>, parsed.sceneReferenceOverrides);
    }
    if (typeof parsed?.referenceGenerationStatus === 'string') {
      (window as any).referenceGenerationStatus = parsed.referenceGenerationStatus;
    }
  } catch {
    // no-op: invalid local cache
  }
}

function inferSceneEnvironment(sceneHeading: string): 'interiors' | 'exteriors' {
  const h = (sceneHeading || '').toUpperCase();
  if (h.includes('EXT.')) return 'exteriors';
  return 'interiors';
}

export function resolveEffectiveReferences(sceneKey: string): Record<ReferenceCategory, StoryboardReferenceSlot[]> {
  const bank = normalizedReferenceBank();
  const overridesRaw = (sceneReferenceOverrides as Record<string, unknown>)[sceneKey];
  const overrides = (overridesRaw && typeof overridesRaw === 'object'
    ? (overridesRaw as Record<string, StoryboardReferenceSlot[]>)
    : {}) as Record<ReferenceCategory, StoryboardReferenceSlot[]>;
  return {
    characters: Array.isArray(overrides.characters) && overrides.characters.length ? overrides.characters : bank.characters,
    locations: Array.isArray(overrides.locations) && overrides.locations.length ? overrides.locations : bank.locations,
    interiors: Array.isArray(overrides.interiors) && overrides.interiors.length ? overrides.interiors : bank.interiors,
    exteriors: Array.isArray(overrides.exteriors) && overrides.exteriors.length ? overrides.exteriors : bank.exteriors,
  };
}

export function validateRequiredReferenceSlots(sceneKey: string, sceneHeading: string): { ok: boolean; reason?: string } {
  const effective = resolveEffectiveReferences(sceneKey);
  const requiredEnv = inferSceneEnvironment(sceneHeading);
  if (!effective.characters.length) return { ok: false, reason: 'Missing character reference' };
  if (!effective.locations.length) return { ok: false, reason: 'Missing location reference' };
  if (!effective[requiredEnv].length) {
    return { ok: false, reason: `Missing ${requiredEnv === 'interiors' ? 'interior' : 'exterior'} reference` };
  }
  return { ok: true };
}

function makeReferenceSlot(category: ReferenceCategory, label: string, prompt: string): StoryboardReferenceSlot {
  return {
    id: `${category}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    category,
    label,
    prompt,
    source: 'ai',
    enabled: true,
    updatedAt: new Date().toISOString(),
  };
}

function extractCharacterCandidates(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const upper = line.trim();
    if (!upper || upper.length > 40) continue;
    if (/^[A-Z][A-Z0-9 .'\-()]+$/.test(upper)) {
      const cleaned = upper.replace(/\(.*?\)/g, '').trim();
      if (cleaned && !out.includes(cleaned)) out.push(cleaned);
    }
  }
  return out.slice(0, 2);
}

async function generateReferenceSlotImage(slot: StoryboardReferenceSlot): Promise<void> {
  const pseudoFrame = {
    id: Date.now(),
    scene: currentSceneNumber(),
    label: slot.label,
    scriptLink: slot.prompt,
    notes: `Style: ${STORYBOARD_STYLE_PROMPT}`,
    userPromptOverride: buildReferenceSlotPrompt(slot),
  } as Parameters<typeof generateFrameImage>[0];
  slot.imageUrl = await generateFrameImage(pseudoFrame);
  slot.updatedAt = new Date().toISOString();
}

async function ensureReferenceCategoryFilled(
  sceneKey: string,
  category: ReferenceCategory,
  slots: StoryboardReferenceSlot[]
): Promise<void> {
  const bank = normalizedReferenceBank();
  const existing = bank[category];
  for (const slot of slots) {
    const already = existing.find((s) => s.label.toLowerCase() === slot.label.toLowerCase());
    const target = already || slot;
    if (!already) existing.push(target);
    if (!target.imageUrl && !target.locked) {
      await generateReferenceSlotImage(target);
    }
  }
  (sceneReferenceOverrides as Record<string, unknown>)[sceneKey] ??= {};
  const sceneOverride = (sceneReferenceOverrides as Record<string, any>)[sceneKey];
  if (!Array.isArray(sceneOverride[category])) sceneOverride[category] = [];
}

function selectedSceneHeadingAndLines(): { sceneHeading: string; sceneBodyLines: string[] } {
  const scene = Number(currentSceneNumber());
  const script = getCurrentScriptText();
  return {
    sceneHeading: extractSceneHeading(script, scene),
    sceneBodyLines: extractSceneBodyLines(script, scene),
  };
}

export async function generateStoryboardReferences(): Promise<void> {
  await generateStoryboardReferencesForScene(sceneKeyFromCurrentScene());
}

export async function generateStoryboardReferencesForScene(sceneKey: string): Promise<void> {
  const { sceneHeading, sceneBodyLines } = selectedSceneHeadingAndLines();
  (window as any).referenceGenerationStatus = 'generating';
  saveReferenceState();
  emitStoryboardRunLog('references-started', { sceneKey });
  try {
    const characterCandidates = extractCharacterCandidates(sceneBodyLines);
    const locationLabel = sceneHeading
      ? sceneHeading.replace(/^\s*(INT\.|EXT\.|EST\.|INT\/EXT\.)\s*/i, '').split(' - ')[0].trim()
      : `Scene ${currentSceneNumber()} Location`;
    const envCategory = inferSceneEnvironment(sceneHeading);

    const slotBatches: Array<{ category: ReferenceCategory; slots: StoryboardReferenceSlot[] }> = [
      {
        category: 'characters',
        slots: (characterCandidates.length ? characterCandidates : ['Primary Character']).map((name) =>
          makeReferenceSlot('characters', name, `${name}, consistent appearance reference for scene continuity`)
        ),
      },
      {
        category: 'locations',
        slots: [
          makeReferenceSlot(
            'locations',
            locationLabel || 'Primary Location',
            `${locationLabel || 'Primary location'} environment reference, maintain set continuity`
          ),
        ],
      },
      {
        category: envCategory,
        slots: [
          makeReferenceSlot(
            envCategory,
            envCategory === 'interiors' ? 'Interior Lighting Reference' : 'Exterior Lighting Reference',
            envCategory === 'interiors'
              ? 'Interior scene reference, consistent set dressing and practical lighting'
              : 'Exterior scene reference, consistent environment and daylight/weather cues'
          ),
        ],
      },
    ];

    for (const batch of slotBatches) {
      await ensureReferenceCategoryFilled(sceneKey, batch.category, batch.slots);
    }

    (window as any).referenceGenerationStatus = 'ready';
    saveReferenceState();
    emitStoryboardRunLog('references-ready', { sceneKey });
  } catch (error) {
    (window as any).referenceGenerationStatus = 'error';
    saveReferenceState();
    emitStoryboardRunLog('references-failed', {
      sceneKey,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export function findReferenceSlot(slotId: string, sceneKey?: string): StoryboardReferenceSlot | null {
  const bank = normalizedReferenceBank();
  if (sceneKey) {
    const sceneOverride = (sceneReferenceOverrides as Record<string, any>)[sceneKey];
    if (sceneOverride && typeof sceneOverride === 'object') {
      for (const category of REFERENCE_CATEGORIES) {
        const slots = Array.isArray(sceneOverride[category]) ? sceneOverride[category] : [];
        const found = slots.find((s: StoryboardReferenceSlot) => s.id === slotId);
        if (found) return found;
      }
    }
  }
  for (const category of REFERENCE_CATEGORIES) {
    const found = bank[category].find((s) => s.id === slotId);
    if (found) return found;
  }
  return null;
}

export async function regenerateReferenceSlot(slotId: string, sceneKey?: string): Promise<void> {
  const slot = findReferenceSlot(slotId, sceneKey);
  if (!slot) return;
  slot.locked = false;
  await generateReferenceSlotImage(slot);
  saveReferenceState();
  emitStoryboardRunLog('reference-regenerated', { slotId, sceneKey: sceneKey || sceneKeyFromCurrentScene() });
  updateInspector('storyboard-reference-category', {
    type: 'storyboard-reference-category',
    name: 'Storyboard References',
    sceneKey: sceneKey || sceneKeyFromCurrentScene(),
    category: slot.category,
  });
}

export function lockReferenceSlot(slotId: string, sceneKey?: string): void {
  const slot = findReferenceSlot(slotId, sceneKey);
  if (!slot) return;
  slot.locked = true;
  slot.updatedAt = new Date().toISOString();
  saveReferenceState();
}

export function unlockReferenceSlot(slotId: string, sceneKey?: string): void {
  const slot = findReferenceSlot(slotId, sceneKey);
  if (!slot) return;
  slot.locked = false;
  slot.updatedAt = new Date().toISOString();
  saveReferenceState();
}

export function updateReferenceSlotField(
  slotId: string,
  field: 'label' | 'prompt' | 'notes',
  value: string,
  sceneKey?: string
): void {
  const slot = findReferenceSlot(slotId, sceneKey);
  if (!slot) return;
  slot[field] = value;
  slot.updatedAt = new Date().toISOString();
  saveReferenceState();
}

export function enableReferenceSlot(slotId: string, enabled: boolean, sceneKey?: string): void {
  const slot = findReferenceSlot(slotId, sceneKey);
  if (!slot) return;
  slot.enabled = enabled;
  slot.updatedAt = new Date().toISOString();
  saveReferenceState();
}
