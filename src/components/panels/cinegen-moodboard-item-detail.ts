import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import { moodBoards, updateMoodBoardItem, removeMoodBoardItem, toggleMoodBoardItemActive } from '@/data/project-data';
import type { MoodBoardItem } from '@/data/project-data';
import { closeModal } from '@/services/modal-manager';

@customElement('cinegen-moodboard-item-detail')
export class CinegenMoodboardItemDetail extends CgLightElement {
  @property({ type: String, attribute: 'board-id' }) boardId = '';
  @property({ type: String, attribute: 'item-id' }) itemId = '';

  @state() private _editLabel = '';
  @state() private _editSource = '';
  @state() private _editNotes = '';
  @state() private _editType: MoodBoardItem['type'] = 'image';

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add('hidden', 'flex', 'flex-col', 'h-full');
    this.id = 'view-moodboard-detail';
    this._loadItem();
  }

  updated(changed: Map<string, unknown>): void {
    if (changed.has('boardId') || changed.has('itemId')) {
      this._loadItem();
    }
  }

  loadItem(boardId: string, itemId: string): void {
    this.boardId = boardId;
    this.itemId = itemId;
    this._loadItem();
  }

  private _getItem(): MoodBoardItem | undefined {
    const board = moodBoards.find((b) => b.id === this.boardId);
    return board?.items.find((i) => i.id === this.itemId);
  }

  private _loadItem(): void {
    const item = this._getItem();
    if (item) {
      this._editLabel = item.label;
      this._editSource = item.source;
      this._editNotes = item.notes;
      this._editType = item.type;
      this.requestUpdate();
    }
  }

  private _handleSave(): void {
    updateMoodBoardItem(this.boardId, this.itemId, {
      label: this._editLabel,
      source: this._editSource,
      notes: this._editNotes,
      type: this._editType,
    });
  }

  private _handleDelete(): void {
    removeMoodBoardItem(this.boardId, this.itemId);
    closeModal('moodboard-item-detail');
  }

  private _handleToggleActive(): void {
    toggleMoodBoardItemActive(this.boardId, this.itemId);
    this.requestUpdate();
  }

  render() {
    const item = this._getItem();
    if (!item) {
      return html`<div class="p-4 text-xs" style="color:var(--text-dim);">Item not found.</div>`;
    }

    return html`
      <div class="flex flex-col gap-3 p-4" style="font-size:12px;">
        ${item.type === 'image'
          ? html`
            <div class="flex items-center justify-center rounded overflow-hidden" style="max-height:200px;background:var(--bg-inset);">
              <img src=${item.source} alt=${item.label} style="max-width:100%;max-height:200px;object-fit:contain;" @error=${(e: Event) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
          ` : nothing
        }

        <div class="flex flex-col gap-1">
          <label style="color:var(--text-dim);font-size:10px;font-weight:600;">LABEL</label>
          <input class="cg-field" type="text" .value=${this._editLabel} @input=${(e: Event) => { this._editLabel = (e.target as HTMLInputElement).value; }} />
        </div>

        <div class="flex flex-col gap-1">
          <label style="color:var(--text-dim);font-size:10px;font-weight:600;">TYPE</label>
          <select class="cg-field" .value=${this._editType} @change=${(e: Event) => { this._editType = (e.target as HTMLSelectElement).value as MoodBoardItem['type']; }}>
            <option value="image">Image</option>
            <option value="video">Video</option>
            <option value="sound">Sound</option>
            <option value="text">Text</option>
          </select>
        </div>

        <div class="flex flex-col gap-1">
          <label style="color:var(--text-dim);font-size:10px;font-weight:600;">
            ${this._editType === 'text' ? 'CONTENT' : 'SOURCE URL'}
          </label>
          ${this._editType === 'text'
            ? html`<textarea class="cg-field" style="min-height:80px;" .value=${this._editSource} @input=${(e: Event) => { this._editSource = (e.target as HTMLTextAreaElement).value; }}></textarea>`
            : html`<input class="cg-field" type="text" .value=${this._editSource} @input=${(e: Event) => { this._editSource = (e.target as HTMLInputElement).value; }} />`
          }
        </div>

        <div class="flex flex-col gap-1">
          <label style="color:var(--text-dim);font-size:10px;font-weight:600;">NOTES</label>
          <textarea class="cg-field" style="min-height:60px;" .value=${this._editNotes} @input=${(e: Event) => { this._editNotes = (e.target as HTMLTextAreaElement).value; }}></textarea>
        </div>

        <div class="flex gap-2 mt-2">
          <button class="toolbar-btn btn-ai text-xs" @click=${this._handleSave}>
            <i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Save
          </button>
          <button class="toolbar-btn text-xs" @click=${this._handleToggleActive}>
            <i class="fa-solid ${item.active ? 'fa-eye-slash' : 'fa-eye'}" aria-hidden="true"></i>
            ${item.active ? 'Deactivate' : 'Activate'}
          </button>
          <button class="toolbar-btn text-xs" style="color:var(--accent-orange);" @click=${this._handleDelete}>
            <i class="fa-solid fa-trash" aria-hidden="true"></i> Delete
          </button>
        </div>
      </div>
    `;
  }
}
