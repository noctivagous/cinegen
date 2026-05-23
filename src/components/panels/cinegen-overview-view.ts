import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

@customElement('cinegen-overview-view')
export class CinegenOverviewView extends CgLightElement {
  connectedCallback(): void {
    super.connectedCallback();
    this.id = 'view-overview';
    this.classList.add('hidden', 'flex', 'flex-col', 'h-full');
  }

  render() {
    return html`
      <cg-panel-header>
        <span slot="title" id="overview-panel-title" class="workspace-panel-title"></span>
        <div slot="actions" id="overview-panel-actions" class="flex gap-1"></div>
      </cg-panel-header>
      <cinegen-overview-panel id="overview-panel-content"></cinegen-overview-panel>
    `;
  }
}
