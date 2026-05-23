import { repeat } from 'lit/directives/repeat.js';
import { html, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import { timelineClips } from '@/data/project-data';
import { escHtml } from '@/utils/html';

export type TimelineClip = {
  id: number;
  scene: string;
  label: string;
  duration: string;
};

function totalDurationSeconds(clips: TimelineClip[]): number {
  return clips.reduce((acc, c) => acc + parseInt(c.duration, 10) || 0, 0);
}

@customElement('cinegen-timeline')
export class CinegenTimeline extends CgLightElement {
  connectedCallback(): void {
    if (!this.id) this.id = 'timeline-track';
    this.classList.add('timeline-track');
    super.connectedCallback();
  }

  refresh(): void {
    this.requestUpdate();
    this._syncDurationLabel();
  }

  private _syncDurationLabel(): void {
    const el = document.getElementById('timeline-duration');
    if (el) el.textContent = `${totalDurationSeconds(timelineClips as TimelineClip[])}s`;
  }

  private _onDragStart(e: DragEvent, clip: TimelineClip): void {
    e.dataTransfer?.setData('text', clip.label);
    window.dragStart?.(e);
  }

  render() {
    if (!timelineClips.length) return nothing;
    return repeat(
      timelineClips as TimelineClip[],
      (c) => String(c.id),
      (clip) => html`
        <div
          class="timeline-clip"
          data-duration=${clip.duration}
          draggable="true"
          @dragstart=${(e: DragEvent) => this._onDragStart(e, clip)}
        >
          ${escHtml(clip.label)}<br />
          <span class="text-[10px] opacity-75">SC${escHtml(clip.scene)}</span>
        </div>
      `
    );
  }

  updated(): void {
    this._syncDurationLabel();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cinegen-timeline': CinegenTimeline;
  }
}
