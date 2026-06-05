import { emitStoryboardFrameSelected } from '@/events/shell-events';
import { sceneIdFromStoryboardFrame } from '@/workspace/shot-frame-bridge';
import { setPrevisSelectionState } from '@/data/project-data';
import type { StoryboardFrame } from '@/storyboard/storyboard-types';

export function openStoryboardFrameEditor(frame: StoryboardFrame): void {
  const modal = document.getElementById('storyboard-frame-editor');
  if (!modal) return;
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  window.selectedStoryboardFrameId = frame.id;

  const sceneId = sceneIdFromStoryboardFrame(frame);
  setPrevisSelectionState({
    sceneId,
    shotId: frame.shotId ?? null,
    frameId: frame.id,
  });

  const titleEl = document.getElementById('sfe-title');
  if (titleEl) {
    titleEl.innerHTML = `<i class="fa-solid fa-pen-ruler"></i> Shot Designer — ${frame.label || `Frame ${frame.id}`}`;
  }

  emitStoryboardFrameSelected(frame.id);

  const loadDesigner = (): void => {
    const sd = document.querySelector<HTMLElement & { openForFrame: (f: StoryboardFrame) => void }>('#shot-designer-modal');
    if (sd && typeof sd.openForFrame === 'function') {
      sd.openForFrame(frame);
    }
  };

  loadDesigner();
  requestAnimationFrame(loadDesigner);
}

export function closeStoryboardFrameEditor(): void {
  const modal = document.getElementById('storyboard-frame-editor');
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

export function initStoryboardFrameEditor(): void {
  const modal = document.getElementById('storyboard-frame-editor');
  if (!modal) return;
  if (modal.dataset.sfeWired === '1') return;
  modal.dataset.sfeWired = '1';

  modal.addEventListener('click', (e: MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-cg-close="storyboard-frame-editor"]')) {
      closeStoryboardFrameEditor();
    }
  });
}
