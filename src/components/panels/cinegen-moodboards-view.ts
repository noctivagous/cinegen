import { html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { CgLightElement } from '@/components/lit-base';
import {
  moodBoards,
  activeMoodBoardId,
  addMoodBoard,
  removeMoodBoard,
  setActiveMoodBoard,
} from '@/data/project-data';
import type { MoodBoard, MoodBoardItemType } from '@/data/project-data';
import { queueMoodBoardGeneration, getGenerationPromptPlaceholder } from '@/moodboards/moodboard-generation';
import { promptTextCG } from '@/utils/prompt-text-cg';

const TYPE_TABS = [
  { value: 'all', label: 'All' },
  { value: 'image', label: 'Images' },
  { value: 'video', label: 'Video' },
  { value: 'sound', label: 'Sound' },
  { value: 'text', label: 'Text' },
];

@customElement('cinegen-moodboards-view')
export class CinegenMoodboardsView extends CgLightElement {
  @state() private _typeFilter = 'all';
  /** Bumps when mood board list/active id changes (module state is not @state). */
  @state() private _boardsRev = 0;

  private _onMoodboardNewBoard = (): void => {
    this._handleNewBoard();
  };

  private _onMoodboardQuickGenerate = (): void => {
    this._handleQuickGenerate();
  };

  connectedCallback(): void {
    super.connectedCallback();
    this.id = 'view-moodboards';
    this.classList.add('hidden', 'flex', 'flex-col', 'h-full');
    window.addEventListener('moodboard-new-board', this._onMoodboardNewBoard);
    window.addEventListener('moodboard-quick-generate', this._onMoodboardQuickGenerate);
  }

  disconnectedCallback(): void {
    window.removeEventListener('moodboard-new-board', this._onMoodboardNewBoard);
    window.removeEventListener('moodboard-quick-generate', this._onMoodboardQuickGenerate);
    super.disconnectedCallback();
  }

  private _getActiveBoard(): MoodBoard | undefined {
    return activeMoodBoardId ? moodBoards.find((b) => b.id === activeMoodBoardId) : undefined;
  }

  private _syncBoardsUi(): void {
    this._boardsRev += 1;
    window.refreshProjectTree?.();
  }

  private async _handleNewBoard(): Promise<void> {
    const name = await promptTextCG({
      title: 'New Mood Board',
      label: 'Board name',
      placeholder: 'e.g. Act 1 — tone & palette',
      okLabel: 'Create Board',
      iconClass: 'fa-images',
    });
    if (!name) return;
    const board = addMoodBoard(name);
    setActiveMoodBoard(board.id);
    this._syncBoardsUi();
  }

  private async _handleQuickGenerate(): Promise<void> {
    let board = this._getActiveBoard();
    if (!board) {
      board = addMoodBoard('Quick Board');
      setActiveMoodBoard(board.id);
      this._syncBoardsUi();
    }
    const typeRaw = (
      await promptTextCG({
        title: 'Quick Generate',
        label: 'Media type (image, video, sound, text)',
        defaultValue: 'image',
        okLabel: 'Continue',
        iconClass: 'fa-wand-magic-sparkles',
      })
    )?.trim().toLowerCase();
    const type = (['image', 'video', 'sound', 'text'] as const).includes(typeRaw as MoodBoardItemType)
      ? (typeRaw as MoodBoardItemType)
      : 'image';
    const promptText = await promptTextCG({
      title: 'Quick Generate',
      label: getGenerationPromptPlaceholder(type),
      okLabel: 'Generate',
      iconClass: 'fa-wand-magic-sparkles',
    });
    if (!promptText) return;
    queueMoodBoardGeneration({ boardId: board.id, type, prompt: promptText });
    this._syncBoardsUi();
  }

  private _handleDeleteBoard(id: string): void {
    removeMoodBoard(id);
    this._syncBoardsUi();
  }

  private _handleSelectBoard(id: string): void {
    setActiveMoodBoard(id);
    this._syncBoardsUi();
  }

  private _handleToggleView(): void {
    const board = this._getActiveBoard();
    if (!board) return;
    board.viewMode = board.viewMode === 'grid' ? 'kanban' : 'grid';
    this._syncBoardsUi();
  }

  render() {
    const activeBoard = this._getActiveBoard();

    return html`
      <div class="flex items-center gap-2 p-2 border-b" style="border-color:var(--border-dark);">
        <span style="font-weight:600;font-size:13px;">
          <i class="fa-solid fa-images" aria-hidden="true"></i> Mood Boards
        </span>
        <div class="flex-1"></div>
        ${activeBoard ? html`
          <button type="button" class="toolbar-btn text-xs" @click=${() => this._handleToggleView()}>
            <i class="fa-solid ${activeBoard.viewMode === 'grid' ? 'fa-list' : 'fa-table-cells'}" aria-hidden="true"></i>
            ${activeBoard.viewMode === 'grid' ? 'Kanban' : 'Grid'}
          </button>
        ` : nothing}
        <button type="button" class="toolbar-btn btn-ai text-xs" @click=${() => void this._handleNewBoard()}>
          <i class="fa-solid fa-plus" aria-hidden="true"></i> New Board
        </button>
      </div>

      <div class="flex gap-2 p-2" style="min-height:0;">
        <div class="flex flex-col gap-1" style="width:180px;min-width:180px;overflow-y:auto;border-right:1px solid var(--border-dark);padding-right:8px;">
          <span class="text-xs" style="color:var(--text-dim);font-weight:600;padding:4px 0;">BOARDS</span>
          ${moodBoards.map((b) => html`
            <div
              class="flex items-center gap-1 p-1 rounded cursor-pointer ${classMap({ 'bg-[var(--selected-bg)]': b.id === activeMoodBoardId })}"
              style="font-size:12px;"
              @click=${() => this._handleSelectBoard(b.id)}
            >
              <i class="fa-solid fa-image text-xs" aria-hidden="true" style="color:var(--tree-section-moodboards);width:16px;"></i>
              <span class="flex-1 truncate">${b.name}</span>
              <span class="text-xs" style="color:var(--text-dim);">${b.items.length}</span>
              <button
                class="text-xs opacity-0 hover:opacity-100"
                style="background:none;border:none;color:var(--text-dim);cursor:pointer;padding:2px;"
                @click=${(e: Event) => { e.stopPropagation(); this._handleDeleteBoard(b.id); }}
                title="Delete board"
              >×</button>
            </div>
          `)}
        </div>

        <div class="flex-1 flex flex-col min-h-0">
          ${activeBoard ? html`
            <div class="flex items-center gap-2 px-2 py-1 border-b" style="border-color:var(--border-dark);">
              <span style="font-weight:600;font-size:13px;">${activeBoard.name}</span>
              <div class="flex-1"></div>
              <div class="flex gap-1">
                ${TYPE_TABS.map((t) => html`
                  <button
                    class="toolbar-btn text-xs ${t.value === this._typeFilter ? 'btn-ai' : ''}"
                    @click=${() => { this._typeFilter = t.value; this.requestUpdate(); }}
                  >${t.label}</button>
                `)}
              </div>
            </div>
            <div class="flex-1 overflow-auto p-2">
              ${activeBoard.viewMode === 'grid'
                ? html`<cinegen-moodboards-panel .boardId=${activeBoard.id} .typeFilter=${this._typeFilter}></cinegen-moodboards-panel>`
                : html`<cinegen-moodboards-kanban .boardId=${activeBoard.id} .typeFilter=${this._typeFilter}></cinegen-moodboards-kanban>`
              }
            </div>
          ` : html`
            <div class="flex-1 flex items-center justify-center" style="color:var(--text-dim);font-size:13px;">
              <div class="text-center">
                <i class="fa-solid fa-images" style="font-size:48px;display:block;margin-bottom:16px;opacity:0.3;"></i>
                <p>Select a board or create a new one to get started.</p>
              </div>
            </div>
          `}
        </div>
      </div>
    `;
  }
}
