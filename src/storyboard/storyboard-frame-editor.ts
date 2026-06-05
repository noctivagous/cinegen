import { emitStoryboardFrameSelected } from '@/events/shell-events';
import type { StoryboardFrame } from '@/storyboard/storyboard-types';

export function openStoryboardFrameEditor(frame: StoryboardFrame): void {
  const modal = document.getElementById('storyboard-frame-editor');
  if (!modal) return;
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  window.selectedStoryboardFrameId = frame.id;

  emitStoryboardFrameSelected(frame.id);

  // Forward the frame to the shot designer component inside the modal
  const sd = document.querySelector<HTMLElement & { openForFrame: (f: StoryboardFrame) => void }>('#shot-designer-modal');
  if (sd && typeof sd.openForFrame === 'function') {
    sd.openForFrame(frame);
  }
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
