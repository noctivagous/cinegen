import { STORYBOARD_FRAME_DESTINATIONS } from '@/storyboard/storyboard-destinations';
import { getCinegenScriptEditor, getCinegenStoryboard } from '@/panels/panel-hosts';
import { getCurrentScriptSelection, scheduleFountainRender } from '@/script/fountain-bundle';
import { alertCG } from '@/utils/alert-cg';
import { escHtml } from '@/utils/html';

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

// ==================== STORYBOARD CONTEXT MENU ====================

export function showStoryboardContextMenu(frame: StoryboardFrame, clientX: number, clientY: number): void {
  const menu = document.getElementById('storyboard-context-menu') as any;
  if (!menu || typeof menu.open !== 'function' || !frame) return;

  hideChipContextMenu?.();
  window.storyboardContextState = { frameId: frame.id };

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
        (window as any).regenerateThumbnail?.(frame);
      } else {
        navigateStoryboardDestination?.(destId, frame);
      }
    },
  });
}

export function hideStoryboardContextMenu(): void {
  (document.getElementById('storyboard-context-menu') as any)?.close?.();
  window.storyboardContextState = null;
}

export function initStoryboardNavigation(): void {
  getCinegenStoryboard()?.wireContextMenuDismiss();
}

// ==================== SCRIPT CONTEXT MENU ====================

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

  const atChip = getChipAtScriptCaret?.();
  if (atChip) {
    hideScriptContextMenu();
    showChipContextMenuAt?.(atChip.type, atChip.label, clientX, clientY);
    return;
  }

  hideScriptContextMenu();
  const selectedText = (window as any).getScriptSelectionOrCurrentLine?.() || '';
  const sel = getCurrentScriptSelection();
  const hasSelection = sel && sel.from !== sel.to;
  const existingChips = hasSelection ? extractChipsFromText?.(selectedText) || [] : [];

  const items: Array<{ id: string; label: string; icon: string }> = [
    { id: 'make-storyboard-frame-for-text', label: 'Make Storyboard Frame', icon: 'fa-image' },
    { id: 'link-frame-to-script', label: 'Link to Selected Frame', icon: 'fa-link' },
    { id: 'revise-selection', label: 'Revise...', icon: 'fa-pen' },
  ];

  if (hasSelection && existingChips.length === 0 && selectedText) {
    items.push({ id: 'make-chip', label: 'Make Chip...', icon: 'fa-tag' });
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
          (window as any).makeStoryboardFrameForText?.();
          break;
        case 'link-frame-to-script':
          (window as any).linkSelectedFrameToScript?.();
          break;
        case 'revise-selection':
          window.openAiAssistModal?.();
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

export function makeChipFromSelection(): void {
  const text = (window as any).getScriptSelectionOrCurrentLine?.() || '';
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
      const name = normalizeEntityName?.(result.label) || result.label;
      if (!w.scriptInfoWardrobe.some((s: string) => s.toLowerCase() === name.toLowerCase())) {
        w.scriptInfoWardrobe.push(name);
      }
    }
    scheduleFountainRender?.();
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
  (window as any).highlightStoryboardForScriptSelection?.();
  toggleStoryboardFrameTextButton();
}
