import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { CgLightElement } from '@/components/lit-base';
import type { LocationCamera, LocationShotTransformation, LocationGuide } from '@/workspace/location-types';
import { SHOT_TYPES, getDefaultFocalLength, createShotTransformation } from '@/workspace/location-types';

@customElement('cinegen-location-camera-editor')
export class CinegenLocationCameraEditor extends CgLightElement {
  @property({ attribute: false }) camera?: LocationCamera;
  @property({ attribute: false }) guideId?: string;

  @state() private _editingLabel = false;
  @state() private _labelBuffer = '';
  @state() private _editingRotation = false;
  @state() private _rotationBuffer = '0';

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add('flex', 'flex-col', 'h-full', 'overflow-hidden');
  }

  private _startEditLabel(): void {
    if (!this.camera) return;
    this._labelBuffer = this.camera.label;
    this._editingLabel = true;
  }

  private _commitLabel(): void {
    if (!this.camera) return;
    const trimmed = this._labelBuffer.trim();
    if (trimmed) this.camera.label = trimmed;
    this._editingLabel = false;
    this._dispatchGuideChanged();
  }

  private _startEditRotation(): void {
    if (!this.camera) return;
    this._rotationBuffer = String(this.camera.rotation);
    this._editingRotation = true;
  }

  private _commitRotation(): void {
    if (!this.camera) return;
    const val = parseFloat(this._rotationBuffer);
    if (!isNaN(val)) {
      this.camera.rotation = ((val % 360) + 360) % 360;
    }
    this._editingRotation = false;
    this._dispatchGuideChanged();
  }

  private _addShotTransformation(): void {
    if (!this.camera) return;
    const shotType = SHOT_TYPES[0];
    const st = createShotTransformation(shotType, getDefaultFocalLength(shotType));
    this.camera.shotTransformations.push(st);
    this.requestUpdate();
    this._dispatchGuideChanged();
  }

  private _removeShotTransformation(st: LocationShotTransformation): void {
    if (!this.camera) return;
    this.camera.shotTransformations = this.camera.shotTransformations.filter(s => s.id !== st.id);
    this.requestUpdate();
    this._dispatchGuideChanged();
  }

  private _updateShotType(st: LocationShotTransformation, shotType: string): void {
    st.shotType = shotType;
    st.focalLength = getDefaultFocalLength(shotType as any);
    this.requestUpdate();
    this._dispatchGuideChanged();
  }

  private _updateFocalLength(st: LocationShotTransformation, value: string): void {
    st.focalLength = value;
    this.requestUpdate();
    this._dispatchGuideChanged();
  }

  private _updateNotes(st: LocationShotTransformation, value: string): void {
    st.notes = value;
    this._dispatchGuideChanged();
  }

  private _toggleActive(st: LocationShotTransformation): void {
    st.isActive = !st.isActive;
    this.requestUpdate();
    this._dispatchGuideChanged();
  }

  private _onBackdropUpload(st: LocationShotTransformation): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        st.backdropUrl = reader.result as string;
        st.thumbnailUrl = reader.result as string;
        this.requestUpdate();
        this._dispatchGuideChanged();
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  private _generateBackdrop(st: LocationShotTransformation): void {
    this.dispatchEvent(new CustomEvent('generate-backdrop', {
      detail: { cameraId: this.camera?.id, shotTransformationId: st.id, shotType: st.shotType },
      bubbles: true,
      composed: true,
    }));
  }

  private _dispatchGuideChanged(): void {
    this.dispatchEvent(new CustomEvent('guide-changed', {
      detail: { cameraId: this.camera?.id },
      bubbles: true,
      composed: true,
    }));
  }

  private _removeCamera(): void {
    if (!this.camera || !confirm(`Remove camera "${this.camera.label}"?`)) return;
    this.dispatchEvent(new CustomEvent('remove-camera', {
      detail: { cameraId: this.camera.id },
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    if (!this.camera) {
      return html`
        <div class="flex flex-col items-center justify-center h-full text-[var(--text-dim)] p-4 text-center text-sm">
          <i class="fa-solid fa-camera text-3xl mb-3 opacity-30"></i>
          <div>Select a camera on the plan view</div>
          <div class="text-xs mt-1">or double-click the plan to add a new camera</div>
        </div>
      `;
    }

    const cam = this.camera;

    return html`
      <div class="flex flex-col h-full overflow-auto">
        <!-- Camera header -->
        <div class="p-3 border-b border-[#333]">
          <div class="flex items-center gap-2 mb-2">
            <i class="fa-solid fa-camera text-[var(--accent-blue)]"></i>
            ${this._editingLabel
              ? html`
                <input
                  type="text"
                  class="flex-1 bg-[#2a2a2a] border border-[#555] rounded px-2 py-0.5 text-sm focus:outline-none focus:border-[var(--accent-blue)]"
                  .value=${this._labelBuffer}
                  @input=${(e: InputEvent) => { this._labelBuffer = (e.target as HTMLInputElement).value; }}
                  @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') this._commitLabel(); if (e.key === 'Escape') this._editingLabel = false; }}
                  @blur=${this._commitLabel}
                  autofocus
                />
              `
              : html`
                <span
                  class="flex-1 text-sm font-semibold cursor-pointer hover:text-[var(--accent-blue)]"
                  @click=${this._startEditLabel}
                  title="Click to rename"
                >${cam.label}</span>
              `
            }
          </div>
          <div class="flex items-center gap-3 text-xs text-[var(--text-dim)]">
            <span>ID: ${cam.id.slice(0, 12)}…</span>
            <span>Position: (${Math.round(cam.position.x * 100)}%, ${Math.round(cam.position.y * 100)}%)</span>
            ${this._editingRotation
              ? html`
                <span>
                  Rotation:
                  <input
                    type="number"
                    class="w-16 bg-[#2a2a2a] border border-[#555] rounded px-1 py-0 text-xs text-center focus:outline-none focus:border-[var(--accent-blue)]"
                    .value=${this._rotationBuffer}
                    @input=${(e: InputEvent) => { this._rotationBuffer = (e.target as HTMLInputElement).value; }}
                    @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') this._commitRotation(); if (e.key === 'Escape') this._editingRotation = false; }}
                    @blur=${this._commitRotation}
                    autofocus
                  />°
                </span>
              `
              : html`
                <span
                  class="cursor-pointer hover:text-[var(--accent-blue)]"
                  @click=${this._startEditRotation}
                  title="Click to edit rotation"
                >Rotation: ${cam.rotation}°</span>
              `
            }
          </div>
        </div>

        <!-- Shot transformations -->
        <div class="flex-1 overflow-auto">
          <div class="flex items-center justify-between px-3 py-2 border-b border-[#333] bg-[#222]">
            <div class="flex items-center gap-1 text-xs font-semibold text-[var(--text-dim)]">
              <i class="fa-solid fa-clapperboard"></i> Shot Transformations (${cam.shotTransformations.length})
            </div>
            <button
              class="text-xs px-2 py-0.5 rounded bg-[#333] hover:bg-[#444] text-[#aaa] hover:text-white transition-colors"
              @click=${this._addShotTransformation}
              title="Add shot transformation"
            ><i class="fa-solid fa-plus"></i> Add Shot</button>
          </div>

          ${cam.shotTransformations.length === 0
            ? html`
              <div class="flex flex-col items-center justify-center py-8 text-[var(--text-dim)] text-xs">
                <i class="fa-solid fa-clapperboard text-2xl mb-2 opacity-30"></i>
                <div>No shot transformations yet</div>
                <button class="mt-2 text-xs px-3 py-1 rounded bg-[#333] hover:bg-[#444]" @click=${this._addShotTransformation}>
                  <i class="fa-solid fa-plus"></i> Add First Shot
                </button>
              </div>
            `
            : html`
              <div class="divide-y divide-[#333]">
                ${cam.shotTransformations.map(st => html`
                  <div class="p-3 hover:bg-[#222] transition-colors ${st.isActive ? '' : 'opacity-50'}">
                    <div class="flex items-center gap-2 mb-2">
                      <select
                        class="bg-[#2a2a2a] border border-[#444] rounded px-2 py-0.5 text-xs focus:outline-none focus:border-[var(--accent-blue)]"
                        .value=${st.shotType}
                        @change=${(e: Event) => this._updateShotType(st, (e.target as HTMLSelectElement).value)}
                      >
                        ${SHOT_TYPES.map(stType => html`
                          <option value=${stType} ?selected=${st.shotType === stType}>${stType}</option>
                        `)}
                      </select>
                      <select
                        class="bg-[#2a2a2a] border border-[#444] rounded px-2 py-0.5 text-xs focus:outline-none focus:border-[var(--accent-blue)]"
                        .value=${st.focalLength || ''}
                        @change=${(e: Event) => this._updateFocalLength(st, (e.target as HTMLSelectElement).value)}
                      >
                        ${['14mm','24mm','35mm','50mm','70mm','85mm','100mm','135mm','200mm'].map(fl => html`
                          <option value=${fl} ?selected=${st.focalLength === fl}>${fl}</option>
                        `)}
                      </select>
                      <div class="flex-1"></div>
                      <button
                        class="text-[10px] px-1.5 py-0.5 rounded ${st.isActive ? 'bg-[var(--accent-blue)] text-white' : 'bg-[#333] text-[#666]'} transition-colors"
                        @click=${() => this._toggleActive(st)}
                        title=${st.isActive ? 'Active' : 'Inactive'}
                      >${st.isActive ? 'ACTIVE' : 'OFF'}</button>
                      <button
                        class="text-[10px] px-1.5 py-0.5 rounded bg-[#333] hover:bg-red-800 hover:text-white text-[#666] transition-colors"
                        @click=${() => this._removeShotTransformation(st)}
                        title="Remove shot"
                      ><i class="fa-solid fa-trash"></i></button>
                    </div>

                    <!-- Backdrop area -->
                    <div class="flex gap-2 items-start">
                      <div class="flex-1 min-w-0">
                        ${st.backdropUrl
                          ? html`
                            <div class="relative group">
                              <img src=${st.backdropUrl} alt=${st.shotType} class="w-full h-20 object-cover rounded border border-[#444]" />
                              <button
                                class="absolute top-1 right-1 text-[10px] px-1 py-0.5 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                @click=${() => { st.backdropUrl = undefined; st.thumbnailUrl = undefined; this.requestUpdate(); this._dispatchGuideChanged(); }}
                              ><i class="fa-solid fa-xmark"></i></button>
                            </div>
                          `
                          : html`
                            <div class="w-full h-20 rounded border border-dashed border-[#444] flex items-center justify-center gap-2 bg-[#1a1a1a]">
                              <button class="text-[10px] px-2 py-1 rounded bg-[#333] hover:bg-[#444] transition-colors" @click=${() => this._onBackdropUpload(st)}>
                                <i class="fa-solid fa-upload"></i> Upload
                              </button>
                              <button class="text-[10px] px-2 py-1 rounded bg-[#2a3a4a] hover:bg-[#3a4a5a] transition-colors" @click=${() => this._generateBackdrop(st)}>
                                <i class="fa-solid fa-wand-magic-sparkles"></i> Generate AI
                              </button>
                            </div>
                          `
                        }
                      </div>
                    </div>

                    <!-- Notes -->
                    <input
                      type="text"
                      class="mt-1 w-full bg-transparent border border-transparent hover:border-[#444] focus:border-[var(--accent-blue)] rounded px-2 py-0.5 text-[10px] text-[var(--text-dim)] focus:outline-none transition-colors"
                      placeholder="Notes for this shot transformation…"
                      .value=${st.notes || ''}
                      @change=${(e: Event) => this._updateNotes(st, (e.target as HTMLInputElement).value)}
                    />
                  </div>
                `)}
              </div>
            `
          }
        </div>

        <!-- Footer actions -->
        <div class="p-2 border-t border-[#333] bg-[#222]">
          <button
            class="text-xs px-2 py-1 rounded bg-red-800/50 hover:bg-red-800 text-red-300 hover:text-white transition-colors w-full"
            @click=${this._removeCamera}
          ><i class="fa-solid fa-trash"></i> Remove Camera</button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cinegen-location-camera-editor': CinegenLocationCameraEditor;
  }
}
