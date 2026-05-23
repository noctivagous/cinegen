import { html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

export type CgModalShellSize = 'default' | 'wide' | 'narrow';

/**
 * Shared modal chrome: fixed overlay, backdrop, dialog, header, body/footer slots.
 * Register `id` with modal-manager; open/close toggles `hidden` on this host.
 *
 * Light DOM: Lit renders into an inner root so `slot="body"` / `slot="footer"`
 * children from parent templates are not removed on first paint.
 */
@customElement('cg-modal-shell')
export class CgModalShell extends CgLightElement {
  private _renderRoot: HTMLDivElement | null = null;

  /** DOM id used by modal-manager and data-cg-close (defaults to element id). */
  @property({ type: String, attribute: 'modal-id' })
  modalId = '';

  @property({ type: String })
  title = '';

  @property({ type: String, attribute: 'title-icon' })
  titleIcon = '';

  @property({ type: String, attribute: 'close-label' })
  closeLabel = 'Close';

  /** default | wide (1200px) | narrow (720px) */
  @property({ type: String, reflect: true })
  size: CgModalShellSize = 'default';

  @property({ type: Boolean, reflect: true })
  hidden = true;

  protected createRenderRoot(): HTMLElement {
    if (!this._renderRoot) {
      this._renderRoot = document.createElement('div');
      this._renderRoot.className = 'cg-modal-shell-root';
    }
    if (!this._renderRoot.isConnected) {
      this.appendChild(this._renderRoot);
    }
    return this._renderRoot;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add('cg-modal-shell');
    if (!this.modalId && this.id) this.modalId = this.id;
    if (!this.hasAttribute('aria-hidden')) {
      this.setAttribute('aria-hidden', this.hidden ? 'true' : 'false');
    }
  }

  protected updated(changed: Map<string, unknown>): void {
    if (changed.has('hidden')) {
      this.setAttribute('aria-hidden', this.hidden ? 'true' : 'false');
    }
    this._distributeSlottedContent();
  }

  private _resolvedModalId(): string {
    return this.modalId || this.id || 'modal';
  }

  private _distributeSlottedContent(): void {
    const root = this._renderRoot;
    if (!root) return;

    const bodyHost = root.querySelector('.cg-modal-body');
    const footerHost = root.querySelector('.cg-modal-footer');
    if (!bodyHost || !footerHost) return;

    const slotted = Array.from(this.children).filter(
      (node): node is HTMLElement =>
        node !== root && node.nodeType === Node.ELEMENT_NODE
    );

    for (const el of slotted) {
      const slotName = el.getAttribute('slot') || 'body';
      if (slotName === 'body') {
        if (!bodyHost.contains(el)) bodyHost.appendChild(el);
        continue;
      }
      if (slotName === 'footer') {
        if (!footerHost.contains(el)) {
          footerHost.querySelector('.cg-modal-footer-default')?.remove();
          footerHost.appendChild(el);
        }
      }
    }
  }

  render() {
    const mid = this._resolvedModalId();
    const titleId = `${mid}-title`;

    return html`
      <div class="cg-modal-backdrop" data-cg-close=${mid} aria-hidden="true"></div>
      <div
        class="cg-modal-dialog bevel-raised"
        role="dialog"
        aria-modal="true"
        aria-labelledby=${titleId}
      >
        <div class="cg-modal-header panel-header">
          <span id=${titleId}>
            ${this.titleIcon
              ? html`<i class="${this.titleIcon}" aria-hidden="true"></i> `
              : nothing}
            ${this.title}
          </span>
          <button
            type="button"
            class="toolbar-btn cg-modal-close"
            data-cg-close=${mid}
            aria-label="Close"
          >
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="cg-modal-body panel-content"></div>
        <div class="cg-modal-footer bevel-sunken">
          <button
            type="button"
            class="toolbar-btn cg-modal-footer-default"
            data-cg-close=${mid}
          >
            ${this.closeLabel}
          </button>
        </div>
      </div>
    `;
  }
}
