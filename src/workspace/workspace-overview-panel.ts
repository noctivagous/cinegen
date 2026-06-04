/**
 * Overview panel — extracted from workspace-bundle.ts
 * Grid/browse views for section and folder nodes.
 */
import { escHtml } from '@/utils/html';
import type { TreeNode } from '@/tree/tree-types';
import { workspaceState } from '@/workspace/workspace-state';
import { getCinegenOverviewPanel } from '@/panels/panel-hosts';
import { switchView } from '@/workspace/view-routing';
import { updateInspector } from '@/components/panels/cinegen-inspector';
import { projectData, assetDetailData, setActiveMoodBoard } from '@/data/project-data';
import {
  highlightScriptForShot as bridgeHighlightScriptForShot,
  selectStoryboardFrameById as bridgeSelectStoryboardFrameById,
} from '@/workspace/shot-frame-bridge';
import { PREPROD_MODES, SUPPORTED_TREE_VIEWS } from '@/tree/tree-view-contract';
import { renderContinuityTable, renderShotListTable } from '@/workspace/table-renderers';
import { _renderAssetDetailForm, _renderAssetFormEmpty, _findSceneRefsForItem } from '@/workspace/asset-form-renderers';

/* Bundle-only functions accessed via window (exported by installWorkspaceBundleGlobals) */
declare function renderFullTree(): void;
declare function selectAssetItem(idx: number): void;
declare function renderSceneDetail(): void;
declare function switchSceneTab(tabIndex: number): void;
declare function inspectShot(id: number): void;
declare function setPreprodMode(mode: string): void;
declare function resolveNodeViewOrFallback(node: TreeNode): string;
declare function _populateTreeNodeView(node: TreeNode, sectionKey: string | null, resolvedView: string): void;
declare function _renderAssetMasterList(items: Array<Record<string, unknown>>, selectedIdx: number): string;

const escapeHtml = escHtml;

// ==================== OVERVIEW PANEL ====================

function _sectionKeyForNode(node: TreeNode | null): string | null {
  if (!node) return null;
  if (typeof window.getTreeSectionKeyForNode === 'function') {
    return window.getTreeSectionKeyForNode(node);
  }
  return null;
}

function _nodeContains(parent: TreeNode, target: TreeNode): boolean {
  if (parent === target) return true;
  for (const child of parent.children || []) {
    if (_nodeContains(child as TreeNode, target)) return true;
  }
  return false;
}

function _nodeItemCount(node: TreeNode): number {
  if (node.children) return node.children.filter((c) => (c as TreeNode).type !== 'tree-divider').length;
  if (node.detailKey) {
    const data = typeof assetDetailData !== 'undefined' ? (assetDetailData as Record<string, unknown>)[node.detailKey] : null;
    if (data && (data as Record<string, unknown>).items) return ((data as Record<string, unknown>).items as unknown[]).length;
    if (data && (data as Record<string, unknown>).rows) return ((data as Record<string, unknown>).rows as unknown[]).length;
  }
  return 0;
}

function _overviewChildItems(child: TreeNode): Array<{ name: string; icon: string; status: string | null; desc?: string; tags?: string[] }> {
  if (child.view === 'asset-detail' && child.detailKey) {
    const data = typeof assetDetailData !== 'undefined' ? (assetDetailData as Record<string, unknown>)[child.detailKey] : null;
    if (!data) return [];
    const d = data as Record<string, unknown>;
    if (d.items) return (d.items as Array<Record<string, unknown>>).slice(0, 50).map((item) => ({
      name: String(item.name ?? ''),
      icon: String(item.icon ?? 'fa-box'),
      status: item.status ? String(item.status) : null,
      desc: item.desc ? String(item.desc) : undefined,
      tags: Array.isArray(item.tags) ? (item.tags as string[]) : undefined,
    }));
    if (d.rows) return (d.rows as Array<unknown[]>).slice(0, 50).map((row, i) => ({
      name: (row[0] as string) || `Row ${i + 1}`,
      icon: 'fa-table-cells',
      status: null,
    }));
  }
  if (child.children) {
    return child.children
      .filter((c) => (c as TreeNode).type !== 'tree-divider')
      .slice(0, 50)
      .map((c) => {
        const tn = c as TreeNode;
        return { name: tn.name, icon: tn.icon || 'fa-folder', status: null };
      });
  }
  return [];
}

