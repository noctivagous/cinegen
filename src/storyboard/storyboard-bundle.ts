/**
 * ── NOTE ──
 * This file reads AI API settings via storageService.getItem() to determine
 * which provider/model to use for storyboard image generation. This is a
 * read-only consumer of the setting that was written by ai-api-settings-bundle.ts.
 *
 * State must remain server-backed through storageService. Do NOT add browser
 * local persistence APIs (localStorage/sessionStorage/IndexedDB) here.
 * ─────────
 */

import {
  storyboardFrames,
  deletedStoryboardFrames,
  storyboardVisibility,
  storyboardReferenceBank,
  sceneReferenceOverrides,
  referenceGenerationStatus,
  previsSelectionState,
} from '@/data/project-data';
import { STORYBOARD_FRAME_DESTINATIONS } from '@/storyboard/storyboard-destinations';
import {
  backfillStoryboardPrompts,
  buildStoryboardPrompt,
  buildReferenceSlotPrompt,
  getReferenceImageUrls,
  STORYBOARD_STYLE_PROMPT,
} from '@/storyboard/storyboard-prompt-builder';
import { EditorView } from '@codemirror/view';
import { resolveFrameScriptRange, applyScriptLinkRangeToFrame } from '@/script/storyboard-link-ranges';
import { getCinegenStoryboard, getCinegenScriptEditor } from '@/panels/panel-hosts';
import { getCurrentScriptText, getCurrentScriptSelection } from '@/script/fountain-bundle';
import { alertCG } from '@/utils/alert-cg';
import { promptFrameCG } from '@/utils/prompt-frame-cg';
import { escHtml } from '@/utils/html';
import { updateInspector } from '@/components/panels/cinegen-inspector';
import {
  assignFrameToShot,
  createCoverageShotForFrame,
  getShotById,
  getShotForFrame,
  removeFrameFromAllShots,
  reorderShotFrameIds,
  reconcileShotFrameLinks,
  sceneIdFromStoryboardFrame,
  sceneNumberFromSceneId,
} from '@/workspace/shot-frame-bridge';
import { requestProjectTreeRefresh } from '@/tree/project-tree-service';
import { patchAppShellState } from '@/stores/app-shell';
import { storageService } from '@/services/persistence';
import { emitAiInteractionLog } from '@/services/ai/interaction-log';

import { CG_TREE_NODE_SELECT, CG_STORYBOARD_REFERENCES_CHANGED, emitStoryboardFrameSelected } from '@/events/shell-events';
import { markProjectDirty } from '@/services/project-service';
import { maybeAdvanceShotToStoryboarded } from '@/workspace/shot-lifecycle';
import {
  generateAllShotStoryboards,
  generateFrameImage,
  buildStoryboardDraftFrames,
} from '@/storyboard/storyboard-generation-service';
import {
  STORYBOARD_GENERATION_MODE_STORAGE_KEY,
  STORYBOARD_REFERENCE_STORAGE_KEY,
} from '@/constants/storage-keys';

function refreshShotFrameTree(): void {
  requestProjectTreeRefresh();
  if (typeof renderFullTree === 'function') renderFullTree();
}

function inheritShotIdForNewFrame(frame: StoryboardFrame): void {
  const selected = getSelectedStoryboardFrame();
  if (selected?.shotId != null && selected.scene === frame.scene) {
    const sceneId = sceneIdFromStoryboardFrame(frame);
    assignFrameToShot(sceneId, frame.id, selected.shotId);
  }
}

function linkDraftFramesToCoverage(drafts: StoryboardFrame[]): void {
  const base = Date.now();
  drafts.forEach((frame, idx) => {
    createCoverageShotForFrame(frame, base + idx);
  });
  if (drafts[0]) reconcileShotFrameLinks(sceneIdFromStoryboardFrame(drafts[0]));
  refreshShotFrameTree();
}

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
  function enableReferenceSlot(slotId: string, enabled: boolean, sceneKey?: string): void;
  function makeChipFromSelection(): void;
  function getChipAtScriptCaret(): { type: string; label: string } | null;
  function showChipContextMenuAt(chipType: string, label: string, clientX: number, clientY: number): void;
  function extractChipsFromText(text: string): Array<{ type: string; label: string }>;
  function addItemsToLibrary(bucket: string, values: string[], icon?: string, desc?: string): void;
  function normalizeEntityName(value: string): string;
  var currentSceneId: string | null;
  var storyboardContextState: { frameId: number } | null;
  var selectedStoryboardFrameId: number | null;
  var storyboardFrames: Array<{ id: number; scene?: string; label: string; scriptLink?: string; notes?: string; imageUrl?: string; generatingStatus?: string; generatedPrompt?: string; userPromptOverride?: string }>;
}


