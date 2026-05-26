import { html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import { moodBoards, type MoodBoardItem, addMoodBoardItem, removeMoodBoardItem, toggleMoodBoardItemActive } from '@/data/project-data';
import { openMoodBoardItemDetail } from '@/toolbar/toolbar-modals-service';

const COLUMNS = [
  { key: 'image' as const, label: 'Images', icon: 'fa-image' },
  { key: 'video' as const, label: 'Video', icon: 'fa-video' },
  { key: 'sound' as const, label: 'Sound', icon: 'fa-music' },
  { key: 'text' as const, label: 'Text', icon: 'fa-font' },
];

@customElement('cinegen-moodboards-kanban')
export class CinegenMoodboardsKanban extends CgLightElement {
  @property({ type: String }) boardId = '';
  @property({ type: String }) typeFilter = 'all';

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add('flex', 'gap-2', 'h-full');
  }

  private _itemsForColumn(type: MoodBoardItem['type']): MoodBoardItem[] {
    const board = moodBoards.find((b) => b.id === this.boardId);
    if (!board) return [];
    let items = board.items.filter((i) => i.type === type);
    if (this.typeFilter !== 'all') {
      items = items.filter((i) => i.type === this.typeFilter);
    }
    return [...items].sort((a, b) => a.order - b.order);
  }

  private _previewText(source: string, max = 120): string {
    const trimmed = source.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('data:')) return '';
    return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
  }

  private _renderItemPreview(item: MoodBoardItem) {
    switch (item.type) {
      case 'image':
        return html`
          <div class="moodboard-kanban-card-thumb">
            <img
              src=${item.source}
              alt=${item.label}
              @error=${(e: Event) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        `;
      case 'video':
        return html`
          <div class="moodboard-kanban-card-thumb moodboard-kanban-card-thumb--icon">
            <i class="fa-solid fa-video" aria-hidden="true"></i>
          </div>
        `;
      case 'sound':
        return html`
          <div class="moodboard-kanban-card-thumb moodboard-kanban-card-thumb--icon">
            <i class="fa-solid fa-music" aria-hidden="true"></i>
          </div>
        `;
      case 'text': {
        const excerpt = this._previewText(item.source);
        return excerpt
          ? html`<div class="moodboard-kanban-card-excerpt">${excerpt}</div>`
          : nothing;
      }
      default:
        return nothing;
    }
  }

  private _renderItemSubline(item: MoodBoardItem) {
    if (item.notes) {
      return html`<div class="mt-1 text-xs truncate" style="color:var(--text-dim);">${item.notes}</div>`;
    }
    if (item.type === 'text') return nothing;
    const hint = item.source.startsWith('blob:') ? 'Local media' : '';
    return hint
      ? html`<div class="mt-1 text-xs truncate" style="color:var(--text-dim);">${hint}</div>`
      : nothing;
  }

  private _handleAddToColumn(colType: MoodBoardItem['type']): void {
    const label = prompt(`New ${colType} item label:`);
    if (!label?.trim()) return;
    const source = prompt(colType === 'text' ? 'Text content:' : 'URL or path:');
    if (!source?.trim()) return;
    addMoodBoardItem(this.boardId, {
      type: colType,
      label: label.trim(),
      source: source.trim(),
      active: true,
      notes: '',
      order: this._itemsForColumn(colType).length,
      metadata: {},
    });
    this.requestUpdate();
  }

  render() {
    const visible = this.typeFilter === 'all'
      ? COLUMNS
      : COLUMNS.filter((c) => c.key === this.typeFilter);

    return html`
      ${visible.map((col) => html`
        <div class="flex-1 flex flex-col min-h-0 rounded" style="background:var(--bg-inset);border:1px solid var(--border-dark);">
          <div class="flex items-center gap-1 p-2 border-b" style="border-color:var(--border-dark);font-size:12px;font-weight:600;">
            <i class="fa-solid ${col.icon}" aria-hidden="true" style="color:var(--tree-section-moodboards);"></i>
            <span class="flex-1">${col.label}</span>
            <span class="text-xs" style="color:var(--text-dim);">${this._itemsForColumn(col.key).length}</span>
          </div>
          <div class="flex-1 overflow-auto p-1 flex flex-col gap-1">
            ${this._itemsForColumn(col.key).map((item) => html`
              <div
                class="rounded p-2 cursor-pointer"
                style="border:1px solid var(--border-light);background:var(--bg-panel);font-size:11px;${item.active ? '' : 'opacity:0.5;'}"
                @dblclick=${(e: Event) => {
                  e.preventDefault();
                  e.stopPropagation();
                  this.dispatchEvent(
                    new CustomEvent('moodboard-item-view', {
                      bubbles: true,
                      composed: true,
                      detail: { boardId: this.boardId, itemId: item.id },
                    })
                  );
                }}
              >
                ${this._renderItemPreview(item)}
                <div class="flex items-center gap-1">
                  <span class="flex-1 truncate">${item.label}</span>
                  <button
                    class="text-xs"
                    style="background:none;border:none;color:var(--text-dim);cursor:pointer;padding:2px;"
                    @click=${(e: Event) => { e.stopPropagation(); removeMoodBoardItem(this.boardId, item.id); this.requestUpdate(); }}
                    title="Remove"
                  >×</button>
                </div>
                ${this._renderItemSubline(item)}
                <div class="flex gap-1 mt-1">
                  <button
                    class="toolbar-btn text-xs"
                    style="padding:1px 4px;"
                    @click=${(e: Event) => { e.stopPropagation(); toggleMoodBoardItemActive(this.boardId, item.id); this.requestUpdate(); }}
                    title=${item.active ? 'Deactivate' : 'Activate'}
                  >
                    <i class="fa-solid ${item.active ? 'fa-eye' : 'fa-eye-slash'}" aria-hidden="true" style="font-size:9px;"></i>
                  </button>
                  <button
                    class="toolbar-btn text-xs"
                    style="padding:1px 4px;"
                    @click=${(e: Event) => { e.stopPropagation(); openMoodBoardItemDetail(this.boardId, item.id); }}
                    title="Edit"
                  >
                    <i class="fa-solid fa-pen" aria-hidden="true" style="font-size:9px;"></i>
                  </button>
                </div>
              </div>
            `)}
            <button
              class="toolbar-btn text-xs w-full mt-1"
              style="padding:4px;"
              @click=${() => this._handleAddToColumn(col.key)}
            >
              <i class="fa-solid fa-plus" aria-hidden="true"></i> Add
            </button>
          </div>
        </div>
      `)}
    `;
  }
}
