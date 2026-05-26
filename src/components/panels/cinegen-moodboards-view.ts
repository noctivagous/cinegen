import { html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { CgLightElement } from '@/components/lit-base';
import {
  moodBoards,
  activeMoodBoardId,
  addMoodBoard,
  autosaveMoodBoards,
  removeMoodBoard,
  setActiveMoodBoard,
} from '@/data/project-data';
import type { MoodBoard, MoodBoardItem, MoodBoardItemType } from '@/data/project-data';
import { queueMoodBoardGeneration, getGenerationPromptPlaceholder } from '@/moodboards/moodboard-generation';
import { moodBoardSourceForFile, moodBoardTypeForFile } from '@/moodboards/moodboard-files';
import { promptTextCG } from '@/utils/prompt-text-cg';

const TYPE_TABS = [
  { value: 'all', label: 'All', icon: 'fa-layer-group' },
  { value: 'image', label: 'Images', icon: 'fa-image' },
  { value: 'video', label: 'Video', icon: 'fa-video' },
  { value: 'sound', label: 'Sound', icon: 'fa-music' },
  { value: 'text', label: 'Text', icon: 'fa-font' },
];

@customElement('cinegen-moodboards-view')
export class CinegenMoodboardsView extends CgLightElement {
  @state() private _typeFilter = 'all';
  /** Bumps when mood board list/active id changes (module state is not @state). */
  @state() private _boardsRev = 0;
  @state() private _editingBoardId: string | null = null;
  @state() private _editingBoardName = '';
  @state() private _dragOver = false;
  @state() private _panelModalOpen = false;
  @state() private _panelModalItem: MoodBoardItem | null = null;

  private _onMoodboardNewBoard = (): void => {
    this._handleNewBoard();
  };

  private _onMoodboardQuickGenerate = (): void => {
    this._handleQuickGenerate();
  };

  private _onMoodboardItemsChanged = (): void => {
    if (this._panelModalOpen && this._panelModalItem) {
      const board = moodBoards.find((b) => b.id === activeMoodBoardId);
      const fresh = board?.items.find((i) => i.id === this._panelModalItem?.id);
      if (fresh) this._panelModalItem = fresh;
    }
    this._syncBoardsUi();
  };

  connectedCallback(): void {
    super.connectedCallback();
    this.id = 'view-moodboards';
    this.classList.add('hidden', 'flex', 'flex-col', 'h-full');
    window.addEventListener('moodboard-new-board', this._onMoodboardNewBoard);
    window.addEventListener('moodboard-quick-generate', this._onMoodboardQuickGenerate);
    this.addEventListener('moodboard-items-changed', this._onMoodboardItemsChanged);
    this.addEventListener('moodboard-item-view', this._onMoodboardItemView as EventListener);
  }

  disconnectedCallback(): void {
    window.removeEventListener('moodboard-new-board', this._onMoodboardNewBoard);
    window.removeEventListener('moodboard-quick-generate', this._onMoodboardQuickGenerate);
    this.removeEventListener('moodboard-items-changed', this._onMoodboardItemsChanged);
    this.removeEventListener('moodboard-item-view', this._onMoodboardItemView as EventListener);
    super.disconnectedCallback();
  }

  private _onMoodboardItemView = (e: Event): void => {
    const detail = (e as CustomEvent<{ boardId: string; itemId: string }>).detail;
    if (!detail?.boardId || !detail?.itemId) return;
    const board = moodBoards.find((b) => b.id === detail.boardId);
    const item = board?.items.find((i) => i.id === detail.itemId);
    if (!item) return;
    this._panelModalItem = item;
    this._panelModalOpen = true;
  };

  private _closePanelModal(): void {
    this._panelModalOpen = false;
    this._panelModalItem = null;
  }

  private _panelModalTitle(): string {
    return this._panelModalItem?.label || 'Item';
  }

  private _panelModalIcon(): string {
    const t = this._panelModalItem?.type;
    if (t === 'video') return 'fa-video';
    if (t === 'sound') return 'fa-music';
    if (t === 'text') return 'fa-font';
    return 'fa-image';
  }

  updated(changed: Map<string, unknown>): void {
    super.updated(changed);
    if (changed.has('_editingBoardId') && this._editingBoardId) {
      queueMicrotask(() => {
        const input = this.querySelector<HTMLInputElement>(
          `input[data-moodboard-edit="${CSS.escape(this._editingBoardId as string)}"]`
        );
        input?.focus();
        input?.select();
      });
    }
  }

  private _getActiveBoard(): MoodBoard | undefined {
    return activeMoodBoardId ? moodBoards.find((b) => b.id === activeMoodBoardId) : undefined;
  }

  private _fileInputEl(): HTMLInputElement | null {
    return this.querySelector<HTMLInputElement>('#moodboards-file-input');
  }

  private _syncBoardsUi(): void {
    this._boardsRev += 1;
    window.refreshProjectTree?.();
    // Child panels read from module-level `moodBoards` but don't get new props;
    // force a repaint after mutations (drops, adds, deletes, renames).
    queueMicrotask(() => {
      this.querySelectorAll<HTMLElement>('cinegen-moodboards-panel, cinegen-moodboards-kanban').forEach((el) => {
        (el as unknown as { requestUpdate?: () => void }).requestUpdate?.();
      });
    });
  }

  private async _addFilesToActiveBoard(files: FileList | File[]): Promise<void> {
    const board = this._getActiveBoard();
    if (!board) return;
    const list = Array.from(files || []);
    const droppedTypes = new Set<MoodBoardItemType>();
    for (const file of list) {
      const type = moodBoardTypeForFile(file);
      droppedTypes.add(type);
      let source = '';
      try {
        source = await moodBoardSourceForFile(type, file);
      } catch {
        source = '';
      }
      // Lazy import to avoid circular dependency at module init.
      const { addMoodBoardItem } = await import('@/data/project-data');
      addMoodBoardItem(board.id, {
        type,
        label: file.name || `Uploaded ${type}`,
        source,
        active: true,
        notes: 'Uploaded',
        order: Date.now(),
        metadata: {
          filename: file.name,
          mime: file.type,
          size: file.size,
          lastModified: file.lastModified,
        },
      });
    }
    if (droppedTypes.size === 1) {
      this._typeFilter = [...droppedTypes][0];
    } else if (droppedTypes.size > 1) {
      this._typeFilter = 'all';
    }
    this._syncBoardsUi();
  }

  private _openFilePicker(): void {
    const input = this._fileInputEl();
    if (!input) return;
    input.value = '';
    input.click();
  }

  private _onPanelDragEnter = (e: DragEvent): void => {
    if (this._panelModalOpen) return;
    e.preventDefault();
    e.stopPropagation();
    this._dragOver = true;
  };

  private _onPanelDragOver = (e: DragEvent): void => {
    if (this._panelModalOpen) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    this._dragOver = true;
  };

  private _onPanelDragLeave = (e: DragEvent): void => {
    if (this._panelModalOpen) return;
    const host = e.currentTarget as HTMLElement;
    const related = e.relatedTarget as Node | null;
    if (related && host.contains(related)) return;
    this._dragOver = false;
  };

  private _onPanelDrop = async (e: DragEvent): Promise<void> => {
    if (this._panelModalOpen) return;
    e.preventDefault();
    e.stopPropagation();
    this._dragOver = false;
    const files = e.dataTransfer?.files;
    if (!files?.length) return;
    await this._addFilesToActiveBoard(files);
  };

  private _startEditingBoard(boardId: string, initialName: string): void {
    this._editingBoardId = boardId;
    this._editingBoardName = initialName;
    this._syncBoardsUi();
  }

  private _commitEditingBoardName(): void {
    const boardId = this._editingBoardId;
    if (!boardId) return;
    const next = this._editingBoardName.trim();
    const board = moodBoards.find((b) => b.id === boardId);
    if (board && next) {
      board.name = next;
      board.updatedAt = Date.now();
      autosaveMoodBoards();
    }
    this._editingBoardId = null;
    this._editingBoardName = '';
    this._syncBoardsUi();
  }

  private _cancelEditingBoardName(): void {
    this._editingBoardId = null;
    this._editingBoardName = '';
    this._syncBoardsUi();
  }

  private _handleNewBoard(): void {
    const board = addMoodBoard('New Mood Board');
    setActiveMoodBoard(board.id);
    this._startEditingBoard(board.id, board.name);
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
    if (this._editingBoardId === id) {
      this._editingBoardId = null;
      this._editingBoardName = '';
    }
    this._syncBoardsUi();
  }

  private _handleSelectBoard(id: string): void {
    setActiveMoodBoard(id);
    this._syncBoardsUi();
  }

  private _renderLayoutToggle(board: MoodBoard) {
    return html`
      <div class="moodboards-layout-toolbar flex-shrink-0">
        <div class="sidebar-view-group" role="group" aria-label="Mood board layout">
          <button
            type="button"
            class="sidebar-view-btn ${board.viewMode === 'grid' ? 'active' : ''}"
            title="Grid"
            @click=${() => { board.viewMode = 'grid'; autosaveMoodBoards(); this._syncBoardsUi(); }}
          >
            <i class="fa-solid fa-table-cells" aria-hidden="true"></i>
            <span>Grid</span>
          </button>
          <button
            type="button"
            class="sidebar-view-btn ${board.viewMode === 'kanban' ? 'active' : ''}"
            title="Kanban"
            @click=${() => { board.viewMode = 'kanban'; autosaveMoodBoards(); this._syncBoardsUi(); }}
          >
            <i class="fa-solid fa-list" aria-hidden="true"></i>
            <span>Kanban</span>
          </button>
        </div>
      </div>
    `;
  }

  render() {
    const activeBoard = this._getActiveBoard();

    return html`
      <cg-panel-header>
        <span slot="title" class="workspace-panel-title">
          <i class="fa-solid fa-images" aria-hidden="true"></i> MOOD BOARDS
        </span>
        <div slot="actions" class="flex items-center gap-2">
          <button type="button" class="toolbar-btn btn-ai text-xs" @click=${() => void this._handleNewBoard()}>
            <i class="fa-solid fa-plus" aria-hidden="true"></i> New Board
          </button>
        </div>
      </cg-panel-header>

      <div class="flex gap-2 p-2 flex-1 min-h-0 panel-content">
        <div class="flex flex-col gap-1" style="width:180px;min-width:180px;overflow-y:auto;border-right:1px solid var(--border-dark);padding-right:8px;">
          <span class="text-xs" style="color:var(--text-dim);font-weight:600;padding:4px 0;">BOARDS</span>
          ${moodBoards.map((b) => html`
            <div
              class="flex items-center gap-1 p-1 rounded cursor-pointer ${classMap({ 'bg-[var(--selected-bg)]': b.id === activeMoodBoardId })}"
              style="font-size:12px;"
              @click=${() => this._handleSelectBoard(b.id)}
              @dblclick=${(e: Event) => {
                e.preventDefault();
                e.stopPropagation();
                if (this._editingBoardId !== b.id) {
                  this._startEditingBoard(b.id, b.name);
                }
              }}
            >
              <i class="fa-solid fa-image text-xs" aria-hidden="true" style="color:var(--tree-section-moodboards);width:16px;"></i>
              ${this._editingBoardId === b.id
                ? html`
                    <input
                      class="cg-field"
                      style="height:22px;padding:2px 6px;font-size:12px;"
                      data-moodboard-edit=${b.id}
                      .value=${this._editingBoardName}
                      @click=${(e: Event) => e.stopPropagation()}
                      @input=${(e: Event) => { this._editingBoardName = (e.target as HTMLInputElement).value; }}
                      @keydown=${(e: KeyboardEvent) => {
                        if (e.key === 'Enter') { e.preventDefault(); this._commitEditingBoardName(); }
                        if (e.key === 'Escape') { e.preventDefault(); this._cancelEditingBoardName(); }
                      }}
                      @blur=${() => this._commitEditingBoardName()}
                    />
                  `
                : html`<span class="flex-1 truncate">${b.name}</span>`
              }
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
            <div class="px-2 py-1" style="flex-shrink:0;">
              <span style="font-weight:600;font-size:13px;">${activeBoard.name}</span>
            </div>
            <div class="tab-strip-classic moodboard-type-tabs" role="tablist" aria-label="Item type">
              ${TYPE_TABS.map((t) => html`
                <button
                  type="button"
                  class="tab-btn-classic ${t.value === this._typeFilter ? 'active' : ''}"
                  role="tab"
                  aria-selected=${t.value === this._typeFilter ? 'true' : 'false'}
                  @click=${() => { this._typeFilter = t.value; this.requestUpdate(); }}
                >
                  <i class="fa-solid ${t.icon}" aria-hidden="true"></i>
                  ${t.label}
                </button>
              `)}
            </div>
            <div class="tab-page-classic moodboards-tab-page flex-1 min-h-0" role="tabpanel">
              <div
                class=${['moodboards-panel-host', 'flex-1', 'min-h-0', 'flex', 'flex-col', this._dragOver ? 'is-dragover' : ''].filter(Boolean).join(' ')}
                @dragenter=${this._onPanelDragEnter}
                @dragover=${this._onPanelDragOver}
                @dragleave=${this._onPanelDragLeave}
                @drop=${this._onPanelDrop}
              >
                <cg-panel-modal
                  .open=${this._panelModalOpen}
                  .title=${this._panelModalTitle()}
                  title-icon=${this._panelModalIcon()}
                  @cg-panel-modal-close=${() => this._closePanelModal()}
                >
                  <cinegen-moodboard-item-viewer .item=${this._panelModalItem}></cinegen-moodboard-item-viewer>
                </cg-panel-modal>

                <input
                  id="moodboards-file-input"
                  type="file"
                  multiple
                  accept="image/*,video/*,audio/*,.txt,.md,.fountain,text/plain"
                  style="display:none;"
                  @change=${async (e: Event) => {
                    const input = e.target as HTMLInputElement;
                    if (!input.files?.length) return;
                    await this._addFilesToActiveBoard(input.files);
                  }}
                />

                <div class="moodboards-drop-surface flex-1 min-h-0 flex flex-col">
                  ${this._renderLayoutToggle(activeBoard)}

                  <div class="moodboards-items-scroll flex-1 min-h-0 overflow-auto">
                    ${activeBoard.viewMode === 'grid'
                      ? html`<cinegen-moodboards-panel .boardId=${activeBoard.id} .typeFilter=${this._typeFilter}></cinegen-moodboards-panel>`
                      : html`<cinegen-moodboards-kanban .boardId=${activeBoard.id} .typeFilter=${this._typeFilter}></cinegen-moodboards-kanban>`
                    }
                  </div>

                  <div
                    class="moodboards-drop-chrome flex-shrink-0"
                    @click=${() => this._openFilePicker()}
                  >
                    <i class="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i>
                    <div class="moodboards-drop-chrome-copy">
                      <strong>Drop files anywhere in this panel</strong>
                      <span>Multiple files OK — images, video, audio, and text are sorted automatically.</span>
                    </div>
                    <button
                      type="button"
                      class="toolbar-btn text-xs"
                      @click=${(ev: Event) => { ev.stopPropagation(); this._openFilePicker(); }}
                    >
                      Browse…
                    </button>
                  </div>
                </div>
              </div>
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
