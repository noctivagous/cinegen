import { html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { CgLightElement } from '@/components/lit-base';
import { moodBoards, type MoodBoardItem, addMoodBoardItem, removeMoodBoardItem, toggleMoodBoardItemActive } from '@/data/project-data';
import { openMoodBoardItemDetail } from '@/toolbar/toolbar-modals-service';

@customElement('cinegen-moodboards-panel')
export class CinegenMoodboardsPanel extends CgLightElement {
  @property({ type: String }) boardId = '';
  @property({ type: String }) typeFilter = 'all';

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add('grid', 'gap-3');
    this.style.gridTemplateColumns = 'repeat(auto-fill, minmax(180px, 1fr))';
  }

  private _getItems(): MoodBoardItem[] {
    const board = moodBoards.find((b) => b.id === this.boardId);
    if (!board) return [];
    let items = board.items;
    if (this.typeFilter !== 'all') {
      items = items.filter((i) => i.type === this.typeFilter);
    }
    return [...items].sort((a, b) => a.order - b.order);
  }

  private _handleAdd(): void {
    const type = prompt('Item type (image, video, sound, text):');
    if (!type || !['image', 'video', 'sound', 'text'].includes(type)) return;
    const label = prompt('Item label:');
    if (!label?.trim()) return;
    const source = prompt(type === 'text' ? 'Text content:' : 'URL or path:');
    if (!source?.trim()) return;
    addMoodBoardItem(this.boardId, {
      type: type as MoodBoardItem['type'],
      label: label.trim(),
      source: source.trim(),
      active: true,
      notes: '',
      order: this._getItems().length,
      metadata: {},
    });
    this.requestUpdate();
  }

  render() {
    const items = this._getItems();

    return html`
      <button class="toolbar-btn btn-ai text-xs col-span-full mb-1" @click=${this._handleAdd}>
        <i class="fa-solid fa-plus" aria-hidden="true"></i> Add Item
      </button>
      ${repeat(
        items,
        (item) => item.id,
        (item) => html`
          <div
            class="flex flex-col rounded overflow-hidden cursor-pointer"
            style="border:1px solid var(--border-light);background:var(--bg-panel);${item.active ? '' : 'opacity:0.5;'}"
          >
            <div
              class="flex items-center justify-center"
              style="height:120px;background:var(--bg-inset);overflow:hidden;"
            >
              ${item.type === 'image'
                ? html`<img src=${item.source} alt=${item.label} style="width:100%;height:100%;object-fit:cover;" @error=${(e: Event) => { (e.target as HTMLImageElement).style.display = 'none'; }} />`
                : item.type === 'video'
                  ? html`<div class="text-center" style="color:var(--text-dim);"><i class="fa-solid fa-video" style="font-size:32px;"></i></div>`
                  : item.type === 'sound'
                    ? html`<div class="text-center" style="color:var(--text-dim);"><i class="fa-solid fa-music" style="font-size:32px;"></i></div>`
                    : html`<div class="text-center p-2 text-xs" style="color:var(--text-dim);overflow:hidden;max-height:100px;">${item.source}</div>`
              }
            </div>
            <div class="flex flex-col p-2 gap-1" style="font-size:11px;">
              <div class="flex items-center gap-1">
                <span class="flex-1 truncate font-medium">${item.label}</span>
                <span class="text-xs" style="color:var(--text-dim);text-transform:uppercase;">${item.type}</span>
              </div>
              ${item.notes ? html`<span class="text-xs" style="color:var(--text-dim);">${item.notes}</span>` : nothing}
              <div class="flex gap-1 mt-1">
                <button
                  class="toolbar-btn text-xs"
                  style="padding:2px 6px;"
                  @click=${(e: Event) => { e.stopPropagation(); toggleMoodBoardItemActive(this.boardId, item.id); this.requestUpdate(); }}
                  title=${item.active ? 'Deactivate' : 'Activate'}
                >
                  <i class="fa-solid ${item.active ? 'fa-eye' : 'fa-eye-slash'}" aria-hidden="true"></i>
                </button>
                <button
                  class="toolbar-btn text-xs"
                  style="padding:2px 6px;"
                  @click=${(e: Event) => { e.stopPropagation(); openMoodBoardItemDetail(this.boardId, item.id); }}
                  title="Edit item"
                >
                  <i class="fa-solid fa-pen" aria-hidden="true"></i>
                </button>
                <button
                  class="toolbar-btn text-xs"
                  style="padding:2px 6px;color:var(--accent-orange);"
                  @click=${(e: Event) => { e.stopPropagation(); removeMoodBoardItem(this.boardId, item.id); this.requestUpdate(); }}
                  title="Remove item"
                >
                  <i class="fa-solid fa-trash" aria-hidden="true"></i>
                </button>
              </div>
            </div>
          </div>
        `
      )}
    `;
  }
}
