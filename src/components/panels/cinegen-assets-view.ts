import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

@customElement('cinegen-assets-view')
export class CinegenAssetsView extends CgLightElement {
  connectedCallback(): void {
    super.connectedCallback();
    this.id = 'view-assets';
    this.classList.add('hidden', 'flex', 'flex-col', 'h-full');
  }

  render() {
    return html`
      <cg-panel-header>
        <span slot="title" class="workspace-panel-title"
          ><i class="fa-solid fa-cube"></i> GLOBAL ASSETS LIBRARY</span>
      </cg-panel-header>
      <div id="assets-content" class="flex-1 overflow-auto">
        <cinegen-assets-panel></cinegen-assets-panel>
      </div>
    `;
  }
}