function _overviewVisibleChildren(node: TreeNode): TreeNode[] {
  const result: TreeNode[] = [];
  (node.children || []).forEach((child) => {
    const c = child as TreeNode;
    if (c.type === 'group') {
      (c.children || []).forEach((gc) => result.push(gc as TreeNode));
    } else if (c.type !== 'tree-divider') {
      result.push(c);
    }
  });
  return result;
}

function _overviewAccentClass(node: TreeNode, sectionKey?: string | null): string {
  const key = sectionKey || _sectionKeyForNode(node);
  return key ? ` overview-card--section-${key}` : '';
}

/** Render a single overview card, with a configurable click handler. */
function _ovCardHtml(
  child: TreeNode,
  idx: number,
  accentClass: string,
  mode: 'activate' | 'select',
  selClass?: string
): string {
  const childIcon = child.icon || 'fa-file';
  const childDesc = child.desc || '';
  const count = _nodeItemCount(child);
  const countBadge = count > 0 ? `<span class="overview-card-count">${count}</span>` : '';
  const dataAttr =
    mode === 'select' ? `data-ws-ov-select="${idx}"` : `data-ws-ov-activate="${idx}"`;
  return `
    <div class="overview-card${accentClass}${selClass || ''}" role="button" tabindex="0"
         ${dataAttr}>
      <span class="overview-card-icon"><i class="fa-solid ${childIcon}" aria-hidden="true"></i></span>
      <div class="overview-card-body">
        <span class="overview-card-title">${escapeHtml(child.name)}${countBadge}</span>
        ${childDesc ? `<span class="overview-card-desc">${escapeHtml(childDesc)}</span>` : ''}
      </div>
    </div>`;
}

/** Inline header bar: mode-select buttons on the left, description text on the right. */
function _renderOvModeHeader(mode: string, desc: string): string {
  const modeDefs = [
    { id: 'column', icon: 'fa-table-columns', label: 'Columns' },
    { id: 'row', icon: 'fa-bars', label: 'Rows' },
    { id: 'master', icon: 'fa-table-cells-large', label: 'Browse' },
  ];
  return `
    <div class="ov-header-bar">
      <div class="ov-mode-group" role="group" aria-label="Overview layout">
        ${modeDefs.map((m) => `
          <button class="ov-mode-btn${mode === m.id ? ' active' : ''}"
                  data-mode="${m.id}" data-ws-ov-mode="${m.id}" title="${m.label}">
            <i class="fa-solid ${m.icon}" aria-hidden="true"></i>
            <span>${m.label}</span>
          </button>`).join('')}
      </div>
      ${desc ? `<p class="overview-desc-inline">${escapeHtml(desc)}</p>` : ''}
      <label class="ov-preview-toggle" title="Show a detail popover when hovering list items">
        <input type="checkbox" class="ov-preview-toggle-input"
               ${workspaceState.ovShowHoverPreview ? 'checked' : ''}
               data-ws-ov-hover-preview>
        <span class="ov-toggle-track"><span class="ov-toggle-thumb"></span></span>
        <span class="ov-preview-toggle-text">Preview on hover</span>
      </label>
    </div>`;
}

/** Renders the expanded accordion body for a column list item. */
function _renderOvColItemBody(
  item: Record<string, unknown>,
  _childIdx: number,
  itemIdx: number,
  hasLinks: boolean
): string {
  const statusClass = `asset-status-${(String(item.status || 'pending')).replace(/\s+/g, '-')}`;
  const statusLabel = (String(item.status || 'pending')).replace(/-/g, ' ');
  const tagsArr = Array.isArray(item.tags) ? item.tags as string[] : [];
  const tagsHtml = tagsArr.map((t) => `<span class="asset-tag">${escapeHtml(t)}</span>`).join('');
  return `
    <div class="ov-col-acc-body">
      ${item.desc ? `<p class="ov-col-acc-desc">${escapeHtml(String(item.desc))}</p>` : '<p class="ov-col-acc-desc" style="color:#484848">No description.</p>'}
      <div class="ov-col-acc-meta">
        <span class="asset-status-dot ${statusClass}"></span>
        <span class="ov-col-acc-status">${escapeHtml(statusLabel)}</span>
      </div>
      ${tagsHtml ? `<div class="ov-col-acc-tags">${tagsHtml}</div>` : ''}
      ${hasLinks ? `
        <button class="toolbar-btn ov-col-acc-open-btn" data-ws-goto-asset="${_childIdx}:${itemIdx}">
          <i class="fa-solid fa-arrow-right" aria-hidden="true"></i> Open in detail
        </button>` : ''}
    </div>`;
}

