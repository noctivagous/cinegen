import {
  storyboardFrames,
  deletedStoryboardFrames,
  previsSelectionState,
} from '@/data/project-data';
import { currentSceneNumber } from '@/storyboard/storyboard-reference-bank';
import { promptFrameCG } from '@/utils/prompt-frame-cg';
import { updateInspector } from '@/components/panels/cinegen-inspector';
import { markProjectDirty } from '@/services/project-service';
import { alertCG } from '@/utils/alert-cg';
import { getCurrentScriptSelection } from '@/script/fountain-bundle';
import { getCinegenScriptEditor } from '@/panels/panel-hosts';
import {
  sceneIdFromStoryboardFrame,
  getShotById,
  assignFrameToShot,
  removeFrameFromAllShots,
  reorderShotFrameIds,
  createCoverageShotForFrame,
  reconcileShotFrameLinks,
} from '@/workspace/shot-frame-bridge';
import { maybeAdvanceShotToStoryboarded } from '@/workspace/shot-lifecycle';
import { applyScriptLinkRangeToFrame } from '@/script/storyboard-link-ranges';
import { generateFrameImage } from '@/storyboard/storyboard-generation-service';
import type { SceneShot } from '@/workspace/scene-types';

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

function inheritShotIdForNewFrame(frame: StoryboardFrame): void {
  const selected = (window as any).getSelectedStoryboardFrame?.() as StoryboardFrame | undefined;
  if (selected?.shotId != null && selected.scene === frame.scene) {
    const sceneId = sceneIdFromStoryboardFrame(frame);
    assignFrameToShot(sceneId, frame.id, selected.shotId);
  }
}

export function linkDraftFramesToCoverage(
  drafts: StoryboardFrame[],
  cinematographyMap?: Record<number, Partial<Pick<SceneShot, 'shotType' | 'cameraAngle' | 'cameraMovement' | 'lens' | 'lightingTechnique' | 'composition' | 'expression' | 'emotion'>>>
): void {
  const base = Date.now();
  drafts.forEach((frame, idx) => {
    createCoverageShotForFrame(frame, base + idx, cinematographyMap?.[idx]);
  });
  if (drafts[0]) reconcileShotFrameLinks(sceneIdFromStoryboardFrame(drafts[0]));
  (window as any).refreshShotFrameTree?.();
}

export async function addStoryboardFrame(): Promise<void> {
  const anchorGuess = (window as any).getScriptSelectionOrCurrentLine?.() || '';
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
  (window as any).renderStoryboard?.();
  updateInspector('storyboard-frame', frame);
  (window as any).scheduleFountainRender?.();
  window.dispatchEvent(new CustomEvent('storyboard-frames-changed'));
  (window as any).refreshShotFrameTree?.();
  if ((window as any).autogenBoardsEnabled) {
    await (window as any).regenerateThumbnail?.(frame);
  }
  markProjectDirty(['storyboard', 'scenes']);
}

export async function addStoryboardSlateFrame(): Promise<void> {
  const scene = currentSceneNumber();
  const sceneId = previsSelectionState.sceneId ?? sceneIdFromStoryboardFrame({ scene } as StoryboardFrame);
  const shotId = previsSelectionState.shotId;
  const shot = sceneId && shotId != null ? getShotById(sceneId, shotId) : null;
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
  (window as any).renderStoryboard?.();
  updateInspector('storyboard-frame', frame);
  window.dispatchEvent(new CustomEvent('storyboard-frames-changed'));
  (window as any).refreshShotFrameTree?.();
  markProjectDirty(['storyboard', 'scenes']);
  alertCG('Text slate frame added. Assign to a shot or upload an image when ready.');
}

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
  let frame = (window as any).getSelectedStoryboardFrame?.() as StoryboardFrame | undefined;
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
  (window as any).renderStoryboard?.();
  updateInspector('storyboard-frame', frame);
  window.dispatchEvent(new CustomEvent('storyboard-frames-changed'));
  (window as any).refreshShotFrameTree?.();
  markProjectDirty(['storyboard', 'scenes']);
  alertCG('Storyboard image applied.');
}

