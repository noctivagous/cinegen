/**
 * Asset detail panel — extracted from workspace-bundle.ts
 */
import { escHtml } from '@/utils/html';
import type { TreeNode } from '@/tree/tree-types';
import { workspaceState } from '@/workspace/workspace-state';
import { getCinegenOverviewPanel } from '@/panels/panel-hosts';
import { assetDetailData } from '@/data/project-data';
import { _renderAssetDetailForm, _renderAssetFormEmpty } from '@/workspace/asset-form-renderers';
import { renderContinuityTable, renderShotListTable } from '@/workspace/table-renderers';

const escapeHtml = escHtml;

/* ── Master list ─────────────────────────────────────────────────────── */

function _renderAssetMasterList(items: Array<Record<string, unknown>>, selectedIdx: number): string {
  if (!items.length) return '<p class="asset-master-empty">No items yet. Click Add to create one.</p>';
  return items.map((item, idx) => {
    const statusClass = `asset-status-${(String(item.status || 'pending')).replace(/\s+/g, '-')}`;
    const sel = idx === selectedIdx ? ' selected' : '';
    return `
      <div class="asset-master-item${sel}" data-idx="${idx}" role="button" tabindex="0"
           data-ws-asset-idx="${idx}">
        <span class="asset-master-item-icon"><i class="fa-solid ${item.icon || 'fa-box'}" aria-hidden="true"></i></span>
        <span class="asset-master-item-name">${escapeHtml(String(item.name || 'Untitled'))}</span>
        <span class="asset-status-dot ${statusClass}"></span>
      </div>`;
  }).join('');
}

/* ── Item selection ──────────────────────────────────────────────────── */

function selectAssetItem(idx: number): void {
  const node = workspaceState.assetDetailCurrentNode;
  if (!node || !node.detailKey) return;
  const data = (assetDetailData as Record<string, unknown>)[node.detailKey] as Record<string, unknown>;
  if (!data || !data.items) return;
  workspaceState.assetDetailSelectedIdx = idx;

  const overviewPanel = getCinegenOverviewPanel();
  if (overviewPanel?.querySelector('cinegen-overview-master-detail')) {
    overviewPanel.refreshMasterDetail();
    return;
  }

  document.querySelectorAll('#asset-master-pane .asset-master-item').forEach((el, i) => {
    el.classList.toggle('selected', i === idx);
  });

  const formPane = document.getElementById('asset-form-pane');
  if (!formPane) return;
  const items = data.items as Array<Record<string, unknown>>;
  const item = items[idx];
  formPane.innerHTML = item
    ? _renderAssetDetailForm(item, data, idx)
    : _renderAssetFormEmpty(data);
}

/* ── Add / delete items ──────────────────────────────────────────────── */

function addAssetItem(): void {
  const node = workspaceState.assetDetailCurrentNode;
  if (!node || !node.detailKey) return;
  const data = (assetDetailData as Record<string, unknown>)[node.detailKey] as Record<string, unknown>;
  if (!data) return;
  if (!data.items) data.items = [];
  const newItem: Record<string, unknown> = {
    name: 'New Item',
    desc: '',
    icon: data.icon || 'fa-box',
    tags: [],
    status: 'pending',
    notes: '',
  };
  if (data.layout === 'list') newItem.duration = '';
  (data.items as Array<Record<string, unknown>>).push(newItem);
  workspaceState.assetDetailSelectedIdx = (data.items as Array<Record<string, unknown>>).length - 1;
  const overviewPanel = getCinegenOverviewPanel();
  if (overviewPanel?.querySelector('cinegen-overview-master-detail')) {
    overviewPanel.refreshMasterDetail();
  } else {
    renderAssetDetailPanel(node);
  }
  requestAnimationFrame(() => {
    const last = document.querySelector('#asset-master-pane .asset-master-item:last-child');
    if (last) last.scrollIntoView({ block: 'nearest' });
    const nameInput = document.getElementById('asset-form-name') as HTMLInputElement | null;
    if (nameInput) nameInput.select();
  });
}

