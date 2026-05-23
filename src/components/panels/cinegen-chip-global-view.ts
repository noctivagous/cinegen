import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

@customElement('cinegen-chip-global-view')
export class CinegenChipGlobalView extends CgLightElement {
  connectedCallback(): void {
    super.connectedCallback();
    this.id = 'view-chip-global';
    this.classList.add('hidden', 'flex', 'flex-col', 'h-full');
  }

  render() {
    return html`
      <cg-panel-header>
        <span slot="title" id="chip-global-title" class="workspace-panel-title"
          ><i class="fa-solid fa-globe"></i> Global view</span
        >
      </cg-panel-header>
      <div id="chip-global-list" class="chip-global-list panel-content flex-1 overflow-auto p-3"></div>
    `;
  }
}
