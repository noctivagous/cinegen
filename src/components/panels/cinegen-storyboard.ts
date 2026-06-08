/**
 * @AI-GUI — TARGET FOR REPLACEMENT
 *
 * Conventions for AI GUI replacement:
 * - Lit 3 + TS decorators (experimentalDecorators: true, useDefineForClassFields: false)
 * - Extend CgLightElement (Light DOM only — NO shadowRoot)
 * - Global CSS classes only (cg-panel-header, cg-btn, flex, grid, gap-*, etc.)
 * - CSS vars: --accent-blue, --text-dim, --bg-panel, --border-light
 * - Font Awesome 6 via <i class="fa-solid fa-*"></i>
 * - @/ path alias maps to src/
 * - Event constants from events/shell-events.ts — NO raw custom-event strings
 * - Keep @customElement('cinegen-storyboard') tag unchanged
 * - Replace ENTIRE file content; export the class
 */

import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import { html, nothing, type PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { whenBootReady } from '@/app/boot-coordinator';
import { CgLightElement } from '@/components/lit-base';
import {
  selectedStoryboardFrameId,
  storyboardFrames,
  storyboardVisibility,
} from '@/data/project-data';
import type { StoryboardFrame, StoryboardVisibilityPart } from '@/storyboard/storyboard-types';
import {
  formatShotDisplayLabel,
  getShotForFrame,
  groupStoryboardFramesByShot,
  sceneNumberFromSceneId,
} from '@/workspace/shot-frame-bridge';
import { escHtml } from '@/utils/html';
import { updateInspector } from '@/components/panels/cinegen-inspector';
import { emitStoryboardFrameSelected } from '@/events/shell-events';

let _storyboardMenuDismissBound = false;

const SHOT_INDEX_IN_GROUP = new Map<number, number>();

@customElement('cinegen-storyboard')
export class CinegenStoryboard extends CgLightElement {
  /** `shots` = grouped by coverage shot; `sequence` = flat board order. */
  @property({ type: String, reflect: true, attribute: 'view-mode' })
  viewMode: 'shots' | 'sequence' = 'shots';

  @property({ type: Number, attribute: 'thumbnail-scale' })
  thumbnailScale = 1;

  private readonly _onFramesChanged = (): void => {
    this.syncVisibilityClasses();
    this.requestUpdate();
  };

  connectedCallback(): void {
    if (!this.id) this.id = 'storyboard-grid';
    this.classList.add('storyboard-grid');
    super.connectedCallback();
    this.wireContextMenuDismiss();
    window.addEventListener('storyboard-frames-changed', this._onFramesChanged);
    whenBootReady('legacyModules', () => this.requestUpdate());
    whenBootReady('app', () => this.requestUpdate());
  }

  disconnectedCallback(): void {
    window.removeEventListener('storyboard-frames-changed', this._onFramesChanged);
    super.disconnectedCallback();
  }

  wireContextMenuDismiss(): void {
    if (_storyboardMenuDismissBound) return;
    _storyboardMenuDismissBound = true;
    document.addEventListener('click', (e) => {
      const menu = document.getElementById('storyboard-context-menu') as HTMLElement & {
        containsTarget?: (t: EventTarget | null) => boolean;
        hidden?: boolean;
        close?: () => void;
      };
      if (!menu || menu.hidden) return;
      if (typeof menu.containsTarget === 'function' && menu.containsTarget(e.target)) return;
      window.hideStoryboardContextMenu?.();
    });
  }

  refresh(): void {
    this.syncVisibilityClasses();
    this.requestUpdate();
  }

  updated(changed: PropertyValues): void {
    super.updated(changed);
    const scale = Math.min(2, Math.max(0.5, this.thumbnailScale || 1));
    this.style.setProperty('--sb-thumb-scale', String(scale));
  }

  syncVisibilityClasses(): void {
    Object.entries(storyboardVisibility).forEach(([part, visible]) => {
      this.classList.toggle(`storyboard-hide-${part}`, !visible);
    });
  }

  setPartVisibility(part: StoryboardVisibilityPart, visible: boolean): void {
    if (!Object.prototype.hasOwnProperty.call(storyboardVisibility, part)) return;
    storyboardVisibility[part] = visible;
    this.syncVisibilityClasses();
    this.requestUpdate();
  }

  selectFrame(frameId: number): void {
    const frame = storyboardFrames.find((f) => f.id === frameId);
    if (!frame) return;
    window.selectedStoryboardFrameId = frameId;
    this.requestUpdate();
    window.highlightScriptForFrame?.(frame);
    updateInspector('storyboard-frame', frame);
    emitStoryboardFrameSelected(frameId);
  }

  getSelectedFrame(): StoryboardFrame | null {
    const selectedId = window.selectedStoryboardFrameId ?? selectedStoryboardFrameId;
    if (!selectedId) return null;
    return storyboardFrames.find((f) => f.id === selectedId) ?? null;
  }

  private _onFrameClick(frame: StoryboardFrame): void {
    this.selectFrame(frame.id);
  }

  private _onFrameContextMenu(e: MouseEvent, frame: StoryboardFrame): void {
    e.preventDefault();
    window.selectedStoryboardFrameId = frame.id;
    this.requestUpdate();
    updateInspector('storyboard-frame', frame);
    window.showStoryboardContextMenu?.(frame, e.clientX, e.clientY);
  }

  private _shotBadge(frame: StoryboardFrame): string | null {
    const shot = getShotForFrame(frame);
    if (!shot?.number) return null;
    const sceneNum = sceneNumberFromSceneId(
      `scene${String(frame.scene || '1').replace(/\D/g, '').padStart(2, '0')}`
    );
    return formatShotDisplayLabel(sceneNum, shot.number);
  }

  private _frameTemplate(frame: StoryboardFrame, frameIndexInShot: number) {
    const selectedId = window.selectedStoryboardFrameId ?? selectedStoryboardFrameId;
    const selected = frame.id === selectedId;
    const hasImage = !!frame.imageUrl;
    const isGenerating = !!frame.generatingStatus;
    const isError = isGenerating && frame.generatingStatus!.startsWith('error:');
    const shotBadge = this._shotBadge(frame);
    return html`
      <div
        class=${classMap({ 'storyboard-frame': true, selected })}
        data-frame-id=${String(frame.id)}
        @click=${() => this._onFrameClick(frame)}
        @dblclick=${() => window.openStoryboardFrameEditor?.(frame)}
        @contextmenu=${(e: MouseEvent) => this._onFrameContextMenu(e, frame)}
      >
        <div class="frame-image frame-part-frame" style="position:relative;overflow:hidden">
          ${hasImage
        ? html`<img src=${frame.imageUrl} alt=${escHtml(frame.label)}
                     style="width:100%;height:100%;object-fit:cover" />`
        : html`<i class="fa-solid fa-video"></i>`}
          ${isGenerating ? html`
            <div style="position:absolute;inset:0;background:rgba(0,0,0,0.7);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:#fff;font-size:11px;z-index:2">
              <i class="fa-solid fa-circle-notch fa-spin" style="font-size:20px"></i>
              <span>${isError
          ? html`<span style="color:#f66">${escHtml(frame.generatingStatus!.replace('error:', ''))}</span>`
          : escHtml(frame.generatingStatus!)}</span>
            </div>
          ` : ''}
        </div>
        <div class="frame-label">
          <div class="scene-ref frame-part-scene">
            SC ${escHtml(frame.scene)}${shotBadge ? html` · ${escHtml(shotBadge)}.${frameIndexInShot}` : nothing}
          </div>
          <div class="frame-shot-label">${escHtml(frame.label)}</div>
        </div>
        <div class="frame-notes frame-part-notes">
          ${frame.notes
        ? escHtml(frame.notes)
        : html`<span class="frame-notes-empty">No notes</span>`}
        </div>
      </div>
    `;
  }

  private _syncShotFrameIndices(): void {
    SHOT_INDEX_IN_GROUP.clear();
    for (const group of groupStoryboardFramesByShot()) {
      group.frames.forEach((frame, idx) => {
        SHOT_INDEX_IN_GROUP.set(frame.id, idx + 1);
      });
    }
  }

  private _renderByShot() {
    const groups = groupStoryboardFramesByShot();
    return repeat(
      groups,
      (g) => g.key,
      (group) => html`
        <section class="storyboard-shot-group">
          <header class="storyboard-shot-group-header text-[10px] uppercase tracking-wide text-[var(--text-dim)] px-1 py-2">
            ${escHtml(group.label)}
          </header>
          <div class="storyboard-shot-group-frames">
            ${repeat(
        group.frames,
        (f) => f.id,
        (frame) => this._frameTemplate(frame, SHOT_INDEX_IN_GROUP.get(frame.id) ?? 1)
      )}
          </div>
        </section>
      `
    );
  }

  private _renderSequence() {
    return repeat(
      storyboardFrames as StoryboardFrame[],
      (f) => f.id,
      (frame, idx) => this._frameTemplate(frame, SHOT_INDEX_IN_GROUP.get(frame.id) ?? idx + 1)
    );
  }

  render() {
    this.syncVisibilityClasses();
    if (!storyboardFrames.length) return nothing;

    this._syncShotFrameIndices();
    return this.viewMode === 'sequence' ? this._renderSequence() : this._renderByShot();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cinegen-storyboard': CinegenStoryboard;
  }
}
