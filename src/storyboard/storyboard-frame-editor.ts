import { storyboardFrames } from '@/data/project-data';
import { updateInspector } from '@/components/panels/cinegen-inspector';
import { escHtml } from '@/utils/html';
import { emitStoryboardFrameSelected } from '@/events/shell-events';

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

function refreshFrameEditorPromptDisplay(): void {
  const modal = document.getElementById('storyboard-frame-editor');
  if (!modal || modal.hidden) return;
  const data: StoryboardFrame = (modal as any)._frameData;
  if (!data) return;

  const promptText = modal.querySelector<HTMLElement>('.sfe-prompt-text');
  const autoBadge = modal.querySelector<HTMLElement>('.sfe-prompt-badge--auto');
  const overrideBadge = modal.querySelector<HTMLElement>('.sfe-prompt-badge--override');
  const overrideTextarea = modal.querySelector<HTMLTextAreaElement>('.sfe-input-override');

  const displayPrompt = data.userPromptOverride || data.generatedPrompt;
  if (promptText) {
    promptText.textContent = displayPrompt || '(Prompt will be generated when you click Regenerate Thumbnail)';
  }

  if (autoBadge) autoBadge.classList.toggle('hidden', !!data.userPromptOverride);
  if (overrideBadge) overrideBadge.classList.toggle('hidden', !data.userPromptOverride);

  if (overrideTextarea) {
    overrideTextarea.value = data.userPromptOverride || '';
  }
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

export function openStoryboardFrameEditor(frame: StoryboardFrame): void {
  const modal = document.getElementById('storyboard-frame-editor');
  if (!modal) return;
  (modal as any)._frameData = { ...frame };
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  window.selectedStoryboardFrameId = frame.id;
  (window as any).renderStoryboard?.();
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

function wireFrameEditor(): void {
  const modal = document.getElementById('storyboard-frame-editor');
  if (!modal) return;
  if (modal.dataset.sfeWired === '1') return;
  modal.dataset.sfeWired = '1';

  const backdropClose = () => {
    const frame = (modal as any)._frameData;
    if (frame) {
      window.selectedStoryboardFrameId = frame.id;
      (window as any).renderStoryboard?.();
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
        if (live && typeof (window as any).regenerateThumbnail === 'function') {
          (window as any).regenerateThumbnail(live).then(() => {
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
      (window as any).renderStoryboard?.();
      updateInspector('storyboard-frame', data);
    });
  };

  syncField('.sfe-input-label', 'label');
  syncField('.sfe-input-scene', 'scene');
  syncField('.sfe-input-anchor', 'scriptLink');
  syncField('.sfe-input-notes', 'notes');

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
