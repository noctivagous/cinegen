import { repeat } from 'lit/directives/repeat.js';
import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import { assetLibrary, moodBoards, activeMoodBoardId } from '@/data/project-data';
import { escHtml } from '@/utils/html';

const ASSET_TAB_KEYS = ['characters', 'locations', 'props', 'vehicles', 'effects', 'moodboard'] as const;
type AssetTabKey = (typeof ASSET_TAB_KEYS)[number];

type AssetItem = {
  name: string;
  desc?: string;
  icon?: string;
};

@customElement('cinegen-assets-panel')
export class CinegenAssetsPanel extends CgLightElement {
  @state() private _tabIndex = 0;

  connectedCallback(): void {
    if (!this.id) this.id = 'asset-grid';
    this.classList.add('grid', 'grid-cols-4', 'gap-6');
    super.connectedCallback();
  }

  switchTab(tab: number): void {
    if (tab < 0 || tab >= ASSET_TAB_KEYS.length) return;
    this._tabIndex = tab;
    this._syncTabButtons();
    this.requestUpdate();
  }

  get activeTabIndex(): number {
    return this._tabIndex;
  }

  refresh(): void {
    this.requestUpdate();
  }

  private _syncTabButtons(): void {
    const seg = document.querySelector('cg-segmented-control[data-segmented="asset-tabs"]') as
      | (HTMLElement & { value: string })
      | null;
    if (seg) {
      seg.value = String(this._tabIndex);
      return;
    }
    document.querySelectorAll<HTMLElement>('[data-ws-asset-tab]').forEach((btn, i) => {
      btn.classList.toggle('active', i === this._tabIndex);
    });
  }

  private _itemsForTab(): AssetItem[] {
    const key = ASSET_TAB_KEYS[this._tabIndex] as AssetTabKey;
    if (key === 'moodboard') {
      const activeBoard = activeMoodBoardId ? moodBoards.find((b) => b.id === activeMoodBoardId) : null;
      if (!activeBoard) return [];
      return activeBoard.items.filter((i) => i.active).map((i) => ({
        name: i.label,
        desc: i.notes || i.type,
        icon: i.type === 'video' ? 'fa-video' : i.type === 'sound' ? 'fa-music' : i.type === 'text' ? 'fa-font' : 'fa-image',
      }));
    }
    const items = assetLibrary[key];
    return Array.isArray(items) ? (items as AssetItem[]) : [];
  }

  private _onSelect(item: AssetItem): void {
    window.selectAsset?.(item.name);
  }

  private _onAddToScene(e: Event, item: AssetItem): void {
    e.stopPropagation();
    window.addAssetToScene?.(item.name);
  }

  render() {
    const items = this._itemsForTab();
    if (!items.length) {
      return html`<div class="text-[var(--text-dim)] text-xs p-3">No assets in this category.</div>`;
    }
    return repeat(
      items,
      (item) => item.name,
      (item) => html`
        <div
          class="asset-card flex flex-col items-center text-center p-3"
          @click=${() => this._onSelect(item)}
        >
          <div class="asset-image w-20 h-20 flex items-center justify-center text-4xl mb-3">
            <i class="fa-solid ${item.icon || 'fa-cube'}"></i>
          </div>
          <div class="asset-label text-xs">${escHtml(item.name)}</div>
          <div class="text-[10px] text-[var(--text-dim)]">${escHtml(item.desc || '')}</div>
          <button
            type="button"
            class="toolbar-btn text-[10px] mt-2"
            @click=${(e: Event) => this._onAddToScene(e, item)}
          >
            Add to Scene
          </button>
        </div>
      `
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cinegen-assets-panel': CinegenAssetsPanel;
  }
}
