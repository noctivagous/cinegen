import {
  groupStoryboardFramesByShot,
  getFramesForShot,
  sceneNumberFromSceneId,
  formatShotDisplayLabel,
  formatPrevisDuration,
  estimateProjectRuntimeSeconds,
  setFrameDurationSeconds,
  setShotDurationSeconds,
  buildPrevisTimelineTracks,
} from '@/workspace/shot-frame-bridge';
import { notifyStoryboardFramesChanged, previsSelectionState, setPrevisSelectionState } from '@/data/project-data';
import { SCRIPT_PREVIS_MARGIN_COLLAPSED_KEY } from '@/constants/storage-keys';
import { storageService } from '@/services/persistence';
import { getCinegenScriptEditor } from '@/panels/panel-hosts';
import { jumpScriptToAnchor } from './fountain-bundle';

type MarginDragTarget = {
  kind: 'shot' | 'frame';
  sceneId: string;
  shotId: number;
  frameId?: number;
  originY: number;
  startSeconds: number;
};

function shotKey(sceneId: string, shotId: number): string {
  return `${sceneId}:${shotId}`;
}

function inferShotTag(raw: string | undefined): 'Master Shot' | 'Coverage' | 'B-Roll' | 'Pickup' {
  const normalized = String(raw || 'coverage').toLowerCase();
  if (normalized.includes('master')) return 'Master Shot';
  if (normalized.includes('b-roll') || normalized.includes('broll')) return 'B-Roll';
  if (normalized.includes('pickup')) return 'Pickup';
  return 'Coverage';
}

function runtimeLabel(): string {
  return formatPrevisDuration(Math.max(1, estimateProjectRuntimeSeconds()));
}

let scriptPrevisMarginCollapsed = false;
const collapsedShotKeys: Set<string> = new Set();
let activeMarginDrag: MarginDragTarget | null = null;

function readScriptPrevisMarginCollapsed(): boolean {
  try {
    const raw = storageService.getItem(SCRIPT_PREVIS_MARGIN_COLLAPSED_KEY);
    return raw === 'true';
  } catch {
    return false;
  }
}

function writeScriptPrevisMarginCollapsed(value: boolean): void {
  try {
    storageService.setItem(SCRIPT_PREVIS_MARGIN_COLLAPSED_KEY, String(value));
  } catch {
    /* noop */
  }
}

