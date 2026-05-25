import { classMap } from 'lit/directives/class-map.js';
import { html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import { assetDetailData, breakdownData, currentSceneData } from '@/data/project-data';
import type { TreeNode } from '@/tree/tree-types';
import { assetStatusClass, assetStatusLabel } from '@/workspace/overview-helpers';
import { workspaceState } from '@/workspace/workspace-state';
import { buildShotListRows, formatShotDisplayLabel } from '@/workspace/shot-frame-bridge';
import { escHtml } from '@/utils/html';

type AssetItem = {
  name?: string;
  desc?: string;
  icon?: string;
  tags?: string[];
  status?: string;
  notes?: string;
  duration?: string;
};

type AssetDetail = {
  layout?: string;
  icon?: string;
  desc?: string;
  addLabel?: string;
  items?: AssetItem[];
  columns?: string[];
  rows?: string[][];
};

function findSceneRefsForItem(itemName: string): string[] {
  if (!itemName) return [];
  const lower = itemName.toLowerCase();
  const refs: string[] = [];
  breakdownData.forEach((row) => {
    const fields = [row.props, row.wardrobe, row.sfx, row.characters, row.notes, row.location];
    if (fields.some((f) => f && f.toLowerCase().includes(lower))) {
      refs.push(`Scene ${row.scene} — ${row.int_ext} ${row.location} (${row.time})`);
    }
  });
  return refs;
}

@customElement('cinegen-overview-master-detail')
export class CinegenOverviewMasterDetail extends CgLightElement {
  @property({ attribute: false }) child: TreeNode | null = null;

  connectedCallback(): void {
    this.id = 'ov-master-detail-pane';
    this.classList.add('ov-master-detail');
    super.connectedCallback();
  }

  private _saveField(key: string, value: string): void {
    window._saveAssetItemField?.(key, value);
  }

  private _shotListTemplate() {
    const rows = buildShotListRows();
    if (!rows.length) {
      return html`<p class="asset-detail-empty">No shots yet. Add scene coverage to populate this list.</p>`;
    }

    const dotClass = (status: string) => {
      const cls =
        status === 'rendered' || status === 'best take'
          ? 'approved'
          : status === 'take'
            ? 'in-progress'
            : 'pending';
      return `asset-status-dot asset-status-${cls}`;
    };

    const shotNumCell = (row: (typeof rows)[number]) => {
      if (row.kind !== 'coverage' || row.shotNumber == null) return '—';
      return escHtml(formatShotDisplayLabel(row.sceneNumber, row.shotNumber));
    };

    const framesCell = (row: (typeof rows)[number]) => {
      if (row.kind !== 'coverage') return '—';
      return String(row.frameCount ?? 0);
    };

    return html`
      <div class="ov-master-table-wrap">
        <div class="continuity-table-wrap">
          <table class="continuity-table">
            <thead>
              <tr>
                <th>Scene</th>
                <th>Shot</th>
                <th>Type</th>
                <th>Label</th>
                <th>Frames</th>
                <th>Duration</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(
                (r) => html`
                  <tr>
                    <td class="continuity-scene-col">${escHtml(r.sceneLabel)}</td>
                    <td>${shotNumCell(r)}</td>
                    <td>${escHtml(r.type)}</td>
                    <td>${escHtml(r.label)}</td>
                    <td>${framesCell(r)}</td>
                    <td>${escHtml(r.duration)}</td>
                    <td>
                      <span class=${dotClass(r.status)} title=${escHtml(r.status)}></span>
                      ${escHtml(r.status)}
                    </td>
                  </tr>
                `
              )}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  private _continuityTemplate(data: AssetDetail) {
    const cols = data.columns || [];
    const rows = data.rows || [];
    if (!cols.length) return html`<p class="asset-detail-empty">No continuity data.</p>`;
    return html`
      <div class="ov-master-table-wrap">
        <div class="continuity-table-wrap">
          <table class="continuity-table">
            <thead>
              <tr>${cols.map((c) => html`<th>${escHtml(c)}</th>`)}</tr>
            </thead>
            <tbody>
              ${rows.map(
                (row) => html`
                  <tr>
                    ${row.map(
                      (cell, i) => html`
                        <td class=${i === 0 ? 'continuity-scene-col' : ''}>${escHtml(cell || '—')}</td>
                      `
                    )}
                  </tr>
                `
              )}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  private _formEmpty(addLabel: string) {
    return html`
      <div class="asset-form-empty">
        <i class="fa-solid fa-arrow-left" aria-hidden="true" style="font-size:22px;opacity:0.25;"></i>
        <p>
          Select an item from the list, or click <strong>${escHtml(addLabel)}</strong> to create one.
        </p>
      </div>
    `;
  }

  private _detailForm(item: AssetItem, data: AssetDetail, _idx: number) {
    const name = item.name || '';
    const desc = item.desc || '';
    const status = item.status || 'pending';
    const tags = (item.tags || []).join(', ');
    const icon = item.icon || data.icon || 'fa-box';
    const notes = item.notes || '';
    const duration = item.duration !== undefined ? item.duration : null;
    const sceneRefs = findSceneRefsForItem(name);

    return html`
      <form class="asset-form" autocomplete="off" @submit=${(e: Event) => e.preventDefault()}>
        <div class="asset-form-media">
          <div class="asset-form-thumb-box">
            <i class="fa-solid ${icon}" aria-hidden="true"></i>
          </div>
          <div class="asset-form-media-body">
            <div class="asset-form-media-title">${escHtml(name) || 'Untitled'}</div>
            <p class="asset-form-media-hint">
              Drop a reference image here or generate one to drive AI rendering.
            </p>
            <div class="asset-form-media-actions">
              <button type="button" class="toolbar-btn" style="padding:2px 8px;font-size:10px;">
                <i class="fa-solid fa-file-import" aria-hidden="true"></i> Import Image
              </button>
              <button type="button" class="toolbar-btn btn-ai" style="padding:2px 8px;font-size:10px;">
                <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> Generate
              </button>
            </div>
          </div>
        </div>

        <div class="asset-form-section">
          <div class="asset-form-section-title">Identity</div>
          <div class="asset-form-row">
            <label for="asset-form-name">Name</label>
            <input
              id="asset-form-name"
              class="cg-field"
              type="text"
              .value=${name}
              @input=${(e: Event) => this._saveField('name', (e.target as HTMLInputElement).value)}
            />
          </div>
          <div class="asset-form-row">
            <label for="asset-form-status">Status</label>
            <div class="cg-nspopup-wrap">
              <select
                id="asset-form-status"
                class="cg-nspopup"
                .value=${status}
                @change=${(e: Event) => this._saveField('status', (e.target as HTMLSelectElement).value)}
              >
                <option value="approved">Approved</option>
                <option value="in-progress">In Progress</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>
          <div class="asset-form-row">
            <label for="asset-form-icon">Icon <small>FA class, e.g. fa-lightbulb</small></label>
            <input
              id="asset-form-icon"
              class="cg-field"
              type="text"
              .value=${icon}
              placeholder="fa-box"
              @input=${(e: Event) => this._saveField('icon', (e.target as HTMLInputElement).value)}
            />
          </div>
        </div>

        <div class="asset-form-section">
          <div class="asset-form-section-title">Description</div>
          <div class="asset-form-row">
            <label for="asset-form-desc">For AI <small>generation prompt hint</small></label>
            <textarea
              id="asset-form-desc"
              class="cg-field asset-form-textarea"
              rows="3"
              .value=${desc}
              @input=${(e: Event) => this._saveField('desc', (e.target as HTMLTextAreaElement).value)}
            ></textarea>
          </div>
        </div>

        ${duration !== null
          ? html`
              <div class="asset-form-section">
                <div class="asset-form-section-title">Timing</div>
                <div class="asset-form-row">
                  <label for="asset-form-duration">Duration</label>
                  <input
                    id="asset-form-duration"
                    class="cg-field"
                    type="text"
                    .value=${duration}
                    placeholder="e.g. 1m 30s"
                    @input=${(e: Event) =>
                      this._saveField('duration', (e.target as HTMLInputElement).value)}
                  />
                </div>
              </div>
            `
          : nothing}

        <div class="asset-form-section">
          <div class="asset-form-section-title">Tags</div>
          <div class="asset-form-row">
            <label for="asset-form-tags">Comma-separated</label>
            <input
              id="asset-form-tags"
              class="cg-field"
              type="text"
              .value=${tags}
              @input=${(e: Event) => this._saveField('tags', (e.target as HTMLInputElement).value)}
            />
          </div>
          <div id="asset-form-tags-chips" class="asset-form-tags-chips">
            ${(item.tags || []).map((t) => html`<span class="asset-tag">${escHtml(t)}</span>`)}
          </div>
        </div>

        <div class="asset-form-section">
          <div class="asset-form-section-title">Notes</div>
          <div class="asset-form-row">
            <textarea
              id="asset-form-notes"
              class="cg-field asset-form-textarea"
              rows="2"
              .value=${notes}
              @input=${(e: Event) => this._saveField('notes', (e.target as HTMLTextAreaElement).value)}
            ></textarea>
          </div>
        </div>

        <div class="asset-form-section">
          <div class="asset-form-section-title">Scene references</div>
          <div class="asset-form-refs">
            ${sceneRefs.length
              ? sceneRefs.map((r) => html`<div class="asset-form-ref-row">${escHtml(r)}</div>`)
              : html`<p class="asset-form-refs-hint">No breakdown mentions found for this item name.</p>`}
          </div>
        </div>

        <div class="asset-form-actions">
          <button
            type="button"
            class="toolbar-btn"
            style="font-size:10px;color:var(--text-dim);"
            data-ws-delete-asset=${String(workspaceState.assetDetailSelectedIdx)}
          >
            <i class="fa-solid fa-trash" aria-hidden="true"></i> Delete item
          </button>
        </div>
      </form>
    `;
  }

  private _assetMasterDetail(data: AssetDetail) {
    const items = data.items || [];
    const addLabel = data.addLabel || 'Items';
    const sel = workspaceState.assetDetailSelectedIdx;
    const selected = sel >= 0 && sel < items.length ? items[sel] : null;

    return html`
      <div class="asset-master-detail">
        <div id="asset-master-pane" class="asset-master">
          <div class="asset-master-header">
            <span>${escHtml(addLabel)}</span>
            <span class="asset-master-count">${items.length}</span>
          </div>
          ${items.length
            ? items.map(
                (item, idx) => html`
                  <div
                    class=${classMap({
                      'asset-master-item': true,
                      selected: idx === sel,
                    })}
                    data-idx=${String(idx)}
                    role="button"
                    tabindex="0"
                    data-ws-asset-idx=${String(idx)}
                  >
                    <span class="asset-master-item-icon"
                      ><i class="fa-solid ${item.icon || 'fa-box'}" aria-hidden="true"></i
                    ></span>
                    <span class="asset-master-item-name">${escHtml(item.name || 'Untitled')}</span>
                    <span class=${assetStatusClass(item.status)}></span>
                  </div>
                `
              )
            : html`<p class="asset-master-empty">No items yet. Click Add to create one.</p>`}
        </div>
        <div id="asset-form-pane" class="asset-form-pane">
          ${selected ? this._detailForm(selected, data, sel) : this._formEmpty(addLabel)}
        </div>
      </div>
    `;
  }

  render() {
    const child = this.child;
    if (!child) return nothing;

    if (child.view === 'asset-detail' && child.detailKey) {
      const data = assetDetailData[child.detailKey as keyof typeof assetDetailData] as AssetDetail | undefined;
      if (!data) {
        return html`
          <div class="ov-master-placeholder">
            <p>No data configured for <strong>${escHtml(child.name)}</strong>.</p>
          </div>
        `;
      }

      workspaceState.assetDetailCurrentNode = child;
      const items = data.items || [];
      if (workspaceState.assetDetailSelectedIdx < 0 || workspaceState.assetDetailSelectedIdx >= items.length) {
        workspaceState.assetDetailSelectedIdx = items.length > 0 ? 0 : -1;
      }

      if (data.layout === 'shot-table') return this._shotListTemplate();
      if (data.layout === 'continuity') return this._continuityTemplate(data);
      return this._assetMasterDetail(data);
    }

    const idx = workspaceState.overviewSelectedCardIdx;
    return html`
      <div class="ov-master-placeholder">
        <i class="fa-solid fa-folder-open" aria-hidden="true"></i>
        <p><strong>${escHtml(child.name)}</strong> is a folder with sub-sections.</p>
        <button
          type="button"
          class="toolbar-btn"
          style="margin-top:10px;font-size:11px;"
          data-ws-ov-activate=${String(idx)}
        >
          <i class="fa-solid fa-arrow-right" aria-hidden="true"></i> Open ${escHtml(child.name)}
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cinegen-overview-master-detail': CinegenOverviewMasterDetail;
  }
}
