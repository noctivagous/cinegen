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
  addStoryboardFrame,
  addStoryboardSlateFrame,
  uploadStoryboardFrameImage,
  linkSelectedFrameToScript,
  deleteSelectedFrame,
  duplicateSelectedFrame,
  moveSelectedFrameUp,
  moveSelectedFrameDown,
  restoreLastDeletedFrame,
  makeStoryboardFrameForText,
  regenerateThumbnail,
  linkDraftFramesToCoverage,
} from '@/storyboard/storyboard-frame-operations';
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

let storyboardGenerationMode: 'review' | 'auto' = 'review';
const STORYBOARD_GEN_MODE_KEY = STORYBOARD_GENERATION_MODE_STORAGE_KEY;

export function initAutogenCheckbox(): void {
  const cb = document.getElementById('autogen-boards-cb') as HTMLInputElement | null;
  if (!cb) return;
  (window as any).autogenBoardsEnabled = cb.checked;
  cb.addEventListener('change', () => {
    (window as any).autogenBoardsEnabled = cb.checked;
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
  w.autogenBoardsEnabled = false;
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
