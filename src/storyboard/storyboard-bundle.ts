/**
 * ── NOTE ──
 * This file reads AI API settings via storageService.getItem() to determine
 * which provider/model to use for storyboard image generation. This is a
 * read-only consumer of the setting that was written by ai-api-settings-bundle.ts.
 * 
 * In a collaborative deployment, the same abstraction layer serves from the
 * server cache. Do NOT add direct localStorage reads or writes here.
 * ─────────
 */

import {
  storyboardFrames,
  deletedStoryboardFrames,
  storyboardVisibility,
  storyboardReferenceBank,
  sceneReferenceOverrides,
  referenceGenerationStatus,
} from '@/data/project-data';
import { STORYBOARD_FRAME_DESTINATIONS } from '@/storyboard/storyboard-destinations';
import { getCinegenStoryboard } from '@/panels/panel-hosts';
import { alertCG } from '@/utils/alert-cg';
import { promptFrameCG } from '@/utils/prompt-frame-cg';
import { escHtml } from '@/utils/html';
import { updateInspector } from '@/components/panels/cinegen-inspector';
import { patchAppShellState } from '@/stores/app-shell';
import { storageService } from '@/services/persistence';
import { emitAiInteractionLog } from '@/services/ai/interaction-log';

/** Storyboard grid, sync, and pre-production actions */

declare global {
  function hideChipContextMenu(): void;
  function navigateStoryboardDestination(destId: string, frame: any): void;
  function syncScriptRenderScroll(): void;
  function scheduleFountainRender(): void;
  function renderFullTree(): void;
  function triggerModelActivityBlink(mod: string): void;
  function openAiAssistModal(): void;
  function showScriptContextMenu(x: number, y: number): void;
  function hideScriptContextMenu(): void;
  function makeStoryboardFrameForText(): Promise<void>;
  function deleteSelectedFrame(): void;
  function renderStoryboard(): void;
  function regenerateThumbnail(frame: StoryboardFrame): Promise<void>;
  function openStoryboardFrameEditor(frame: StoryboardFrame): void;
  function closeStoryboardFrameEditor(): void;
  function setStoryboardGenerationMode(mode: 'review' | 'auto'): void;
  function getStoryboardGenerationMode(): 'review' | 'auto';
  function duplicateSelectedFrame(): void;
  function moveSelectedFrameUp(): void;
  function moveSelectedFrameDown(): void;
  function restoreLastDeletedFrame(): void;
  function generateStoryboardReferences(): Promise<void>;
  function regenerateReferenceSlot(slotId: string, sceneKey?: string): Promise<void>;
  function lockReferenceSlot(slotId: string, sceneKey?: string): void;
  function unlockReferenceSlot(slotId: string, sceneKey?: string): void;
  function updateReferenceSlotField(
    slotId: string,
    field: 'label' | 'prompt' | 'notes',
    value: string,
    sceneKey?: string
  ): void;
  function makeChipFromSelection(): void;
  function getChipAtScriptCaret(): { type: string; label: string } | null;
  function showChipContextMenuAt(chipType: string, label: string, clientX: number, clientY: number): void;
  function extractChipsFromText(text: string): Array<{ type: string; label: string }>;
  function addItemsToLibrary(bucket: string, values: string[], icon?: string, desc?: string): void;
  function normalizeEntityName(value: string): string;
  var currentSceneId: string | null;
  var storyboardContextState: { frameId: number } | null;
  var selectedStoryboardFrameId: number | null;
  var storyboardFrames: Array<{ id: number; scene?: string; label: string; scriptLink?: string; notes?: string; imageUrl?: string; generatingStatus?: string }>;
}

function getScriptEditor(): HTMLTextAreaElement | null {
  return document.getElementById('script-editor') as HTMLTextAreaElement | null;
}

interface StoryboardFrame {
  id: number;
  scene?: string;
  label: string;
  scriptLink?: string;
  notes?: string;
  imageUrl?: string;
  generatingStatus?: string;
}

type ReferenceCategory = 'characters' | 'locations' | 'interiors' | 'exteriors';
interface StoryboardReferenceSlot {
  id: string;
  category: ReferenceCategory;
  label: string;
  prompt: string;
  imageUrl?: string;
  notes?: string;
  locked?: boolean;
  source: 'ai' | 'user';
  updatedAt?: string;
}

const REFERENCE_CATEGORIES: ReferenceCategory[] = ['characters', 'locations', 'interiors', 'exteriors'];
const STORYBOARD_REFERENCE_KEY = 'cinegen.storyboard.references';

export function showStoryboardContextMenu(frame: StoryboardFrame, clientX: number, clientY: number): void {
  const menu = document.getElementById('storyboard-context-menu') as any;
  if (!menu || typeof menu.open !== 'function' || !frame) return;

  hideChipContextMenu();
  storyboardContextState = { frameId: frame.id };

  const thumbLabel = frame.imageUrl ? 'Regenerate Thumbnail' : 'Generate Thumbnail';
  menu.open({
    x: clientX,
    y: clientY,
    items: [
      { id: 'regenerate-thumbnail', label: thumbLabel, icon: 'fa-arrows-rotate' },
      ...STORYBOARD_FRAME_DESTINATIONS.map((d) => ({
        id: d.id,
        label: d.label,
        icon: d.icon,
      })),
    ],
    onSelect: (destId: string) => {
      if (destId === 'regenerate-thumbnail') {
        regenerateThumbnail(frame);
      } else {
        navigateStoryboardDestination(destId, frame);
      }
    },
  });
}

export function hideStoryboardContextMenu(): void {
  (document.getElementById('storyboard-context-menu') as any)?.close?.();
  storyboardContextState = null;
}

export function initStoryboardNavigation() {
  getCinegenStoryboard()?.wireContextMenuDismiss();
}


// ==================== EXISTING FUNCTIONS (enhanced) ====================
export function applyStoryboardVisibilityClasses() {
  getCinegenStoryboard()?.syncVisibilityClasses();
}

