/**
 * alertCG — custom alert replacement with blurred backdrop.
 *
 * Replaces native alert() across the app with a styled modal
 * that respects the CineGen dark UI and supports queueing.
 */

let _alertQueue: Array<{ message: string; title?: string }> = [];
let _alertOpen = false;

function _ensureAlertContainer(): HTMLElement | null {
  let el = document.getElementById('cg-alert-modal');
  if (el) return el;

  el = document.createElement('div');
  el.id = 'cg-alert-modal';
  el.className = 'cg-alert-modal';
  el.setAttribute('hidden', '');
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <div class="cg-alert-modal-layer" role="alertdialog" aria-modal="true" aria-labelledby="cg-alert-title-text" aria-describedby="cg-alert-message">
      <div class="cg-alert-dialog bevel-raised">
        <div class="cg-alert-header panel-header">
          <span id="cg-alert-title"><i id="cg-alert-icon" class="fa-solid fa-circle-info" aria-hidden="true"></i> <span id="cg-alert-title-text">Notice</span></span>
        </div>
        <div id="cg-alert-message" class="cg-alert-body panel-content"></div>
        <div class="cg-alert-footer bevel-sunken">
          <button type="button" id="cg-alert-ok" class="toolbar-btn toolbar-btn--shape-soft btn-ai">OK</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(el);

  const okBtn = el.querySelector<HTMLElement>('#cg-alert-ok');
  if (okBtn) {
    okBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      _closeAlertCG();
    });
  }

  el.addEventListener('click', (e) => {
    if (e.target === el) _closeAlertCG();
  });

  return el;
}

function _showNextAlert(): void {
  if (_alertOpen || _alertQueue.length === 0) return;
  const next = _alertQueue.shift()!;
  _openAlertCG(next.message, next.title);
}

function _openAlertCG(message: string, title = 'Notice'): void {
  const layer = _ensureAlertContainer();
  if (!layer) {
    // Fallback to native alert if DOM isn't ready
    // eslint-disable-next-line no-alert
    window.alert(message);
    return;
  }

  const titleEl = layer.querySelector<HTMLElement>('#cg-alert-title-text');
  const messageEl = layer.querySelector<HTMLElement>('#cg-alert-message');
  const iconEl = layer.querySelector<HTMLElement>('#cg-alert-icon');

  if (titleEl) titleEl.textContent = title;
  if (messageEl) {
    messageEl.innerHTML = '';
    messageEl.appendChild(document.createTextNode(message));
  }
  if (iconEl) {
    iconEl.className = 'fa-solid fa-circle-info';
  }

  layer.hidden = false;
  layer.setAttribute('aria-hidden', 'false');
  _alertOpen = true;

  // Focus the OK button for keyboard accessibility
  setTimeout(() => {
    layer.querySelector<HTMLElement>('#cg-alert-ok')?.focus();
  }, 0);
}

function _closeAlertCG(): void {
  const layer = document.getElementById('cg-alert-modal');
  if (!layer || layer.hidden) return;
  layer.hidden = true;
  layer.setAttribute('aria-hidden', 'true');
  _alertOpen = false;
  _showNextAlert();
}

/**
 * Show a custom alert modal with blurred backdrop.
 * If another alert is already open, the message is queued.
 */
export function alertCG(message: string): void {
  if (_alertOpen) {
    _alertQueue.push({ message });
    return;
  }
  _openAlertCG(message);
}

/** Wire the global Escape key for alertCG (delegates after modal-manager). */
export function initAlertCG(): void {
  if ((document as unknown as { _cgAlertInit?: boolean })._cgAlertInit) return;
  (document as unknown as { _cgAlertInit?: boolean })._cgAlertInit = true;

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    const layer = document.getElementById('cg-alert-modal');
    if (layer && !layer.hidden) {
      e.stopPropagation();
      _closeAlertCG();
    }
  });
}
