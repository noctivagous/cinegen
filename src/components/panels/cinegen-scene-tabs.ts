import { classMap } from 'lit/directives/class-map.js';
import { html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import { emitWorkspaceSceneTab } from '@/events/shell-events';
import type { SceneDetail, SceneShot } from '@/workspace/scene-types';
import { workspaceState } from '@/workspace/workspace-state';
import { escHtml } from '@/utils/html';
import { currentSceneData } from '@/data/project-data';
import {
  isAcceptedReferenceFile,
  readFileAsDataUrl,
} from '@/assets/asset-upload-service';
import { cameraLightingData } from '@/camera/camera-lighting-bundle';
import { markProjectDirty } from '@/services/project-service';
import {
  formatShotDisplayLabel,
  getFramesForShot,
  sceneNumberFromSceneId,
} from '@/workspace/shot-frame-bridge';
import {
  allowedNextShotStatuses,
  normalizeShotStatus,
  setShotStatus,
  type ShotLifecycleStatus,
} from '@/workspace/shot-lifecycle';

const SCENE_TAB_LABELS = [
  'OVERVIEW',
  'MASTER SHOT',
  'COVERAGE',
  'B-ROLL',
  'PICKUPS',
  'NOTES',
] as const;

@customElement('cinegen-scene-tabs')
export class CinegenSceneTabs extends CgLightElement {
  @state() private _tabIndex = 0;
  @state() private _scene: SceneDetail | null = null;
  @state() private _sceneId: string | null = null;

  connectedCallback(): void {
    this.classList.add('flex', 'flex-col', 'flex-1', 'min-h-0');
    super.connectedCallback();
  }

  setScene(sceneId: string | null, scene: SceneDetail | null): void {
    this._sceneId = sceneId;
    this._scene = scene;
    this._tabIndex = 0;
    workspaceState.activeSceneTab = 0;
    this.requestUpdate();
  }

  switchTab(tabIndex: number): void {
    if (tabIndex < 0 || tabIndex >= SCENE_TAB_LABELS.length) return;
    this._tabIndex = tabIndex;
    workspaceState.activeSceneTab = tabIndex;
    emitWorkspaceSceneTab({ tabIndex, sceneId: this._sceneId });
    this.requestUpdate();
  }

  get activeTabIndex(): number {
    return this._tabIndex;
  }

  private _statusBadgeClass(status: string | undefined): string {
    switch (status) {
      case 'approved': return 'text-emerald-400';
      case 'generated': return 'text-yellow-400';
      case 'reviewed': return 'text-cyan-400';
      case 'queued': return 'text-orange-400';
      case 'prompted': return 'text-purple-400';
      case 'storyboarded': return 'text-blue-400';
      case 'rejected': return 'text-red-400';
      case 'locked': return 'text-gray-500';
      default: return 'text-gray-400';
    }
  }

  private _updateShotField(sceneId: string, shotId: number, field: keyof SceneShot, value: string): void {
    const scene = currentSceneData[sceneId];
    if (!scene || !Array.isArray(scene.coverage)) return;
    const shot = scene.coverage.find((s: SceneShot) => s.id === shotId);
    if (!shot) return;
    (shot as Record<string, unknown>)[field] = value;
    markProjectDirty(['scenes']);
    this.requestUpdate();
  }

  private _updateShotStatus(sceneId: string, shotId: number, next: ShotLifecycleStatus): void {
    const scene = currentSceneData[sceneId];
    if (!scene || !Array.isArray(scene.coverage)) return;
    const shot = scene.coverage.find((s: SceneShot) => s.id === shotId);
    if (!shot) return;
    const result = setShotStatus(shot, next);
    if (result.ok) {
      markProjectDirty(['scenes']);
      this.requestUpdate();
    }
  }

  private _renumberShots(sceneId: string): void {
    const scene = currentSceneData[sceneId];
    if (!scene || !Array.isArray(scene.coverage)) return;
    scene.coverage.forEach((shot: SceneShot, idx: number) => {
      shot.number = idx + 1;
    });
  }

  private _reorderShot(sceneId: string, shotId: number, direction: 'up' | 'down'): void {
    const scene = currentSceneData[sceneId];
    if (!scene || !Array.isArray(scene.coverage)) return;
    const idx = scene.coverage.findIndex((s: SceneShot) => s.id === shotId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= scene.coverage.length) return;

    // Swap
    const temp = scene.coverage[idx];
    scene.coverage[idx] = scene.coverage[swapIdx];
    scene.coverage[swapIdx] = temp;

    this._renumberShots(sceneId);
    markProjectDirty(['scenes']);
    this.requestUpdate();
  }

  private _addShotRef(sceneId: string, shot: SceneShot): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,image/avif,.pdf';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file || !isAcceptedReferenceFile(file)) return;
      const dataUrl = await readFileAsDataUrl(file);
      if (!Array.isArray(shot.sceneReferenceSlots)) shot.sceneReferenceSlots = [];
      shot.sceneReferenceSlots.push(dataUrl);
      markProjectDirty(['scenes']);
      this.requestUpdate();
    });
    input.click();
  }

  private _removeShotRef(sceneId: string, shot: SceneShot, idx: number): void {
    if (!Array.isArray(shot.sceneReferenceSlots)) return;
    shot.sceneReferenceSlots.splice(idx, 1);
    markProjectDirty(['scenes']);
    this.requestUpdate();
  }

  private _shotRefHtml(sceneId: string, shot: SceneShot) {
    const refSlots = shot.sceneReferenceSlots;
    const refUrls = Array.isArray(refSlots) ? refSlots : [];
    return html`
      <div class="mt-2">
        <div class="text-[10px] text-[var(--text-dim)] mb-1">
          ${refUrls.length ? `${refUrls.length} shot reference${refUrls.length === 1 ? '' : 's'}` : 'No shot references'}
        </div>
        ${refUrls.length
          ? html`<div class="flex flex-wrap gap-1 mb-1">
              ${refUrls.map((url, i) => html`
                <div style="position:relative;">
                  <img src=${url} alt="Shot ref ${i + 1}"
                    style="width:48px;height:48px;object-fit:cover;border-radius:4px;border:1px solid var(--border-dark);" />
                  <button
                    type="button"
                    @click=${() => this._removeShotRef(sceneId, shot, i)}
                    style="position:absolute;top:-4px;right:-4px;width:16px;height:16px;border-radius:50%;background:#c00;color:#fff;font-size:10px;line-height:16px;text-align:center;padding:0;"
                    title="Remove reference"
                  >&times;</button>
                </div>
              `)}
            </div>`
          : nothing}
        <button
          type="button"
          class="text-[10px] text-[var(--text-dim)] hover:text-emerald-400"
          @click=${() => this._addShotRef(sceneId, shot)}
        >
          <i class="fa-solid fa-plus"></i> Add Reference
        </button>
      </div>
    `;
  }

  private _overviewHtml(scene: SceneDetail) {
    const master = scene.master;
    const coverageRows = scene.coverage.length
      ? scene.coverage.map(
          (shot) => html`
            <li class="scene-overview-list-item">
              <span class="scene-overview-list-primary">${escHtml(shot.type)}</span>
              <span class="scene-overview-list-meta"
                >${escHtml(shot.label)} · ${escHtml(shot.duration)}${shot.bestTake
                  ? ' · ★ best'
                  : ''}${shot.status
                    ? html` · <span class="${this._statusBadgeClass(shot.status)}">${escHtml(shot.status)}</span>`
                    : ''}</span
              >
            </li>
          `
        )
      : html`<li class="scene-overview-empty">No coverage shots yet.</li>`;

    const brollRows = scene.broll.length
      ? scene.broll.map(
          (b) => html`
            <li class="scene-overview-list-item">
              <span class="scene-overview-list-primary">${escHtml(b.label)}</span>
              <span class="scene-overview-list-meta">${escHtml(b.duration)}</span>
            </li>
          `
        )
      : html`<li class="scene-overview-empty">No B-Roll yet.</li>`;

    const pickupRows = scene.pickups.length
      ? scene.pickups.map(
          (p) => html`
            <li class="scene-overview-list-item">
              <span class="scene-overview-list-primary">${escHtml(p.label)}</span>
              <span class="scene-overview-list-meta">${escHtml(p.duration)}</span>
            </li>
          `
        )
      : html`<li class="scene-overview-empty">No pickups scheduled.</li>`;

    const notesPreview = (scene.notes || '').trim();
    const notesBody = notesPreview
      ? html`<p class="scene-overview-notes">${escHtml(notesPreview)}</p>`
      : html`<p class="scene-overview-empty">No scene notes.</p>`;

    return html`
      <div class="scene-overview">
        <section
          class="scene-overview-section"
          role="button"
          tabindex="0"
          @click=${() => this.switchTab(1)}
          @keydown=${(e: KeyboardEvent) => this._overviewKey(e, 1)}
        >
          <h3 class="scene-overview-heading"><i class="fa-solid fa-film"></i> Master Shot</h3>
          <p class="scene-overview-lead">${escHtml(master.label)}</p>
          <p class="scene-overview-meta">
            ${escHtml(master.duration)} · ${escHtml(master.status)}
          </p>
          <p class="scene-overview-detail">${escHtml(master.prompt)}</p>
        </section>
        <section
          class="scene-overview-section"
          role="button"
          tabindex="0"
          @click=${() => this.switchTab(2)}
          @keydown=${(e: KeyboardEvent) => this._overviewKey(e, 2)}
        >
          <h3 class="scene-overview-heading">
            <i class="fa-solid fa-camera"></i> Coverage
            <span class="scene-overview-count">${scene.coverage.length}</span>
          </h3>
          <ul class="scene-overview-list">${coverageRows}</ul>
        </section>
        <section
          class="scene-overview-section"
          role="button"
          tabindex="0"
          @click=${() => this.switchTab(3)}
          @keydown=${(e: KeyboardEvent) => this._overviewKey(e, 3)}
        >
          <h3 class="scene-overview-heading">
            <i class="fa-solid fa-video"></i> B-Roll
            <span class="scene-overview-count">${scene.broll.length}</span>
          </h3>
          <ul class="scene-overview-list">${brollRows}</ul>
        </section>
        <section
          class="scene-overview-section"
          role="button"
          tabindex="0"
          @click=${() => this.switchTab(4)}
          @keydown=${(e: KeyboardEvent) => this._overviewKey(e, 4)}
        >
          <h3 class="scene-overview-heading">
            <i class="fa-solid fa-rotate"></i> Pickups
            <span class="scene-overview-count">${scene.pickups.length}</span>
          </h3>
          <ul class="scene-overview-list">${pickupRows}</ul>
        </section>
        <section
          class="scene-overview-section"
          role="button"
          tabindex="0"
          @click=${() => this.switchTab(5)}
          @keydown=${(e: KeyboardEvent) => this._overviewKey(e, 5)}
        >
          <h3 class="scene-overview-heading"><i class="fa-solid fa-note-sticky"></i> Notes</h3>
          ${notesBody}
        </section>
      </div>
    `;
  }

  private _overviewKey(e: KeyboardEvent, tab: number): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.switchTab(tab);
    }
  }

  private _tabPanel(scene: SceneDetail) {
    switch (this._tabIndex) {
      case 0:
        return this._overviewHtml(scene);
      case 1:
        return html`
          <div class="flex justify-between items-start">
            <div>
              <div class="text-lg font-bold">${escHtml(scene.master.label)}</div>
              <div class="text-xs text-emerald-400">
                ${escHtml(scene.master.duration)} • ${escHtml(scene.master.status)}
              </div>
              <p class="text-[var(--text-dim)] mt-2">${escHtml(scene.master.prompt)}</p>
            </div>
            <div class="frame-image w-80 flex-col justify-center">
              <i class="fa-solid fa-film text-6xl mb-4"></i>
              <button data-ws-action="regenerateMaster" class="toolbar-btn btn-ai text-xs">
                Regenerate Master
              </button>
            </div>
          </div>
        `;
      case 2:
        return html`
          <div class="grid grid-cols-2 gap-4">
            ${scene.coverage.map((shot, shotIdx) => {
              const sceneId = this._sceneId ?? workspaceState.currentSceneId ?? '';
              const frames = sceneId ? getFramesForShot(sceneId, shot.id) : [];
              const shotLabel =
                shot.number != null && sceneId
                  ? formatShotDisplayLabel(sceneNumberFromSceneId(sceneId), shot.number)
                  : '';
              const shotTypeOptions = cameraLightingData.shotTypes.items.map(
                (i) => html`<option value=${i.abbr} ?selected=${shot.shotType === i.abbr}>${escHtml(i.abbr)} — ${escHtml(i.name)}</option>`
              );
              const angleOptions = cameraLightingData.angles.items.map(
                (i) => html`<option value=${i.abbr} ?selected=${shot.cameraAngle === i.abbr}>${escHtml(i.abbr)} — ${escHtml(i.name)}</option>`
              );
              const movementOptions = cameraLightingData.movements.items.map(
                (i) => html`<option value=${i.abbr} ?selected=${shot.cameraMovement === i.abbr}>${escHtml(i.abbr)} — ${escHtml(i.name)}</option>`
              );
              const isFirst = shotIdx === 0;
              const isLast = shotIdx === scene.coverage.length - 1;
              return html`
                <div data-ws-inspect-shot=${String(shot.id)} class="storyboard-frame p-2">
                  <div class="frame-image"><i class="fa-solid fa-camera"></i></div>
                  <div class="frame-label">
                    ${shotLabel
                      ? html`<div class="scene-ref">Shot ${escHtml(shotLabel)}</div>`
                      : nothing}
                    <div class="scene-ref">${escHtml(shot.type ?? '')}</div>
                    <div>${escHtml(shot.label)} • ${escHtml(shot.duration)}</div>
                    ${shot.status
                      ? html`<span class="text-[10px] uppercase tracking-wider ${this._statusBadgeClass(shot.status)}">${escHtml(shot.status)}</span>`
                      : nothing}
                    ${shot.bestTake
                      ? html`<span class="text-emerald-400 text-[10px]">★ BEST TAKE</span>`
                      : nothing}
                    <div class="flex gap-1 mt-1">
                      <button
                        type="button"
                        class="text-[10px] text-[var(--text-dim)] hover:text-emerald-400 disabled:opacity-30"
                        ?disabled=${isFirst}
                        title="Move shot earlier"
                        @click=${() => this._reorderShot(sceneId, shot.id, 'up')}
                      >
                        <i class="fa-solid fa-arrow-up"></i>
                      </button>
                      <button
                        type="button"
                        class="text-[10px] text-[var(--text-dim)] hover:text-emerald-400 disabled:opacity-30"
                        ?disabled=${isLast}
                        title="Move shot later"
                        @click=${() => this._reorderShot(sceneId, shot.id, 'down')}
                      >
                        <i class="fa-solid fa-arrow-down"></i>
                      </button>
                    </div>
                    <div class="mt-2 space-y-1">
                      <select
                        class="bg-[#1f1f1f] text-[10px] text-[var(--text-dim)] border border-[var(--border)] rounded px-1 py-0.5 w-full"
                        title="Shot type"
                        @change=${(e: Event) => {
                          const val = (e.target as HTMLSelectElement).value;
                          this._updateShotField(sceneId, shot.id, 'shotType', val);
                        }}
                      >
                        <option value="">Type…</option>
                        ${shotTypeOptions}
                      </select>
                      <select
                        class="bg-[#1f1f1f] text-[10px] text-[var(--text-dim)] border border-[var(--border)] rounded px-1 py-0.5 w-full"
                        title="Camera angle"
                        @change=${(e: Event) => {
                          const val = (e.target as HTMLSelectElement).value;
                          this._updateShotField(sceneId, shot.id, 'cameraAngle', val);
                        }}
                      >
                        <option value="">Angle…</option>
                        ${angleOptions}
                      </select>
                      <select
                        class="bg-[#1f1f1f] text-[10px] text-[var(--text-dim)] border border-[var(--border)] rounded px-1 py-0.5 w-full"
                        title="Camera movement"
                        @change=${(e: Event) => {
                          const val = (e.target as HTMLSelectElement).value;
                          this._updateShotField(sceneId, shot.id, 'cameraMovement', val);
                        }}
                      >
                        <option value="">Movement…</option>
                        ${movementOptions}
                      </select>
                      <select
                        class="bg-[#1f1f1f] text-[10px] text-[var(--text-dim)] border border-[var(--border)] rounded px-1 py-0.5 w-full"
                        title="Production status"
                        @change=${(e: Event) => {
                          const val = (e.target as HTMLSelectElement).value as ShotLifecycleStatus;
                          this._updateShotStatus(sceneId, shot.id, val);
                        }}
                      >
                        ${allowedNextShotStatuses(shot.status).map(
                          (st) => html`<option value=${st} ?selected=${normalizeShotStatus(shot.status) === st}>${escHtml(st)}</option>`
                        )}
                      </select>
                    </div>
                    ${frames.length
                      ? html`<ul class="scene-shot-frame-list mt-2 space-y-1">
                          ${frames.map(
                            (frame, idx) => html`
                              <li>
                                <button
                                  type="button"
                                  class="text-[10px] text-left underline text-[var(--text-dim)] hover:text-emerald-400"
                                  @click=${(e: Event) => {
                                    e.stopPropagation();
                                    window.switchView?.('preprod-workspace', 'Storyboard', 'scenes');
                                    window.setPreprodMode?.('storyboard');
                                    window.selectStoryboardFrameById?.(frame.id);
                                  }}
                                >
                                  Frame ${idx + 1}: ${escHtml(frame.label)}
                                </button>
                              </li>
                            `
                          )}
                        </ul>`
                      : html`<p class="text-[10px] text-[var(--text-dim)] mt-2">No storyboard frames linked.</p>`}
                    ${this._shotRefHtml(sceneId, shot)}
                  </div>
                </div>
              `;
            })}
          </div>
        `;
      case 3:
        return scene.broll.length
          ? html`
              <div class="storyboard-grid">
                ${scene.broll.map(
                  (b) => html`
                    <div class="storyboard-frame">
                      <div class="frame-image"><i class="fa-solid fa-video"></i></div>
                      <div class="frame-label">${escHtml(b.label)}</div>
                    </div>
                  `
                )}
              </div>
            `
          : html`<p class="text-[var(--text-dim)]">
              No B-Roll yet.
              <button data-ws-action="addBroll" class="underline">Generate AI B-Roll</button>
            </p>`;
      case 4:
        return html`
          <p class="text-[var(--text-dim)]">
            Pickups are targeted re-generations for continuity fixes.
          </p>
          <button data-ws-action="addPickup" class="toolbar-btn btn-ai mt-4">
            Create new pickup shot
          </button>
        `;
      case 5:
        return html`
          <textarea class="w-full h-64 bg-[#1f1f1f] p-3 text-xs">${escHtml(scene.notes)}</textarea>
        `;
      default:
        return nothing;
    }
  }

  render() {
    return html`
      <div class="tab-bar px-2">
        ${SCENE_TAB_LABELS.map(
          (label, i) => html`
            <button
              type="button"
              id=${`scene-tab-${i}`}
              class=${classMap({ 'tab-btn': true, active: i === this._tabIndex })}
              data-ws-scene-tab=${String(i)}
              @click=${() => this.switchTab(i)}
            >
              ${label}
            </button>
          `
        )}
      </div>
      <div
        id="scene-tab-content"
        class="flex-1 overflow-auto p-4 bg-[var(--bg-inset)] scene-tab-content-host"
      >
        ${this._scene ? this._tabPanel(this._scene) : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cinegen-scene-tabs': CinegenSceneTabs;
  }
}
