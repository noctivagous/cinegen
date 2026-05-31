import { repeat } from 'lit/directives/repeat.js';
import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import { previsSelectionState, setPrevisSelectionState, timelineClips } from '@/data/project-data';
import { openModal } from '@/services/modal-manager';
import { escHtml } from '@/utils/html';
import { buildPrevisTimelineTracks, formatPrevisDuration, type PrevisTimelineItem } from '@/workspace/shot-frame-bridge';

export type TimelineClip = {
  id: number;
  scene: string;
  label: string;
  duration: string;
  durationSeconds?: number;
  frameId?: number;
  shotId?: number;
  track?: string;
};

export type CustomTrackDef = {
  key: string;
  title: string;
  icon: string;
};

const BASE_PX_PER_SECOND = 18;

const CUSTOM_TRACK_TYPES: CustomTrackDef[] = [
  { key: 'vfx', title: 'VFX', icon: 'fa-wand-magic-sparkles' },
  { key: 'adr', title: 'ADR', icon: 'fa-microphone' },
  { key: 'foley', title: 'Foley', icon: 'fa-shoe-prints' },
  { key: 'notes', title: 'Notes', icon: 'fa-note-sticky' },
  { key: 'custom', title: 'Custom', icon: 'fa-plus' },
];

let _customTracks: CustomTrackDef[] = [];

@customElement('cinegen-timeline')
export class CinegenTimeline extends CgLightElement {
  @state() private _dragging = false;
  @state() private _isPlaying = false;
  @state() private _showAddTrackMenu = false;

  private _zoom = 1;
  private _pxPerSecond = BASE_PX_PER_SECOND;
  private _currentTimeSeconds = 0;
  private _previewTimeSeconds: number | null = null;
  private _playbackStartTime = 0;
  private _playbackStartSeconds = 0;
  private _playbackRaf = 0;

  connectedCallback(): void {
    if (!this.id) this.id = 'timeline-track';
    this.classList.add('timeline-track');
    super.connectedCallback();
    window.addEventListener('previs-selection-changed', this._onExternalUpdate);
    window.addEventListener('previs-timing-changed', this._onExternalUpdate);
    window.addEventListener('storyboard-frames-changed', this._onExternalUpdate);
    this.addEventListener('mousedown', this._onMouseDown);
    this.addEventListener('mousemove', this._onMouseMove);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('previs-selection-changed', this._onExternalUpdate);
    window.removeEventListener('previs-timing-changed', this._onExternalUpdate);
    window.removeEventListener('storyboard-frames-changed', this._onExternalUpdate);
    this.removeEventListener('mousedown', this._onMouseDown);
    this.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mouseup', this._onMouseUp);
  }

  private _onExternalUpdate = (): void => {
    this.refresh();
  };

  refresh(): void {
    this.requestUpdate();
    this._syncDurationLabel();
  }

  private _syncDurationLabel(): void {
    const el = document.getElementById('timeline-duration');
    const tracks = buildPrevisTimelineTracks();
    if (el) el.textContent = formatPrevisDuration(tracks.totalRuntimeSeconds || 1);
  }

  setZoom(value: number): void {
    this._zoom = Math.max(0.25, Math.min(4, value));
    this._pxPerSecond = BASE_PX_PER_SECOND * this._zoom;
    this._updateZoomStyle();
    this.requestUpdate();
  }

  private _updateZoomStyle(): void {
    const tracks = buildPrevisTimelineTracks();
    const totalSeconds = Math.max(1, tracks.totalRuntimeSeconds);
    this.style.setProperty('--px-per-second', `${this._pxPerSecond}px`);
    this.style.setProperty('--timeline-duration-seconds', String(totalSeconds));
    const labelWidth = this._isDockMode() ? 112 : 120;
    const laneWidth = totalSeconds * this._pxPerSecond;
    const minWidth = Math.max(900, laneWidth + labelWidth + 32);
    this.style.minWidth = `${minWidth}px`;
  }

  private _contentLane(): HTMLElement | null {
    return this.renderRoot.querySelector(
      '.timeline-track-row--storyboard .timeline-track-lane'
    ) as HTMLElement | null;
  }

  private _isDockMode(): boolean {
    return this.getAttribute('data-mode') === 'dock';
  }

  private _clipSurfaceClass(): string {
    return this._isDockMode()
      ? 'toolbar-btn--finish-matte toolbar-btn--relief-protruded toolbar-btn--shape-soft'
      : '';
  }

  private _selectItem(item: PrevisTimelineItem): void {
    this._currentTimeSeconds = item.startSeconds;
    setPrevisSelectionState({
      sceneId: item.sceneId,
      shotId: item.shotId ?? null,
      frameId: item.frameId ?? null,
      timelineItemId: item.id,
    });
    if (item.frameId != null) {
      window.selectStoryboardFrameById?.(item.frameId);
    }
    this.requestUpdate();
  }

