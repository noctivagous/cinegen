import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import { buildPrevisTimelineTracks, formatPrevisDuration } from '@/workspace/shot-frame-bridge';

@customElement('cinegen-sound-editor-modal')
export class CinegenSoundEditorModal extends CgLightElement {
  @state() private _selectedTrack: 'sfx' | 'music' | 'both' = 'both';

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add('sound-editor-modal-body');
  }

  private _renderWaveformLane(title: string, items: { startSeconds: number; durationSeconds: number; label: string }[]): unknown {
    const tracks = buildPrevisTimelineTracks();
    const total = tracks.totalRuntimeSeconds || 1;
    const bars = 60;
    return html`
      <div class="sound-editor-lane">
        <div class="sound-editor-lane-header">${title}</div>
        <div class="sound-editor-waveform">
          ${Array.from({ length: bars }).map((_, i) => {
            const t = (i / bars) * total;
            const active = items.some(
              (it) => t >= it.startSeconds && t < it.startSeconds + it.durationSeconds
            );
            const height = active ? 20 + Math.random() * 50 : 4 + Math.random() * 8;
            return html`
              <div
                class="sound-editor-waveform-bar ${active ? 'is-active' : ''}"
                style="height:${height}%"
              ></div>
            `;
          })}
        </div>
        <div class="sound-editor-lane-labels">
          ${items.map((it) => html`
            <span class="sound-editor-clip-label" style="left:${(it.startSeconds / total) * 100}%">
              ${it.label}
            </span>
          `)}
        </div>
      </div>
    `;
  }

  render() {
    const tracks = buildPrevisTimelineTracks();
    return html`
      <div class="sound-editor-toolbar">
        <span class="sound-editor-title">Sound Editor Timeline</span>
        <span class="sound-editor-runtime">Total: ${formatPrevisDuration(tracks.totalRuntimeSeconds || 1)}</span>
        <div class="sound-editor-track-tabs">
          <button
            class="toolbar-btn ${this._selectedTrack === 'both' ? 'active' : ''}"
            @click=${() => { this._selectedTrack = 'both'; }}
          >All</button>
          <button
            class="toolbar-btn ${this._selectedTrack === 'sfx' ? 'active' : ''}"
            @click=${() => { this._selectedTrack = 'sfx'; }}
          >SFX</button>
          <button
            class="toolbar-btn ${this._selectedTrack === 'music' ? 'active' : ''}"
            @click=${() => { this._selectedTrack = 'music'; }}
          >Music</button>
        </div>
      </div>
      <div class="sound-editor-timeline">
        ${this._selectedTrack !== 'music'
          ? this._renderWaveformLane('Sound Design / SFX', tracks.sfx)
          : ''}
        ${this._selectedTrack !== 'sfx'
          ? this._renderWaveformLane('Music / Atmos', tracks.music)
          : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cinegen-sound-editor-modal': CinegenSoundEditorModal;
  }
}
