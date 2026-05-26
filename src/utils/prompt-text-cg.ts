export interface PromptTextOptions {
  title: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  okLabel?: string;
  iconClass?: string;
}

/** In-app single-line prompt (replaces blocked native `prompt()`). */
export function promptTextCG(opts: PromptTextOptions): Promise<string | null> {
  return new Promise((resolve) => {
    const hostId = 'cg-prompt-text';
    let el = document.getElementById(hostId);
    if (el) el.remove();

    const defaultValue = opts.defaultValue ?? '';
    const placeholder = opts.placeholder ?? '';
    const okLabel = opts.okLabel ?? 'OK';
    const iconClass = opts.iconClass ?? 'fa-pen';

    el = document.createElement('div');
    el.id = hostId;
    el.innerHTML = `
      <div class="cg-prompt-layer" role="dialog" aria-modal="true" aria-labelledby="cg-prompt-text-title">
        <div class="cg-prompt-dialog bevel-raised" style="width:360px">
          <div class="cg-prompt-header panel-header">
            <span id="cg-prompt-text-title"><i class="fa-solid ${iconClass}" aria-hidden="true"></i> ${opts.title}</span>
          </div>
          <div class="cg-prompt-body panel-content">
            <label class="cg-prompt-field">
              <span>${opts.label}</span>
              <input type="text" id="cg-prompt-text-value" class="cg-input" value="${defaultValue.replace(/"/g, '&quot;')}" placeholder="${placeholder.replace(/"/g, '&quot;')}" />
            </label>
          </div>
          <div class="cg-prompt-footer bevel-sunken">
            <button type="button" id="cg-prompt-text-cancel" class="toolbar-btn">Cancel</button>
            <button type="button" id="cg-prompt-text-ok" class="toolbar-btn toolbar-btn--shape-soft btn-ai">${okLabel}</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(el);

    const layer = el.querySelector('.cg-prompt-layer') as HTMLElement;
    const valueInput = el.querySelector('#cg-prompt-text-value') as HTMLInputElement;
    const okBtn = el.querySelector('#cg-prompt-text-ok') as HTMLElement;
    const cancelBtn = el.querySelector('#cg-prompt-text-cancel') as HTMLElement;

    function close(result: string | null) {
      el!.remove();
      document.removeEventListener('keydown', onKeydown);
      resolve(result);
    }

    function submit() {
      const value = valueInput.value.trim();
      if (!value) {
        valueInput.focus();
        return;
      }
      close(value);
    }

    function onKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape') close(null);
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
    }

    okBtn.addEventListener('click', (e) => { e.stopPropagation(); submit(); });
    cancelBtn.addEventListener('click', (e) => { e.stopPropagation(); close(null); });
    layer.addEventListener('click', (e) => { if (e.target === layer) close(null); });
    valueInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
    });
    document.addEventListener('keydown', onKeydown);

    el.hidden = false;
    el.setAttribute('aria-hidden', 'false');
    setTimeout(() => valueInput.focus(), 0);
  });
}
