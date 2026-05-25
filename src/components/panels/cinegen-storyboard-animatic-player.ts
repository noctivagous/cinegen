import { html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import { previsSelectionState, storyboardFrames, setPrevisSelectionState } from '@/data/project-data';
import {
  estimateProjectRuntimeSeconds,
  formatPrevisDuration,
  getFrameDurationSeconds,
  groupStoryboardFramesByShot,
} from '@/workspace/shot-frame-bridge';

type FlatFrame = {
  id: number;
  label: string;
  scene: string;
  shotId?: number;
  scriptLink?: string;
  imageUrl?: string;
};

@customElement('cinegen-storyboard-animatic-player')
export class CinegenStoryboardAnimaticPlayer extends CgLightElement {
  @property({ type: Boolean }) noScrubber = false;

  @state() private _index = 0;

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add('previs-animatic-player');
    window.addEventListener('previs-selection-changed', this._onExternalSelection);
    window.addEventListener('storyboard-frames-changed', this._onExternalSelection);
    window.addEventListener('previs-timing-changed', this._onExternalSelection);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('previs-selection-changed', this._onExternalSelection);
    window.removeEventListener('storyboard-frames-changed', this._onExternalSelection);
    window.removeEventListener('previs-timing-changed', this._onExternalSelection);
  }

  private _onExternalSelection = (): void => {
    const frames = this._frames();
    if (!frames.length) {
      this._index = 0;
      return;
    }
    const selected = previsSelectionState.frameId;
    if (selected == null) return;
    const idx = frames.findIndex((frame) => frame.id === selected);
    if (idx >= 0) this._index = idx;
    this.requestUpdate();
  };

  private _frames(): FlatFrame[] {
    const grouped = groupStoryboardFramesByShot();
    const ordered = grouped.flatMap((group) => group.frames);
    if (ordered.length) {
      return ordered.map((frame) => ({
        id: frame.id,
        label: frame.label,
        scene: frame.scene,
        shotId: frame.shotId,
        scriptLink: frame.scriptLink,
        imageUrl: frame.imageUrl,
      }));
    }
    return (storyboardFrames as FlatFrame[]).map((frame) => ({ ...frame }));
  }

  private _seek(index: number): void {
    const frames = this._frames();
    if (!frames.length) return;
    const clamped = Math.min(frames.length - 1, Math.max(0, index));
    this._index = clamped;
    const frame = frames[clamped];
    window.selectStoryboardFrameById?.(frame.id);
    setPrevisSelectionState({
      sceneId: `scene${String(frame.scene || '1').padStart(2, '0')}`,
      shotId: frame.shotId ?? null,
      frameId: frame.id,
      timelineItemId: `frame-${frame.id}`,
    });
    if (frame.scriptLink) window.highlightScriptForFrame?.(frame);
    this.requestUpdate();
  }

  scrubToFrame(frameId: number): void {
    const frames = this._frames();
    const idx = frames.findIndex((f) => f.id === frameId);
    if (idx >= 0) {
      this._index = idx;
      this.requestUpdate();
    }
  }

  render() {
    const frames = this._frames();
    const active = frames[this._index];
    const total = estimateProjectRuntimeSeconds();
    const currentSeconds = frames
      .slice(0, this._index + 1)
      .reduce((acc, frame) => acc + getFrameDurationSeconds(frame as any), 0);

    return html`
      <div class="previs-player-header">
        <div class="previs-player-title">Storyboard Video Player (Previs)</div>
        <div class="previs-player-runtime">Estimated runtime ${formatPrevisDuration(total || 1)}</div>
      </div>
      <div class="previs-player-stage">
        ${active?.imageUrl
          ? html`<img src=${active.imageUrl} alt=${active.label} class="previs-player-image" />`
          : html`<div class="previs-player-placeholder">No frame image selected</div>`}
      </div>
      <div class="previs-player-controls">
        <button class="toolbar-btn" @click=${() => this._seek(this._index - 1)} ?disabled=${this._index <= 0}>
          <i class="fa-solid fa-backward-step"></i>
        </button>
        ${this.noScrubber
          ? ''
          : html`<input
              class="previs-player-scrubber"
              type="range"
              min="0"
              max=${String(Math.max(0, frames.length - 1))}
              .value=${String(this._index)}
              @input=${(event: Event) =>
                this._seek(parseInt((event.target as HTMLInputElement).value || '0', 10))}
            />`}
        <button
          class="toolbar-btn"
          @click=${() => this._seek(this._index + 1)}
          ?disabled=${this._index >= frames.length - 1}
        >
          <i class="fa-solid fa-forward-step"></i>
        </button>
      </div>
      <div class="previs-player-meta">
        <span>${active ? `${active.label} (Frame ${active.id})` : 'No frame selected'}</span>
        <span>${formatPrevisDuration(currentSeconds || 1)}</span>
      </div>
    `;
  }
}

