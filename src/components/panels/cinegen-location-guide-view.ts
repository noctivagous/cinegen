/**
 * @AI-GUI — TARGET FOR REPLACEMENT
 *
 * Conventions for AI GUI replacement:
 *
 * Framework:
 * - Lit 3 + TS decorators (experimentalDecorators: true, useDefineForClassFields: false)
 * - Use @property() / @state() decorators — NOT class field initializers
 * - Extend CgLightElement (Light DOM only — DO NOT create a shadowRoot)
 *
 * Styling:
 * - Global CSS classes only (CineGenBaseGUI*.css) — no scoped/shadow styles
 * - Use: cg-panel-header, cg-btn, cg-input, cg-grid, cg-card, cg-badge, toolbar-btn, flex, grid, gap-*, p-*, text-*, rounded, etc.
 * - cg-panel-header provides title bar with slot="title"
 * - See styleguide/CineGenBaseGUI-Controls-Styleguide.html
 * - CSS vars: --accent-blue, --text-dim, --bg-panel, --border-light, --widget-border
 * - Font Awesome 6 via <i class="fa-solid fa-*"></i>
 *
 * Imports:
 * - @/ path alias maps to src/
 * - Event constants from events/shell-events.ts — NO raw custom-event strings
 * - Types from data/project-data.ts or relevant type files
 *
 * Architecture:
 * - This panel is registered in panel-loader.ts, index.html, globals.d.ts,
 *   tree-view-contract.ts, project-tree.cinetree, project-feature-catalog.ts
 * - Keep @customElement('...') tag unchanged; chunk file is separate
 * - No new window.* globals; export the class
 *
 * Integration:
 * - Replace ENTIRE file content with new GUI implementation
 * - Keep same @customElement decorator tag
 * - Panel receives state via Lit properties/context
 */