  private _renderRuler(totalRuntimeSeconds: number) {
    const ticks = [];
    let minor = 1;
    let major = 5;
    if (totalRuntimeSeconds > 180) { minor = 5; major = 15; }
    else if (totalRuntimeSeconds > 60) { minor = 2; major = 10; }

    for (let t = 0; t <= totalRuntimeSeconds; t += minor) {
      const isMajor = t % major === 0;
      ticks.push(html`
        <div
          class="timeline-ruler-tick ${isMajor ? 'is-major' : ''}"
          style="left: calc(var(--px-per-second, 18px) * ${t})"
        >
          ${isMajor ? html`<span class="timeline-ruler-label">${formatPrevisDuration(t)}</span>` : ''}
        </div>
      `);
    }

    return html`
      <div class="timeline-track-row timeline-track-row--ruler">
        <div class="timeline-track-label"></div>
        <div class="timeline-track-lane timeline-ruler-lane">
          ${ticks}
        </div>
      </div>
    `;
  }

  private _renderTrackRow(
    key: 'script' | 'dialogue' | 'storyboard' | 'sfx' | 'music',
    title: string,
    icon: string,
    items: PrevisTimelineItem[]
  ) {
    const surface = this._clipSurfaceClass();
    const dock = this._isDockMode();
    return html`
      <div class="timeline-track-row timeline-track-row--${key}">
        <div class="timeline-track-label ${surface}">
          <i class="fa-solid ${icon}" style="margin-right:6px;opacity:0.7;"></i>${title}
        </div>
        <div class="timeline-track-lane">
          ${repeat(
            items,
            (item) => item.id,
            (item) => {
              const duration = formatPrevisDuration(item.durationSeconds);
              return html`
                <button
                  class="timeline-clip ${surface} ${previsSelectionState.timelineItemId === item.id ? 'is-selected' : ''}"
                  style="--clip-start-seconds:${item.startSeconds};--clip-seconds:${item.durationSeconds}"
                  data-duration=${duration}
                  @click=${() => this._selectItem(item)}
                  title=${`${item.label} (${duration})`}
                >
                  <span class="timeline-clip-label">${escHtml(item.label)}</span>
                  ${dock ? html`<span class="timeline-clip-duration">${duration}</span>` : ''}
                </button>
              `;
            }
          )}
        </div>
      </div>
    `;
  }

  private _getLaneBounds(): { left: number; width: number } | null {
    const lane = this._contentLane();
    if (!lane) return null;
    const rect = lane.getBoundingClientRect();
    return { left: rect.left, width: rect.width };
  }

  private _timeFromMouseX(clientX: number): number {
    const bounds = this._getLaneBounds();
    if (!bounds) return 0;
    const relativeX = clientX - bounds.left;
    const tracks = buildPrevisTimelineTracks();
    const total = tracks.totalRuntimeSeconds || 1;
    const time = relativeX / this._pxPerSecond;
    return Math.max(0, Math.min(total, time));
  }

  private _frameAtTime(timeSeconds: number): PrevisTimelineItem | null {
    const tracks = buildPrevisTimelineTracks();
    const storyboard = tracks.storyboard;
    let item = storyboard.find((i) => i.startSeconds <= timeSeconds && timeSeconds < i.endSeconds);
    if (!item && storyboard.length) {
      item = storyboard.reduce((closest, current) =>
        Math.abs(current.startSeconds - timeSeconds) < Math.abs(closest.startSeconds - timeSeconds)
          ? current
          : closest
      );
    }
    return item ?? null;
  }

  private _scrubToTime(timeSeconds: number): void {
    const tracks = buildPrevisTimelineTracks();
    const clamped = Math.max(0, Math.min(tracks.totalRuntimeSeconds || 1, timeSeconds));
    this._currentTimeSeconds = clamped;

    const item = this._frameAtTime(clamped);
    if (item?.frameId != null) {
      const players = document.querySelectorAll('cinegen-storyboard-animatic-player');
      players.forEach((p) => {
        (p as any).scrubToFrame?.(item.frameId);
      });
    }

    window.dispatchEvent(new CustomEvent('previs-time-updated', {
      detail: { timeSeconds: clamped },
    }));

    this._updatePlayheadPosition();
  }

  private _updatePlayheadPosition(): void {
    const playhead = this.renderRoot.querySelector('.timeline-playhead') as HTMLElement | null;
    const preview = this.renderRoot.querySelector('.timeline-playhead-preview') as HTMLElement | null;
    const lane = this._contentLane();
    if (!playhead || !lane) return;

    const laneRect = lane.getBoundingClientRect();
    const trackRect = this.getBoundingClientRect();
    const laneOffset = laneRect.left - trackRect.left;

    playhead.style.left = `${laneOffset + this._currentTimeSeconds * this._pxPerSecond}px`;

    if (preview) {
      if (this._previewTimeSeconds != null) {
        preview.style.left = `${laneOffset + this._previewTimeSeconds * this._pxPerSecond}px`;
        preview.style.opacity = '1';
      } else {
        preview.style.opacity = '0';
      }
    }
  }

