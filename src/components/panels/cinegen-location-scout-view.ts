import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import { colorState } from '@/color/color-state';

@customElement('cinegen-location-scout-view')
export class CinegenLocationScoutView extends CgLightElement {
  @state() private _palette: string[] = [];
  private _unsub: (() => void) | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.id = 'view-location-scout';
    this.classList.add('hidden', 'flex', 'flex-col', 'h-full');
    this._palette = colorState.getPalette();
    this._unsub = colorState.subscribe((palette) => {
      this._palette = palette;
      this.requestUpdate();
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._unsub?.();
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
      <details style="border-top:1px solid #333;padding:4px 8px;">
        <summary style="cursor:pointer;font-size:12px;font-weight:600;color:#aaa;padding:4px 0;">
          <i class="fa-solid fa-palette"></i> Location Color Palette
        </summary>
        <div style="padding:4px 0;">
          <cg-color-palette
            .palette=${this._palette}
            shownIn="panel"
            style="display:block;"
            @cg-palette-change=${(e: any) => {
              colorState.setPalette(e.detail.palette);
            }}
          ></cg-color-palette>
        </div>
      </details>
    `;
  }
}