/* ── View 1: Column (card + vertical companion) ──────────────────────── */

function _renderOverviewColumnView(visibleChildren: TreeNode[], accentClass: string): string {
  if (!visibleChildren.length) return '<p class="overview-lead" style="padding:24px">No sections.</p>';

  const cols = visibleChildren.map((child, idx) => {
    const cardHtml = _ovCardHtml(child, idx, accentClass, 'activate');
    const items = _overviewChildItems(child);
    const hasLinks = child.view === 'asset-detail' && child.detailKey;

    const listHtml = items.length
      ? items.map((item, itemIdx) => {
        const statusClass = `asset-status-${(item.status || 'pending').replace(/\s+/g, '-')}`;
        return `
          <div class="ov-col-item-wrap">
            <div class="ov-col-item" role="button" tabindex="0"
                 data-ws-ov-toggle-wrap data-ws-ov-preview="${idx}:${itemIdx}"
                 data-ws-ov-preview-hide>
              <span class="ov-col-item-chevron"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></span>
              <span class="ov-col-item-icon"><i class="fa-solid ${item.icon || 'fa-box'}" aria-hidden="true"></i></span>
              <span class="ov-col-item-name">${escapeHtml(item.name || '—')}</span>
              <span class="asset-status-dot ${statusClass}"></span>
              ${hasLinks
          ? `<button class="ov-col-goto" data-ws-goto-asset="${idx}:${itemIdx}"
                         title="Open ${escapeHtml(item.name || '')}">
                      <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
                    </button>`
          : ''}
            </div>
            <div class="ov-col-item-body">
              <div class="ov-col-item-body-inner">
                ${_renderOvColItemBody(item as Record<string, unknown>, idx, itemIdx, !!hasLinks)}
            </div>
          </div>`;
      }).join('')
      : '<p class="ov-col-empty">No items yet.</p>';

    return `
      <div class="ov-col-container">
        ${cardHtml}
        <div class="ov-col-companion">
          <div class="ov-col-list">${listHtml}</div>
        </div>
      </div>`;
  }).join('');

  return `<div class="ov-col-track">${cols}</div>`;
}

/* ── View 2: Row (card + horizontal companion) ───────────────────────── */

function _renderOverviewRowView(visibleChildren: TreeNode[], accentClass: string): string {
  if (!visibleChildren.length) return '<p class="overview-lead" style="padding:24px">No sections.</p>';

  const rows = visibleChildren.map((child, idx) => {
    const cardHtml = _ovCardHtml(child, idx, accentClass, 'activate');
    const items = _overviewChildItems(child);
    const hasLinks = !!(child.view === 'asset-detail' && child.detailKey);

    const listHtml = items.length
      ? items.map((item, itemIdx) => {
        const statusClass = `asset-status-${(item.status || 'pending').replace(/\s+/g, '-')}`;
        return `
          <div class="ov-row-item-wrap">
            <div class="ov-row-item" role="button" tabindex="0"
                 data-ws-ov-toggle-wrap data-ws-ov-preview="${idx}:${itemIdx}"
                 data-ws-ov-preview-hide>
              <span class="ov-row-item-chevron"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></span>
              <span class="ov-row-item-icon">
                <i class="fa-solid ${item.icon || 'fa-box'}" aria-hidden="true"></i>
              </span>
              <span class="ov-row-item-name">${escapeHtml(item.name || '—')}</span>
              <span class="asset-status-dot ${statusClass}"></span>
              ${hasLinks
          ? `<button class="ov-row-goto" data-ws-goto-asset="${idx}:${itemIdx}"
                         title="Open ${escapeHtml(item.name || '')}">
                      <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
                    </button>`
          : ''}
            </div>
            <div class="ov-row-item-body">
              <div class="ov-row-item-body-inner">
                <div class="ov-row-acc-body">
                  ${_renderOvColItemBody(item as Record<string, unknown>, idx, itemIdx, hasLinks)}
                </div>
              </div>
            </div>
          </div>`;
      }).join('')
      : '<p class="ov-row-empty">No items yet.</p>';

    return `
      <div class="ov-row-container">
        <div class="ov-row-card-wrap">
          ${cardHtml}
        </div>
        <div class="ov-row-companion">
          <div class="ov-row-tabs">
            <button class="ov-row-tab active">Items</button>
            <button class="ov-row-tab">Info</button>
          </div>
          <div class="ov-row-list">${listHtml}</div>
        </div>
      </div>`;
  }).join('');

  return `<div class="ov-row-track">${rows}</div>`;
}

