import { html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { CgLightElement } from '@/components/lit-base';
import type { ReferenceSource, SearchResultItem, ProductionReference } from '@/workspace/references-types';
import { searchAll } from '@/services/references-search-service';
import { getProductionReferences, downloadAndSaveReference, removeReference, mirrorToGlobalAssets } from '@/services/production-reference-service';
import { CG_REF_CONTEXTMENU, CG_PRODUCTION_REFERENCES_CHANGED } from '@/events/shell-events';

type TabMode = 'search' | 'library';
type ViewMode = 'grid' | 'masonry';

@customElement('cinegen-references-finder')
export class CinegenReferencesFinder extends CgLightElement {
  @state() private _activeTab: TabMode = 'search';
  @state() private _source: ReferenceSource = 'internet-archive';
  @state() private _query = '';
  @state() private _results: SearchResultItem[] = [];
  @state() private _loading = false;
  @state() private _page = 1;
  @state() private _totalResults = 0;
  @state() private _viewMode: ViewMode = 'grid';
  @state() private _selectedResult: SearchResultItem | null = null;
  @state() private _libraryRefs: ProductionReference[] = [];
  @state() private _selectedRef: ProductionReference | null = null;
  @state() private _downloading = new Set<string>();
  @state() private _downloadError = '';

  private _searchTimer: ReturnType<typeof setTimeout> | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.id = 'view-references-finder';
    this.classList.add('hidden', 'flex', 'flex-col', 'h-full');
    this._refreshLibrary();
  }

  private _refreshLibrary(): void {
    this._libraryRefs = [...getProductionReferences()];
  }

  private _onSourceChange(source: ReferenceSource): void {
    this._source = source;
    this._results = [];
    this._page = 1;
    this._totalResults = 0;
    if (this._query.trim()) {
      this._doSearch();
    }
  }

  private _onQueryInput(e: Event): void {
    const value = (e.target as HTMLInputElement).value;
    this._query = value;
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => {
      this._page = 1;
      this._results = [];
      this._totalResults = 0;
      if (value.trim()) this._doSearch();
    }, 400);
  }

  private async _doSearch(): Promise<void> {
    const q = this._query.trim();
    if (!q) return;
    this._loading = true;
    try {
      const res = await searchAll(q, this._source, this._page);
      this._results = this._page === 1 ? res.items : [...this._results, ...res.items];
      this._totalResults = res.totalResults;
    } catch {
      this._results = [];
      this._totalResults = 0;
    } finally {
      this._loading = false;
    }
  }

  private _loadMore(): void {
    this._page++;
    this._doSearch();
  }

  private async _handleDownload(resultItem: SearchResultItem): Promise<void> {
    if (this._downloading.has(resultItem.id)) return;
    this._downloading = new Set(this._downloading).add(resultItem.id);
    this._downloadError = '';
    try {
      const ref = await downloadAndSaveReference(resultItem, this._source);
      if (ref) {
        this._refreshLibrary();
        this._selectedResult = null;
      }
    } catch {
      this._downloadError = 'Download failed. The image may not be available.';
    } finally {
      const next = new Set(this._downloading);
      next.delete(resultItem.id);
      this._downloading = next;
    }
  }

  private async _handleRemoveRef(id: string): Promise<void> {
    await removeReference(id);
    this._refreshLibrary();
    if (this._selectedRef?.id === id) this._selectedRef = null;
  }

  private _handleRefContextMenu(e: MouseEvent, ref: ProductionReference): void {
    e.preventDefault();
    this._selectedRef = ref;
    const evt = new CustomEvent(CG_REF_CONTEXTMENU, {
      bubbles: true,
      composed: true,
      detail: { ref, x: e.clientX, y: e.clientY },
    });
    this.dispatchEvent(evt);
  }

  private _handleResultContextMenu(e: MouseEvent, result: SearchResultItem): void {
    e.preventDefault();
    this._selectedResult = result;
  }

  private _sourceLabel(source: ReferenceSource): string {
    const labels: Record<ReferenceSource, string> = {
      'internet-archive': 'Internet Archive',
      'library-of-congress': 'Library of Congress',
      'wikimedia-commons': 'Wikimedia Commons',
    };
    return labels[source];
  }

  private _sourceIcon(source: ReferenceSource): string {
    const icons: Record<ReferenceSource, string> = {
      'internet-archive': 'fa-archive',
      'library-of-congress': 'fa-landmark',
      'wikimedia-commons': 'fa-wikipedia-w',
    };
    return icons[source];
  }

  render() {
    return html`
      <style>
        .masonry-grid { column-count: 3; column-gap: 0.75rem; }
        .masonry-grid > * { break-inside: avoid; margin-bottom: 0.75rem; }
        @media (max-width: 1024px) { .masonry-grid { column-count: 2; } }
        @media (max-width: 640px) { .masonry-grid { column-count: 1; } }
      </style>
      <cg-panel-header>
        <span slot="title" class="workspace-panel-title"
          ><i class="fa-solid fa-image"></i> REFERENCES FINDER</span
        >
      </cg-panel-header>
      <div class="panel-content flex flex-col flex-1 overflow-hidden">
        ${this._renderTabBar()}
        ${this._activeTab === 'search' ? this._renderSearchTab() : this._renderLibraryTab()}
      </div>
      ${this._renderDetailOverlay()}
    `;
  }

  private _renderTabBar() {
    return html`
      <div class="flex border-b border-gray-700">
        <button
          class="px-4 py-2 text-sm font-medium ${this._activeTab === 'search' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}"
          @click=${() => { this._activeTab = 'search'; }}
        >
          <i class="fa-solid fa-search mr-1"></i> Search
        </button>
        <button
          class="px-4 py-2 text-sm font-medium ${this._activeTab === 'library' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}"
          @click=${() => { this._activeTab = 'library'; this._refreshLibrary(); }}
        >
          <i class="fa-solid fa-book mr-1"></i> Library (${this._libraryRefs.length})
        </button>
      </div>
    `;
  }

  private _renderSearchTab() {
    return html`
      <div class="flex flex-col flex-1 overflow-hidden">
        <div class="flex gap-2 p-2 bg-gray-900 border-b border-gray-700">
          ${(['internet-archive', 'library-of-congress', 'wikimedia-commons'] as ReferenceSource[]).map((src) => html`
            <button
              class="px-3 py-1.5 rounded text-xs font-medium ${this._source === src ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
              @click=${() => this._onSourceChange(src)}
            >
              <i class="fa-brands ${this._sourceIcon(src)} mr-1"></i>${this._sourceLabel(src)}
            </button>
          `)}
        </div>
        <div class="flex gap-2 p-2 bg-gray-800 items-center">
          <div class="flex-1 relative">
            <i class="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
            <input
              type="text"
              class="w-full bg-gray-700 text-white rounded pl-8 pr-3 py-1.5 text-sm border border-gray-600 focus:outline-none focus:border-blue-500"
              placeholder="Search for reference images..."
              .value=${this._query}
              @input=${this._onQueryInput}
            />
          </div>
          <div class="flex gap-1">
            <button
              class="px-2 py-1.5 rounded text-xs ${this._viewMode === 'grid' ? 'bg-gray-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'}"
              @click=${() => { this._viewMode = 'grid'; }}
              title="Grid view"
            >
              <i class="fa-solid fa-grid-2"></i>
            </button>
            <button
              class="px-2 py-1.5 rounded text-xs ${this._viewMode === 'masonry' ? 'bg-gray-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'}"
              @click=${() => { this._viewMode = 'masonry'; }}
              title="Masonry view"
            >
              <i class="fa-solid fa-masonry"></i>
            </button>
          </div>
        </div>
        <div class="flex-1 overflow-auto p-3">
          ${this._loading && this._results.length === 0 ? this._renderLoading() : nothing}
          ${this._results.length === 0 && !this._loading && this._query.trim() ? html`
            <div class="text-gray-400 text-center mt-8">No results found</div>
          ` : nothing}
          ${this._results.length === 0 && !this._loading && !this._query.trim() ? html`
            <div class="text-gray-500 text-center mt-16">
              <i class="fa-solid fa-image text-4xl mb-3 block"></i>
              <p>Search for reference images from public archives</p>
              <p class="text-xs mt-2">Internet Archive &bull; Library of Congress &bull; Wikimedia Commons</p>
            </div>
          ` : nothing}
          ${this._results.length > 0 ? html`
            <div class="${this._viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3' : 'masonry-grid'}">
              ${repeat(this._results, (item) => item.id, (item) => this._renderResultCard(item))}
            </div>
            ${this._results.length < this._totalResults ? html`
              <div class="text-center mt-4">
                <button
                  class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm"
                  @click=${this._loadMore}
                  ?disabled=${this._loading}
                >
                  ${this._loading ? 'Loading...' : `Load more (${this._results.length} of ${this._totalResults})`}
                </button>
              </div>
            ` : nothing}
          ` : nothing}
          ${this._downloadError ? html`
            <div class="text-red-400 text-xs mt-2 p-2 bg-red-900/30 rounded">${this._downloadError}</div>
          ` : nothing}
        </div>
      </div>
    `;
  }

  private _renderResultCard(item: SearchResultItem) {
    const isDownloading = this._downloading.has(item.id);
    return html`
      <div
        class="bg-gray-800 rounded overflow-hidden border border-gray-700 hover:border-blue-500/50 cursor-pointer group relative ${this._viewMode === 'masonry' ? 'break-inside-avoid mb-3' : ''}"
        @click=${() => { this._selectedResult = item; }}
        @contextmenu=${(e: MouseEvent) => this._handleResultContextMenu(e, item)}
      >
        <div class="aspect-video bg-gray-900 overflow-hidden">
          ${item.thumbnailUrl ? html`
            <img
              src=${item.thumbnailUrl}
              alt=${item.title}
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              loading="lazy"
              @error=${(e: Event) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ` : html`
            <div class="flex items-center justify-center h-full text-gray-600">
              <i class="fa-solid fa-image text-3xl"></i>
            </div>
          `}
        </div>
        <div class="p-2">
          <div class="text-xs text-white truncate font-medium" title=${item.title}>${item.title}</div>
          <div class="flex items-center gap-1 mt-1">
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">${this._sourceLabel(item.source)}</span>
            ${item.creator ? html`<span class="text-[10px] text-gray-400 truncate">${item.creator}</span>` : nothing}
          </div>
          ${item.description ? html`
            <div class="text-[10px] text-gray-500 mt-1 line-clamp-2">${item.description}</div>
          ` : nothing}
        </div>
        <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            class="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium ${isDownloading ? 'opacity-50' : ''}"
            @click=${(e: Event) => { e.stopPropagation(); this._handleDownload(item); }}
            ?disabled=${isDownloading}
          >
            ${isDownloading ? html`<i class="fa-solid fa-spinner fa-spin"></i>` : html`<i class="fa-solid fa-download"></i>`}
          </button>
        </div>
      </div>
    `;
  }

  private _renderLibraryTab() {
    if (this._libraryRefs.length === 0) {
      return html`
        <div class="flex-1 flex items-center justify-center text-gray-500">
          <div class="text-center">
            <i class="fa-solid fa-book text-4xl mb-3 block"></i>
            <p>No downloaded references yet</p>
            <p class="text-xs mt-2">Search and download images from the Search tab</p>
          </div>
        </div>
      `;
    }
    return html`
      <div class="flex-1 overflow-auto p-3">
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          ${repeat(this._libraryRefs, (ref) => ref.id, (ref) => this._renderLibraryCard(ref))}
        </div>
      </div>
    `;
  }

  private _renderLibraryCard(ref: ProductionReference) {
    return html`
      <div
        class="bg-gray-800 rounded overflow-hidden border border-gray-700 hover:border-green-500/50 cursor-pointer relative"
        @click=${() => { this._selectedRef = ref; }}
        @contextmenu=${(e: MouseEvent) => { this._handleRefContextMenu(e, ref); }}
      >
        <div class="aspect-video bg-gray-900 overflow-hidden">
          ${ref.thumbnailDataUrl ? html`
            <img src=${ref.thumbnailDataUrl} alt=${ref.title} class="w-full h-full object-cover" loading="lazy" />
          ` : html`
            <div class="flex items-center justify-center h-full text-gray-600">
              <i class="fa-solid fa-image text-3xl"></i>
            </div>
          `}
        </div>
        <div class="p-2">
          <div class="text-xs text-white truncate font-medium" title=${ref.title}>${ref.title}</div>
          <div class="flex flex-wrap gap-1 mt-1">
            ${ref.colorPalette.slice(0, 4).map((hex) => html`
              <span class="w-3 h-3 rounded-full inline-block border border-gray-600" style="background-color: ${hex}" title=${hex}></span>
            `)}
          </div>
          <div class="flex flex-wrap gap-1 mt-1">
            ${ref.tags.slice(0, 3).map((tag) => html`
              <span class="text-[10px] px-1 py-0.5 rounded bg-gray-700 text-gray-300">${tag}</span>
            `)}
          </div>
        </div>
        <button
          class="absolute top-2 right-2 px-1.5 py-0.5 bg-red-700/80 hover:bg-red-600 text-white rounded text-[10px] opacity-0 hover:opacity-100 transition-opacity"
          @click=${(e: Event) => { e.stopPropagation(); this._handleRemoveRef(ref.id); }}
          title="Remove"
        >
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `;
  }

  private _renderDetailOverlay() {
    const result = this._selectedResult;
    const ref = this._selectedRef;
    const item = result || ref;
    if (!item) return nothing;

    const isRef = !!ref;
    const title = 'title' in item ? item.title : '';
    const description = 'description' in item ? (item.description || '') : (ref?.metadata.description || '');
    const creator = ref?.metadata.creator || ('creator' in item ? (item.creator || '') : '');
    const date = ref?.metadata.date || ('date' in item ? (item.date || '') : '');
    const sourceUrl = ref?.sourceUrl || ('sourceUrl' in item ? (item.sourceUrl || '') : '');
    const sourcePageUrl = ref?.sourcePageUrl || ('sourcePageUrl' in item ? (item.sourcePageUrl || '') : '');
    const imageUrl = ref?.thumbnailDataUrl || ('thumbnailUrl' in item ? (item.thumbnailUrl || '') : '');
    const palette = ref?.colorPalette || [];

    return html`
      <div class="fixed inset-0 z-50 bg-black/70 flex items-center justify-center" @click=${() => { this._selectedResult = null; this._selectedRef = null; }}>
        <div class="bg-gray-800 rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto" @click=${(e: Event) => e.stopPropagation()}>
          <div class="flex justify-between items-center p-3 border-b border-gray-700">
            <h3 class="text-sm font-medium text-white truncate">${title}</h3>
            <button class="text-gray-400 hover:text-white" @click=${() => { this._selectedResult = null; this._selectedRef = null; }}>
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          ${imageUrl ? html`
            <div class="bg-gray-900 flex items-center justify-center p-2">
              <img src=${imageUrl} alt=${title} class="max-w-full max-h-80 object-contain rounded" />
            </div>
          ` : nothing}
          <div class="p-3 space-y-2 text-xs">
            ${palette.length > 0 ? html`
              <div>
                <span class="text-gray-400 block mb-1">Color Palette</span>
                <div class="flex gap-1">
                  ${palette.map((hex) => html`
                    <span class="w-6 h-6 rounded border border-gray-600" style="background-color: ${hex}" title=${hex}></span>
                  `)}
                </div>
              </div>
            ` : nothing}
            ${description ? html`
              <div><span class="text-gray-400">Description:</span> <span class="text-gray-200">${description}</span></div>
            ` : nothing}
            ${creator ? html`
              <div><span class="text-gray-400">Creator:</span> <span class="text-gray-200">${creator}</span></div>
            ` : nothing}
            ${date ? html`
              <div><span class="text-gray-400">Date:</span> <span class="text-gray-200">${date}</span></div>
            ` : nothing}
            ${sourceUrl ? html`
              <div><span class="text-gray-400">Source:</span> <a href=${sourceUrl} target="_blank" class="text-blue-400 hover:underline">${sourceUrl}</a></div>
            ` : nothing}
            ${sourcePageUrl ? html`
              <div><span class="text-gray-400">Page:</span> <a href=${sourcePageUrl} target="_blank" class="text-blue-400 hover:underline">View original</a></div>
            ` : nothing}
          </div>
          <div class="flex gap-2 p-3 border-t border-gray-700">
            ${!isRef && result ? html`
              <button
                class="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium"
                @click=${() => { this._handleDownload(result); }}
              >
                <i class="fa-solid fa-download mr-1"></i> Download to Project
              </button>
            ` : nothing}
            ${isRef && ref ? html`
              <button
                class="flex-1 px-3 py-2 bg-red-700 hover:bg-red-600 text-white rounded text-sm font-medium"
                @click=${() => { this._handleRemoveRef(ref.id); }}
              >
                <i class="fa-solid fa-trash-can mr-1"></i> Remove
              </button>
              <button
                class="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm font-medium"
                @click=${(e: MouseEvent) => { this._handleRefContextMenu(e, ref); }}
              >
                <i class="fa-solid fa-arrow-right mr-1"></i> Assign...
              </button>
            ` : nothing}
          </div>
        </div>
      </div>
    `;
  }

  private _renderLoading() {
    return html`
      <div class="flex items-center justify-center h-48">
        <div class="text-center text-gray-400">
          <i class="fa-solid fa-spinner fa-spin text-2xl mb-2 block"></i>
          <span class="text-sm">Searching...</span>
        </div>
      </div>
    `;
  }
}
