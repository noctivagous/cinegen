import { html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { CgLightElement } from '@/components/lit-base';
import {
  moodBoards,
  type MoodBoardItem,
  type MoodBoardItemType,
  addMoodBoardItem,
  removeMoodBoardItem,
  toggleMoodBoardItemActive,
} from '@/data/project-data';
import {
  queueMoodBoardGeneration,
  getGenerationPromptPlaceholder,
  getGenerateButtonLabel,
} from '@/moodboards/moodboard-generation';
import { openMoodBoardItemDetail } from '@/toolbar/toolbar-modals-service';
import { promptTextCG } from '@/utils/prompt-text-cg';

@customElement('cinegen-moodboards-panel')
export class CinegenMoodboardsPanel extends CgLightElement {
  @property({ type: String }) boardId = '';
  @property({ type: String }) typeFilter = 'all';

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add('moodboards-panel', 'flex', 'flex-col', 'min-h-0');
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

  private _notifyItemsChanged(): void {
    this.dispatchEvent(new CustomEvent('moodboard-items-changed', { bubbles: true }));
    this.requestUpdate();
  }

  private _openItemViewer(item: MoodBoardItem): void {
    this.dispatchEvent(
      new CustomEvent('moodboard-item-view', {
        bubbles: true,
        composed: true,
        detail: { boardId: this.boardId, itemId: item.id },
      })
    );
  }

  private async _resolveGenerateType(): Promise<MoodBoardItemType | null> {
    if (this.typeFilter !== 'all') {
      return this.typeFilter as MoodBoardItemType;
    }
    const typeRaw = (
      await promptTextCG({
        title: 'Generate',
        label: 'Media type (image, video, sound, text)',
        defaultValue: 'image',
        okLabel: 'Continue',
        iconClass: 'fa-wand-magic-sparkles',
      })
    )?.trim().toLowerCase();
    if (!typeRaw) return null;
    return (['image', 'video', 'sound', 'text'] as const).includes(typeRaw as MoodBoardItemType)
      ? (typeRaw as MoodBoardItemType)
      : 'image';
  }

  private async _handleGenerate(): Promise<void> {
    const type = await this._resolveGenerateType();
    if (!type) return;
    const promptText = await promptTextCG({
      title: getGenerateButtonLabel(type).replace(/\.\.\.$/, ''),
      label: getGenerationPromptPlaceholder(type),
      okLabel: 'Generate',
      iconClass: 'fa-wand-magic-sparkles',
    });
    if (!promptText) return;
    queueMoodBoardGeneration({ boardId: this.boardId, type, prompt: promptText });
    this._notifyItemsChanged();
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
    this._notifyItemsChanged();
  }

  render() {
    const items = this._getItems();
    const generateLabel = getGenerateButtonLabel(this.typeFilter);

    return html`
      <div class="moodboards-panel-toolbar flex flex-wrap gap-1 flex-shrink-0">
        <button
          type="button"
          class="toolbar-btn btn-ai text-xs"
          @click=${() => void this._handleGenerate()}
        >
          <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
          ${generateLabel}
        </button>
        <button type="button" class="toolbar-btn text-xs" @click=${() => this._handleAdd()}>
          <i class="fa-solid fa-plus" aria-hidden="true"></i> Add Item
        </button>
      </div>
      <div class="moodboards-items-grid">
        ${repeat(
          items,
          (item) => item.id,
          (item) => html`
            <div
              class="moodboard-grid-card flex flex-col rounded overflow-hidden cursor-pointer"
              style="border:1px solid var(--border-light);background:var(--bg-panel);${item.active ? '' : 'opacity:0.5;'}"
              @dblclick=${(e: Event) => {
                e.preventDefault();
                e.stopPropagation();
                this._openItemViewer(item);
              }}
            >
              <div
                class="flex items-center justify-center moodboard-grid-card-thumb"
              >
                ${item.type === 'image'
                  ? html`<img src=${item.source} alt=${item.label} @error=${(e: Event) => { (e.target as HTMLImageElement).style.display = 'none'; }} />`
                  : item.type === 'video'
                    ? html`<div class="text-center" style="color:var(--text-dim);"><i class="fa-solid fa-video" style="font-size:32px;"></i></div>`
                    : item.type === 'sound'
                      ? html`<div class="text-center" style="color:var(--text-dim);"><i class="fa-solid fa-music" style="font-size:32px;"></i></div>`
                      : html`<div class="text-center p-2 text-xs" style="color:var(--text-dim);overflow:hidden;max-height:100%;">${item.source}</div>`
                }
              </div>
              <div class="flex flex-col p-2 gap-1 moodboard-grid-card-meta">
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
      </div>
    `;
  }
}