export function setStoryboardPartVisibility(part: string, visible: boolean): void {
  const vis = storyboardVisibility as Record<string, boolean>;
  if (!Object.prototype.hasOwnProperty.call(vis, part)) return;
  vis[part] = visible;
  getCinegenStoryboard()?.setPartVisibility(part as 'scene' | 'frame' | 'notes', visible);
  document.querySelectorAll(`input[data-storyboard-part="${part}"]`).forEach((input) => {
    (input as HTMLInputElement).checked = visible;
  });
}

let autogenBoardsEnabled = false;
let storyboardGenerationMode: 'review' | 'auto' = 'review';
const STORYBOARD_GEN_MODE_KEY = 'cinegen.storyboard.generationMode';
const STORYBOARD_STYLE_PROMPT =
  'Pencil illustration of film frame, monochrome linework, cinematic composition, clear subject blocking, practical shot intent, no photorealism.';

export function initAutogenCheckbox(): void {
  const cb = document.getElementById('autogen-boards-cb') as HTMLInputElement | null;
  if (!cb) return;
  autogenBoardsEnabled = cb.checked;
  cb.addEventListener('change', () => {
    autogenBoardsEnabled = cb.checked;
  });
}

function emitStoryboardRunLog(event: string, payload: Record<string, unknown>): void {
  emitAiInteractionLog({
    capability: 'image',
    level: 'info',
    message: `🧪 Storyboard ${event}: ${JSON.stringify(payload)}`,
  });
}

function loadStoryboardGenerationMode(): 'review' | 'auto' {
  const raw = storageService.getItem(STORYBOARD_GEN_MODE_KEY);
  return raw === 'auto' ? 'auto' : 'review';
}

function syncStoryboardGenerationModeControls(): void {
  document.querySelectorAll<HTMLInputElement>('input[name="storyboard-generation-mode"]').forEach((input) => {
    input.checked = input.value === storyboardGenerationMode;
  });
  document.querySelectorAll<HTMLSelectElement>('select[data-storyboard-generation-mode-select]').forEach((select) => {
    select.value = storyboardGenerationMode;
  });
}

export function getStoryboardGenerationMode(): 'review' | 'auto' {
  return storyboardGenerationMode;
}

export function setStoryboardGenerationMode(mode: 'review' | 'auto'): void {
  storyboardGenerationMode = mode === 'auto' ? 'auto' : 'review';
  storageService.setItem(STORYBOARD_GEN_MODE_KEY, storyboardGenerationMode);
  syncStoryboardGenerationModeControls();
  emitStoryboardRunLog('mode-changed', { mode: storyboardGenerationMode });
}

function initStoryboardGenerationModeControls(): void {
  storyboardGenerationMode = loadStoryboardGenerationMode();
  syncStoryboardGenerationModeControls();

  document.querySelectorAll<HTMLInputElement>('input[name="storyboard-generation-mode"]').forEach((input) => {
    if (input.dataset.storyboardModeBound === '1') return;
    input.dataset.storyboardModeBound = '1';
    input.addEventListener('change', () => {
      if (!input.checked) return;
      setStoryboardGenerationMode(input.value === 'auto' ? 'auto' : 'review');
    });
  });

  document.querySelectorAll<HTMLSelectElement>('select[data-storyboard-generation-mode-select]').forEach((select) => {
    if (select.dataset.storyboardModeBound === '1') return;
    select.dataset.storyboardModeBound = '1';
    select.addEventListener('change', () => {
      setStoryboardGenerationMode(select.value === 'auto' ? 'auto' : 'review');
    });
  });
}

