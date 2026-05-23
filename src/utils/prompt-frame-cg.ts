export interface FrameFormData {
  label: string;
  anchor: string;
  notes: string;
}

export function promptFrameCG(defaults: {
  label: string;
  anchor: string;
}): Promise<FrameFormData | null> {
  return new Promise((resolve) => {
    let el = document.getElementById('cg-prompt-frame');
    if (el) el.remove();

    el = document.createElement('div');
    el.id = 'cg-prompt-frame';
    el.innerHTML = `
      <div class="cg-prompt-layer" role="dialog" aria-modal="true" aria-labelledby="cg-prompt-title">
        <div class="cg-prompt-dialog bevel-raised">
          <div class="cg-prompt-header panel-header">
            <span><i class="fa-solid fa-image"></i> Add Storyboard Frame</span>
          </div>
          <div class="cg-prompt-body panel-content">
            <label class="cg-prompt-field">
              <span>Frame label</span>
              <input type="text" id="cg-prompt-label" class="cg-input" value="${defaults.label.replace(/"/g, '&quot;')}" />
            </label>
            <label class="cg-prompt-field">
              <span>Link to script text (anchor)</span>
              <input type="text" id="cg-prompt-anchor" class="cg-input" value="${defaults.anchor.replace(/"/g, '&quot;')}" />
            </label>
            <label class="cg-prompt-field">
              <span>Notes (optional)</span>
              <textarea id="cg-prompt-notes" class="cg-input" rows="3"></textarea>
            </label>
          </div>
          <div class="cg-prompt-footer bevel-sunken">
            <button type="button" id="cg-prompt-cancel" class="toolbar-btn">Cancel</button>
            <button type="button" id="cg-prompt-ok" class="toolbar-btn toolbar-btn--shape-soft btn-ai">Add Frame</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(el);

    const layer = el.querySelector('.cg-prompt-layer') as HTMLElement;
    const labelInput = el.querySelector('#cg-prompt-label') as HTMLInputElement;
    const anchorInput = el.querySelector('#cg-prompt-anchor') as HTMLInputElement;
    const notesInput = el.querySelector('#cg-prompt-notes') as HTMLTextAreaElement;
    const okBtn = el.querySelector('#cg-prompt-ok') as HTMLElement;
    const cancelBtn = el.querySelector('#cg-prompt-cancel') as HTMLElement;

    function close(result: FrameFormData | null) {
      el!.remove();
      resolve(result);
    }

    function submit() {
      const label = labelInput.value.trim();
      if (!label) {
        labelInput.focus();
        return;
      }
      close({
        label,
        anchor: anchorInput.value.trim(),
        notes: notesInput.value.trim(),
      });
    }

    okBtn.addEventListener('click', (e) => { e.stopPropagation(); submit(); });
    cancelBtn.addEventListener('click', (e) => { e.stopPropagation(); close(null); });
    layer.addEventListener('click', (e) => { if (e.target === layer) close(null); });

    labelInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); anchorInput.focus(); }
    });
    anchorInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); notesInput.focus(); }
    });
    notesInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
    });

    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') { document.removeEventListener('keydown', handler); close(null); }
    });

    el.hidden = false;
    el.setAttribute('aria-hidden', 'false');
    setTimeout(() => labelInput.focus(), 0);
  });
}
