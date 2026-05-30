import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

@customElement('cinegen-script-info-pane')
export class CinegenScriptInfoPane extends CgLightElement {
  connectedCallback(): void {
    super.connectedCallback();
    this.id = 'script-pane-info';
    this.classList.add('script-pane-view', 'hidden');
  }

  render() {
    return html`
      <div class="script-info-toolbar bevel-sunken">
        <span><i class="fa-solid fa-tags" aria-hidden="true"></i> SCRIPT INFO — Entity registry</span>
        <button
          class="toolbar-btn"
          style="padding: 2px 8px; font-size: 10px;"
          data-ws-action="refreshScriptInfoFromScript"
        >
          <i class="fa-solid fa-rotate"></i> Entities
        </button>
        <button
          class="toolbar-btn"
          style="padding: 2px 8px; font-size: 10px;"
          data-ws-action="refresh-breakdown-from-script"
          title="Re-sync scenes, breakdown rows, and starter shots from screenplay"
        >
          <i class="fa-solid fa-table-list"></i> Breakdown
        </button>
      </div>
      <div id="script-info-content" class="script-info-content"></div>
    `;
  }
}
