import { html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

/**
 * Modal layer sized to its offset parent (panel host), not the viewport.
 * Place inside a `position: relative` container with defined height.
 */
@customElement('cg-panel-modal')
export class CgPanelModal extends CgLightElement {
  @property({ type: Boolean, reflect: true })
  open = false;

  @property({ type: String })
  title = '';

  @property({ type: String, attribute: 'title-icon' })
  titleIcon = '';

  @property({ type: String, attribute: 'close-label' })
  closeLabel = 'Close';

  private _onDocKeydown = (e: KeyboardEvent): void => {
    if (!this.open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this._requestClose('escape');
    }
  };

  connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'dialog');
    this.setAttribute('aria-modal', 'true');
    document.addEventListener('keydown', this._onDocKeydown, true);
  }

  disconnectedCallback(): void {
    document.removeEventListener('keydown', this._onDocKeydown, true);
    super.disconnectedCallback();
  }

  protected updated(changed: Map<string, unknown>): void {
    if (changed.has('open')) {
      this.setAttribute('aria-hidden', this.open ? 'false' : 'true');
      if (this.open && this.title) {
        this.setAttribute('aria-label', this.title);
      } else {
        this.removeAttribute('aria-label');
      }
    }
  }

  private _requestClose(reason: 'backdrop' | 'button' | 'escape'): void {
    this.dispatchEvent(
      new CustomEvent('cg-panel-modal-close', {
        bubbles: true,
        composed: true,
        detail: { reason },
      })
    );
  }

  render() {
    if (!this.open) return nothing;

    return html`
      <div
        class="cg-panel-modal-backdrop"
        aria-hidden="true"
        @click=${() => this._requestClose('backdrop')}
      ></div>
      <div
        class="cg-panel-modal-dialog bevel-raised"
        role="document"
        @click=${(e: Event) => e.stopPropagation()}
      >
        <div class="cg-panel-modal-header panel-header">
          <span class="cg-panel-modal-title">
            ${this.titleIcon
              ? html`<i class="fa-solid ${this.titleIcon}" aria-hidden="true"></i>`
              : nothing}
            ${this.title}
          </span>
          <button
            type="button"
            class="toolbar-btn cg-panel-modal-close"
            title=${this.closeLabel}
            aria-label=${this.closeLabel}
            @click=${() => this._requestClose('button')}
          >
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>
        <div class="cg-panel-modal-body panel-content">
          <slot></slot>
        </div>
      </div>
    `;
  }
}