export function linkSelectedFrameToScript(): void {
  const frame = (window as any).getSelectedStoryboardFrame?.() as StoryboardFrame | undefined;
  if (!frame) {
    alertCG('Select a storyboard frame first.');
    return;
  }
  const sel = getCurrentScriptSelection();
  const linkText = sel?.text || (window as any).getScriptSelectionOrCurrentLine?.() || '';
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
  (window as any).scheduleFountainRender?.();
  window.dispatchEvent(new CustomEvent('storyboard-frames-changed'));
  alertCG('Frame link updated from current script selection.');
}

export function deleteSelectedFrame(): void {
  const frame = (window as any).getSelectedStoryboardFrame?.() as StoryboardFrame | undefined;
  if (!frame) {
    alertCG('Select a storyboard frame to delete.');
    return;
  }
  const sceneId = sceneIdFromStoryboardFrame(frame);
  removeFrameFromAllShots(frame.id);
  assignFrameToShot(sceneId, frame.id, null);
  window.storyboardFrames = storyboardFrames.filter(item => item.id !== frame.id);
  deletedStoryboardFrames.unshift({ ...frame, deletedAt: new Date().toISOString() } as any);
  window.selectedStoryboardFrameId = null;
  (window as any).renderStoryboard?.();
  (window as any).refreshShotFrameTree?.();
  updateInspector('scrap', { items: deletedStoryboardFrames });
  window.dispatchEvent(new CustomEvent('storyboard-frames-changed'));
}

export function duplicateSelectedFrame(): void {
  const frame = (window as any).getSelectedStoryboardFrame?.() as StoryboardFrame | undefined;
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
  (window as any).renderStoryboard?.();
  updateInspector('storyboard-frame', copy);
  window.dispatchEvent(new CustomEvent('storyboard-frames-changed'));
  (window as any).refreshShotFrameTree?.();
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
  (window as any).renderStoryboard?.();
  window.dispatchEvent(new CustomEvent('storyboard-frames-changed'));
  (window as any).refreshShotFrameTree?.();
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
  (window as any).renderStoryboard?.();
  updateInspector('storyboard-frame', frame);
  window.dispatchEvent(new CustomEvent('storyboard-frames-changed'));
}

export async function makeStoryboardFrameForText(): Promise<void> {
  const sel = getCurrentScriptSelection();
  const text = sel?.text || (window as any).getScriptSelectionOrCurrentLine?.() || '';
  if (!text) {
    alertCG('Select text in the script editor first.');
    return;
  }
  if (typeof (window as any).triggerModelActivityBlink === 'function') (window as any).triggerModelActivityBlink('image');
  const scene = currentSceneNumber();
  const trunc = text.length > 30 ? text.slice(0, 30) + '\u2026' : text;
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
  (window as any).renderStoryboard?.();
  updateInspector('storyboard-frame', frame);
  (window as any).scheduleFountainRender?.();
  window.dispatchEvent(new CustomEvent('storyboard-frames-changed'));
  (window as any).refreshShotFrameTree?.();
  const msgTrunc = text.length > 50 ? text.slice(0, 50) + '\u2026' : text;
  alertCG(`New storyboard frame created from selected text: "${msgTrunc}"`);
  if ((window as any).autogenBoardsEnabled) {
    await (window as any).regenerateThumbnail?.(frame);
  }
}

export async function regenerateThumbnail(frame: StoryboardFrame): Promise<void> {
  const live = storyboardFrames.find((f) => f.id === frame.id) ?? frame;

  if (live.generatingStatus && !live.generatingStatus.startsWith('error:')) {
    return;
  }

  live.generatingStatus = 'Starting\u2026';
  (window as any).renderStoryboard?.();

  const started = Date.now();
  try {
    live.generatingStatus = 'Generating\u2026';
    (window as any).renderStoryboard?.();

    const dataUrl = await generateFrameImage(live);

    live.imageUrl = dataUrl;
    live.generatingStatus = undefined;
    (window as any).renderStoryboard?.();

    const sceneKey = currentSceneNumber();
    const elapsedMs = Date.now() - started;
    (window as any).emitStoryboardRunLog?.('thumbnail-ready', { sceneKey, frameId: live.id, elapsedMs });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    live.generatingStatus = `error: ${msg}`;
    (window as any).renderStoryboard?.();
    const sceneKey = currentSceneNumber();
    const elapsedMs = Date.now() - started;
    (window as any).emitStoryboardRunLog?.('thumbnail-failed', { sceneKey, frameId: live.id, elapsedMs, error: msg });
  }
}
