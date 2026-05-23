import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

@customElement('cinegen-asset-detail-view')
export class CinegenAssetDetailView extends CgLightElement {
  connectedCallback(): void {
    super.connectedCallback();
    this.id = 'view-asset-detail';
    this.classList.add('hidden', 'flex', 'flex-col', 'h-full');
  }

  render() {
    return html`
      <cg-panel-header>
        <span slot="title" id="asset-detail-title" class="workspace-panel-title"></span>
        <div slot="actions" id="asset-detail-actions" class="flex gap-1"></div>
      </cg-panel-header>
      <div
        id="asset-detail-content"
        class="flex-1 min-h-0 overflow-hidden"
        style="background: var(--bg-inset);"
      ></div>
    `;
  }
}