export function renderPrevisMargin(host: HTMLElement): void {
  scriptPrevisMarginCollapsed = readScriptPrevisMarginCollapsed();
  const groups = groupStoryboardFramesByShot();
  const html = groups
    .map((group) => {
      const sceneNumber = sceneNumberFromSceneId(group.sceneId);
      const shot = group.shot;
      const shotId = group.shotId ?? 0;
      const tag = inferShotTag(shot?.type);
      const currentShotKey = shotKey(group.sceneId, shotId);
      const expanded = !collapsedShotKeys.has(currentShotKey);
      const isPickup = tag === 'Pickup' || !!shot?.isPickup;
      const frames = shot?.id != null ? getFramesForShot(group.sceneId, shot.id) : group.frames;
      const shotDuration = Math.max(
        1,
        shot?.durationSeconds ??
          (frames.reduce((acc, frame) => acc + (frame.durationSeconds || 3), 0) || 8)
      );
      const shotLabel =
        shot != null
          ? `Shot ${formatShotDisplayLabel(sceneNumber, shot.number ?? 1)}`
          : `Scene ${sceneNumber} Unassigned`;
      const frameRows = expanded
        ? frames
            .map((frame) => {
              const isSelected = previsSelectionState.frameId === frame.id;
              const frameDuration = Math.max(1, frame.durationSeconds || 3);
              return `<div class="previs-frame-block${isSelected ? ' is-selected' : ''}" data-frame-id="${frame.id}" data-scene-id="${group.sceneId}" data-shot-id="${shotId}" style="--previs-seconds:${frameDuration};">
                <button class="previs-duration-handle previs-duration-handle--top" data-resize-kind="frame" data-frame-id="${frame.id}" data-scene-id="${group.sceneId}" data-shot-id="${shotId}" title="Adjust frame duration"></button>
                <div class="previs-frame-label">Frame ${frame.id}: ${frame.label}</div>
                <div class="previs-frame-time">${formatPrevisDuration(frameDuration)}</div>
                <button class="previs-duration-handle previs-duration-handle--bottom" data-resize-kind="frame" data-frame-id="${frame.id}" data-scene-id="${group.sceneId}" data-shot-id="${shotId}" title="Adjust frame duration"></button>
              </div>`;
            })
            .join('')
        : '';

      const selectedShot = previsSelectionState.shotId != null && previsSelectionState.shotId === shotId;
      return `<section class="previs-scene-block" data-scene-id="${group.sceneId}">
        <header class="previs-scene-header">Scene ${sceneNumber}</header>
        <article class="previs-shot-block${selectedShot ? ' is-selected' : ''}${isPickup ? ' is-pickup' : ''}" data-scene-id="${group.sceneId}" data-shot-id="${shotId}" style="--previs-seconds:${shotDuration};">
          <button class="previs-duration-handle previs-duration-handle--top" data-resize-kind="shot" data-scene-id="${group.sceneId}" data-shot-id="${shotId}" title="Adjust shot duration"></button>
          <div class="previs-shot-head">
            <button class="previs-expander" data-toggle-shot="${currentShotKey}" title="Toggle storyboard frames">${expanded ? '▾' : '▸'}</button>
            <div class="previs-shot-title-wrap">
              <div class="previs-shot-title">${shotLabel}</div>
              <div class="previs-shot-tag">${tag}</div>
            </div>
            <div class="previs-shot-time">${formatPrevisDuration(shotDuration)}</div>
          </div>
          <div class="previs-frame-list">${frameRows}</div>
          <button class="previs-duration-handle previs-duration-handle--bottom" data-resize-kind="shot" data-scene-id="${group.sceneId}" data-shot-id="${shotId}" title="Adjust shot duration"></button>
        </article>
      </section>`;
    })
    .join('');
  const collapsed = scriptPrevisMarginCollapsed;
  const toggleTitle = collapsed ? 'Show previs timeline' : 'Hide previs timeline';
  const toggleIcon = collapsed ? '▸' : '◂';
  host.classList.toggle('is-collapsed', collapsed);
  host.innerHTML = `<div class="previs-margin-head">
      <span class="previs-margin-head-label">Previs Runtime ${runtimeLabel()}</span>
      <button type="button" class="previs-margin-collapse-btn" data-toggle-previs-margin title="${toggleTitle}" aria-expanded="${collapsed ? 'false' : 'true'}" aria-label="${toggleTitle}">${toggleIcon}</button>
    </div><div class="previs-margin-scroll">${html}</div>`;
}

function finishMarginResize(): void {
  if (!activeMarginDrag) return;
  activeMarginDrag = null;
  document.body.classList.remove('previs-resizing');
  window.removeEventListener('mousemove', onMarginDragMove);
  window.removeEventListener('mouseup', finishMarginResize);
  notifyStoryboardFramesChanged();
  buildPrevisTimelineTracks();
  window.renderTimeline?.();
  window.dispatchEvent(new CustomEvent('previs-timing-changed'));
  // Re-render is triggered by the previs-timing-changed event listener
}

function onMarginDragMove(event: MouseEvent): void {
  if (!activeMarginDrag) return;
  const delta = event.clientY - activeMarginDrag.originY;
  const deltaSeconds = Math.round(delta / 10);
  const nextSeconds = Math.max(1, activeMarginDrag.startSeconds + deltaSeconds);
  if (activeMarginDrag.kind === 'shot') {
    setShotDurationSeconds(activeMarginDrag.sceneId, activeMarginDrag.shotId, nextSeconds);
  } else if (activeMarginDrag.frameId != null) {
    setFrameDurationSeconds(activeMarginDrag.frameId, nextSeconds);
  }
  window.dispatchEvent(new CustomEvent('previs-timing-changed'));
}