interface StoryboardFrame {
  id: number;
  scene: string;
  shotId?: number;
  durationSeconds?: number;
  label: string;
  scriptLink?: string;
  scriptRange?: { start: number; end: number };
  notes?: string;
  imageUrl?: string;
  generatingStatus?: string;
  generatedPrompt?: string;
  userPromptOverride?: string;
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
  enabled?: boolean;
  source: 'ai' | 'user';
  updatedAt?: string;
}

const REFERENCE_CATEGORIES: ReferenceCategory[] = ['characters', 'locations', 'interiors', 'exteriors'];
const STORYBOARD_REFERENCE_KEY = STORYBOARD_REFERENCE_STORAGE_KEY;

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
const STORYBOARD_GEN_MODE_KEY = STORYBOARD_GENERATION_MODE_STORAGE_KEY;

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
  window.dispatchEvent(new CustomEvent(CG_STORYBOARD_REFERENCES_CHANGED));
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
  const pseudoFrame: StoryboardFrame = {
    id: Date.now(),
    scene: currentSceneNumber(),
    label: slot.label,
    scriptLink: slot.prompt,
    notes: `Style: ${STORYBOARD_STYLE_PROMPT}`,
    userPromptOverride: buildReferenceSlotPrompt(slot),
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
  const script = getCurrentScriptText();
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

export function enableReferenceSlot(slotId: string, enabled: boolean, sceneKey?: string): void {
  const slot = findReferenceSlot(slotId, sceneKey);
  if (!slot) return;
  slot.enabled = enabled;
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
  const host = getCinegenScriptEditor();
  const view = host?.editorView;
  if (!view) return;
  const span = resolveFrameScriptRange(view, frame);
  if (span) {
    view.dispatch({
      selection: { anchor: span.from, head: span.from },
      effects: EditorView.scrollIntoView(span.from, { y: 'center' }),
    });
    window.setPrevisSelectionState?.({
      sceneId: frame.scene ? `scene${String(frame.scene).padStart(2, '0')}` : null,
      shotId: frame.shotId ?? null,
      frameId: frame.id,
      scriptRange: { start: span.from, end: span.to },
      timelineItemId: frame.id ? `frame-${frame.id}` : null,
    });
    return;
  }
  if (!frame.scriptLink) return;
}

export function getSelectedStoryboardFrame(): StoryboardFrame | null {
  if (!window.selectedStoryboardFrameId) return null;
  return storyboardFrames.find((frame) => frame.id === window.selectedStoryboardFrameId) || null;
}

export function getScriptSelectionOrCurrentLine(): string {
  const sel = getCurrentScriptSelection();
  if (!sel) return '';
  if (sel.text) return sel.text;
  const view = getCinegenScriptEditor()?.editorView;
  if (!view) return '';
  const pos = view.state.selection.main.head;
  const line = view.state.doc.lineAt(pos);
  return line.text.trim();
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
    durationSeconds: 3,
    label: result.label,
    scriptLink: result.anchor,
    notes: result.notes,
  };
  storyboardFrames.push(frame);
  inheritShotIdForNewFrame(frame);
  window.selectedStoryboardFrameId = frame.id;
  renderStoryboard();
  updateInspector('storyboard-frame', frame);
  scheduleFountainRender();
  window.dispatchEvent(new CustomEvent('storyboard-frames-changed'));
  refreshShotFrameTree();
  if (autogenBoardsEnabled) {
    await regenerateThumbnail(frame);
  }
  markProjectDirty(['storyboard', 'scenes']);
}