function syncReferenceGateControls(): void {
  const sceneKey = sceneKeyFromCurrentScene();
  const script = getScriptEditor()?.value || '';
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

function normalizedReferenceBank(): Record<ReferenceCategory, StoryboardReferenceSlot[]> {
  const bank = storyboardReferenceBank as Record<string, unknown>;
  for (const category of REFERENCE_CATEGORIES) {
    if (!Array.isArray(bank[category])) bank[category] = [];
  }
  return bank as Record<ReferenceCategory, StoryboardReferenceSlot[]>;
}

function saveReferenceState(): void {
  storageService.setItem(
    STORYBOARD_REFERENCE_KEY,
    JSON.stringify({
      referenceBank: storyboardReferenceBank,
      sceneReferenceOverrides,
      referenceGenerationStatus,
    })
  );
  window.dispatchEvent(new CustomEvent('storyboard-references-changed'));
  syncReferenceGateControls();
}

function hydrateReferenceStateFromStorage(): void {
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

function sceneKeyFromCurrentScene(): string {
  return window.currentSceneId || 'scene1';
}

function currentSceneNumber(): string {
  const id = window.currentSceneId;
  return id ? String(parseInt(id.replace('scene', ''), 10)) : '1';
}

function inferSceneEnvironment(sceneHeading: string): 'interiors' | 'exteriors' {
  const h = (sceneHeading || '').toUpperCase();
  if (h.includes('EXT.')) return 'exteriors';
  return 'interiors';
}

function resolveEffectiveReferences(sceneKey: string): Record<ReferenceCategory, StoryboardReferenceSlot[]> {
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

function validateRequiredReferenceSlots(sceneKey: string, sceneHeading: string): { ok: boolean; reason?: string } {
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
  const pseudoFrame: StoryboardFrame = {
    id: Date.now(),
    scene: currentSceneNumber(),
    label: slot.label,
    scriptLink: slot.prompt,
    notes: `Style: ${STORYBOARD_STYLE_PROMPT}`,
  };
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
  const script = getScriptEditor()?.value || '';
  return {
    sceneHeading: extractSceneHeading(script, scene),
    sceneBodyLines: extractSceneBodyLines(script, scene),
  };
}

export async function generateStoryboardReferences(): Promise<void> {
  await generateStoryboardReferencesForScene(sceneKeyFromCurrentScene());
}

async function generateStoryboardReferencesForScene(sceneKey: string): Promise<void> {
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

function findReferenceSlot(slotId: string, sceneKey?: string): StoryboardReferenceSlot | null {
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

export function initStoryboardVisibilityToggles(): void {
  document.querySelectorAll('input[data-storyboard-part]').forEach((input) => {
    const part = (input as HTMLElement).dataset.storyboardPart;
    (input as HTMLInputElement).checked = (storyboardVisibility as Record<string, boolean>)[part!] !== false;
    input.addEventListener('change', () => {
      setStoryboardPartVisibility(part!, (input as HTMLInputElement).checked);
    });
  });
  applyStoryboardVisibilityClasses();
}

export function renderStoryboard() {
  getCinegenStoryboard()?.refresh();
}

export function highlightScriptForFrame(frame: StoryboardFrame): void {
  const editor = getScriptEditor();
  if (!editor || !frame.scriptLink) return;
  const text = editor.value;
  const searchStr = frame.scriptLink.trim();
  const idx = text.toLowerCase().indexOf(searchStr.toLowerCase());
  if (idx === -1) return;
  editor.focus({ preventScroll: true });
  editor.setSelectionRange(idx, idx + searchStr.length);
  const lh = parseFloat(getComputedStyle(editor).lineHeight) || 19;
  const line = text.slice(0, idx).split('\n').length;
  editor.scrollTop = Math.max(0, (line - 3) * lh);
  syncScriptRenderScroll();
}

export function getSelectedStoryboardFrame(): StoryboardFrame | null {
  if (!window.selectedStoryboardFrameId) return null;
  return storyboardFrames.find((frame) => frame.id === window.selectedStoryboardFrameId) || null;
}

export function getScriptSelectionOrCurrentLine(): string {
  const editor = getScriptEditor();
  if (!editor) return '';
  const selected = editor.value.slice(editor.selectionStart, editor.selectionEnd).trim();
  if (selected) return selected;
  const before = editor.value.slice(0, editor.selectionStart);
  const lineStart = before.lastIndexOf('\n') + 1;
  const lineEndIdx = editor.value.indexOf('\n', editor.selectionStart);
  const lineEnd = lineEndIdx === -1 ? editor.value.length : lineEndIdx;
  return editor.value.slice(lineStart, lineEnd).trim();
}

export async function addStoryboardFrame(): Promise<void> {
  const anchorGuess = getScriptSelectionOrCurrentLine();
  const result = await promptFrameCG({
    label: `New Frame ${storyboardFrames.length + 1}`,
    anchor: anchorGuess || '',
  });
  if (!result) return;
  const scene = currentSceneNumber();
  const frame: StoryboardFrame = {
    id: Date.now(),
    scene,
    label: result.label,
    scriptLink: result.anchor,
    notes: result.notes,
  };
  storyboardFrames.push(frame);
  window.selectedStoryboardFrameId = frame.id;
  renderStoryboard();
  updateInspector('storyboard-frame', frame);
  scheduleFountainRender();
  window.dispatchEvent(new CustomEvent('storyboard-frames-changed'));
  if (autogenBoardsEnabled) {
    await regenerateThumbnail(frame);
  }
}

export function linkSelectedFrameToScript(): void {
  const frame = getSelectedStoryboardFrame();
  if (!frame) {
    alertCG('Select a storyboard frame first.');
    return;
  }
  const linkText = getScriptSelectionOrCurrentLine();
  if (!linkText) {
    alertCG('Select script text or place the cursor on a line to create a link.');
    return;
  }
  frame.scriptLink = linkText;
  updateInspector('storyboard-frame', frame);
  scheduleFountainRender();
  alertCG('Frame link updated from current script selection.');
}

export function deleteSelectedFrame(): void {
  const frame = getSelectedStoryboardFrame();
  if (!frame) {
    alertCG('Select a storyboard frame to delete.');
    return;
  }
  window.storyboardFrames = storyboardFrames.filter(item => item.id !== frame.id);
  deletedStoryboardFrames.unshift({ ...frame, deletedAt: new Date().toISOString() });
  window.selectedStoryboardFrameId = null;
  renderStoryboard();
  renderFullTree();
  updateInspector('scrap', { items: deletedStoryboardFrames });
  window.dispatchEvent(new CustomEvent('storyboard-frames-changed'));
}

export function duplicateSelectedFrame(): void {
  const frame = getSelectedStoryboardFrame();
  if (!frame) {
    alertCG('Select a storyboard frame to duplicate.');
    return;
  }
  const idx = storyboardFrames.findIndex((f) => f.id === frame.id);
  if (idx === -1) return;
  const copy: StoryboardFrame = {
    ...frame,
    id: Date.now(),
    label: `${frame.label} (copy)`,
    generatingStatus: undefined,
  };
  storyboardFrames.splice(idx + 1, 0, copy);
  window.selectedStoryboardFrameId = copy.id;
  renderStoryboard();
  updateInspector('storyboard-frame', copy);
  window.dispatchEvent(new CustomEvent('storyboard-frames-changed'));
}

function moveSelectedFrame(direction: -1 | 1): void {
  const selectedId = window.selectedStoryboardFrameId;
  if (!selectedId) {
    alertCG('Select a storyboard frame first.');
    return;
  }
  const idx = storyboardFrames.findIndex((f) => f.id === selectedId);
  if (idx === -1) return;
  const target = idx + direction;
  if (target < 0 || target >= storyboardFrames.length) return;
  const [item] = storyboardFrames.splice(idx, 1);
  storyboardFrames.splice(target, 0, item);
  renderStoryboard();
  window.dispatchEvent(new CustomEvent('storyboard-frames-changed'));
}

export function moveSelectedFrameUp(): void {
  moveSelectedFrame(-1);
}

export function moveSelectedFrameDown(): void {
  moveSelectedFrame(1);
}

export function restoreLastDeletedFrame(): void {
  const restored = deletedStoryboardFrames.shift();
  if (!restored) {
    alertCG('Scrap Bin is empty.');
    return;
  }
  const frame: StoryboardFrame = {
    id: Date.now(),
    scene: restored.scene || '1',
    label: restored.label || 'Restored Frame',
    scriptLink: restored.scriptLink,
    notes: restored.notes,
    imageUrl: restored.imageUrl,
    generatingStatus: undefined,
  };
  storyboardFrames.push(frame);
  window.selectedStoryboardFrameId = frame.id;
  renderStoryboard();
  updateInspector('storyboard-frame', frame);
  window.dispatchEvent(new CustomEvent('storyboard-frames-changed'));
}

export function highlightStoryboardForScriptSelection(): void {
  const editor = getScriptEditor();
  if (!editor) return;
  const selectedText = editor.value.slice(editor.selectionStart, editor.selectionEnd).trim();
  if (!selectedText) return;
  const normalized = selectedText.toLowerCase();
  const frame = storyboardFrames.find(item => item.scriptLink && normalized.includes(item.scriptLink.toLowerCase()))
    || storyboardFrames.find(item => item.scriptLink && item.scriptLink.toLowerCase().includes(normalized));
  if (!frame) return;
  window.selectedStoryboardFrameId = frame.id;
  renderStoryboard();
  const frameEl = document.querySelector(
    `cinegen-storyboard .storyboard-frame[data-frame-id="${frame.id}"]`
  );
  if (frameEl) frameEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  updateInspector('storyboard-frame', frame);
}

export async function generateBoards(): Promise<void> {
  if (typeof triggerModelActivityBlink === 'function') triggerModelActivityBlink('image');
  const scene = currentSceneNumber();
  const sceneKey = sceneKeyFromCurrentScene();
  const editor = getScriptEditor();
  const scriptText = editor?.value || '';
  const selection = getScriptSelectionOrCurrentLine();
  const sceneHeading = extractSceneHeading(scriptText, Number(scene));
  const sceneBodyLines = extractSceneBodyLines(scriptText, Number(scene));
  const anchor = selection || sceneHeading || undefined;

  const preGate = validateRequiredReferenceSlots(sceneKey, sceneHeading);
  if (!preGate.ok) {
    emitStoryboardRunLog('reference-gate-missing', { sceneKey, reason: preGate.reason });
    try {
      await generateStoryboardReferencesForScene(sceneKey);
    } catch {
      alertCG(`Reference generation failed. ${preGate.reason || ''}`.trim());
      return;
    }
  }
  const gate = validateRequiredReferenceSlots(sceneKey, sceneHeading);
  if (!gate.ok) {
    emitStoryboardRunLog('reference-gate-blocked', { sceneKey, reason: gate.reason });
    alertCG(`Cannot generate frames yet: ${gate.reason}`);
    return;
  }
  emitStoryboardRunLog('reference-gate-passed', { sceneKey });

  const drafts = buildStoryboardDraftFrames(scene, sceneHeading, anchor, sceneBodyLines);
  drafts.forEach((frame) => storyboardFrames.push(frame));
  window.selectedStoryboardFrameId = drafts[0]?.id || null;
  renderStoryboard();
  if (drafts[0]) updateInspector('storyboard-frame', drafts[0]);
  window.dispatchEvent(new CustomEvent('storyboard-frames-changed'));

  emitStoryboardRunLog('draft-created', {
    mode: storyboardGenerationMode,
    scene,
    frameCount: drafts.length,
    hasSelection: !!selection,
  });

  if (storyboardGenerationMode === 'auto') {
    if (typeof triggerModelActivityBlink === 'function') triggerModelActivityBlink('image');
    let ok = 0;
    let failed = 0;
    for (const frame of drafts) {
      await regenerateThumbnail(frame);
      if (frame.generatingStatus?.startsWith('error:')) failed += 1;
      else ok += 1;
    }
    emitStoryboardRunLog('auto-images-finished', { scene, ok, failed, frameCount: drafts.length });
  } else {
    alertCG(`Created ${drafts.length} storyboard draft frame(s) for scene ${scene}. Review and generate thumbnails when ready.`);
  }
}

function extractSceneHeading(script: string, sceneNumber: number): string {
  if (!script || !Number.isFinite(sceneNumber) || sceneNumber < 1) return '';
  const lines = script.split('\n');
  const sceneLines = lines.filter((line) => /^\s*(INT\.|EXT\.|EST\.|INT\/EXT\.)/i.test(line.trim()));
  return sceneLines[sceneNumber - 1]?.trim() || '';
}

function extractSceneBodyLines(script: string, sceneNumber: number): string[] {
  if (!script || !Number.isFinite(sceneNumber) || sceneNumber < 1) return [];
  const lines = script.split('\n');
  const headingIdxs: number[] = [];
  lines.forEach((line, idx) => {
    if (/^\s*(INT\.|EXT\.|EST\.|INT\/EXT\.)/i.test(line.trim())) headingIdxs.push(idx);
  });
  const start = headingIdxs[sceneNumber - 1];
  if (start == null) return [];
  const next = headingIdxs[sceneNumber] ?? lines.length;
  return lines
    .slice(start + 1, next)
    .map((line) => line.trim())
    .filter((line) => line && !/^[A-Z0-9 .'\-()]+$/.test(line));
}

function buildStoryboardDraftFrames(
  scene: string,
  sceneHeading: string,
  anchor: string | undefined,
  sceneBodyLines: string[]
): StoryboardFrame[] {
  const cleanedHeading = sceneHeading || `Scene ${scene}`;
  const snippets = sceneBodyLines.slice(0, 3);
  const labels = [
    `AI Draft - Establishing shot (${cleanedHeading})`,
    `AI Draft - Action beat (${cleanedHeading})`,
    `AI Draft - Character beat (${cleanedHeading})`,
  ];

  return labels.map((label, idx) => ({
    id: Date.now() + idx,
    scene,
    label,
    scriptLink: snippets[idx] || anchor,
    notes: `AI draft frame ${idx + 1}. Adjust framing, lens intent, and movement as needed.\nStyle: ${STORYBOARD_STYLE_PROMPT}`,
  }));
}

export async function makeStoryboardFrameForText(): Promise<void> {
  const text = getScriptSelectionOrCurrentLine();
  if (!text) {
    alertCG('Select text in the script editor first.');
    return;
  }
  if (typeof triggerModelActivityBlink === 'function') triggerModelActivityBlink('image');
  const scene = currentSceneNumber();
  const trunc = text.length > 30 ? text.slice(0, 30) + '…' : text;
  const frame: StoryboardFrame = {
    id: Date.now(),
    scene,
    label: `AI Frame: "${trunc}"`,
    scriptLink: text,
  };
  storyboardFrames.push(frame);
  window.selectedStoryboardFrameId = frame.id;
  renderStoryboard();
  updateInspector('storyboard-frame', frame);
  scheduleFountainRender();
  window.dispatchEvent(new CustomEvent('storyboard-frames-changed'));
  const msgTrunc = text.length > 50 ? text.slice(0, 50) + '…' : text;
  alertCG(`New storyboard frame created from selected text: "${msgTrunc}"`);
  if (autogenBoardsEnabled) {
    await regenerateThumbnail(frame);
  }
}

/* ── Image generation helpers ─────────────────────────────────────────────── */

const PROXY_BASE = '';

const PROVIDER_TARGET_MAP: Record<string, string> = {
  'openai-compatible': 'openai',
  'fal-ai': 'fal',
  'replicate-api': 'replicate',
  'google-gemini-api': 'google',
  'luma-api': 'luma',
};

const VENDOR_TARGET_MAP: Record<string, string> = {
  openai: 'openai',
  xai: 'xai',
  together: 'together',
  groq: 'groq',
  mistral: 'mistral',
  deepseek: 'deepseek',
  anthropic: 'anthropic',
  google: 'google',
  elevenlabs: 'elevenlabs',
  fal: 'fal',
  replicate: 'replicate',
  runway: 'runway',
  luma: 'luma',
};

interface ImageGenSettings {
  provider: string;
  target: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  vendorId: string;
}

function getImageGenSettings(): ImageGenSettings | null {
  try {
    const raw = storageService.getItem('cinegen.aiApiSettings');
    if (!raw) return null;
    const settings = JSON.parse(raw);
    const imageCfg = settings?.modalities?.image;
    if (!imageCfg?.provider || !imageCfg?.model) return null;

      let target = '';
      if (imageCfg.vendorId && typeof window.loadApiKeys === 'function') {
        const keys = window.loadApiKeys();
        const vendor = (keys?.vendors || []).find((v: any) => v.id === imageCfg.vendorId);
        const slotId = (vendor as any)?.slotId || imageCfg.vendorId;
        if (slotId) target = VENDOR_TARGET_MAP[slotId] || slotId;
      }
    if (!target) target = PROVIDER_TARGET_MAP[imageCfg.provider] || imageCfg.provider;

    return {
      provider: imageCfg.provider,
      target,
      model: imageCfg.model,
      apiKey: '',
      baseUrl: imageCfg.baseUrl || '',
      vendorId: imageCfg.vendorId || '',
    };
  } catch {
    return null;
  }
}

async function fetchImageAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`Failed to fetch image: HTTP ${res.status}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function generateFrameImage(frame: StoryboardFrame): Promise<string> {
  const settings = getImageGenSettings();
  if (!settings) {
    throw new Error('No image generation provider configured. Open Settings → AI Models & Modalities to set one up.');
  }

  const { provider, target, model, apiKey, baseUrl } = settings;
  const styleFromNotes = extractStoryboardStyleFromNotes(frame.notes);
  const stylePrompt = styleFromNotes || STORYBOARD_STYLE_PROMPT;
  const sceneKey = `scene${parseInt(String(frame.scene || currentSceneNumber()), 10) || 1}`;
  const refsText = referenceDescriptorText(sceneKey);
  const prompt = frame.scriptLink
    ? `${frame.label}: ${frame.scriptLink}. ${stylePrompt}${refsText ? ` ${refsText}` : ''}`
    : `${frame.label}. ${stylePrompt}${refsText ? ` ${refsText}` : ''}`;

  if (provider === 'openai-compatible') {
    const size = model === 'dall-e-3' ? '1024x1024' : '1024x1024';
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-Cinegen-Target': target };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    if (baseUrl) headers['X-Cinegen-Base-Url'] = baseUrl;
    const res = await fetch(`${PROXY_BASE}/proxy/v1/images/generations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, prompt, n: 1, size, response_format: 'b64_json' }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `API error (HTTP ${res.status})`);
    }
    const data = await res.json();
    const b64 = data.data?.[0]?.b64_json;
    if (b64) return `data:image/png;base64,${b64}`;
    const url = data.data?.[0]?.url;
    if (url) return fetchImageAsDataUrl(url);
    throw new Error('No image data in API response');
  }

  if (provider === 'fal-ai') {
    const refImages = referenceImageUrls(sceneKey).slice(0, 4);
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-Cinegen-Target': target };
    if (apiKey) headers['Authorization'] = `Key ${apiKey}`;
    if (baseUrl) headers['X-Cinegen-Base-Url'] = baseUrl;
    const body: Record<string, unknown> = { prompt };
    if (refImages.length) body.image_urls = refImages;
    const res = await fetch(`${PROXY_BASE}/proxy/${model}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `API error (HTTP ${res.status})`);
    }
    const data = await res.json();
    const imgUrl = data.images?.[0]?.url || data.image?.url;
    if (imgUrl) return fetchImageAsDataUrl(imgUrl);
    throw new Error('No image URL in fal.ai response');
  }

  throw new Error(`Provider "${provider}" image generation not yet implemented`);
}

function referenceDescriptorText(sceneKey: string): string {
  const effective = resolveEffectiveReferences(sceneKey);
  const bits: string[] = [];
  const charNames = effective.characters.slice(0, 2).map((s) => s.label).join(', ');
  if (charNames) bits.push(`Consistent character appearance reference: ${charNames}.`);
  const loc = effective.locations[0]?.label;
  if (loc) bits.push(`Primary location reference: ${loc}.`);
  const env = effective.interiors[0]?.label || effective.exteriors[0]?.label;
  if (env) bits.push(`Environment reference: ${env}.`);
  return bits.join(' ');
}

function referenceImageUrls(sceneKey: string): string[] {
  const effective = resolveEffectiveReferences(sceneKey);
  const urls: string[] = [];
  for (const category of REFERENCE_CATEGORIES) {
    for (const slot of effective[category]) {
      if (slot.imageUrl) urls.push(slot.imageUrl);
    }
  }
  return urls;
}

function extractStoryboardStyleFromNotes(notes?: string): string {
  if (!notes) return '';
  const match = notes.match(/style\s*:\s*(.+)/i);
  return match?.[1]?.trim() || '';
}

export async function regenerateThumbnail(frame: StoryboardFrame): Promise<void> {
  if (frame.generatingStatus && !frame.generatingStatus.startsWith('error:')) {
    return;
  }

  frame.generatingStatus = 'Starting…';
  renderStoryboard();

  const started = Date.now();
  try {
    frame.generatingStatus = 'Generating…';
    renderStoryboard();

    const dataUrl = await generateFrameImage(frame);

    frame.imageUrl = dataUrl;
    frame.generatingStatus = undefined;
    renderStoryboard();
    window.dispatchEvent(new CustomEvent('storyboard-frames-changed'));

    if (typeof triggerModelActivityBlink === 'function') triggerModelActivityBlink('image');
    emitStoryboardRunLog('thumbnail-success', {
      frameId: frame.id,
      scene: frame.scene,
      elapsedMs: Date.now() - started,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    frame.generatingStatus = `error:${msg}`;
    renderStoryboard();
    emitStoryboardRunLog('thumbnail-error', {
      frameId: frame.id,
      scene: frame.scene,
      elapsedMs: Date.now() - started,
      error: msg,
    });
  }
}

export function openStoryboardFrameEditor(frame: StoryboardFrame): void {
  const modal = document.getElementById('storyboard-frame-editor');
  if (!modal) return;
  (modal as any)._frameData = { ...frame };
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  window.selectedStoryboardFrameId = frame.id;
  renderStoryboard();
  syncFrameEditorForm();

  const preview = modal.querySelector('.sfe-preview');
  if (preview) {
    if (frame.imageUrl) {
      preview.innerHTML = `<img src="${escHtml(frame.imageUrl)}" alt="${escHtml(frame.label)}" style="width:100%;height:100%;object-fit:cover;display:block" />`;
    } else {
      preview.innerHTML = `<div class="sfe-preview-placeholder"><i class="fa-solid fa-video"></i><span>Frame preview</span></div>`;
    }
  }

  const regenBtn = modal.querySelector<HTMLElement>('.sfe-regenerate-btn');
  if (regenBtn) {
    regenBtn.innerHTML = frame.imageUrl
      ? '<i class="fa-solid fa-arrows-rotate"></i> Regenerate Thumbnail'
      : '<i class="fa-solid fa-arrows-rotate"></i> Generate Thumbnail';
  }
}

export function closeStoryboardFrameEditor(): void {
  const modal = document.getElementById('storyboard-frame-editor');
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  (modal as any)._frameData = null;
  document.body.style.overflow = '';
}

function syncFrameEditorForm(): void {
  const modal = document.getElementById('storyboard-frame-editor');
  if (!modal || modal.hidden) return;
  const data: StoryboardFrame = (modal as any)._frameData;
  if (!data) return;
  const labelInput = modal.querySelector<HTMLInputElement>('.sfe-input-label');
  const sceneInput = modal.querySelector<HTMLInputElement>('.sfe-input-scene');
  const anchorInput = modal.querySelector<HTMLInputElement>('.sfe-input-anchor');
  const notesTextarea = modal.querySelector<HTMLTextAreaElement>('.sfe-input-notes');
  if (labelInput) { labelInput.value = data.label || ''; }
  if (sceneInput) { sceneInput.value = data.scene || ''; }
  if (anchorInput) { anchorInput.value = data.scriptLink || ''; }
  if (notesTextarea) { notesTextarea.value = data.notes || ''; }
}

function wireFrameEditor(): void {
  const modal = document.getElementById('storyboard-frame-editor');
  if (!modal) return;
  if (modal.dataset.sfeWired === '1') return;
  modal.dataset.sfeWired = '1';

  const backdropClose = () => {
    const frame = (modal as any)._frameData;
    if (frame) {
      window.selectedStoryboardFrameId = frame.id;
      renderStoryboard();
    }
    closeStoryboardFrameEditor();
  };

  modal.addEventListener('click', (e: MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.dataset.cgClose === 'storyboard-frame-editor') {
      backdropClose();
      return;
    }
    if (t.closest('.sfe-regenerate-btn')) {
      const frameData = (modal as any)._frameData;
      if (frameData) {
        const live = storyboardFrames.find((f) => f.id === frameData.id);
        if (live) {
          regenerateThumbnail(live).then(() => {
            if (!live.generatingStatus && live.imageUrl) {
              const preview = modal.querySelector('.sfe-preview');
              if (preview) {
                preview.innerHTML = `<img src="${escHtml(live.imageUrl)}" alt="${escHtml(live.label)}" style="width:100%;height:100%;object-fit:cover;display:block" />`;
              }
            }
          });
        }
      }
      return;
    }
  });

  const syncField = (selector: string, field: keyof StoryboardFrame) => {
    const el = modal.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
    if (!el) return;
    el.addEventListener('input', () => {
      const data = (modal as any)._frameData;
      if (!data) return;
      data[field] = el.value;
      const frame = storyboardFrames.find((f: StoryboardFrame) => f.id === data.id);
      if (frame) {
        (frame as any)[field] = el.value;
      }
      window.selectedStoryboardFrameId = data.id;
      renderStoryboard();
      updateInspector('storyboard-frame', data);
    });
  };

  syncField('.sfe-input-label', 'label');
  syncField('.sfe-input-scene', 'scene');
  syncField('.sfe-input-anchor', 'scriptLink');
  syncField('.sfe-input-notes', 'notes');
}

export function initStoryboardFrameEditor(): void {
  wireFrameEditor();
  document.addEventListener('click', (e) => {
    const modal = document.getElementById('storyboard-frame-editor');
    if (!modal || modal.hidden) return;
    if ((e.target as HTMLElement).closest('.storyboard-frame-editor-dialog')) return;
    if ((e.target as HTMLElement).closest('[data-cg-close]')) return;
    const target = e.target as HTMLElement;
    if (target.dataset.cgClose === 'storyboard-frame-editor') {
      closeStoryboardFrameEditor();
    }
  });
}

function insertAtCursor(text: string): void {
  const editor = getScriptEditor();
  if (!editor) return;
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const before = editor.value.slice(0, start);
  const after = editor.value.slice(end);
  editor.value = before + text + after;
  const newPos = start + text.length;
  editor.setSelectionRange(newPos, newPos);
  editor.focus();
  window.scheduleFountainRender?.();
  window.scheduleScriptEditorProjectSync?.();
}

export function showScriptContextMenu(clientX: number, clientY: number): void {
  const menu = document.getElementById('script-context-menu') as any;
  if (!menu || typeof menu.open !== 'function') return;

  const atChip = window.getChipAtScriptCaret?.();
  if (atChip) {
    hideScriptContextMenu();
    window.showChipContextMenuAt?.(atChip.type, atChip.label, clientX, clientY);
    return;
  }

  hideScriptContextMenu();
  const selectedText = getScriptSelectionOrCurrentLine();
  const editor = getScriptEditor();
  const hasSelection = editor && editor.selectionStart !== editor.selectionEnd;
  const existingChips = hasSelection ? window.extractChipsFromText?.(selectedText) || [] : [];

  const items: Array<{ id: string; label: string; icon: string }> = [
    { id: 'make-storyboard-frame-for-text', label: 'Make Storyboard Frame', icon: 'fa-image' },
    { id: 'link-frame-to-script', label: 'Link to Selected Frame', icon: 'fa-link' },
    { id: 'revise-selection', label: 'Revise...', icon: 'fa-pen' },
  ];

  if (hasSelection && existingChips.length === 0 && selectedText) {
    items.push({ id: 'make-chip', label: `Make Chip...`, icon: 'fa-tag' });
  }

  items.push(
    { id: 'insert-scene-heading', label: 'Insert Scene Heading', icon: 'fa-heading' },
    { id: 'add-transition', label: 'Add Transition', icon: 'fa-arrow-right' },
  );

  menu.open({
    x: clientX,
    y: clientY,
    items,
    onSelect: (actionId: string) => {
      switch (actionId) {
        case 'make-storyboard-frame-for-text':
          makeStoryboardFrameForText();
          break;
        case 'link-frame-to-script':
          linkSelectedFrameToScript();
          break;
        case 'revise-selection':
          openAiAssistModal();
          break;
        case 'make-chip':
          makeChipFromSelection();
          break;
        case 'insert-scene-heading':
          insertAtCursor('.\n\n');
          break;
        case 'add-transition':
          insertAtCursor('> TRANSITION TO:\n\n');
          break;
      }
    },
  });
}

function makeChipFromSelection(): void {
  const text = getScriptSelectionOrCurrentLine();
  if (!text) {
    alertCG('Select text in the script editor first.');
    return;
  }
  let el = document.getElementById('cg-make-chip-prompt');
  if (el) el.remove();
  el = document.createElement('div');
  el.id = 'cg-make-chip-prompt';
  el.innerHTML = `
    <div class="cg-prompt-layer" role="dialog" aria-modal="true" aria-labelledby="cg-make-chip-title">
      <div class="cg-prompt-dialog bevel-raised" style="width:360px">
        <div class="cg-prompt-header panel-header">
          <span id="cg-make-chip-title"><i class="fa-solid fa-tag"></i> Make Chip</span>
        </div>
        <div class="cg-prompt-body panel-content">
          <p class="text-xs text-[var(--text-dim)] mb-3">Create a new entity chip for: <strong>${escHtml(text)}</strong></p>
          <label class="cg-prompt-field">
            <span>Chip type</span>
            <select id="cg-make-chip-type" class="cg-input">
              <option value="character">Character</option>
              <option value="location" selected>Location</option>
              <option value="prop">Prop</option>
              <option value="wardrobe">Wardrobe</option>
              <option value="effect">SFX / Makeup</option>
              <option value="vehicle">Vehicle</option>
            </select>
          </label>
          <label class="cg-prompt-field">
            <span>Chip label (name)</span>
            <input type="text" id="cg-make-chip-label" class="cg-input" value="${escHtml(text)}" />
          </label>
        </div>
        <div class="cg-prompt-footer bevel-sunken">
          <button type="button" id="cg-make-chip-cancel" class="toolbar-btn">Cancel</button>
          <button type="button" id="cg-make-chip-ok" class="toolbar-btn toolbar-btn--shape-soft btn-ai">Create Chip</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(el);
  const layer = el.querySelector('.cg-prompt-layer') as HTMLElement;
  const typeSelect = el.querySelector('#cg-make-chip-type') as HTMLSelectElement;
  const labelInput = el.querySelector('#cg-make-chip-label') as HTMLInputElement;
  const okBtn = el.querySelector('#cg-make-chip-ok') as HTMLElement;
  const cancelBtn = el.querySelector('#cg-make-chip-cancel') as HTMLElement;
  const close = (result: { type: string; label: string } | null) => {
    el!.remove();
    if (!result) return;
    const bucketMap: Record<string, string> = {
      character: 'characters',
      location: 'locations',
      prop: 'props',
      effect: 'effects',
      vehicle: 'vehicles',
    };
    const bucket = bucketMap[result.type];
    if (bucket) {
      window.addItemsToLibrary?.(bucket, [result.label], 'fa-tag', 'Created from script');
    } else if (result.type === 'wardrobe') {
      const w = window as any;
      if (!Array.isArray(w.scriptInfoWardrobe)) w.scriptInfoWardrobe = [];
      const name = window.normalizeEntityName?.(result.label) || result.label;
      if (!w.scriptInfoWardrobe.some((s: string) => s.toLowerCase() === name.toLowerCase())) {
        w.scriptInfoWardrobe.push(name);
      }
    }
    window.scheduleFountainRender?.();
    alertCG(`Chip "${result.label}" created as ${result.type}.`);
  };
  okBtn.addEventListener('click', (e) => { e.stopPropagation(); const lbl = labelInput.value.trim(); if (!lbl) { labelInput.focus(); return; } close({ type: typeSelect.value, label: lbl }); });
  cancelBtn.addEventListener('click', (e) => { e.stopPropagation(); close(null); });
  layer.addEventListener('click', (e) => { if (e.target === layer) close(null); });
  labelInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); okBtn.click(); }
  });
  document.addEventListener('keydown', function handler(e) {
    if (e.key === 'Escape') { document.removeEventListener('keydown', handler); close(null); }
  });
  el.hidden = false;
  el.setAttribute('aria-hidden', 'false');
  setTimeout(() => labelInput.focus(), 0);
}

