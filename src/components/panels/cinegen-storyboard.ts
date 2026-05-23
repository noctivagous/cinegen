import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import { html, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { whenBootReady } from '@/app/boot-coordinator';
import { CgLightElement } from '@/components/lit-base';
import {
  selectedStoryboardFrameId,
  storyboardFrames,
  storyboardVisibility,
} from '@/data/project-data';
import type { StoryboardFrame, StoryboardVisibilityPart } from '@/storyboard/storyboard-types';
import { escHtml } from '@/utils/html';
import { updateInspector } from '@/components/panels/cinegen-inspector';

let _storyboardMenuDismissBound = false;

@customElement('cinegen-storyboard')
export class CinegenStoryboard extends CgLightElement {
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

  /** Document-level dismiss for storyboard context menu (once). */
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

  /** Re-render from `storyboardFrames` / selection (called by storyboard-bundle). */
  refresh(): void {
    this.syncVisibilityClasses();
    this.requestUpdate();
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

  private _frameTemplate(frame: StoryboardFrame) {
    const selectedId = window.selectedStoryboardFrameId ?? selectedStoryboardFrameId;
    const selected = frame.id === selectedId;
    const hasImage = !!frame.imageUrl;
    const isGenerating = !!frame.generatingStatus;
    const isError = isGenerating && frame.generatingStatus!.startsWith('error:');
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
          <div class="scene-ref frame-part-scene">SC ${escHtml(frame.scene)}</div>
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

  render() {
    this.syncVisibilityClasses();
    if (!storyboardFrames.length) return nothing;
    return html`${repeat(storyboardFrames, (f) => f.id, (frame) => this._frameTemplate(frame))}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cinegen-storyboard': CinegenStoryboard;
  }
}
