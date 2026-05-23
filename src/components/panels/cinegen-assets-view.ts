import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import type { CinegenAssetsPanel } from '@/components/panels/cinegen-assets-panel';

const ASSET_TAB_OPTIONS = [
  { value: '0', label: 'Characters' },
  { value: '1', label: 'Locations' },
  { value: '2', label: 'Props' },
  { value: '3', label: 'Vehicles' },
  { value: '4', label: 'Lighting & Effects' },
];

@customElement('cinegen-assets-view')
export class CinegenAssetsView extends CgLightElement {
  connectedCallback(): void {
    super.connectedCallback();
    this.id = 'view-assets';
    this.classList.add('hidden', 'flex', 'flex-col', 'h-full');
  }

  firstUpdated(): void {
    const seg = this.querySelector<HTMLElement>(
      'cg-segmented-control[data-segmented="asset-tabs"]'
    );
    if (!seg || seg.dataset.bound === '1') return;
    seg.dataset.bound = '1';
    seg.addEventListener('cg-change', (e: Event) => {
      const value = (e as CustomEvent<{ value: string }>).detail?.value;
      const tab = parseInt(value ?? '0', 10);
      if (Number.isNaN(tab)) return;
      const panel = this.querySelector<CinegenAssetsPanel>('cinegen-assets-panel');
      if (panel) panel.switchTab(tab);
      else window.switchAssetTab?.(tab);
    });
  }

  render() {
    return html`
      <cg-panel-header>
        <span slot="title" class="workspace-panel-title"
          ><i class="fa-solid fa-cube"></i> GLOBAL ASSETS LIBRARY</span
        >
      </cg-panel-header>
      <div class="tab-bar px-2" style="border-bottom: 2px solid #1a1a1a;">
        <cg-segmented-control
          data-segmented="asset-tabs"
          name="Asset library category"
          variant="asset-tabs-segmented"
          .options=${ASSET_TAB_OPTIONS}
          value="0"
        ></cg-segmented-control>
      </div>
      <div id="assets-content" class="flex-1 p-4 overflow-auto">
        <cinegen-assets-panel></cinegen-assets-panel>
      </div>
    `;
  }
}
