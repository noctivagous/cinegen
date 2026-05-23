import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

@customElement('cinegen-casting-view')
export class CinegenCastingView extends CgLightElement {
  connectedCallback(): void {
    super.connectedCallback();
    this.id = 'view-casting';
    this.classList.add('hidden', 'flex', 'flex-col', 'h-full');
  }

  render() {
    return html`
      <cg-panel-header>
        <span slot="title" class="workspace-panel-title"
          ><i class="fa-solid fa-users"></i> CASTING / CHARACTERS</span
        >
      </cg-panel-header>
      <div id="casting-character-list" class="casting-grid panel-content flex-1 overflow-auto p-4"></div>
    `;
  }
}
