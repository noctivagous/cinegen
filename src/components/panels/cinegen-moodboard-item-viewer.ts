import { html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import type { MoodBoardItem } from '@/data/project-data';

@customElement('cinegen-moodboard-item-viewer')
export class CinegenMoodboardItemViewer extends CgLightElement {
  @property({ attribute: false })
  item: MoodBoardItem | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add('moodboard-item-viewer');
  }

  render() {
    const item = this.item;
    if (!item) {
      return html`<div class="moodboard-item-viewer-empty">No item selected.</div>`;
    }

    return html`
      <div class="moodboard-item-viewer-meta">
        <span class="moodboard-item-viewer-label">${item.label}</span>
        <span class="moodboard-item-viewer-type">${item.type}</span>
        ${item.notes ? html`<span class="moodboard-item-viewer-notes">${item.notes}</span>` : nothing}
      </div>
      <div class="moodboard-item-viewer-stage">
        ${this._renderMedia(item)}
      </div>
    `;
  }

  private _renderMedia(item: MoodBoardItem) {
    switch (item.type) {
      case 'image':
        return html`
          <img
            class="moodboard-item-viewer-image"
            src=${item.source}
            alt=${item.label}
            @error=${(e: Event) => {
              const img = e.target as HTMLImageElement;
              img.replaceWith(
                Object.assign(document.createElement('div'), {
                  className: 'moodboard-item-viewer-fallback',
                  textContent: 'Image could not be loaded.',
                })
              );
            }}
          />
        `;
      case 'video':
        return html`
          <video
            class="moodboard-item-viewer-video"
            src=${item.source}
            controls
            playsinline
          ></video>
        `;
      case 'sound':
        return html`
          <div class="moodboard-item-viewer-audio-wrap">
            <i class="fa-solid fa-music moodboard-item-viewer-audio-icon" aria-hidden="true"></i>
            <audio class="moodboard-item-viewer-audio" src=${item.source} controls></audio>
          </div>
        `;
      default:
        return html`
          <pre class="moodboard-item-viewer-text">${item.source}</pre>
        `;
    }
  }
}
