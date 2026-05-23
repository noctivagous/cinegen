import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

@customElement('cinegen-location-scout-view')
export class CinegenLocationScoutView extends CgLightElement {
  connectedCallback(): void {
    super.connectedCallback();
    this.id = 'view-location-scout';
    this.classList.add('hidden', 'flex', 'flex-col', 'h-full');
  }

  render() {
    return html`
      <cg-panel-header>
        <span slot="title" class="workspace-panel-title"
          ><i class="fa-solid fa-map"></i> VIRTUAL LOCATION SCOUT</span
        >
        <div slot="actions">
          <input
            id="location-search"
            type="text"
            placeholder="Search mood / environment..."
            class="bg-[#2a2a2a] border border-[#1a1a1a] text-xs px-3 py-1 rounded focus:outline-none focus:border-[var(--accent-blue)] w-64"
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === 'Enter') window.filterLocations?.();
            }}
          />
          <button data-ws-action="generateLocation" class="toolbar-btn btn-ai ml-2">
            <i class="fa-solid fa-magic"></i> AI Generate Location
          </button>
        </div>
      </cg-panel-header>
      <cinegen-location-scout></cinegen-location-scout>
    `;
  }
}