function deleteAssetItem(idx: number): void {
  const node = workspaceState.assetDetailCurrentNode;
  if (!node || !node.detailKey) return;
  const data = (assetDetailData as Record<string, unknown>)[node.detailKey] as Record<string, unknown>;
  const items = data?.items as Array<Record<string, unknown>> | undefined;
  if (!data || !items || idx < 0 || idx >= items.length) return;
  const itemName = String(items[idx].name || 'this item');
  if (!confirm(`Delete "${itemName}"?`)) return;
  items.splice(idx, 1);
  workspaceState.assetDetailSelectedIdx = Math.min(idx, items.length - 1);
  const overviewPanel = getCinegenOverviewPanel();
  if (overviewPanel?.querySelector('cinegen-overview-master-detail')) {
    overviewPanel.refreshMasterDetail();
  } else {
    renderAssetDetailPanel(node);
  }
}

/* ── Live field saving ───────────────────────────────────────────────── */

function _saveAssetItemField(key: string, value: string): void {
  const node = workspaceState.assetDetailCurrentNode;
  if (!node || !node.detailKey) return;
  const data = (assetDetailData as Record<string, unknown>)[node.detailKey] as Record<string, unknown>;
  if (!data || !data.items) return;
  const items = data.items as Array<Record<string, unknown>>;
  const item = items[workspaceState.assetDetailSelectedIdx];
  if (!item) return;

  if (key === 'tags') {
    item.tags = value.split(',').map((t) => t.trim()).filter(Boolean);
    const chipsEl = document.getElementById('asset-form-tags-chips');
    if (chipsEl) chipsEl.innerHTML = (item.tags as string[]).map((t) => `<span class="asset-tag">${escapeHtml(t)}</span>`).join('');
  } else {
    item[key] = value;
  }

  const masterItem = document.querySelector(`#asset-master-pane .asset-master-item[data-idx="${workspaceState.assetDetailSelectedIdx}"]`);
  if (masterItem) {
    if (key === 'name') {
      const nameEl = masterItem.querySelector('.asset-master-item-name');
      if (nameEl) nameEl.textContent = value || 'Untitled';
      const titleEl = document.querySelector('.asset-form-media-title');
      if (titleEl) titleEl.textContent = value || 'Untitled';
    }
    if (key === 'icon') {
      const iconEl = masterItem.querySelector('.asset-master-item-icon i');
      if (iconEl) iconEl.className = `fa-solid ${value || 'fa-box'}`;
      const thumbEl = document.querySelector('.asset-form-thumb-box i');
      if (thumbEl) thumbEl.className = `fa-solid ${value || 'fa-box'}`;
    }
    if (key === 'status') {
      const dotEl = masterItem.querySelector('.asset-status-dot');
      if (dotEl) dotEl.className = `asset-status-dot asset-status-${(value || 'pending').replace(/\s+/g, '-')}`;
    }
  }
}

/* ── Continuity add-row stub ─────────────────────────────────────────── */

function addContinuityRow(detailKey: string): void {
  const data = (typeof assetDetailData !== 'undefined' ? (assetDetailData as Record<string, unknown>)[detailKey] : null) as Record<string, unknown> | null;
  if (!data || !data.rows) return;
  const rows = data.rows as Array<unknown[]>;
  const columns = data.columns as string[] | undefined;
  const emptyRow = new Array((columns || []).length).fill('—');
  emptyRow[0] = `Row ${rows.length + 1}`;
  rows.push(emptyRow);
  const contentEl = document.getElementById('asset-detail-content');
  if (contentEl) {
    const leadHtml = data.desc ? `<p class="asset-detail-lead">${escapeHtml(String(data.desc))}</p>` : '';
    contentEl.innerHTML = `<div class="asset-table-scroll">${leadHtml}${renderContinuityTable(data)}</div>`;
  }
}