/** Text-only slate frame (no provider required). */
export async function addStoryboardSlateFrame(): Promise<void> {
  const scene = currentSceneNumber();
  const sceneId = previsSelectionState.sceneId ?? sceneIdFromStoryboardFrame({ scene });
  const shotId = previsSelectionState.shotId;
  const shot =
    sceneId && shotId != null ? getShotById(sceneId, shotId) : null;
  const slateLines: string[] = ['Manual storyboard slate'];
  if (shot) {
    if (shot.shotType) slateLines.push(`Type: ${shot.shotType}`);
    if (shot.cameraAngle) slateLines.push(`Angle: ${shot.cameraAngle}`);
    if (shot.cameraMovement) slateLines.push(`Movement: ${shot.cameraMovement}`);
    if (shot.lightingTechnique) slateLines.push(`Light: ${shot.lightingTechnique}`);
  }
  const frame: StoryboardFrame = {
    id: Date.now(),
    scene,
    durationSeconds: 3,
    label: shot?.label ? `Slate — ${shot.label}` : `Slate ${storyboardFrames.length + 1}`,
    notes: slateLines.join('\n'),
    generatingStatus: 'slate',
  };
  storyboardFrames.push(frame);
  inheritShotIdForNewFrame(frame);
  if (shot) maybeAdvanceShotToStoryboarded(shot);
  window.selectedStoryboardFrameId = frame.id;
  renderStoryboard();
  updateInspector('storyboard-frame', frame);
  window.dispatchEvent(new CustomEvent('storyboard-frames-changed'));
  refreshShotFrameTree();
  markProjectDirty(['storyboard', 'scenes']);
  alertCG('Text slate frame added. Assign to a shot or upload an image when ready.');
}

