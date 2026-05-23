import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

@customElement('cinegen-scene-detail-view')
export class CinegenSceneDetailView extends CgLightElement {
  connectedCallback(): void {
    super.connectedCallback();
    this.id = 'view-scene-detail';
    this.classList.add('hidden', 'flex', 'flex-col', 'h-full');
  }

  render() {
    return html`
      <cg-panel-header>
        <span slot="title" id="scene-detail-title" class="workspace-panel-title"
          ><i class="fa-solid fa-photo-film"></i> SCENE 01 - ABANDONED WAREHOUSE</span
        >
        <div slot="actions" class="flex gap-2">
          <button
            data-ws-action="generateMasterShot"
            class="toolbar-btn btn-ai"
            style="padding: 2px 10px; font-size: 10px;"
          >
            <i class="fa-solid fa-film"></i> Master Shot
          </button>
          <button
            data-ws-action="lockContinuity"
            class="toolbar-btn"
            style="padding: 2px 10px; font-size: 10px;"
          >
            <i class="fa-solid fa-lock"></i> Continuity Lock
          </button>
          <button
            data-ws-action="addShotToCoverage"
            class="toolbar-btn"
            style="padding: 2px 10px; font-size: 10px;"
          >
            <i class="fa-solid fa-plus"></i> Add Shot
          </button>
          <button
            class="toolbar-btn"
            style="padding: 2px 8px; font-size: 10px; margin-left:auto;"
            data-ws-action="openSectionSettings"
            title="Section settings"
          >
            <i class="fa-solid fa-gear"></i>
          </button>
        </div>
      </cg-panel-header>
      <cinegen-scene-tabs class="flex-1 flex flex-col min-h-0"></cinegen-scene-tabs>
    `;
  }
}