/* ── View 3: Master (cards grid + inline master-detail) ──────────────── */

function _renderOverviewMasterView(
  visibleChildren: TreeNode[],
  accentClass: string,
  headerHtml: string
): string {
  if (!visibleChildren.length) {
    return headerHtml + '<p style="padding:16px 24px;font-size:11px;color:var(--text-dim);">No sections.</p>';
  }

  const cardsHtml = visibleChildren.map((child, idx) => {
    const selClass = idx === workspaceState.overviewSelectedCardIdx ? ' selected' : '';
    return _ovCardHtml(child, idx, accentClass, 'select', selClass);
  }).join('');

  const detailHtml = workspaceState.overviewSelectedCardIdx >= 0 && visibleChildren[workspaceState.overviewSelectedCardIdx]
    ? _renderOverviewInlineDetail(visibleChildren[workspaceState.overviewSelectedCardIdx])
    : `<div class="ov-master-placeholder">
         <i class="fa-solid fa-hand-pointer" aria-hidden="true"></i>
         <p>Click a section above to browse its contents here.</p>
       </div>`;

  return `
    <div class="ov-master-layout">
      ${headerHtml}
      <div class="ov-master-cards">
        <div class="overview-grid">${cardsHtml}</div>
      </div>
      <div class="ov-master-divider"></div>
      <div class="ov-master-detail" id="ov-master-detail-pane">
        ${detailHtml}
      </div>
    </div>`;
}

function _renderOverviewContent(
  mode: string,
  visibleChildren: TreeNode[],
  accentClass: string,
  node: TreeNode
): string {
  const desc = (node && node.desc) || '';
  const headerHtml = _renderOvModeHeader(mode, desc);
  if (mode === 'column') return headerHtml + _renderOverviewColumnView(visibleChildren, accentClass);
  if (mode === 'row') return headerHtml + _renderOverviewRowView(visibleChildren, accentClass);
  return _renderOverviewMasterView(visibleChildren, accentClass, headerHtml);
}

function _renderOverviewInlineDetail(child: TreeNode | null): string {
  if (!child) return '';

  if (child.view === 'asset-detail' && child.detailKey) {
    const data = typeof assetDetailData !== 'undefined' ? (assetDetailData as Record<string, unknown>)[child.detailKey] : null;
    if (!data) return `<div class="ov-master-placeholder"><p>No data configured for <strong>${escapeHtml(child.name)}</strong>.</p></div>`;

    workspaceState.assetDetailCurrentNode = child;
    const d = data as Record<string, unknown>;
    const items = (d.items as Array<Record<string, unknown>>) || [];
    if (workspaceState.assetDetailSelectedIdx < 0 || workspaceState.assetDetailSelectedIdx >= items.length) workspaceState.assetDetailSelectedIdx = 0;

    if (d.layout === 'shot-table') {
      return `<div class="ov-master-table-wrap">${renderShotListTable()}</div>`;
    }
    if (d.layout === 'continuity') {
      return `<div class="ov-master-table-wrap">${renderContinuityTable(d as never)}</div>`;
    }

    const selectedItem = items[workspaceState.assetDetailSelectedIdx];
    return `
      <div class="asset-master-detail">
        <div id="asset-master-pane" class="asset-master">
          <div class="asset-master-header">
            <span>${escapeHtml(String(d.addLabel || 'Items'))}</span>
            <span class="asset-master-count">${items.length}</span>
          </div>
          ${_renderAssetMasterList(items, workspaceState.assetDetailSelectedIdx)}
        </div>
        <div id="asset-form-pane" class="asset-form-pane">
          ${selectedItem
            ? _renderAssetDetailForm(selectedItem, d as never, workspaceState.assetDetailSelectedIdx)
            : _renderAssetFormEmpty(d as never)}
        </div>
      </div>`;
  }

  return `
    <div class="ov-master-placeholder">
      <i class="fa-solid fa-folder-open" aria-hidden="true"></i>
      <p><strong>${escapeHtml(child.name)}</strong> is a folder with sub-sections.</p>
      <button class="toolbar-btn" style="margin-top:10px;font-size:11px;"
              data-ws-ov-activate="${workspaceState.overviewSelectedCardIdx}">
        <i class="fa-solid fa-arrow-right" aria-hidden="true"></i> Open ${escapeHtml(child.name)}
      </button>
    </div>`;
}

