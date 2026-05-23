import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
@customElement('cinegen-console')
export class CinegenConsole extends CgLightElement {
  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add('console-drawer');
    this.hidden = false;
  }

  render() {
    return html`
      <div class="console-toolbar bevel-raised">
        <span class="console-title"><i class="fa-solid fa-terminal"></i> Console</span>
        <div class="console-actions">
          <button type="button" class="toolbar-btn console-breakout-btn" title="Break out / dock">
            <i class="fa-solid fa-expand"></i>
          </button>
          <button type="button" class="toolbar-btn console-close-btn" title="Close (Alt+K)">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>
      <div class="console-terminal"></div>
    `;
  }
}