export function handlePrevisMarginDragStart(event: MouseEvent): void {
  const target = event.target as HTMLElement | null;
  if (!target?.dataset.resizeKind) return;
  const sceneId = target.dataset.sceneId || '';
  const shotId = parseInt(target.dataset.shotId || '0', 10);
  if (!sceneId || !shotId) return;
  event.preventDefault();
  const kind = target.dataset.resizeKind === 'frame' ? 'frame' : 'shot';
  const frameId = target.dataset.frameId ? parseInt(target.dataset.frameId, 10) : undefined;
  const startSeconds =
    kind === 'shot'
      ? Number(target.closest<HTMLElement>('.previs-shot-block')?.style.getPropertyValue('--previs-seconds')) ||
        8
      : Number(target.closest<HTMLElement>('.previs-frame-block')?.style.getPropertyValue('--previs-seconds')) ||
        3;
  activeMarginDrag = {
    kind,
    sceneId,
    shotId,
    frameId,
    originY: event.clientY,
    startSeconds: Math.max(1, Math.round(startSeconds)),
  };
  document.body.classList.add('previs-resizing');
  window.addEventListener('mousemove', onMarginDragMove);
  window.addEventListener('mouseup', finishMarginResize);
}

export function handlePrevisMarginClick(event: Event): void {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  if (target.closest<HTMLElement>('[data-toggle-previs-margin]')) {
    scriptPrevisMarginCollapsed = !scriptPrevisMarginCollapsed;
    writeScriptPrevisMarginCollapsed(scriptPrevisMarginCollapsed);
    window.dispatchEvent(new CustomEvent('previs-timing-changed'));
    return;
  }
  const expander = target.closest<HTMLElement>('[data-toggle-shot]');
  if (expander?.dataset.toggleShot) {
    const key = expander.dataset.toggleShot;
    if (collapsedShotKeys.has(key)) collapsedShotKeys.delete(key);
    else collapsedShotKeys.add(key);
    window.dispatchEvent(new CustomEvent('previs-timing-changed'));
    return;
  }

  const frameBlock = target.closest<HTMLElement>('.previs-frame-block');
  if (frameBlock?.dataset.frameId) {
    const frameId = parseInt(frameBlock.dataset.frameId, 10);
    const frame = (window.storyboardFrames || []).find((item: any) => item.id === frameId);
    if (frame) {
      window.selectStoryboardFrameById?.(frameId);
      jumpScriptToAnchor(frame.scriptLink || '');
      setPrevisSelectionState({
        sceneId: frameBlock.dataset.sceneId || null,
        shotId: frameBlock.dataset.shotId ? parseInt(frameBlock.dataset.shotId, 10) : null,
        frameId,
        timelineItemId: `frame-${frameId}`,
      });
      window.dispatchEvent(new CustomEvent('previs-timing-changed'));
    }
    return;
  }

  const shotBlock = target.closest<HTMLElement>('.previs-shot-block');
  if (shotBlock?.dataset.sceneId && shotBlock.dataset.shotId) {
    const sceneId = shotBlock.dataset.sceneId;
    const shotId = parseInt(shotBlock.dataset.shotId, 10);
    const groups = groupStoryboardFramesByShot();
    const match = groups.find((group) => group.sceneId === sceneId && group.shotId === shotId);
    const anchor = match?.frames.find((frame) => !!frame.scriptLink)?.scriptLink || match?.shot?.scriptLink || '';
    if (anchor) jumpScriptToAnchor(anchor);
    setPrevisSelectionState({
      sceneId,
      shotId,
      frameId: match?.frames[0]?.id ?? null,
      timelineItemId: match?.frames[0]?.id ? `frame-${match.frames[0].id}` : null,
    });
    window.dispatchEvent(new CustomEvent('previs-timing-changed'));
  }
}

/** Refresh the previs margin inside the active script editor. */
export function refreshPrevisMargin(): void {
  const editor = getCinegenScriptEditor();
  if (!editor) return;
  const host = editor.querySelector<HTMLElement>('.script-previs-margin');
  if (host) renderPrevisMargin(host);
}