/** Navigate to a leaf node AND pre-select a specific item in its master list. */
function gotoAssetItem(childIdx: number, itemIdx: number): void {
  const child = workspaceState.overviewNodeRefs[childIdx];
  if (!child) return;
  workspaceState.assetDetailSelectedIdx = itemIdx;
  _selectTreeItemByNode(child);
  _renderNodeView(child);
  requestAnimationFrame(() => {
    if (typeof selectAssetItem === 'function') selectAssetItem(itemIdx);
  });
}

/** Navigate to a child node from any overview card click. */
function activateOverviewCard(idx: number): void {
  const child = workspaceState.overviewNodeRefs[idx];
  if (!child) return;
  _selectTreeItemByNode(child);
  _renderNodeView(child);
}

function selectOverviewCard(idx: number): void {
  workspaceState.overviewSelectedCardIdx = idx;

  const panel = getCinegenOverviewPanel();
  if (panel) {
    panel.selectCard(idx);
    return;
  }

  document.querySelectorAll('.ov-master-cards .overview-card').forEach((el, i) => {
    el.classList.toggle('selected', i === idx);
  });

  const detailPane = document.getElementById('ov-master-detail-pane');
  if (!detailPane) return;

  const child = workspaceState.overviewNodeRefs[idx];
  detailPane.innerHTML = child
    ? _renderOverviewInlineDetail(child)
    : '<div class="ov-master-placeholder"><p>No content available.</p></div>';
}

function setOverviewViewMode(mode: string): void {
  workspaceState.overviewViewMode = mode as 'column' | 'row' | 'master';
  const m = workspaceState.overviewViewMode;
  workspaceState.overviewSelectedCardIdx = -1;

  document.querySelectorAll('.ov-mode-btn').forEach((btn) => {
    btn.classList.toggle('active', (btn as HTMLElement).dataset.mode === mode);
  });

  const panel = getCinegenOverviewPanel();
  if (panel && workspaceState.overviewCurrentNode) {
    panel.setMode(mode as 'column' | 'row' | 'master');
    return;
  }

  const contentEl = document.getElementById('overview-panel-content');
  if (!workspaceState.overviewCurrentNode || !contentEl) return;

  const visibleChildren = _overviewVisibleChildren(workspaceState.overviewCurrentNode);
  const accentClass = _overviewAccentClass(workspaceState.overviewCurrentNode);
  contentEl.innerHTML = _renderOverviewContent(mode, visibleChildren, accentClass, workspaceState.overviewCurrentNode);
}

