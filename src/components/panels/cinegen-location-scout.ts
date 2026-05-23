import { repeat } from 'lit/directives/repeat.js';
import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import { locationLibrary } from '@/data/project-data';
import { escHtml } from '@/utils/html';

type LocationItem = {
  id: number;
  name: string;
  tags: string;
  icon: string;
};

function normalizeSearchQuery(raw: string | undefined | null): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase();
}

@customElement('cinegen-location-scout')
export class CinegenLocationScout extends CgLightElement {
  connectedCallback(): void {
    if (!this.id) this.id = 'location-grid';
    this.classList.add('storyboard-grid');
    if (!this.style.gridTemplateColumns) {
      this.style.gridTemplateColumns = 'repeat(auto-fill, minmax(220px, 1fr))';
    }
    super.connectedCallback();
  }

  refresh(): void {
    this.requestUpdate();
  }

  private _visibleLocations(): LocationItem[] {
    const input = document.getElementById('location-search') as HTMLInputElement | null;
    const query = normalizeSearchQuery(input?.value);
    if (!query) return locationLibrary as LocationItem[];
    return (locationLibrary as LocationItem[]).filter((loc) =>
      `${loc.name} ${loc.tags}`.toLowerCase().includes(query)
    );
  }

  private _onUseLocation(loc: LocationItem): void {
    window.useLocation?.(loc.id);
  }

  render() {
    const locations = this._visibleLocations();
    if (!locations.length) {
      return html`<div class="text-[var(--text-dim)] text-xs p-3">No locations match that filter.</div>`;
    }
    return repeat(
      locations,
      (loc) => String(loc.id),
      (loc) => html`
        <div class="location-card" @click=${() => this._onUseLocation(loc)}>
          <div class="location-image"><i class="fa-solid ${loc.icon} text-6xl"></i></div>
          <div class="location-label">
            <div class="scene-ref">${escHtml(loc.name)}</div>
            <div class="text-[10px] text-[var(--text-dim)]">${escHtml(loc.tags)}</div>
          </div>
        </div>
      `
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cinegen-location-scout': CinegenLocationScout;
  }
}
