import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

@customElement('cinegen-breakdown-view')
export class CinegenBreakdownView extends CgLightElement {
  connectedCallback(): void {
    super.connectedCallback();
    this.id = 'view-breakdown';
    this.classList.add('hidden', 'flex', 'flex-col', 'h-full');
  }

  render() {
    return html`
      <cg-panel-header>
        <span slot="title" class="workspace-panel-title"
          ><i class="fa-solid fa-table-list"></i> BREAKDOWN SHEETS - Scene Analysis</span
        >
        <div slot="actions" class="flex gap-1">
          <button
            class="toolbar-btn btn-ai"
            style="padding: 2px 8px; font-size: 10px;"
            data-ws-action="autoSuggestBreakdown"
          >
            <i class="fa-solid fa-robot"></i> AI Auto-Suggest
          </button>
          <button
            class="toolbar-btn"
            style="padding: 2px 8px; font-size: 10px;"
            data-ws-action="exportBreakdown"
          >
            <i class="fa-solid fa-download"></i> Export CSV
          </button>
        </div>
      </cg-panel-header>
      <div class="panel-content" style="overflow: auto;">
        <table class="breakdown-table">
          <thead>
            <tr>
              <th style="width: 80px;">Scene</th>
              <th style="width: 120px;">INT/EXT</th>
              <th style="width: 150px;">Location</th>
              <th style="width: 100px;">Time</th>
              <th style="width: 150px;">Characters</th>
              <th style="width: 150px;">Props</th>
              <th style="width: 150px;">Wardrobe</th>
              <th style="width: 120px;">SFX/Makeup</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody id="breakdown-tbody"></tbody>
        </table>
      </div>
    `;
  }
}
