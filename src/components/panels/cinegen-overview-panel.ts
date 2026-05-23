import { classMap } from 'lit/directives/class-map.js';
import { html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import './cinegen-overview-master-detail';
import type { TreeNode } from '@/tree/tree-types';
import type { OverviewViewMode } from '@/workspace/workspace-panel-bridge';
import {
  assetStatusClass,
  assetStatusLabel,
  overviewAccentClass,
  overviewChildItems,
  overviewNodeItemCount,
  overviewVisibleChildren,
  type OverviewListItem,
} from '@/workspace/overview-helpers';
import { workspaceState } from '@/workspace/workspace-state';
import { escHtml } from '@/utils/html';

const OV_MODES = [
  { id: 'column' as const, icon: 'fa-table-columns', label: 'Columns' },
  { id: 'row' as const, icon: 'fa-bars', label: 'Rows' },
  { id: 'master' as const, icon: 'fa-table-cells-large', label: 'Browse' },
];

@customElement('cinegen-overview-panel')
export class CinegenOverviewPanel extends CgLightElement {
  @state() private _mode: OverviewViewMode = workspaceState.overviewViewMode;

  connectedCallback(): void {
    if (!this.id) this.id = 'overview-panel-content';
    this.classList.add('flex-1', 'min-h-0', 'min-w-0', 'overflow-hidden');
    if (!this.style.background) this.style.background = 'var(--bg-inset)';
    if (!this.style.display) {
      this.style.display = 'flex';
      this.style.flexDirection = 'column';
    }
    super.connectedCallback();
  }

  syncFromWorkspace(): void {
    this._mode = workspaceState.overviewViewMode;
    this.requestUpdate();
  }

  setMode(mode: OverviewViewMode): void {
    this._mode = mode;
    this.requestUpdate();
  }

  selectCard(_idx: number): void {
    this.requestUpdate();
  }

  refresh(): void {
    this.syncFromWorkspace();
  }

  refreshMasterDetail(): void {
    this.querySelector('cinegen-overview-master-detail')?.requestUpdate();
  }

  private _header(node: TreeNode) {
    const desc = node.desc || '';
    return html`
      <div class="ov-header-bar">
        <div class="ov-mode-group" role="group" aria-label="Overview layout">
          ${OV_MODES.map(
            (m) => html`
              <button
                type="button"
                class=${classMap({ 'ov-mode-btn': true, active: this._mode === m.id })}
                data-mode=${m.id}
                data-ws-ov-mode=${m.id}
                title=${m.label}
              >
                <i class="fa-solid ${m.icon}" aria-hidden="true"></i>
                <span>${m.label}</span>
              </button>
            `
          )}
        </div>
        ${desc ? html`<p class="overview-desc-inline">${escHtml(desc)}</p>` : nothing}
        <button
          type="button"
          class="toolbar-btn"
          style="padding: 2px 8px; font-size: 10px; margin-left:auto;"
          data-ws-action="openSectionSettings"
          title="Section settings"
        >
          <i class="fa-solid fa-gear"></i>
        </button>
        <label class="ov-preview-toggle" title="Show a detail popover when hovering list items">
          <input
            type="checkbox"
            class="ov-preview-toggle-input"
            ?checked=${workspaceState.ovShowHoverPreview}
            data-ws-ov-hover-preview
          />
          <span class="ov-toggle-track"><span class="ov-toggle-thumb"></span></span>
          <span class="ov-preview-toggle-text">Preview on hover</span>
        </label>
      </div>
    `;
  }

  private _card(
    child: TreeNode,
    idx: number,
    accentClass: string,
    mode: 'activate' | 'select',
    selected = false
  ) {
    const icon = child.icon || 'fa-file';
    const count = overviewNodeItemCount(child);
    const countBadge =
      count > 0 ? html`<span class="overview-card-count">${count}</span>` : nothing;

    return html`
      <div
        class=${classMap({
          'overview-card': true,
          ...(accentClass.trim() ? { [accentClass.trim()]: true } : {}),
          selected,
        })}
        role="button"
        tabindex="0"
        data-ws-ov-activate=${mode === 'activate' ? String(idx) : nothing}
        data-ws-ov-select=${mode === 'select' ? String(idx) : nothing}
      >
        <span class="overview-card-icon"><i class="fa-solid ${icon}" aria-hidden="true"></i></span>
        <div class="overview-card-body">
          <span class="overview-card-title">${escHtml(child.name)}${countBadge}</span>
          ${child.desc ? html`<span class="overview-card-desc">${escHtml(child.desc)}</span>` : nothing}
        </div>
      </div>
    `;
  }

  private _colItemBody(item: OverviewListItem, childIdx: number, itemIdx: number, hasLinks: boolean) {
    const tags = item.tags || [];
    return html`
      <div class="ov-col-acc-body">
        ${item.desc
          ? html`<p class="ov-col-acc-desc">${escHtml(item.desc)}</p>`
          : html`<p class="ov-col-acc-desc" style="color:#484848">No description.</p>`}
        <div class="ov-col-acc-meta">
          <span class=${assetStatusClass(item.status)}></span>
          <span class="ov-col-acc-status">${escHtml(assetStatusLabel(item.status))}</span>
        </div>
        ${tags.length
          ? html`<div class="ov-col-acc-tags">${tags.map((t) => html`<span class="asset-tag">${escHtml(t)}</span>`)}</div>`
          : nothing}
        ${hasLinks
          ? html`
              <button
                type="button"
                class="toolbar-btn ov-col-acc-open-btn"
                data-ws-goto-asset=${`${childIdx}:${itemIdx}`}
              >
                <i class="fa-solid fa-arrow-right" aria-hidden="true"></i> Open in detail
              </button>
            `
          : nothing}
      </div>
    `;
  }

  private _colItemRow(
    item: OverviewListItem,
    childIdx: number,
    itemIdx: number,
    hasLinks: boolean,
    rowClass: 'ov-col-item' | 'ov-row-item'
  ) {
    const wrapClass = rowClass === 'ov-col-item' ? 'ov-col-item-wrap' : 'ov-row-item-wrap';
    const chevronClass = rowClass === 'ov-col-item' ? 'ov-col-item-chevron' : 'ov-row-item-chevron';
    const iconClass = rowClass === 'ov-col-item' ? 'ov-col-item-icon' : 'ov-row-item-icon';
    const nameClass = rowClass === 'ov-col-item' ? 'ov-col-item-name' : 'ov-row-item-name';
    const gotoClass = rowClass === 'ov-col-item' ? 'ov-col-goto' : 'ov-row-goto';
    const bodyClass = rowClass === 'ov-col-item' ? 'ov-col-item-body' : 'ov-row-item-body';
    const innerClass = rowClass === 'ov-col-item' ? 'ov-col-item-body-inner' : 'ov-row-item-body-inner';
    const accClass = rowClass === 'ov-row-item' ? 'ov-row-acc-body' : '';

    return html`
      <div class=${wrapClass}>
        <div
          class=${rowClass}
          role="button"
          tabindex="0"
          data-ws-ov-toggle-wrap
          data-ws-ov-preview=${`${childIdx}:${itemIdx}`}
          data-ws-ov-preview-hide
        >
          <span class=${chevronClass}><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></span>
          <span class=${iconClass}><i class="fa-solid ${item.icon || 'fa-box'}" aria-hidden="true"></i></span>
          <span class=${nameClass}>${escHtml(item.name || '—')}</span>
          <span class=${assetStatusClass(item.status)}></span>
          ${hasLinks
            ? html`
                <button
                  type="button"
                  class=${gotoClass}
                  data-ws-goto-asset=${`${childIdx}:${itemIdx}`}
                  title=${`Open ${item.name || ''}`}
                >
                  <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
                </button>
              `
            : nothing}
        </div>
        <div class=${bodyClass}>
          <div class=${innerClass}>
            ${rowClass === 'ov-row-item'
              ? html`<div class=${accClass}>${this._colItemBody(item, childIdx, itemIdx, hasLinks)}</div>`
              : this._colItemBody(item, childIdx, itemIdx, hasLinks)}
          </div>
        </div>
      </div>
    `;
  }

  private _columnView(children: TreeNode[], accentClass: string) {
    if (!children.length) {
      return html`<p class="overview-lead" style="padding:24px">No sections.</p>`;
    }
    return html`
      <div class="ov-col-track">
        ${children.map((child, idx) => {
          const items = overviewChildItems(child);
          const hasLinks = Boolean(child.view === 'asset-detail' && child.detailKey);
          return html`
            <div class="ov-col-container">
              ${this._card(child, idx, accentClass, 'activate')}
              <div class="ov-col-companion">
                <div class="ov-col-list">
                  ${items.length
                    ? items.map((item, itemIdx) =>
                        this._colItemRow(item, idx, itemIdx, hasLinks, 'ov-col-item')
                      )
                    : html`<p class="ov-col-empty">No items yet.</p>`}
                </div>
              </div>
            </div>
          `;
        })}
      </div>
    `;
  }

  private _rowView(children: TreeNode[], accentClass: string) {
    if (!children.length) {
      return html`<p class="overview-lead" style="padding:24px">No sections.</p>`;
    }
    return html`
      <div class="ov-row-track">
        ${children.map((child, idx) => {
          const items = overviewChildItems(child);
          const hasLinks = Boolean(child.view === 'asset-detail' && child.detailKey);
          return html`
            <div class="ov-row-container">
              <div class="ov-row-card-wrap">${this._card(child, idx, accentClass, 'activate')}</div>
              <div class="ov-row-companion">
                <div class="ov-row-tabs">
                  <button type="button" class="ov-row-tab active">Items</button>
                  <button type="button" class="ov-row-tab">Info</button>
                </div>
                <div class="ov-row-list">
                  ${items.length
                    ? items.map((item, itemIdx) =>
                        this._colItemRow(item, idx, itemIdx, hasLinks, 'ov-row-item')
                      )
                    : html`<p class="ov-row-empty">No items yet.</p>`}
                </div>
              </div>
            </div>
          `;
        })}
      </div>
    `;
  }

  private _masterView(node: TreeNode, children: TreeNode[], accentClass: string) {
    if (!children.length) {
      return html`
        ${this._header(node)}
        <p style="padding:16px 24px;font-size:11px;color:var(--text-dim);">No sections.</p>
      `;
    }

    const sel = workspaceState.overviewSelectedCardIdx;
    const selectedChild = sel >= 0 ? children[sel] : null;

    return html`
      <div class="ov-master-layout">
        ${this._header(node)}
        <div class="ov-master-cards">
          <div class="overview-grid">
            ${children.map((child, idx) =>
              this._card(child, idx, accentClass, 'select', idx === sel)
            )}
          </div>
        </div>
        <div class="ov-master-divider"></div>
        ${selectedChild
          ? html`<cinegen-overview-master-detail .child=${selectedChild}></cinegen-overview-master-detail>`
          : html`
              <div class="ov-master-detail" id="ov-master-detail-pane">
                <div class="ov-master-placeholder">
                  <i class="fa-solid fa-hand-pointer" aria-hidden="true"></i>
                  <p>Click a section above to browse its contents here.</p>
                </div>
              </div>
            `}
      </div>
    `;
  }

  render() {
    const node = workspaceState.overviewCurrentNode;
    if (!node) return nothing;

    const children = overviewVisibleChildren(node);
    const accent = overviewAccentClass(node, workspaceState.overviewSectionKey);

    if (this._mode === 'column') {
      return html`${this._header(node)}${this._columnView(children, accent)}`;
    }
    if (this._mode === 'row') {
      return html`${this._header(node)}${this._rowView(children, accent)}`;
    }
    return this._masterView(node, children, accent);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cinegen-overview-panel': CinegenOverviewPanel;
  }
}