/* ── Main render function ────────────────────────────────────────────── */

function renderAssetDetailPanel(node: TreeNode, attempt = 0): void {
  const titleEl = document.getElementById('asset-detail-title');
  const actionsEl = document.getElementById('asset-detail-actions');
  const contentEl = document.getElementById('asset-detail-content');
  if (!titleEl || !contentEl || !actionsEl) {
    if (attempt < 24) {
      requestAnimationFrame(() => renderAssetDetailPanel(node, attempt + 1));
    }
    return;
  }

  workspaceState.assetDetailCurrentNode = node;

  const detailKey = node.detailKey;
  const data = (detailKey && typeof assetDetailData !== 'undefined')
    ? (assetDetailData as Record<string, unknown>)[detailKey] as Record<string, unknown>
    : null;

  const icon = (data && String(data.icon)) || node.icon || 'fa-file';
  titleEl.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i> ${escapeHtml(node.name.toUpperCase())}`;

  if (!data) {
    actionsEl.innerHTML = '';
    contentEl.innerHTML = `<div class="asset-form-empty"><p>Content for <strong>${escapeHtml(node.name)}</strong> is not yet configured.</p></div>`;
    return;
  }

  if (data.layout === 'shot-table') {
    actionsEl.innerHTML = '';
    contentEl.innerHTML = `<div class="asset-table-scroll">${data.desc ? `<p class="asset-detail-lead">${escapeHtml(String(data.desc))}</p>` : ''}${renderShotListTable()}</div>`;
    return;
  }

  if (data.layout === 'continuity') {
    actionsEl.innerHTML = `
      <button type="button" class="toolbar-btn" style="padding:2px 8px;font-size:10px;" data-ws-continuity-key="${detailKey}">
        <i class="fa-solid fa-plus" aria-hidden="true"></i> Add Row
      </button>`;
    contentEl.innerHTML = `<div class="asset-table-scroll">${data.desc ? `<p class="asset-detail-lead">${escapeHtml(String(data.desc))}</p>` : ''}${renderContinuityTable(data)}</div>`;
    return;
  }

  const addLabel = String(data.addLabel || 'Add Item');
  actionsEl.innerHTML = `
    <button type="button" class="toolbar-btn btn-ai" style="padding:2px 8px;font-size:10px;" data-ws-action="addAssetItem">
      <i class="fa-solid fa-plus" aria-hidden="true"></i> ${escapeHtml(addLabel)}
    </button>`;

  const items = (data.items as Array<Record<string, unknown>>) || [];
  if (workspaceState.assetDetailSelectedIdx >= items.length) workspaceState.assetDetailSelectedIdx = items.length > 0 ? 0 : -1;
  if (workspaceState.assetDetailSelectedIdx < 0 && items.length > 0) workspaceState.assetDetailSelectedIdx = 0;

  contentEl.innerHTML = `
    <div class="asset-master-detail">
      <div id="asset-master-pane" class="asset-master">
        <div class="asset-master-header">
          <span>${escapeHtml(addLabel)}</span>
          <span class="asset-master-count">${items.length}</span>
        </div>
        ${_renderAssetMasterList(items, workspaceState.assetDetailSelectedIdx)}
      </div>
      <div id="asset-form-pane" class="asset-form-pane">
        ${workspaceState.assetDetailSelectedIdx >= 0 && items[workspaceState.assetDetailSelectedIdx]
          ? _renderAssetDetailForm(items[workspaceState.assetDetailSelectedIdx], data, workspaceState.assetDetailSelectedIdx)
          : _renderAssetFormEmpty(data)}
      </div>
    </div>`;
}

export {
  renderAssetDetailPanel,
  _renderAssetMasterList,
  selectAssetItem,
  addAssetItem,
  deleteAssetItem,
  _saveAssetItemField,
  addContinuityRow,
};