function renderOverviewPanel(node: TreeNode, sectionKey?: string | null): void {
  const titleEl = document.getElementById('overview-panel-title');
  const actionsEl = document.getElementById('overview-panel-actions');
  const contentEl = document.getElementById('overview-panel-content');
  if (!titleEl) return;

  workspaceState.overviewNodeRefs.length = 0;
  workspaceState.overviewCurrentNode = node;
  workspaceState.overviewSectionKey = sectionKey ?? null;
  workspaceState.overviewSelectedCardIdx = -1;

  const icon = node.icon || 'fa-folder';
  titleEl.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i> ${escapeHtml(node.name.toUpperCase())}`;

  if (actionsEl) actionsEl.innerHTML = '';

  const visibleChildren = _overviewVisibleChildren(node);
  visibleChildren.forEach((child) => workspaceState.overviewNodeRefs.push(child));

  const panel = getCinegenOverviewPanel();
  if (panel) {
    panel.syncFromWorkspace();
    return;
  }

  if (!contentEl) return;
  const accentClass = _overviewAccentClass(node, sectionKey);
  contentEl.innerHTML = _renderOverviewContent(workspaceState.overviewViewMode, visibleChildren, accentClass, node);
}

/* ── Shared helpers ──────────────────────────────────────────────────── */

/** Find the tree item whose data-name matches node.name and highlight it. */
function _selectTreeItemByNode(node: TreeNode): void {
  if (!node || !node.name) return;

  if (typeof (window as any).expandProjectTreeToNode === 'function') {
    (window as any).expandProjectTreeToNode(node);
  } else {
    const path = _findNodePath(projectData as unknown as TreeNode, node);
    if (path && path.length > 1) {
      let treeChanged = false;
      for (let i = 0; i < path.length - 1; i++) {
        if (path[i].children && !path[i].expanded) {
          path[i].expanded = true;
          treeChanged = true;
        }
      }
      if (treeChanged) {
        renderFullTree();
        void import('@/services/project-service').then((m) => m.persistProjectTreeExpandedState());
      }
    }
  }

  if (typeof (window as any).setProjectTreeSelection === 'function') {
    (window as any).setProjectTreeSelection(node.name);
    return;
  }

  const items = document.querySelectorAll('.tree-item');
  for (const item of items) {
    if ((item as HTMLElement).dataset.name === node.name) {
      document.querySelectorAll('.tree-item').forEach((el) => el.classList.remove('selected'));
      item.classList.add('selected');
      item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return;
    }
  }
}

/**
 * Return the path (array of node objects) from `root` down to `target`,
 * or null if `target` is not found in the subtree.
 * Uses reference equality so it works even when multiple nodes share a name.
 */
function _findNodePath(root: TreeNode, target: TreeNode): TreeNode[] | null {
  if (root === target) return [root];
  for (const child of (root.children || [])) {
    const sub = _findNodePath(child as TreeNode, target);
    if (sub) return [root, ...sub];
  }
  return null;
}

/**
 * Render the appropriate workspace view for a node.
 * Mirrors selectTreeNode but takes a node object directly (used from overview cards).
 */
function _renderNodeView(node: TreeNode): void {
  if (!node) return;
  const sectionKey = _sectionKeyForNode(node);

  if (node.type === 'scene-shot' && node.sceneId && node.shotId != null) {
    workspaceState.currentSceneId = node.sceneId;
    void switchView('scene-detail', node.name, sectionKey).then(() => {
      renderSceneDetail();
      switchSceneTab(2);
      inspectShot(Number(node.shotId));
    });
    return;
  }

  if (node.type === 'storyboard-frame' && node.frameId != null) {
    void switchView('preprod-workspace', node.name, sectionKey).then(() => {
      setPreprodMode('storyboard');
      if (node.sceneId) workspaceState.currentSceneId = node.sceneId;
      bridgeSelectStoryboardFrameById(Number(node.frameId));
    });
    return;
  }

  if (node.type === 'scene' && node.sceneId) {
    workspaceState.currentSceneId = node.sceneId;
    void switchView('scene-detail', node.name, sectionKey).then(() => {
      renderSceneDetail();
      updateInspector('scene', (window as any).currentSceneData?.[node.sceneId!]);
    });
    return;
  }

  const resolvedView = resolveNodeViewOrFallback(node);
  void switchView(resolvedView, node.name, sectionKey).then(() => {
    _populateTreeNodeView(node, sectionKey, resolvedView);
  });
}

export {
  renderOverviewPanel,
  setOverviewViewMode,
  selectOverviewCard,
  _overviewVisibleChildren,
  _overviewAccentClass,
  _renderOverviewContent,
  _renderOvModeHeader,
  _ovCardHtml,
  _overviewChildItems,
  _nodeItemCount,
  _renderOverviewColumnView,
  _renderOvColItemBody,
  _renderOverviewRowView,
  _renderOverviewMasterView,
  _renderOverviewInlineDetail,
  gotoAssetItem,
  activateOverviewCard,
  _selectTreeItemByNode,
  _findNodePath,
  _renderNodeView,
  _sectionKeyForNode,
  _nodeContains,
};