export function hideScriptContextMenu(): void {
  (document.getElementById('script-context-menu') as any)?.close?.();
}

let _scriptMenuDismissBound = false;

export function wireScriptContextMenuDismiss(): void {
  if (_scriptMenuDismissBound) return;
  _scriptMenuDismissBound = true;
  document.addEventListener('click', (e) => {
    const menu = document.getElementById('script-context-menu') as HTMLElement & {
      containsTarget?: (t: EventTarget | null) => boolean;
      hidden?: boolean;
      close?: () => void;
    };
    if (!menu || menu.hidden) return;
    if (typeof menu.containsTarget === 'function' && menu.containsTarget(e.target)) return;
    hideScriptContextMenu();
  });
}

function toggleStoryboardFrameTextButton(): void {
  const btn = document.getElementById('make-storyboard-frame-text-btn');
  if (!btn) return;
  const editor = getScriptEditor();
  if (!editor) {
    btn.hidden = true;
    return;
  }
  const selected = editor.value.slice(editor.selectionStart, editor.selectionEnd).trim();
  btn.hidden = !selected;
}

export function syncScriptSelectionToStoryboard(): void {
  highlightStoryboardForScriptSelection();
  toggleStoryboardFrameTextButton();
}

export function installStoryboardBundleGlobals(): void {
  const w = window as unknown as Record<string, unknown>;
  w.showStoryboardContextMenu = showStoryboardContextMenu;
  w.hideStoryboardContextMenu = hideStoryboardContextMenu;
  w.initStoryboardNavigation = initStoryboardNavigation;
  w.applyStoryboardVisibilityClasses = applyStoryboardVisibilityClasses;
  w.setStoryboardPartVisibility = setStoryboardPartVisibility;
  w.initStoryboardVisibilityToggles = initStoryboardVisibilityToggles;
  w.renderStoryboard = renderStoryboard;
  w.highlightScriptForFrame = highlightScriptForFrame;
  w.getSelectedStoryboardFrame = getSelectedStoryboardFrame;
  w.getScriptSelectionOrCurrentLine = getScriptSelectionOrCurrentLine;
  w.addStoryboardFrame = addStoryboardFrame;
  w.linkSelectedFrameToScript = linkSelectedFrameToScript;
  w.deleteSelectedFrame = deleteSelectedFrame;
  w.duplicateSelectedFrame = duplicateSelectedFrame;
  w.moveSelectedFrameUp = moveSelectedFrameUp;
  w.moveSelectedFrameDown = moveSelectedFrameDown;
  w.restoreLastDeletedFrame = restoreLastDeletedFrame;
  w.generateStoryboardReferences = generateStoryboardReferences;
  w.regenerateReferenceSlot = regenerateReferenceSlot;
  w.lockReferenceSlot = lockReferenceSlot;
  w.unlockReferenceSlot = unlockReferenceSlot;
  w.updateReferenceSlotField = updateReferenceSlotField;
  w.highlightStoryboardForScriptSelection = highlightStoryboardForScriptSelection;
  w.syncScriptSelectionToStoryboard = syncScriptSelectionToStoryboard;
  w.generateBoards = generateBoards;
  w.setStoryboardGenerationMode = setStoryboardGenerationMode;
  w.getStoryboardGenerationMode = getStoryboardGenerationMode;
  w.makeStoryboardFrameForText = makeStoryboardFrameForText;
  w.showScriptContextMenu = showScriptContextMenu;
  w.hideScriptContextMenu = hideScriptContextMenu;
  w.regenerateThumbnail = regenerateThumbnail;
  w.openStoryboardFrameEditor = openStoryboardFrameEditor;
  w.closeStoryboardFrameEditor = closeStoryboardFrameEditor;
  w.makeChipFromSelection = makeChipFromSelection;
  w.initStoryboardFrameEditor = initStoryboardFrameEditor;
  wireScriptContextMenuDismiss();
  initStoryboardFrameEditor();
  initAutogenCheckbox();
  initStoryboardGenerationModeControls();
  hydrateReferenceStateFromStorage();
  normalizedReferenceBank();
  syncReferenceGateControls();
  document.addEventListener('cg-tree-node-select', () => syncReferenceGateControls());
  document.getElementById('script-editor')?.addEventListener('input', () => syncReferenceGateControls());
  setTimeout(() => initStoryboardGenerationModeControls(), 0);
  setTimeout(() => {
    initStoryboardGenerationModeControls();
    syncReferenceGateControls();
  }, 600);
}
