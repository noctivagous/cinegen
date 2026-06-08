import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';
import { CgLightElement } from '@/components/lit-base';
import type { LocationCamera, LocationPlanView as LocationPlanViewType, LocationGuide } from '@/workspace/location-types';

const CAMERA_ICON = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="3"/><circle cx="12" cy="12" r="4"/></svg>'
);

@customElement('cinegen-location-plan-view')
export class CinegenLocationPlanView extends CgLightElement {
  @property({ attribute: false }) guide?: LocationGuide;

  @state() private _selectedCameraId: string | null = null;
  @state() private _draggingCameraId: string | null = null;
  @state() private _panOffset = { x: 0, y: 0 };
  @state() private _zoom = 1;

  private _canvasEl: HTMLElement | null = null;
  private _dragStart = { x: 0, y: 0 };
  private _dragCamStart = { x: 0, y: 0 };
  private _isPanning = false;

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add('relative', 'overflow-hidden', 'bg-[#1a1a1a]', 'rounded', 'border', 'border-[#333]', 'flex-1', 'min-h-0');
  }

  private _getNormalizedPos(cam: LocationCamera): { x: number; y: number } {
    return {
      x: Math.round(cam.position.x * 10000) / 100,
      y: Math.round(cam.position.y * 10000) / 100,
    };
  }

  private _onCanvasMouseDown(e: MouseEvent): void {
    if (e.target === this._canvasEl || (e.target as HTMLElement)?.classList.contains('plan-image')) {
      this._isPanning = true;
      this._dragStart = { x: e.clientX - this._panOffset.x, y: e.clientY - this._panOffset.y };
      this._selectedCameraId = null;
    }
  }

  private _onCanvasMouseMove(e: MouseEvent): void {
    if (this._draggingCameraId && this.guide) {
      const rect = this._canvasEl?.getBoundingClientRect();
      if (!rect) return;
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;
      const cam = this.guide.cameras.find(c => c.id === this._draggingCameraId);
      if (cam) {
        cam.position.x = Math.max(0, Math.min(1, nx));
        cam.position.y = Math.max(0, Math.min(1, ny));
        this.requestUpdate();
        this._dispatchGuideChanged();
      }
      return;
    }
    if (this._isPanning) {
      this._panOffset = { x: e.clientX - this._dragStart.x, y: e.clientY - this._dragStart.y };
      this.requestUpdate();
    }
  }

  private _onCanvasMouseUp(): void {
    this._draggingCameraId = null;
    this._isPanning = false;
  }

  private _onCameraMouseDown(e: MouseEvent, cam: LocationCamera): void {
    e.stopPropagation();
    this._selectedCameraId = cam.id;
    this._draggingCameraId = cam.id;
    this._dragCamStart = { ...cam.position };
    this._dispatchCameraSelected(cam.id);
  }

  private _onCameraContextMenu(e: MouseEvent, cam: LocationCamera): void {
    e.preventDefault();
    e.stopPropagation();
    this._selectedCameraId = cam.id;
    this._dispatchCameraSelected(cam.id);
  }

  private _onPlanClick(e: MouseEvent): void {
    if (e.target !== this._canvasEl && !(e.target as HTMLElement)?.classList.contains('plan-image')) return;
    const rect = this._canvasEl?.getBoundingClientRect();
    if (!rect || !this.guide) return;
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    this._dispatchAddCamera(Math.max(0, Math.min(1, nx)), Math.max(0, Math.min(1, ny)));
  }

  private _dispatchCameraSelected(cameraId: string): void {
    this.dispatchEvent(new CustomEvent('camera-selected', {
      detail: { cameraId },
      bubbles: true,
      composed: true,
    }));
  }

  private _dispatchAddCamera(x: number, y: number): void {
    this.dispatchEvent(new CustomEvent('add-camera', {
      detail: { x, y },
      bubbles: true,
      composed: true,
    }));
  }

  private _dispatchGuideChanged(): void {
    this.dispatchEvent(new CustomEvent('guide-changed', {
      detail: { guide: this.guide },
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    if (!this.guide) {
      return html`<div class="flex items-center justify-center h-full text-[var(--text-dim)] text-sm">No location selected</div>`;
    }

    const planImage = this.guide.planView?.imageUrl;
    const containerStyle = styleMap({
      transform: `translate(${this._panOffset.x}px, ${this._panOffset.y}px) scale(${this._zoom})`,
      transformOrigin: '0 0',
    });

    return html`
      <div class="flex flex-col h-full">
        <div class="flex items-center gap-2 p-2 border-b border-[#333] bg-[#222] text-xs">
          <span class="text-[var(--text-dim)]">Cameras: ${this.guide.cameras.length}</span>
          <span class="text-[var(--text-dim)]">|</span>
          <span class="text-[var(--text-dim)]">Click to add camera</span>
          <span class="text-[var(--text-dim)]">|</span>
          <span class="text-[var(--text-dim)]">Drag cameras to position</span>
          <div class="flex-1"></div>
          <button
            class="px-2 py-0.5 rounded bg-[#333] hover:bg-[#444] text-xs"
            @click=${() => { this._zoom = Math.min(4, this._zoom * 1.2); this.requestUpdate(); }}
            title="Zoom in"
          ><i class="fa-solid fa-plus"></i></button>
          <span class="text-[var(--text-dim)] text-xs">${Math.round(this._zoom * 100)}%</span>
          <button
            class="px-2 py-0.5 rounded bg-[#333] hover:bg-[#444] text-xs"
            @click=${() => { this._zoom = Math.max(0.25, this._zoom / 1.2); this.requestUpdate(); }}
            title="Zoom out"
          ><i class="fa-solid fa-minus"></i></button>
          <button
            class="px-2 py-0.5 rounded bg-[#333] hover:bg-[#444] text-xs"
            @click=${() => { this._panOffset = { x: 0, y: 0 }; this._zoom = 1; this.requestUpdate(); }}
            title="Reset view"
          ><i class="fa-solid fa-expand"></i></button>
        </div>
        <div
          class="relative flex-1 overflow-hidden cursor-grab active:cursor-grabbing"
          @mousedown=${this._onCanvasMouseDown}
          @mousemove=${this._onCanvasMouseMove}
          @mouseup=${this._onCanvasMouseUp}
          @mouseleave=${this._onCanvasMouseUp}
          @dblclick=${this._onPlanClick}
        >
          <div
            class="absolute inset-0"
            style=${containerStyle}
          >
            <div class="plan-image relative" style="width:600px;height:400px;background:#2a2a2a;border:1px solid #444;">
              ${planImage
                ? html`<img src=${planImage} alt="Plan" class="absolute inset-0 w-full h-full object-contain" />`
                : html`<div class="absolute inset-0 flex items-center justify-center text-[var(--text-dim)] text-xs">No plan image — click to place cameras</div>`
              }
              <!-- Grid dots for visual reference -->
              <svg class="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 600 400">
                ${Array.from({ length: 7 }, (_, i) => html`
                  <line x1="0" y1=${i * 66.7} x2="600" y2=${i * 66.7} stroke="#333" stroke-width="0.5" opacity="0.3"/>
                `)}
                ${Array.from({ length: 9 }, (_, i) => html`
                  <line x1=${i * 75} y1="0" x2=${i * 75} y2="400" stroke="#333" stroke-width="0.5" opacity="0.3"/>
                `)}
              </svg>
              <!-- Camera markers -->
              ${this.guide.cameras.map(cam => {
                const px = cam.position.x * 600;
                const py = cam.position.y * 400;
                const isSelected = cam.id === this._selectedCameraId;
                const angleRad = (cam.rotation * Math.PI) / 180;
                const coneLen = 40;
                const coneX = px + Math.cos(angleRad) * coneLen;
                const coneY = py - Math.sin(angleRad) * coneLen;

                return html`
                  <div
                    class="absolute"
                    style=${styleMap({
                      left: `${px}px`,
                      top: `${py}px`,
                      transform: 'translate(-50%, -50%)',
                      cursor: 'grab',
                      zIndex: isSelected ? 10 : 5,
                    })}
                    @mousedown=${(e: MouseEvent) => this._onCameraMouseDown(e, cam)}
                    @contextmenu=${(e: MouseEvent) => this._onCameraContextMenu(e, cam)}
                  >
                    <!-- Field of view cone -->
                    <svg
                      class="absolute pointer-events-none"
                      width="80" height="60"
                      style=${styleMap({
                        left: '0px',
                        top: '-30px',
                        transform: `rotate(${cam.rotation}deg) translate(40px, 30px)`,
                        transformOrigin: '0 30px',
                        opacity: isSelected ? 0.4 : 0.2,
                      })}
                    >
                      <polygon points="0,30 80,5 80,55" fill="var(--accent-blue, #4a9eff)" />
                    </svg>
                    <!-- Camera body -->
                    <div
                      class=${classMap({
                        'w-8 h-6 rounded flex items-center justify-center border-2 text-xs font-bold transition-all': true,
                        'border-[var(--accent-blue)] bg-[var(--accent-blue)] text-white': isSelected,
                        'border-[#555] bg-[#333] text-[#ccc]': !isSelected,
                      })}
                      style="transform: rotate(${cam.rotation}deg);"
                      title=${`${cam.label} (${cam.shotTransformations.length} shots)`}
                    >
                      <i class="fa-solid fa-camera text-[10px]"></i>
                    </div>
                    <!-- Label -->
                    <div
                      class="absolute left-1/2 top-full mt-1 whitespace-nowrap text-[10px] px-1 rounded pointer-events-none"
                      style=${styleMap({
                        transform: 'translateX(-50%)',
                        color: isSelected ? 'var(--accent-blue)' : 'var(--text-dim)',
                        background: 'rgba(0,0,0,0.7)',
                      })}
                    >${cam.label}${cam.shotTransformations.length ? ` (${cam.shotTransformations.length})` : ''}</div>
                  </div>
                `;
              })}
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cinegen-location-plan-view': CinegenLocationPlanView;
  }
}
