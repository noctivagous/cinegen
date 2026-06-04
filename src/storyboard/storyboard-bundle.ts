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
  previsSelectionState,
} from '@/data/project-data';
import {
  backfillStoryboardPrompts,
  buildStoryboardPrompt,
  getReferenceImageUrls,
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

import { CG_TREE_NODE_SELECT, emitStoryboardFrameSelected } from '@/events/shell-events';
import { markProjectDirty } from '@/services/project-service';
import { maybeAdvanceShotToStoryboarded } from '@/workspace/shot-lifecycle';
import {
  generateAllShotStoryboards,
  generateFrameImage,
  buildStoryboardDraftFrames,
} from '@/storyboard/storyboard-generation-service';
import {
  STORYBOARD_GENERATION_MODE_STORAGE_KEY,
} from '@/constants/storage-keys';
import {
  openStoryboardFrameEditor,
  closeStoryboardFrameEditor,
  initStoryboardFrameEditor,
} from '@/storyboard/storyboard-frame-editor';
import {
  showStoryboardContextMenu,
  hideStoryboardContextMenu,
  initStoryboardNavigation,
  showScriptContextMenu,
  hideScriptContextMenu,
  makeChipFromSelection,
  wireScriptContextMenuDismiss,
  syncScriptSelectionToStoryboard,
} from '@/storyboard/storyboard-context-menus';
import {
  generateStoryboardReferences,
  regenerateReferenceSlot,
  lockReferenceSlot,
  unlockReferenceSlot,
  updateReferenceSlotField,
  enableReferenceSlot,
  hydrateReferenceStateFromStorage,
  normalizedReferenceBank,
  syncReferenceGateControls,
  sceneKeyFromCurrentScene,
  currentSceneNumber,
  emitStoryboardRunLog,
  extractSceneHeading,
  extractSceneBodyLines,
  validateRequiredReferenceSlots,
  generateStoryboardReferencesForScene,
} from '@/storyboard/storyboard-reference-bank';
export type { ReferenceCategory, StoryboardReferenceSlot } from '@/storyboard/storyboard-reference-bank';

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
