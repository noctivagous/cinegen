import { repeat } from 'lit/directives/repeat.js';
import { html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';
import { CgLightElement } from '@/components/lit-base';
import { escHtml } from '@/utils/html';
import {
  CG_ASSETS_UPLOAD,
  CG_ASSETS_FETCH,
  CG_ASSETS_GENERATE,
} from '@/events/shell-events';
import { updateInspector } from '@/components/panels/cinegen-inspector';

type ViewState = 'grid' | 'list' | 'strip';
type AssetType = 'Character' | 'Location' | 'Prop' | 'Vehicle' | 'VFX' | 'Audio';

interface Asset {
  id: number;
  name: string;
  type: AssetType;
  folder: string;
  color: string;
  scenes: string[];
  size: string;
  modified: string;
  tags: string[];
  desc: string;
  related: number[];
  versions: string[];
}

interface Folder {
  id: string;
  name: string;
  icon: string;
  count: number;
  children: Folder[];
}

const SAMPLE_FOLDERS: Folder[] = [
  { id: 'all', name: 'All Assets', icon: 'grid', count: 12, children: [] },
  { id: 'chars', name: 'Characters', icon: 'user', count: 3, children: [
    { id: 'chars-hero', name: 'Heroes', icon: 'folder', count: 2, children: [] },
    { id: 'chars-villain', name: 'Villains', icon: 'folder', count: 1, children: [] },
  ]},
  { id: 'locs', name: 'Locations', icon: 'map', count: 3, children: [
    { id: 'locs-int', name: 'Interiors', icon: 'folder', count: 2, children: [] },
    { id: 'locs-ext', name: 'Exteriors', icon: 'folder', count: 1, children: [] },
  ]},
  { id: 'props', name: 'Props', icon: 'box', count: 2, children: [] },
  { id: 'vehicles', name: 'Vehicles', icon: 'truck', count: 1, children: [] },
  { id: 'vfx', name: 'VFX', icon: 'zap', count: 2, children: [] },
  { id: 'effects', name: 'Effects', icon: 'star', count: 0, children: [] },
  { id: 'audio', name: 'Audio', icon: 'music', count: 1, children: [] },
];

const SAMPLE_ASSETS: Asset[] = [
  { id: 1, name: 'Hero_Protagonist_v2', type: 'Character', folder: 'chars-hero', color: '#3b82f6', scenes: ['Scene 01', 'Scene 05', 'Scene 12'], size: '4.2 MB', modified: '2025-10-02', tags: ['hero', 'male', 'rigged'], desc: 'Main protagonist character with full rig and facial blend shapes.', related: [2, 7], versions: ['v2 - 2025-10-02', 'v1 - 2025-09-28'] },
  { id: 2, name: 'Hero_Costume_Combat', type: 'Prop', folder: 'props', color: '#ef4444', scenes: ['Scene 01', 'Scene 05'], size: '1.8 MB', modified: '2025-10-01', tags: ['costume', 'armor'], desc: 'Combat armor for protagonist.', related: [1], versions: ['v1 - 2025-10-01'] },
  { id: 3, name: 'Villain_Boss_Final', type: 'Character', folder: 'chars-villain', color: '#8b5cf6', scenes: ['Scene 15'], size: '5.1 MB', modified: '2025-09-30', tags: ['villain', 'boss'], desc: 'Final boss character model.', related: [], versions: ['v1 - 2025-09-30'] },
  { id: 4, name: 'Alley_Night_Dystopian', type: 'Location', folder: 'locs-ext', color: '#1e293b', scenes: ['Scene 03', 'Scene 07', 'Scene 08'], size: '12.4 MB', modified: '2025-10-02', tags: ['exterior', 'night', 'dystopian'], desc: 'Rainy dystopian alley environment.', related: [5, 11], versions: ['v3 - 2025-10-02'] },
  { id: 5, name: 'Neon_Signs_Pack', type: 'Prop', folder: 'props', color: '#f59e0b', scenes: ['Scene 03', 'Scene 07'], size: '3.2 MB', modified: '2025-09-29', tags: ['neon', 'signs', 'cyberpunk'], desc: 'Collection of animated neon signs.', related: [4], versions: ['v1 - 2025-09-29'] },
  { id: 6, name: 'HQ_Interior_Lobby', type: 'Location', folder: 'locs-int', color: '#06b6d4', scenes: ['Scene 02', 'Scene 10'], size: '18.7 MB', modified: '2025-10-01', tags: ['interior', 'modern', 'office'], desc: 'Corporate headquarters lobby.', related: [], versions: ['v2 - 2025-10-01'] },
  { id: 7, name: 'Sidekick_Pilot', type: 'Character', folder: 'chars-hero', color: '#22c55e', scenes: ['Scene 04', 'Scene 09'], size: '3.9 MB', modified: '2025-09-28', tags: ['support', 'pilot'], desc: 'Pilot sidekick character.', related: [1, 8], versions: ['v1 - 2025-09-28'] },
  { id: 8, name: 'Spaceship_Fighter_X9', type: 'Vehicle', folder: 'vehicles', color: '#6366f1', scenes: ['Scene 04'], size: '24.1 MB', modified: '2025-09-27', tags: ['spaceship', 'vehicle', 'fighter'], desc: 'X9 fighter spaceship model.', related: [7], versions: ['v1 - 2025-09-27'] },
  { id: 9, name: 'Explosion_Partical_Sim', type: 'VFX', folder: 'vfx', color: '#f97316', scenes: ['Scene 12'], size: '8.3 MB', modified: '2025-10-02', tags: ['explosion', 'particle', 'sim'], desc: 'Large scale explosion particle simulation.', related: [], versions: ['v1 - 2025-10-02'] },
  { id: 10, name: 'Muzzle_Flash_Element', type: 'VFX', folder: 'vfx', color: '#eab308', scenes: ['Scene 05', 'Scene 12'], size: '0.8 MB', modified: '2025-09-30', tags: ['muzzle', 'flash', 'gun'], desc: 'Gun muzzle flash effect element.', related: [], versions: ['v1 - 2025-09-30'] },
  { id: 11, name: 'Ambient_City_Rain', type: 'Audio', folder: 'audio', color: '#14b8a6', scenes: ['Scene 03'], size: '15.2 MB', modified: '2025-09-26', tags: ['ambient', 'rain', 'city'], desc: 'Looping city rain ambience.', related: [4], versions: ['v1 - 2025-09-26'] },
  { id: 12, name: 'Warehouse_Abandoed', type: 'Location', folder: 'locs-int', color: '#64748b', scenes: ['Scene 14'], size: '14.6 MB', modified: '2025-09-25', tags: ['interior', 'warehouse', 'abandoned'], desc: 'Abandoned warehouse interior.', related: [], versions: ['v1 - 2025-09-25'] },
];

@customElement('cinegen-assets-panel')
export class CinegenAssetsPanel extends CgLightElement {
  @state() private _viewMode: ViewState = 'grid';
  @state() private _searchQuery = '';
  @state() private _activeFolder = 'all';
  @state() private _expandedFolders: Set<string> = new Set(['all', 'chars', 'locs']);
  @state() private _selectedAssets: Set<number> = new Set();
  @state() private _folders: Folder[] = JSON.parse(JSON.stringify(SAMPLE_FOLDERS));
  @state() private _assets: Asset[] = JSON.parse(JSON.stringify(SAMPLE_ASSETS));
  @state() private _sortColumn: keyof Asset | 'scenes' = 'name';
  @state() private _sortAsc = true;
  @state() private _draggedFolder: string | null = null;
  @state() private _dragOverFolder: string | null = null;
  @state() private _contextType: 'folder' | 'asset' | null = null;
  @state() private _contextData: any = null;
  @state() private _contextPos = { x: 0, y: 0 };
  @state() private _showFolderMenu = false;
  @state() private _showAssetMenu = false;
  @state() private _dropActive = false;
  @state() private _toast: { msg: string; id: number } | null = null;

  private _toastTimer: number | undefined;
  private _nextFolderId = 1000;

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add('flex', 'flex-col', 'h-full');
  }

  switchTab(tab: number): void {
  }

  refresh(): void {
    this._assets = JSON.parse(JSON.stringify(SAMPLE_ASSETS));
    this._folders = JSON.parse(JSON.stringify(SAMPLE_FOLDERS));
    this._expandedFolders = new Set(['all', 'chars', 'locs']);
    this._selectedAssets.clear();
    this._searchQuery = '';
    this._sortColumn = 'name';
    this._sortAsc = true;
    this.requestUpdate();
  }

  private _showToast(msg: string): void {
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toast = { msg, id: Date.now() };
    this._toastTimer = window.setTimeout(() => {
      this._toast = null;
      this.requestUpdate();
    }, 3000);
    this.requestUpdate();
  }

  private _getFilteredAssets(): Asset[] {
    let assets = [...this._assets];

    if (this._activeFolder !== 'all') {
      assets = assets.filter(a => {
        if (this._activeFolder === 'chars') return a.type === 'Character';
        if (this._activeFolder === 'locs') return a.type === 'Location';
        if (this._activeFolder === 'props') return a.type === 'Prop';
        if (this._activeFolder === 'vehicles') return a.type === 'Vehicle';
        if (this._activeFolder === 'vfx') return a.type === 'VFX';
        if (this._activeFolder === 'audio') return a.type === 'Audio';
        return a.folder === this._activeFolder;
      });
    }

    if (this._searchQuery) {
      const q = this._searchQuery.toLowerCase();
      assets = assets.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.type.toLowerCase().includes(q) ||
        a.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    assets.sort((a, b) => {
      let valA: any = a[this._sortColumn as keyof Asset];
      let valB: any = b[this._sortColumn as keyof Asset];
      if (this._sortColumn === 'scenes') {
        valA = a.scenes.length;
        valB = b.scenes.length;
      }
      if (valA < valB) return this._sortAsc ? -1 : 1;
      if (valA > valB) return this._sortAsc ? 1 : -1;
      return 0;
    });

    return assets;
  }

  private _setSort(col: keyof Asset | 'scenes'): void {
    if (this._sortColumn === col) {
      this._sortAsc = !this._sortAsc;
    } else {
      this._sortColumn = col;
      this._sortAsc = true;
    }
    this.requestUpdate();
  }

  private _selectAsset(id: number, e: MouseEvent): void {
    if (e.ctrlKey || e.metaKey) {
      if (this._selectedAssets.has(id)) {
        this._selectedAssets.delete(id);
      } else {
        this._selectedAssets.add(id);
      }
    } else {
      this._selectedAssets.clear();
      this._selectedAssets.add(id);
    }
    this.requestUpdate();
    // Push selection to global inspector
    const asset = this._assets.find(a => a.id === id) ?? null;
    updateInspector('asset', asset);
  }

  private _deleteSelected(): void {
    if (this._selectedAssets.size === 0) return;
    const count = this._selectedAssets.size;
    if (!confirm(`Delete ${count} selected asset(s)?`)) return;
    this._assets = this._assets.filter(a => !this._selectedAssets.has(a.id));
    this._selectedAssets.clear();
    this._showToast('Assets deleted');
    this.requestUpdate();
  }

  private _selectFolder(id: string): void {
    this._activeFolder = id;
    this._selectedAssets.clear();
    this.requestUpdate();
  }

  private _toggleFolder(id: string): void {
    if (this._expandedFolders.has(id)) {
      this._expandedFolders.delete(id);
    } else {
      this._expandedFolders.add(id);
    }
    this.requestUpdate();
  }

  private _onDragStart(folderId: string): void {
    this._draggedFolder = folderId;
  }

  private _onDragEnd(): void {
    this._draggedFolder = null;
    this._dragOverFolder = null;
    this.requestUpdate();
  }

  private _onDragOver(folderId: string): void {
    if (this._draggedFolder && this._draggedFolder !== folderId) {
      this._dragOverFolder = folderId;
    }
  }

  private _onDropOnFolder(folderId: string): void {
    if (this._draggedFolder && this._draggedFolder !== folderId) {
      this._showToast(`Moved folder to ${folderId}`);
    }
    this._draggedFolder = null;
    this._dragOverFolder = null;
    this.requestUpdate();
  }

  private _showContextMenu(type: 'folder' | 'asset', data: any, x: number, y: number): void {
    this._contextType = type;
    this._contextData = data;
    this._contextPos = { x, y };
    if (type === 'folder') this._showFolderMenu = true;
    else this._showAssetMenu = true;
    this.requestUpdate();
  }

  private _hideContextMenus(): void {
    this._showFolderMenu = false;
    this._showAssetMenu = false;
    this._contextType = null;
    this._contextData = null;
  }

  private _handleFolderContextAction(action: string, folder: Folder): void {
    if (action === 'new-subfolder') {
      const name = prompt('Enter subfolder name:');
      if (name) {
        if (!folder.children) folder.children = [];
        folder.children.push({ id: `folder-${this._nextFolderId++}`, name, icon: 'folder', count: 0, children: [] });
        this._expandedFolders.add(folder.id);
        this._folders = [...this._folders];
        this.requestUpdate();
      }
    } else if (action === 'rename') {
      const newName = prompt('Enter new folder name:', folder.name);
      if (newName) {
        folder.name = newName;
        this.requestUpdate();
      }
    } else if (action === 'delete') {
      if (confirm(`Delete folder "${folder.name}"?`)) {
        this._removeFolder(this._folders, folder.id);
        this._showToast('Folder deleted');
        this.requestUpdate();
      }
    }
    this._hideContextMenus();
  }

  private _removeFolder(folders: Folder[], id: string): boolean {
    for (let i = 0; i < folders.length; i++) {
      if (folders[i].id === id) {
        folders.splice(i, 1);
        return true;
      }
      if (folders[i].children && this._removeFolder(folders[i].children, id)) return true;
    }
    return false;
  }

  private _handleAssetContextAction(action: string, asset: Asset): void {
    if (action === 'open') {
      this._showToast(`Opening ${asset.name} in preview...`);
    } else if (action === 'rename') {
      const newName = prompt('Enter new name:', asset.name);
      if (newName) {
        asset.name = newName;
        this.requestUpdate();
      }
    } else if (action === 'duplicate') {
      const copy: Asset = { ...asset, id: Date.now(), name: asset.name + ' Copy' };
      this._assets = [...this._assets, copy];
      this._showToast('Asset duplicated');
      this.requestUpdate();
    } else if (action === 'delete') {
      if (confirm(`Delete "${asset.name}"?`)) {
        this._assets = this._assets.filter(a => a.id !== asset.id);
        this._selectedAssets.delete(asset.id);
        this._showToast('Asset deleted');
        this.requestUpdate();
      }
    }
    this._hideContextMenus();
  }

  private _handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Delete' && this._selectedAssets.size > 0) {
      this._deleteSelected();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault();
      this._selectedAssets = new Set(this._getFilteredAssets().map(a => a.id));
      this.requestUpdate();
    }
    if (e.key === 'Escape') {
      this._selectedAssets.clear();
      this.requestUpdate();
    }
    if (e.key === 'k' && !e.ctrlKey && !e.metaKey) {
      this._showToast('Shortcuts: Ctrl+A Select All | Del Delete | Esc Deselect | Drag Reorder');
    }
  }

  private _handleFileInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (input.files?.length) {
      const count = input.files.length;
      this._showToast(`Uploading ${count} file(s)...`);
      setTimeout(() => this._showToast(`Successfully uploaded ${count} file(s)`), 1000);
      input.value = '';
    }
  }

  private _newFolder(): void {
    const name = prompt('Enter folder name:');
    if (name) {
      this._folders = [...this._folders, { id: `folder-${this._nextFolderId++}`, name, icon: 'folder', count: 0, children: [] }];
      this.requestUpdate();
      this._showToast('Folder created');
    }
  }

  private _updateAssetName(asset: Asset, value: string): void {
    asset.name = value;
    this.requestUpdate();
  }

  private _updateAssetDesc(asset: Asset, value: string): void {
    asset.desc = value;
  }

  private _updateAssetType(asset: Asset, value: string): void {
    asset.type = value as AssetType;
    this.requestUpdate();
  }

  private _addTag(asset: Asset, value: string): void {
    const tag = value.trim();
    if (tag && !asset.tags.includes(tag)) {
      asset.tags.push(tag);
      this.requestUpdate();
    }
  }

  private _removeTag(asset: Asset, tag: string): void {
    asset.tags = asset.tags.filter(t => t !== tag);
    this.requestUpdate();
  }

  private _navToRelated(id: number): void {
    if (this._assets.find(a => a.id === id)) {
      this._selectedAssets.clear();
      this._selectedAssets.add(id);
      this.requestUpdate();
    }
  }

  private _getTypeIcon(type: AssetType): string {
    switch (type) {
      case 'Character': return 'fa-user';
      case 'Location': return 'fa-map';
      case 'Prop': return 'fa-box';
      case 'Vehicle': return 'fa-truck';
      case 'VFX': return 'fa-bolt';
      case 'Audio': return 'fa-music';
    }
  }

  private _renderFolder(folder: Folder, level: number): unknown {
    const hasChildren = folder.children && folder.children.length > 0;
    const isExpanded = this._expandedFolders.has(folder.id);
    const isActive = this._activeFolder === folder.id;
    const isDragOver = this._dragOverFolder === folder.id && this._draggedFolder !== folder.id;

    return html`
      <div>
        <div
          class="tree-item ${classMap({ active: isActive, 'drag-over': isDragOver, dragging: this._draggedFolder === folder.id })}"
          style="padding-left: ${8 + level * 16}px"
          draggable="${folder.id !== 'all'}"
          @click=${(e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.closest('.tree-expand')) {
              this._toggleFolder(folder.id);
            } else {
              this._selectFolder(folder.id);
            }
          }}
          @contextmenu=${(e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (folder.id !== 'all') this._showContextMenu('folder', folder, e.pageX, e.pageY);
          }}
          @dragstart=${() => this._onDragStart(folder.id)}
          @dragend=${() => this._onDragEnd()}
          @dragover=${(e: DragEvent) => { e.preventDefault(); this._onDragOver(folder.id); }}
          @dragleave=${() => { if (this._dragOverFolder === folder.id) this._dragOverFolder = null; this.requestUpdate(); }}
          @drop=${(e: DragEvent) => { e.preventDefault(); this._onDropOnFolder(folder.id); }}
        >
          ${hasChildren ? html`
            <span class="tree-expand ${classMap({ expanded: isExpanded })}">
              <i class="fa-solid fa-chevron-right" style="font-size:10px"></i>
            </span>
          ` : html`<span style="width:16px"></span>`}
          <span class="tree-icon"><i class="fa-solid ${this._folderIcon(folder.icon)}"></i></span>
          <span class="tree-label">${folder.name}</span>
          <span class="tree-count">${folder.count || ''}</span>
        </div>
        ${hasChildren && isExpanded ? html`
          <div class="tree-children expanded">
            ${folder.children.map(child => this._renderFolder(child, level + 1))}
          </div>
        ` : nothing}
      </div>
    `;
  }

  private _folderIcon(icon: string): string {
    const map: Record<string, string> = {
      grid: 'fa-th',
      user: 'fa-user',
      map: 'fa-map',
      box: 'fa-box',
      truck: 'fa-truck',
      zap: 'fa-bolt',
      star: 'fa-star',
      music: 'fa-music',
      folder: 'fa-folder',
    };
    return map[icon] || 'fa-folder';
  }

  private _thumbIcon(asset: Asset): string {
    if (asset.type === 'Audio') return 'fa-music';
    if (asset.type === 'VFX') return 'fa-bolt';
    if (asset.type === 'Character') return 'fa-user';
    if (asset.type === 'Location') return 'fa-map';
    if (asset.type === 'Prop') return 'fa-box';
    if (asset.type === 'Vehicle') return 'fa-truck';
    return 'fa-image';
  }

  private _assetCard(asset: Asset): unknown {
    const selected = this._selectedAssets.has(asset.id);
    return html`
      <div
        class="asset-card ${classMap({ selected })}"
        data-asset-id="${asset.id}"
        @click=${(e: MouseEvent) => this._selectAsset(asset.id, e)}
        @contextmenu=${(e: MouseEvent) => {
          e.preventDefault();
          this._showContextMenu('asset', asset, e.pageX, e.pageY);
        }}
      >
        <div class="asset-thumb" style=${styleMap({ background: `linear-gradient(135deg, ${asset.color}20, ${asset.color}40)` })}>
          <i class="fa-solid ${this._thumbIcon(asset)}" style="font-size:32px;opacity:0.5"></i>
        </div>
        <div class="asset-info">
          <div class="asset-name" title="${asset.name}">${escHtml(asset.name)}</div>
          <div class="asset-meta">
            <span class="badge badge-type">${asset.type}</span>
            <span class="badge badge-scene">Used in ${asset.scenes.length}</span>
          </div>
        </div>
      </div>
    `;
  }

  render() {
    const filteredAssets = this._getFilteredAssets();
    const selectedAsset = this._selectedAssets.size === 1
      ? this._assets.find(a => a.id === Array.from(this._selectedAssets)[0])
      : null;

    return html`
      <style>
        :host {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--bg-panel);
        }
        .cg-panel-header {
          background: var(--bg-panel);
          border-bottom: 1px solid var(--border-light);
          padding: 12px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 52px;
        }
        .cg-panel-header h1 {
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.3px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .app-container {
          display: flex;
          flex: 1;
          min-height: 0;
        }
        .panel {
          background: var(--bg-panel);
          border-right: 1px solid var(--border-light);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .panel-left {
          width: 20%;
          min-width: 240px;
          border-right: 1px solid var(--border-light);
        }
        .panel-center {
          width: 60%;
          flex: 1;
          border-right: 1px solid var(--border-light);
        }
        .panel-right {
          width: 20%;
          min-width: 320px;
        }
        .panel-section-header {
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-light);
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--text-dim);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .tree-item { display: flex; align-items: center; padding: 6px 8px; border-radius: 4px; cursor: pointer; font-size: 13px; transition: var(--transition, all 0.2s); margin: 1px 0; }
        .tree-item:hover { background: var(--bg-hover, #374151); }
        .tree-item.active { background: var(--accent-blue, #3b82f6); color: white; }
        .tree-item.dragging { opacity: 0.5; }
        .tree-item.drag-over { background: rgba(59,130,246,0.2); outline: 1px dashed var(--accent-blue, #3b82f6); }
        .tree-expand { width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: transform 0.15s; }
        .tree-expand.expanded { transform: rotate(90deg); }
        .tree-icon { width: 16px; margin: 0 8px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
        .tree-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .tree-count { font-size: 11px; color: var(--text-dim, #9ca3af); margin-left: 8px; }
        .tree-children { margin-left: 16px; }
        .search-box {
          padding: 12px;
          border-bottom: 1px solid var(--border-light);
        }
        .search-input {
          width: 100%;
          background: var(--bg-inset, #262626);
          border: 1px solid var(--widget-border, #4b5563);
          border-radius: 6px;
          padding: 8px 12px 8px 32px;
          color: var(--text-main, #f9fafb);
          font-size: 13px;
          transition: var(--transition, all 0.2s);
        }
        .search-input:focus {
          outline: none;
          border-color: var(--accent-blue, #3b82f6);
          box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
        }
        .search-wrapper {
          position: relative;
        }
        .search-icon {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          width: 14px;
          height: 14px;
          color: var(--text-dim, #9ca3af);
          pointer-events: none;
        }
        .asset-card { background: var(--bg-inset, #262626); border: 1px solid var(--border-light, #374151); border-radius: 8px; overflow: hidden; cursor: pointer; transition: var(--transition, all 0.2s); position: relative; }
        .asset-card:hover { border-color: var(--accent-blue, #3b82f6); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
        .asset-card.selected { border-color: var(--accent-blue, #3b82f6); box-shadow: 0 0 0 2px rgba(59,130,246,0.3); }
        .asset-card.selected::after { content: ''; position: absolute; top: 8px; right: 8px; width: 20px; height: 20px; background: var(--accent-blue, #3b82f6); border-radius: 50%; }
        .asset-card.selected::before { content: '✓'; position: absolute; top: 8px; right: 8px; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; z-index: 1; font-weight: bold; }
        .asset-thumb { width: 100%; aspect-ratio: 16/9; display: flex; align-items: center; justify-content: center; }
        .asset-info { padding: 10px 12px; }
        .asset-name { font-size: 13px; font-weight: 500; margin-bottom: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .asset-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
        .badge-type { background: rgba(59,130,246,0.2); color: var(--accent-blue, #3b82f6); }
        .badge-scene { background: rgba(34,197,94,0.2); color: var(--accent-green, #22c55e); }
        .drop-overlay { position: absolute; inset: 0; background: rgba(59,130,246,0.1); border: 3px dashed var(--accent-blue, #3b82f6); border-radius: 8px; display: none; align-items: center; justify-content: center; z-index: 10; pointer-events: none; }
        .drop-overlay.active { display: flex; }
        .context-menu { position: fixed; background: var(--bg-panel, #1f2937); border: 1px solid var(--widget-border, #4b5563); border-radius: 6px; padding: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.4); z-index: 1000; min-width: 180px; }
        .context-item { padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 13px; display: flex; align-items: center; gap: 10px; color: var(--text-main, #f9fafb); }
        .context-item:hover { background: var(--bg-hover, #374151); }
        .context-item.danger { color: var(--accent-red, #ef4444); }
        .context-divider { height: 1px; background: var(--border-light, #374151); margin: 4px 0; }
        .inspector-preview { width: 100%; aspect-ratio: 16/9; border-radius: 8px; margin-bottom: 16px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .form-group { margin-bottom: 16px; }
        .form-label { display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-dim, #9ca3af); margin-bottom: 6px; }
        .form-input, .form-textarea, .form-select { width: 100%; background: var(--bg-inset, #262626); border: 1px solid var(--widget-border, #4b5563); border-radius: 6px; padding: 8px 12px; color: var(--text-main, #f9fafb); font-size: 13px; font-family: inherit; transition: var(--transition, all 0.2s); }
        .form-input:focus, .form-textarea:focus, .form-select:focus { outline: none; border-color: var(--accent-blue, #3b82f6); box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
        .form-textarea { resize: vertical; min-height: 80px; }
        .tag-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
        .tag-pill { background: var(--bg-inset, #262626); border: 1px solid var(--widget-border, #4b5563); padding: 4px 10px; border-radius: 12px; font-size: 11px; display: flex; align-items: center; gap: 6px; }
        .tag-remove { cursor: pointer; color: var(--text-dim, #9ca3af); }
        .tag-remove:hover { color: var(--accent-red, #ef4444); }
        .section-divider { height: 1px; background: var(--border-light, #374151); margin: 20px 0; }
        .scene-item, .related-item, .version-item { background: var(--bg-inset, #262626); border: 1px solid var(--border-light, #374151); border-radius: 6px; padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; font-size: 13px; }
        .toast { position: fixed; bottom: 50px; right: 20px; background: var(--bg-panel, #1f2937); border: 1px solid var(--accent-blue, #3b82f6); padding: 12px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.4); z-index: 10000; font-size: 13px; }
        .asset-list { width: 100%; border-collapse: collapse; }
        .asset-list thead { position: sticky; top: 0; background: var(--bg-panel, #1f2937); z-index: 1; }
        .asset-list th { text-align: left; padding: 10px 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-dim, #9ca3af); border-bottom: 1px solid var(--border-light, #374151); cursor: pointer; }
        .asset-list th:hover { color: var(--text-main, #f9fafb); }
        .asset-list tbody tr { border-bottom: 1px solid var(--border-light, #374151); cursor: pointer; transition: var(--transition, all 0.2s); }
        .asset-list tbody tr:hover { background: var(--bg-hover, #374151); }
        .asset-list tbody tr.selected { background: rgba(59,130,246,0.15); }
        .asset-list td { padding: 10px 12px; font-size: 13px; }
        .asset-list-thumb { width: 40px; height: 40px; border-radius: 4px; display: flex; align-items: center; justify-content: center; }
        .thumb-strip { display: flex; gap: 12px; overflow-x: auto; padding: 16px; }
        .thumb-strip-item { flex-shrink: 0; width: 200px; cursor: pointer; }
        .thumb-strip-item .asset-card { height: 100%; }
        .toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-light);
          gap: 8px;
          flex-wrap: wrap;
        }
        .toolbar-left, .toolbar-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .btn-group {
          display: flex;
          border: 1px solid var(--widget-border);
          border-radius: 6px;
          overflow: hidden;
        }
        .btn-group .toolbar-btn {
          border: none;
          border-radius: 0;
          border-right: 1px solid var(--widget-border);
        }
        .btn-group .toolbar-btn:last-child {
          border-right: none;
        }
        .btn-group .toolbar-btn.active {
          background: var(--accent-blue);
          color: white;
        }
        .footer {
          height: 36px;
          background: var(--bg-panel);
          border-top: 1px solid var(--border-light);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          font-size: 12px;
          color: var(--text-dim);
        }
        .footer-stats {
          display: flex;
          gap: 20px;
        }
        .asset-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 16px;
          padding: 16px;
        }
        .toolbar-btn {
          background: var(--bg-inset);
          border: 1px solid var(--widget-border);
          color: var(--text-main);
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          transition: var(--transition);
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-weight: 500;
        }
        .toolbar-btn:hover {
          background: var(--bg-hover);
          border-color: var(--accent-blue);
        }
        .toolbar-btn:active {
          transform: scale(0.98);
        }
        .btn-ai {
          background: linear-gradient(to bottom, var(--accent-ai, #2a4268) 0%, var(--accent-ai-light, #3a5278) 100%);
          border-color: var(--accent-ai-border, #152535);
          color: white;
        }
        .btn-danger {
          color: var(--accent-red, #ef4444);
          border-color: rgba(239, 68, 68, 0.3);
        }
        .btn-icon {
          padding: 6px;
          width: 32px;
          height: 32px;
          justify-content: center;
        }
      </style>

     
      <div class="app-container">
        <!-- Left Panel: Folder Tree -->
        <div class="panel panel-left">
          <div class="panel-section-header">
            <span>Folders</span>
            <button class="toolbar-btn btn-icon" style="width:24px;height:24px;border:none;background:transparent;cursor:pointer;color:var(--text-main,#f9fafb);display:flex;align-items:center;justify-content:center;border-radius:4px;"
              @click=${this._newFolder} title="New Folder">
              <i class="fa-solid fa-plus" style="font-size:12px"></i>
            </button>
          </div>
          <div class="search-box">
            <div class="search-wrapper">
              <i class="fa-solid fa-search search-icon"></i>
              <input type="text" class="search-input" placeholder="Search assets..."
                .value=${this._searchQuery}
                @input=${(e: InputEvent) => { this._searchQuery = (e.target as HTMLInputElement).value; this.requestUpdate(); }}
                @click=${(e: Event) => e.stopPropagation()}
              />
            </div>
          </div>
          <div class="folder-tree">
            ${this._folders.map(f => this._renderFolder(f, 0))}
          </div>
        </div>

        <!-- Center Panel: Asset Browser -->
        <div class="panel panel-center"
          @dragover=${(e: DragEvent) => { e.preventDefault(); this._dropActive = true; this.requestUpdate(); }}
          @dragleave=${(e: DragEvent) => { const target = e.currentTarget as HTMLElement; if (!target.contains(e.relatedTarget as Node)) { this._dropActive = false; this.requestUpdate(); } }}
          @drop=${(e: DragEvent) => {
            e.preventDefault();
            this._dropActive = false;
            if (e.dataTransfer?.files?.length) {
              this._showToast(`Uploading ${e.dataTransfer.files!.length} file(s)...`);
              setTimeout(() => this._showToast(`Successfully uploaded ${e.dataTransfer!.files!.length} file(s)`), 1000);
            }
            this.requestUpdate();
          }}>
          <div class="toolbar">
            <div class="toolbar-left">
              <button class="toolbar-btn btn-ai" @click=${() => {
                const input = this.renderRoot?.querySelector('#fileInput') as HTMLInputElement;
                input?.click();
              }}><i class="fa-solid fa-upload"></i> Upload</button>
              <input type="file" id="fileInput" multiple style="display:none" @change=${this._handleFileInput} />
              <button class="toolbar-btn" @click=${() => window.dispatchEvent(new CustomEvent(CG_ASSETS_FETCH, { bubbles: true }))}><i class="fa-solid fa-wand-magic-sparkles"></i> AI Fetch</button>
              <button class="toolbar-btn" @click=${() => window.dispatchEvent(new CustomEvent(CG_ASSETS_GENERATE, { bubbles: true }))}><i class="fa-solid fa-robot"></i> AI Generate</button>
              <button class="toolbar-btn btn-danger" style=${styleMap({ display: this._selectedAssets.size > 0 ? 'inline-flex' : 'none' })}
                @click=${this._deleteSelected}><i class="fa-solid fa-trash"></i> Delete Selected</button>
            </div>
            <div class="toolbar-right">
              <div class="btn-group">
                <button class="toolbar-btn btn-icon ${classMap({ active: this._viewMode === 'grid' })}"
                  @click=${() => { this._viewMode = 'grid'; this.requestUpdate(); }} title="Grid View"><i class="fa-solid fa-th"></i></button>
                <button class="toolbar-btn btn-icon ${classMap({ active: this._viewMode === 'list' })}"
                  @click=${() => { this._viewMode = 'list'; this.requestUpdate(); }} title="List View"><i class="fa-solid fa-list"></i></button>
                <button class="toolbar-btn btn-icon ${classMap({ active: this._viewMode === 'strip' })}"
                  @click=${() => { this._viewMode = 'strip'; this.requestUpdate(); }} title="Thumbnail Strip"><i class="fa-solid fa-grip"></i></button>
              </div>
            </div>
          </div>

          <div class="asset-browser" style="position:relative;flex:1;overflow:hidden;display:flex;flex-direction:column">
            <div class="drop-overlay ${classMap({ active: this._dropActive })}">
              <div class="drop-content" style="text-align:center">
                <i class="fa-solid fa-upload" style="font-size:64px;color:var(--accent-blue,#3b82f6);margin-bottom:16px"></i>
                <h3>Drop files to upload</h3>
                <p style="color:var(--text-dim,#9ca3af);margin-top:8px">Images, videos, audio, 3D models</p>
              </div>
            </div>
            <div class="asset-content">
              ${this._viewMode === 'grid' ? html`
                <div class="asset-grid">
                  ${filteredAssets.length === 0 ? html`
                    <div style="grid-column:1/-1;display:flex;flex-direction:column;align-items:center;justify-content:center;height:200px;color:var(--text-dim,#9ca3af)">
                      <i class="fa-solid fa-cube" style="font-size:48px;opacity:0.2;margin-bottom:16px"></i>
                      <span>No assets match your search</span>
                    </div>
                  ` : filteredAssets.map(a => this._assetCard(a))}
                </div>
              ` : this._viewMode === 'list' ? html`
                <table class="asset-list">
                  <thead>
                    <tr>
                      <th style="width:50px"></th>
                      <th data-sort="name" @click=${() => this._setSort('name')}>Name ${this._sortColumn === 'name' ? (this._sortAsc ? '↑' : '↓') : ''}</th>
                      <th data-sort="type" @click=${() => this._setSort('type')}>Type ${this._sortColumn === 'type' ? (this._sortAsc ? '↑' : '↓') : ''}</th>
                      <th data-sort="scenes" @click=${() => this._setSort('scenes')}>Scene Assignments ${this._sortColumn === 'scenes' ? (this._sortAsc ? '↑' : '↓') : ''}</th>
                      <th data-sort="size" @click=${() => this._setSort('size')}>Size ${this._sortColumn === 'size' ? (this._sortAsc ? '↑' : '↓') : ''}</th>
                      <th data-sort="modified" @click=${() => this._setSort('modified')}>Modified ${this._sortColumn === 'modified' ? (this._sortAsc ? '↑' : '↓') : ''}</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${filteredAssets.length === 0 ? html`
                      <tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-dim,#9ca3af)"><i class="fa-solid fa-cube" style="font-size:32px;opacity:0.2;display:block;margin-bottom:8px"></i>No assets match your search</td></tr>
                    ` : filteredAssets.map(a => html`
                      <tr class="${classMap({ selected: this._selectedAssets.has(a.id) })}" data-asset-id="${a.id}"
                        @click=${(e: MouseEvent) => this._selectAsset(a.id, e)}
                        @contextmenu=${(e: MouseEvent) => { e.preventDefault(); this._showContextMenu('asset', a, e.pageX, e.pageY); }}>
                        <td><div class="asset-list-thumb" style=${styleMap({ background: `${a.color}30` })}><i class="fa-solid ${this._thumbIcon(a)}" style="font-size:18px;opacity:0.6"></i></div></td>
                        <td><strong>${escHtml(a.name)}</strong></td>
                        <td><span class="badge badge-type">${a.type}</span></td>
                        <td><span class="badge badge-scene">${a.scenes.length} scenes</span></td>
                        <td>${a.size}</td>
                        <td>${a.modified}</td>
                      </tr>
                    `)}
                  </tbody>
                </table>
              ` : html`
                <div class="thumb-strip">
                  ${filteredAssets.length === 0 ? html`
                    <div style="width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;color:var(--text-dim,#9ca3af)">
                      <i class="fa-solid fa-cube" style="font-size:48px;opacity:0.2;margin-bottom:16px"></i>
                      <span>No assets match your search</span>
                    </div>
                  ` : filteredAssets.map(a => html`
                    <div class="thumb-strip-item">${this._assetCard(a)}</div>
                  `)}
                </div>
              `}
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="footer">
        <div class="footer-stats">
          <span>${this._assets.length} assets</span>
          <span>${this._selectedAssets.size} selected</span>
        </div>
        <span>Storage: 2.3 GB</span>
      </div>

      <!-- Context Menus -->
      ${this._showFolderMenu && this._contextData ? html`
        <div class="context-menu" style=${styleMap({ left: `${this._contextPos.x}px`, top: `${this._contextPos.y}px` })}
          @click=${(e: Event) => e.stopPropagation()}>
          <div class="context-item" @click=${() => this._handleFolderContextAction('new-subfolder', this._contextData)}>
            <i class="fa-solid fa-plus"></i> New Subfolder
          </div>
          <div class="context-item" @click=${() => this._handleFolderContextAction('rename', this._contextData)}>
            <i class="fa-solid fa-pen"></i> Rename
          </div>
          <div class="context-divider"></div>
          <div class="context-item danger" @click=${() => this._handleFolderContextAction('delete', this._contextData)}>
            <i class="fa-solid fa-trash"></i> Delete Folder
          </div>
        </div>
      ` : nothing}

      ${this._showAssetMenu && this._contextData ? html`
        <div class="context-menu" style=${styleMap({ left: `${this._contextPos.x}px`, top: `${this._contextPos.y}px` })}
          @click=${(e: Event) => e.stopPropagation()}>
          <div class="context-item" @click=${() => this._handleAssetContextAction('open', this._contextData)}>
            <i class="fa-solid fa-eye"></i> Open Preview
          </div>
          <div class="context-item" @click=${() => this._handleAssetContextAction('rename', this._contextData)}>
            <i class="fa-solid fa-pen"></i> Rename
          </div>
          <div class="context-item" @click=${() => this._handleAssetContextAction('duplicate', this._contextData)}>
            <i class="fa-solid fa-copy"></i> Duplicate
          </div>
          <div class="context-divider"></div>
          <div class="context-item danger" @click=${() => this._handleAssetContextAction('delete', this._contextData)}>
            <i class="fa-solid fa-trash"></i> Delete Asset
          </div>
        </div>
      ` : nothing}

      ${this._toast ? html`
        <div class="toast">${this._toast.msg}</div>
      ` : nothing}
    `;
  }
}