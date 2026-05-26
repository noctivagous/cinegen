/**
 * Overview panel hover-preview popover and accordion toggle utilities.
 */

import { workspaceState } from '@/workspace/workspace-state';
import { escHtml } from '@/utils/html';

/** Toggle the accordion open/closed for a column or row list item wrapper. */
export function toggleOvColItem(wrapper: HTMLElement | null): void {
  if (!wrapper) return;
  wrapper.classList.toggle('open');
}

interface AssetItem {
  name?: string;
  desc?: string;
  icon?: string;
  status?: string;
  tags?: string[];
}

/** Show the hover-preview popover near the hovered element. */
export function showOvPreview(el: HTMLElement, childIdx: number, itemIdx: number): void {
  if (!workspaceState.ovShowHoverPreview) return;
  if (workspaceState.ovPreviewHideTimer) clearTimeout(workspaceState.ovPreviewHideTimer);

  const child = workspaceState.overviewNodeRefs[childIdx];
  if (!child || !child.detailKey) return;
  const w = window as unknown as Record<string, unknown>;
  const assetData = w.assetDetailData as Record<string, { items?: AssetItem[] }>;
  const data = (typeof assetData !== 'undefined') ? assetData[child.detailKey] : null;
  if (!data || !data.items) return;
  const item: AssetItem | undefined = data.items[itemIdx];
  if (!item) return;

  const popover = document.getElementById('ov-col-preview');
  if (!popover) return;

  const statusClass = `asset-status-${(item.status || 'pending').replace(/\s+/g, '-')}`;
  const statusLabel = (item.status || 'pending').replace(/-/g, ' ');
  const tagsHtml    = (item.tags || []).map((t) => `<span class="asset-tag">${escHtml(t)}</span>`).join('');

  popover.innerHTML = `
    <div class="ov-preview-icon">
      <i class="fa-solid ${item.icon || 'fa-box'}" aria-hidden="true"></i>
    </div>
    <div class="ov-preview-body">
      <div class="ov-preview-name">
        ${escHtml(item.name || 'Untitled')}
        <span class="asset-status-dot ${statusClass}" title="${escHtml(statusLabel)}"></span>
      </div>
      <p class="ov-preview-status">${escHtml(statusLabel)}</p>
      ${item.desc ? `<p class="ov-preview-desc">${escHtml(item.desc)}</p>` : ''}
      ${tagsHtml ? `<div class="ov-preview-tags">${tagsHtml}</div>` : ''}
      <p class="ov-preview-hint">Click row to expand · <i class="fa-solid fa-arrow-right"></i> to open</p>
    </div>`;

  popover.hidden = false;

  // Position after content is set so offsetHeight is accurate
  requestAnimationFrame(() => {
    const rect = el.getBoundingClientRect();
    const pw   = popover.offsetWidth  || 260;
    const ph   = popover.offsetHeight || 140;
    let   left = rect.right + 10;
    let   top  = rect.top - 4;
    if (left + pw > window.innerWidth  - 12) left = rect.left - pw - 10;
    if (left < 8)                            left = 8;
    if (top  + ph > window.innerHeight - 12) top  = window.innerHeight - ph - 12;
    if (top  < 8)                            top  = 8;
    popover.style.left = `${left}px`;
    popover.style.top  = `${top}px`;
  });
}

export function hideOvPreview() {
  workspaceState.ovPreviewHideTimer = setTimeout(_dismissOvPreview, 120);
}

export function _dismissOvPreview() {
  const popover = document.getElementById('ov-col-preview');
  if (popover) popover.hidden = true;
}

/** Toggle the "preview on hover" preference. */
export function setOvHoverPreview(checked: boolean) {
  workspaceState.ovShowHoverPreview = !!checked;
  if (!workspaceState.ovShowHoverPreview) _dismissOvPreview();
}