/** Upload a still image onto the selected frame (or create a new frame). */
export function uploadStoryboardFrameImage(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/jpeg,image/png,image/webp,image/gif';
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => alertCG('Could not read image file.');
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (!dataUrl) {
        alertCG('Could not read image file.');
        return;
      }
      void applyStoryboardImageUpload(dataUrl, file.name);
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

async function applyStoryboardImageUpload(dataUrl: string, fileName: string): Promise<void> {
  let frame = getSelectedStoryboardFrame();
  if (!frame) {
    const scene = currentSceneNumber();
    frame = {
      id: Date.now(),
      scene,
      durationSeconds: 3,
      label: fileName.replace(/\.[^.]+$/, '') || 'Uploaded frame',
      imageUrl: dataUrl,
      notes: 'Uploaded reference still.',
    };
    storyboardFrames.push(frame);
    inheritShotIdForNewFrame(frame);
    const sceneId = previsSelectionState.sceneId ?? sceneIdFromStoryboardFrame(frame);
    const shotId = previsSelectionState.shotId;
    if (sceneId && shotId != null) {
      assignFrameToShot(sceneId, frame.id, shotId);
      const shot = getShotById(sceneId, shotId);
      if (shot) maybeAdvanceShotToStoryboarded(shot);
    }
  } else {
    frame.imageUrl = dataUrl;
    frame.generatingStatus = undefined;
    const sceneId = sceneIdFromStoryboardFrame(frame);
    if (frame.shotId != null) {
      const shot = getShotById(sceneId, frame.shotId);
      if (shot) maybeAdvanceShotToStoryboarded(shot);
    }
  }
  window.selectedStoryboardFrameId = frame.id;
  renderStoryboard();
  updateInspector('storyboard-frame', frame);
  window.dispatchEvent(new CustomEvent('storyboard-frames-changed'));
  refreshShotFrameTree();
  markProjectDirty(['storyboard', 'scenes']);
  alertCG('Storyboard image applied.');
}

export function linkSelectedFrameToScript(): void {
  const frame = getSelectedStoryboardFrame();
  if (!frame) {
    alertCG('Select a storyboard frame first.');
    return;
  }
  const sel = getCurrentScriptSelection();
  const linkText = sel?.text || getScriptSelectionOrCurrentLine();
  if (!linkText) {
    alertCG('Select script text or place the cursor on a line to create a link.');
    return;
  }
  if (sel?.text) {
    applyScriptLinkRangeToFrame(frame, sel.text, sel.from, sel.to);
  } else {
    frame.scriptLink = linkText;
    frame.scriptRange = undefined;
  }
  updateInspector('storyboard-frame', frame);
  scheduleFountainRender();
  window.dispatchEvent(new CustomEvent('storyboard-frames-changed'));
  alertCG('Frame link updated from current script selection.');
}

export function deleteSelectedFrame(): void {
  const frame = getSelectedStoryboardFrame();
  if (!frame) {
    alertCG('Select a storyboard frame to delete.');
    return;
  }
  const sceneId = sceneIdFromStoryboardFrame(frame);
  removeFrameFromAllShots(frame.id);
  assignFrameToShot(sceneId, frame.id, null);
  window.storyboardFrames = storyboardFrames.filter(item => item.id !== frame.id);
  deletedStoryboardFrames.unshift({ ...frame, deletedAt: new Date().toISOString() });
  window.selectedStoryboardFrameId = null;
  renderStoryboard();
  refreshShotFrameTree();
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
    durationSeconds: frame.durationSeconds ?? 3,
    label: `${frame.label} (copy)`,
    generatingStatus: undefined,
  };
  storyboardFrames.splice(idx + 1, 0, copy);
  if (frame.shotId != null) {
    assignFrameToShot(sceneIdFromStoryboardFrame(copy), copy.id, frame.shotId);
  }
  window.selectedStoryboardFrameId = copy.id;
  renderStoryboard();
  updateInspector('storyboard-frame', copy);
  window.dispatchEvent(new CustomEvent('storyboard-frames-changed'));
  refreshShotFrameTree();
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
  if (item.shotId != null) {
    reorderShotFrameIds(sceneIdFromStoryboardFrame(item), item.shotId);
  }
  renderStoryboard();
  window.dispatchEvent(new CustomEvent('storyboard-frames-changed'));
  refreshShotFrameTree();
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
    durationSeconds: restored.durationSeconds ?? 3,
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
  const sel = getCurrentScriptSelection();
  if (!sel) return;
  const selectedText = sel.text;
  if (!selectedText) return;
  const normalized = selectedText.toLowerCase();
  const frame = storyboardFrames.find(item => item.scriptLink && normalized.includes(item.scriptLink.toLowerCase()))
    || storyboardFrames.find(item => item.scriptLink && item.scriptLink.toLowerCase().includes(normalized));
  if (!frame) return;
  window.selectedStoryboardFrameId = frame.id;
  window.setPrevisSelectionState?.({
    sceneId: frame.scene ? `scene${String(frame.scene).padStart(2, '0')}` : null,
    shotId: frame.shotId ?? null,
    frameId: frame.id,
    scriptRange: { start: sel.from, end: sel.to },
    timelineItemId: frame.id ? `frame-${frame.id}` : null,
  });
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
  const scriptText = getCurrentScriptText();
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
  linkDraftFramesToCoverage(drafts);
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

export async function makeStoryboardFrameForText(): Promise<void> {
  const sel = getCurrentScriptSelection();
  const text = sel?.text || getScriptSelectionOrCurrentLine();
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
  if (sel) {
    applyScriptLinkRangeToFrame(frame, text, sel.from, sel.to);
  }
  storyboardFrames.push(frame);
  const shot = createCoverageShotForFrame(frame);
  const view = getCinegenScriptEditor()?.editorView;
  if (shot && sel && view) {
    try {
      shot.scriptRange = {
        start: view.state.doc.lineAt(sel.from).from,
        end: view.state.doc.lineAt(sel.to).to,
      };
    } catch {
      /* selection out of range */
    }
  }
  window.selectedStoryboardFrameId = frame.id;
  renderStoryboard();
  updateInspector('storyboard-frame', frame);
  scheduleFountainRender();
  window.dispatchEvent(new CustomEvent('storyboard-frames-changed'));
  refreshShotFrameTree();
  const msgTrunc = text.length > 50 ? text.slice(0, 50) + '…' : text;
  alertCG(`New storyboard frame created from selected text: "${msgTrunc}"`);
  if (autogenBoardsEnabled) {
    await regenerateThumbnail(frame);
  }
}

export async function regenerateThumbnail(frame: StoryboardFrame): Promise<void> {
  const live = storyboardFrames.find((f) => f.id === frame.id) ?? frame;

  if (live.generatingStatus && !live.generatingStatus.startsWith('error:')) {
    return;
  }

  live.generatingStatus = 'Starting…';
  renderStoryboard();

  const started = Date.now();
  try {
    live.generatingStatus = 'Generating…';
    renderStoryboard();

    const dataUrl = await generateFrameImage(live);

    live.imageUrl = dataUrl;
    live.generatingStatus = undefined;
    renderStoryboard();
    window.dispatchEvent(new CustomEvent('storyboard-frames-changed'));
    updateInspector('storyboard-frame', live);

    if (typeof triggerModelActivityBlink === 'function') triggerModelActivityBlink('image');
    emitStoryboardRunLog('thumbnail-success', {
      frameId: live.id,
      scene: live.scene,
      elapsedMs: Date.now() - started,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    live.generatingStatus = `error:${msg}`;
    renderStoryboard();
    updateInspector('storyboard-frame', live);
    emitStoryboardRunLog('thumbnail-error', {
      frameId: live.id,
      scene: live.scene,
      elapsedMs: Date.now() - started,
      error: msg,
    });
  }
}

function refreshFrameEditorPromptDisplay(): void {
  const modal = document.getElementById('storyboard-frame-editor');
  if (!modal || modal.hidden) return;
  const data: StoryboardFrame = (modal as any)._frameData;
  if (!data) return;

  const promptText = modal.querySelector<HTMLElement>('.sfe-prompt-text');
  const autoBadge = modal.querySelector<HTMLElement>('.sfe-prompt-badge--auto');
  const overrideBadge = modal.querySelector<HTMLElement>('.sfe-prompt-badge--override');
  const overrideTextarea = modal.querySelector<HTMLTextAreaElement>('.sfe-input-override');

  // Show generated or override prompt
  const displayPrompt = data.userPromptOverride || data.generatedPrompt;
  if (promptText) {
    promptText.textContent = displayPrompt || '(Prompt will be generated when you click Regenerate Thumbnail)';
  }

  // Toggle badges
  if (autoBadge) autoBadge.classList.toggle('hidden', !!data.userPromptOverride);
  if (overrideBadge) overrideBadge.classList.toggle('hidden', !data.userPromptOverride);

  // Sync override textarea
  if (overrideTextarea) {
    overrideTextarea.value = data.userPromptOverride || '';
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

  emitStoryboardFrameSelected(frame.id);

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

  refreshFrameEditorPromptDisplay();
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
    if (t.closest('[data-cg-close="storyboard-frame-editor"]')) {
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

  // Override textarea: store value and refresh prompt display
  const overrideTextarea = modal.querySelector<HTMLTextAreaElement>('.sfe-input-override');
  if (overrideTextarea) {
    overrideTextarea.addEventListener('input', () => {
      const data = (modal as any)._frameData;
      if (!data) return;
      data.userPromptOverride = overrideTextarea.value.trim() || undefined;
      const frame = storyboardFrames.find((f: StoryboardFrame) => f.id === data.id);
      if (frame) {
        frame.userPromptOverride = data.userPromptOverride;
      }
      refreshFrameEditorPromptDisplay();
      updateInspector('storyboard-frame', data);
    });
  }
}

export function initStoryboardFrameEditor(): void {
  wireFrameEditor();
}

function insertAtCursor(text: string): void {
  const view = getCinegenScriptEditor()?.editorView;
  if (!view) return;
  const { from, to } = view.state.selection.main;
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length },
  });
  view.focus();
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
  const sel = getCurrentScriptSelection();
  const hasSelection = sel && sel.from !== sel.to;
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
  const sel = getCurrentScriptSelection();
  if (!sel) {
    btn.hidden = true;
    return;
  }
  btn.hidden = !sel.text;
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
  w.addStoryboardSlateFrame = addStoryboardSlateFrame;
  w.uploadStoryboardFrameImage = uploadStoryboardFrameImage;
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
  w.enableReferenceSlot = enableReferenceSlot;
  w.highlightStoryboardForScriptSelection = highlightStoryboardForScriptSelection;
  w.syncScriptSelectionToStoryboard = syncScriptSelectionToStoryboard;
  w.generateBoards = generateBoards;
  w.draftShotStoryboards = generateAllShotStoryboards;
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
  document.addEventListener(CG_TREE_NODE_SELECT, () => syncReferenceGateControls());
  setTimeout(() => initStoryboardGenerationModeControls(), 0);
  setTimeout(() => {
    initStoryboardGenerationModeControls();
    syncReferenceGateControls();
  }, 600);
  setTimeout(() => {
    const count = backfillStoryboardPrompts();
    if (count > 0) {
      console.log(`CineGen: backfilled ${count} storyboard frame prompts.`);
    }
  }, 800);
}
