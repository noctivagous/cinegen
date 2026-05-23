import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

/** Right inspector chrome (header + close control + `cinegen-inspector`). */
@customElement('cinegen-inspector-shell')
export class CinegenInspectorShell extends CgLightElement {
  connectedCallback(): void {
    super.connectedCallback();
    this.id = 'inspector-panel';
    this.classList.add('bevel-flat', 'flex', 'flex-col', 'min-h-0');
    if (!this.style.width) {
      this.style.width = '288px';
      this.style.minWidth = '240px';
    }
  }

  render() {
    return html`
      <cg-panel-header>
        <span slot="title"><i class="fa-solid fa-info-circle"></i> INSPECTOR</span>
        <button
          slot="actions"
          type="button"
          id="inspector-panel-close-btn"
          class="text-xs text-[var(--text-dim)] hover:text-white"
          aria-label="Close inspector"
        >
          ✕
        </button>
      </cg-panel-header>
      <cinegen-inspector></cinegen-inspector>
    `;
  }
}