import { html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { classMap } from 'lit/directives/class-map.js';
import { CgLightElement } from '@/components/lit-base';
import { colorState } from '@/color/color-state';
import { locationLibrary, locationGuides } from '@/data/project-data';
import type { LocationGuide, LocationCamera } from '@/workspace/location-types';
import { createLocationGuide, createCamera } from '@/workspace/location-types';

type LocationItem = {
  id: string;
  name: string;
  tags: string;
  icon: string;
};

function normalizeSearchQuery(raw: string | undefined | null): string {
  return String(raw ?? '').trim().toLowerCase();
}

@customElement('cinegen-location-guide-view')
export class CinegenLocationGuideView extends CgLightElement {
  @state() private _activeTab: 'library' | 'guide' = 'guide';
  @state() private _selectedLocationId: string | null = null;
  @state() private _selectedCameraId: string | null = null;
  @state() private _searchQuery = '';
  @state() private _palette: string[] = [];
  @state() private _guides: LocationGuide[] = [];

  private _unsubColor: (() => void) | null = null;
  private _unsubGuides: (() => void) | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.id = 'view-location-guide';
    this.classList.add('hidden', 'flex', 'flex-col', 'h-full');
    this._palette = colorState.getPalette();
    this._unsubColor = colorState.subscribe((palette) => {
      this._palette = palette;
      this.requestUpdate();
    });
    this._syncGuides();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._unsubColor?.();
    this._unsubGuides?.();
  }

  private _syncGuides(): void {
    this._guides = [...locationGuides];
  }

  private _getLocation(id: string): LocationItem | undefined {
    return (locationLibrary as LocationItem[]).find(l => l.id === id);
  }

  private _getOrCreateGuide(locationId: string): LocationGuide {
    let guide = this._guides.find(g => g.locationId === locationId);
    if (!guide) {
      guide = createLocationGuide(locationId);
      this._guides.push(guide);
      this._persistGuides();
    }
    return guide;
  }

  private _getGuide(locationId: string): LocationGuide | undefined {
    return this._guides.find(g => g.locationId === locationId);
  }

  private _selectLocation(locationId: string): void {
    this._selectedLocationId = locationId;
    this._selectedCameraId = null;
    this._getOrCreateGuide(locationId);
    this._activeTab = 'guide';
    this.requestUpdate();
  }

  private _handleAddCamera(e: CustomEvent): void {
    const { x, y } = e.detail;
    if (!this._selectedLocationId) return;
    const guide = this._getOrCreateGuide(this._selectedLocationId);
    const camNum = guide.cameras.length + 1;
    const cam = createCamera(`Camera ${camNum}`, { x, y }, 0);
    guide.cameras.push(cam);
    this._selectedCameraId = cam.id;
    this._persistGuides();
    this.requestUpdate();
  }

  private _handleCameraSelected(e: CustomEvent): void {
    this._selectedCameraId = e.detail.cameraId;
    this.requestUpdate();
  }

  private _handleRemoveCamera(e: CustomEvent): void {
    if (!this._selectedLocationId) return;
    const guide = this._getGuide(this._selectedLocationId);
    if (!guide) return;
    guide.cameras = guide.cameras.filter(c => c.id !== e.detail.cameraId);
    if (this._selectedCameraId === e.detail.cameraId) {
      this._selectedCameraId = guide.cameras[0]?.id || null;
    }
    this._persistGuides();
    this.requestUpdate();
  }

  private _handleGuideChanged(): void {
    this._persistGuides();
  }

  private _handleGenerateBackdrop(e: CustomEvent): void {
    const { cameraId, shotTransformationId, shotType } = e.detail;
    if (!this._selectedLocationId) return;
    const guide = this._getGuide(this._selectedLocationId);
    if (!guide) return;
    const cam = guide.cameras.find(c => c.id === cameraId);
    if (!cam) return;
    const st = cam.shotTransformations.find(s => s.id === shotTransformationId);
    if (!st) return;
    const loc = this._getLocation(this._selectedLocationId);
    st.backdropUrl = `/api/location-guide/generate-backdrop?location=${encodeURIComponent(loc?.name || '')}&shotType=${encodeURIComponent(shotType)}&cameraLabel=${encodeURIComponent(cam.label)}&rotation=${cam.rotation}`;
    st.thumbnailUrl = st.backdropUrl;
    this._persistGuides();
    this.requestUpdate();
  }

  private _handleRemoveGuide(): void {
    if (!this._selectedLocationId) return;
    if (!confirm('Remove location guide data for this location?')) return;
    this._guides = this._guides.filter(g => g.locationId !== this._selectedLocationId);
    this._selectedLocationId = null;
    this._selectedCameraId = null;
    this._persistGuides();
    this.requestUpdate();
  }

  private _handleUploadPlanImage(): void {
    if (!this._selectedLocationId) return;
    const guide = this._getOrCreateGuide(this._selectedLocationId);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        guide.planView ??= {};
        guide.planView.imageUrl = reader.result as string;
        this._persistGuides();
        this.requestUpdate();
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  private _handleRemovePlanImage(): void {
    if (!this._selectedLocationId) return;
    const guide = this._getGuide(this._selectedLocationId);
    if (!guide?.planView) return;
    guide.planView.imageUrl = undefined;
    this._persistGuides();
    this.requestUpdate();
  }

  private _persistGuides(): void {
    locationGuides.length = 0;
    locationGuides.push(...this._guides);
  }

  private _visibleLocations(): LocationItem[] {
    const query = normalizeSearchQuery(this._searchQuery);
    if (!query) return locationLibrary as LocationItem[];
    return (locationLibrary as LocationItem[]).filter(loc =>
      `${loc.name} ${loc.tags}`.toLowerCase().includes(query)
    );
  }

  render() {
    const selectedGuide = this._selectedLocationId ? this._getGuide(this._selectedLocationId) : undefined;
    const selectedCamera = selectedGuide?.cameras.find(c => c.id === this._selectedCameraId);
    const selectedLocation = this._selectedLocationId ? this._getLocation(this._selectedLocationId) : undefined;
    const locations = this._visibleLocations();

    return html`
      <cg-panel-header>
        <span slot="title" class="workspace-panel-title"
          ><i class="fa-solid fa-map"></i> LOCATION GUIDE</span
        >
        <div slot="actions">
          <div class="flex items-center gap-2">
            <!-- Tab toggle -->
            <div class="flex bg-[#2a2a2a] rounded border border-[#1a1a1a] text-xs overflow-hidden">
              <button
                class=${classMap({
                  'px-3 py-1 transition-colors': true,
                  'bg-[var(--accent-blue)] text-white': this._activeTab === 'guide',
                  'text-[var(--text-dim)] hover:text-white': this._activeTab !== 'guide',
                })}
                @click=${() => { this._activeTab = 'guide'; this.requestUpdate(); }}
              ><i class="fa-solid fa-compass"></i> Guide</button>
              <button
                class=${classMap({
                  'px-3 py-1 transition-colors': true,
                  'bg-[var(--accent-blue)] text-white': this._activeTab === 'library',
                  'text-[var(--text-dim)] hover:text-white': this._activeTab !== 'library',
                })}
                @click=${() => { this._activeTab = 'library'; this.requestUpdate(); }}
              ><i class="fa-solid fa-book"></i> Library</button>
            </div>
          </div>
        </div>
      </cg-panel-header>

      ${this._activeTab === 'library' ? html`
        <!-- Library view -->
        <div class="flex flex-col flex-1 overflow-hidden">
          <div class="p-2 border-b border-[#333]">
            <input
              type="text"
              placeholder="Search locations..."
              class="w-full bg-[#2a2a2a] border border-[#1a1a1a] text-xs px-3 py-1.5 rounded focus:outline-none focus:border-[var(--accent-blue)]"
              @input=${(e: InputEvent) => { this._searchQuery = (e.target as HTMLInputElement).value; this.requestUpdate(); }}
            />
          </div>
          <div class="flex-1 overflow-auto p-2">
            <div class="grid gap-2" style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));">
              ${locations.map(loc => {
                const hasGuide = !!this._getGuide(loc.id);
                const isSelected = loc.id === this._selectedLocationId;
                return html`
                  <button
                    class=${classMap({
                      'location-card text-left p-3 rounded border transition-colors': true,
                      'border-[var(--accent-blue)] bg-[var(--accent-blue)]/10': isSelected,
                      'border-[#333] bg-[#222] hover:bg-[#2a2a2a]': !isSelected,
                    })}
                    @click=${() => this._selectLocation(loc.id)}
                  >
                    <div class="flex items-center gap-2 mb-1">
                      <i class="fa-solid ${loc.icon} text-[var(--accent-blue)]"></i>
                      <span class="text-sm font-medium">${loc.name}</span>
                      ${hasGuide ? html`<span class="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent-blue)]/20 text-[var(--accent-blue)]"><i class="fa-solid fa-check"></i> Guide</span>` : nothing}
                    </div>
                    <div class="text-[10px] text-[var(--text-dim)] truncate">${loc.tags}</div>
                  </button>
                `;
              })}
            </div>
          </div>
        </div>
      ` : html`
        <!-- Guide view -->
        <div class="flex flex-1 overflow-hidden">
          ${!selectedLocation || !selectedGuide ? html`
            <div class="flex flex-col items-center justify-center flex-1 text-[var(--text-dim)] p-8">
              <i class="fa-solid fa-map text-5xl mb-4 opacity-30"></i>
              <div class="text-sm mb-2">Select a location from the Library to start planning</div>
              <button
                class="text-xs px-4 py-2 rounded bg-[#333] hover:bg-[#444] transition-colors"
                @click=${() => { this._activeTab = 'library'; this.requestUpdate(); }}
              ><i class="fa-solid fa-book"></i> Open Library</button>
            </div>
          ` : html`
            <!-- Location header bar -->
            <div class="flex flex-col flex-1 overflow-hidden">
              <div class="flex items-center gap-2 px-3 py-2 border-b border-[#333] bg-[#222]">
                <i class="fa-solid ${selectedLocation.icon} text-[var(--accent-blue)]"></i>
                <span class="text-sm font-semibold">${selectedLocation.name}</span>
                <span class="text-[10px] text-[var(--text-dim)]">${selectedGuide.cameras.length} camera${selectedGuide.cameras.length !== 1 ? 's' : ''}</span>
                <div class="flex-1"></div>
                ${selectedGuide.planView?.imageUrl
                  ? html`
                    <button class="text-[10px] px-2 py-1 rounded bg-[#333] hover:bg-[#444] text-[#aaa] transition-colors" @click=${this._handleRemovePlanImage}>
                      <i class="fa-solid fa-trash"></i> Remove Plan
                    </button>
                  `
                  : nothing
                }
                <button class="text-[10px] px-2 py-1 rounded bg-[#333] hover:bg-[#444] text-[#aaa] transition-colors" @click=${this._handleUploadPlanImage}>
                  <i class="fa-solid fa-image"></i> Upload Plan
                </button>
                <button class="text-[10px] px-2 py-1 rounded bg-red-800/30 hover:bg-red-800 text-red-300 hover:text-white transition-colors" @click=${this._handleRemoveGuide}>
                  <i class="fa-solid fa-trash"></i> Clear Guide
                </button>
              </div>

              <!-- Main split: plan view + camera editor -->
              <div class="flex flex-1 overflow-hidden">
                <div class="flex-1 flex flex-col min-w-0">
                  <cinegen-location-plan-view
                    .guide=${selectedGuide}
                    @add-camera=${this._handleAddCamera}
                    @camera-selected=${this._handleCameraSelected}
                    @guide-changed=${this._handleGuideChanged}
                  ></cinegen-location-plan-view>
                </div>

                <!-- Camera editor sidebar -->
                <div class="w-72 border-l border-[#333] flex flex-col overflow-hidden bg-[#1e1e1e]">
                  <cinegen-location-camera-editor
                    .camera=${selectedCamera}
                    .guideId=${this._selectedLocationId}
                    @remove-camera=${this._handleRemoveCamera}
                    @guide-changed=${this._handleGuideChanged}
                    @generate-backdrop=${this._handleGenerateBackdrop}
                  ></cinegen-location-camera-editor>
                </div>
              </div>
            </div>
          `}
        </div>
      `}

      <!-- Color palette at bottom -->
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

declare global {
  interface HTMLElementTagNameMap {
    'cinegen-location-guide-view': CinegenLocationGuideView;
  }
}