  private _onMouseMove = (e: MouseEvent): void => {
    if (!this._dragging) {
      this._previewTimeSeconds = this._timeFromMouseX(e.clientX);
    } else {
      this._previewTimeSeconds = null;
      const time = this._timeFromMouseX(e.clientX);
      this._scrubToTime(time);
    }
    this._updatePlayheadPosition();
  };

  private _onMouseDown = (e: MouseEvent): void => {
    this._dragging = true;
    this._previewTimeSeconds = null;
    const time = this._timeFromMouseX(e.clientX);
    this._scrubToTime(time);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mouseup', this._onMouseUp);
  };

  private _onMouseUp = (): void => {
    if (this._dragging) {
      this._dragging = false;
      this._previewTimeSeconds = null;
      const item = this._frameAtTime(this._currentTimeSeconds);
      if (item) {
        setPrevisSelectionState({
          sceneId: item.sceneId,
          shotId: item.shotId ?? null,
          frameId: item.frameId ?? null,
          timelineItemId: item.id,
        });
        if (item.frameId != null) {
          window.selectStoryboardFrameById?.(item.frameId);
        }
      }
      this._updatePlayheadPosition();
    }
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mouseup', this._onMouseUp);
  };

  togglePlayback(): void {
    if (this._isPlaying) {
      this._pause();
    } else {
      this._play();
    }
  }

  private _play(): void {
    this._isPlaying = true;
    this._playbackStartTime = performance.now();
    this._playbackStartSeconds = this._currentTimeSeconds;
    this._advancePlayback();
  }

  private _pause(): void {
    this._isPlaying = false;
    if (this._playbackRaf) {
      cancelAnimationFrame(this._playbackRaf);
      this._playbackRaf = 0;
    }
  }

  private _advancePlayback = (): void => {
    if (!this._isPlaying) return;
    const elapsed = (performance.now() - this._playbackStartTime) / 1000;
    const tracks = buildPrevisTimelineTracks();
    const total = tracks.totalRuntimeSeconds || 1;
    const next = this._playbackStartSeconds + elapsed;
    if (next >= total) {
      this._currentTimeSeconds = total;
      this._isPlaying = false;
    } else {
      this._currentTimeSeconds = next;
      this._playbackRaf = requestAnimationFrame(this._advancePlayback);
    }
    this._scrubToTime(this._currentTimeSeconds);
  };

  stepForward(): void {
    this._pause();
    this._scrubToTime(this._currentTimeSeconds + 1);
  }

  stepBackward(): void {
    this._pause();
    this._scrubToTime(this._currentTimeSeconds - 1);
  }

  getCurrentTimeSeconds(): number {
    return this._currentTimeSeconds;
  }

  private _addCustomTrack(def: CustomTrackDef): void {
    _customTracks.push(def);
    this._showAddTrackMenu = false;
    this.requestUpdate();
  }

  render() {
    void timelineClips;
    const tracks = buildPrevisTimelineTracks();
    return html`
      ${this._renderRuler(tracks.totalRuntimeSeconds || 1)}
      ${this._renderTrackRow('script', 'Script Track', 'fa-file-lines', tracks.script)}
      ${this._renderTrackRow('dialogue', 'Dialogue Track', 'fa-comments', tracks.dialogue)}
      ${this._renderTrackRow('storyboard', 'Storyboard Frame Track', 'fa-film', tracks.storyboard)}
      <div class="timeline-sound-group" @dblclick=${this._openSoundEditor}>
        <div class="timeline-sound-group-label">Sound</div>
        <div class="timeline-sound-group-tracks">
          ${this._renderTrackRow('sfx', 'Sound Design / SFX', 'fa-volume-high', tracks.sfx)}
          ${this._renderTrackRow('music', 'Music / Atmos', 'fa-music', tracks.music)}
        </div>
      </div>
      ${_customTracks.map((ct) => this._renderTrackRow(
        ct.key as 'script' | 'dialogue' | 'storyboard' | 'sfx' | 'music',
        ct.title,
        ct.icon,
        tracks.custom
      ))}
      <div class="timeline-add-track-row">
        <button
          class="toolbar-btn timeline-add-track-btn"
          @click=${() => { this._showAddTrackMenu = !this._showAddTrackMenu; }}
        >
          <i class="fa-solid fa-plus"></i> Add Track
        </button>
        ${this._showAddTrackMenu ? html`
          <div class="timeline-add-track-menu">
            ${CUSTOM_TRACK_TYPES.map((t) => html`
              <button class="toolbar-btn" @click=${() => this._addCustomTrack(t)}>
                <i class="fa-solid ${t.icon}"></i> ${t.title}
              </button>
            `)}
          </div>
        ` : ''}
      </div>
      <div class="timeline-playhead">
        <div class="timeline-playhead-head"></div>
      </div>
      <div class="timeline-playhead-preview"></div>
    `;
  }

  private _openSoundEditor(): void {
    openModal('sound-editor-modal');
  }

  updated(): void {
    this._syncDurationLabel();
    this._updateZoomStyle();
    this._updatePlayheadPosition();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cinegen-timeline': CinegenTimeline;
  }
}
