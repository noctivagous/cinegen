/**
 * Asset detail form HTML renderers and scene cross-reference lookup.
 */

import { workspaceState } from '@/workspace/workspace-state';
import { escHtml } from '@/utils/html';

interface BreakdownRow {
  props?: string;
  wardrobe?: string;
  sfx?: string;
  characters?: string;
  notes?: string;
  location?: string;
  scene?: string;
  int_ext?: string;
  time?: string;
}

export function _findSceneRefsForItem(itemName: string): string[] {
  const w = window as unknown as Record<string, unknown>;
  if (!itemName || typeof w.breakdownData === 'undefined' || !Array.isArray(w.breakdownData)) return [];
  const lower = itemName.toLowerCase();
  const refs: string[] = [];
  (w.breakdownData as BreakdownRow[]).forEach((row) => {
    const fields = [row.props, row.wardrobe, row.sfx, row.characters, row.notes, row.location];
    if (fields.some((f) => f && f.toLowerCase().includes(lower))) {
      refs.push(`Scene ${row.scene} — ${row.int_ext} ${row.location} (${row.time})`);
    }
  });
  return refs;
}

interface AssetItem {
  name?: string;
  desc?: string;
  status?: string;
  tags?: string[];
  icon?: string;
  notes?: string;
  duration?: string;
}

interface AssetData {
  icon?: string;
  addLabel?: string;
}

export function _renderAssetDetailForm(item: AssetItem, data: AssetData, idx: number): string {
  const name     = item.name     || '';
  const desc     = item.desc     || '';
  const status   = item.status   || 'pending';
  const tags     = (item.tags    || []).join(', ');
  const icon     = item.icon     || (data && data.icon) || 'fa-box';
  const notes    = item.notes    || '';
  const duration = item.duration !== undefined ? item.duration : null;

  const statusOpts = ['approved', 'in-progress', 'pending'].map((s) =>
    `<option value="${s}"${status === s ? ' selected' : ''}>${
      s === 'in-progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)
    }</option>`
  ).join('');

  const tagsChips = (item.tags || [])
    .map((t) => `<span class="asset-tag">${escHtml(t)}</span>`).join('');

  const sceneRefs = _findSceneRefsForItem(name);
  const refsHtml = sceneRefs.length
    ? sceneRefs.map((r) => `<div class="asset-form-ref-row">${escHtml(r)}</div>`).join('')
    : `<p class="asset-form-refs-hint">No breakdown mentions found for this item name.</p>`;

  // Attribute-safe values
  const va = (v: string) => escHtml(v).replace(/"/g, '&quot;');

  return `
    <form class="asset-form" autocomplete="off" onsubmit="return false;">

      <!-- ── Reference image / thumbnail ── -->
      <div class="asset-form-media">
        <div class="asset-form-thumb-box">
          <i class="fa-solid ${escHtml(icon)}" aria-hidden="true"></i>
        </div>
        <div class="asset-form-media-body">
          <div class="asset-form-media-title">${escHtml(name) || 'Untitled'}</div>
          <p class="asset-form-media-hint">Drop a reference image here or generate one to drive AI rendering.</p>
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

      <!-- ── Identity ── -->
      <div class="asset-form-section">
        <div class="asset-form-section-title">Identity</div>
        <div class="asset-form-row">
          <label for="asset-form-name">Name</label>
          <input id="asset-form-name" class="cg-field" type="text" value="${va(name)}"
                 oninput="_saveAssetItemField('name', this.value)">
        </div>
        <div class="asset-form-row">
          <label for="asset-form-status">Status</label>
          <div class="cg-nspopup-wrap">
            <select id="asset-form-status" class="cg-nspopup"
                    onchange="_saveAssetItemField('status', this.value)">
              ${statusOpts}
            </select>
          </div>
        </div>
        <div class="asset-form-row">
          <label for="asset-form-icon">Icon <small>FA class, e.g. fa-lightbulb</small></label>
          <input id="asset-form-icon" class="cg-field" type="text" value="${va(icon)}"
                 placeholder="fa-box"
                 oninput="_saveAssetItemField('icon', this.value)">
        </div>
      </div>

      <!-- ── Description ── -->
      <div class="asset-form-section">
        <div class="asset-form-section-title">Description</div>
        <div class="asset-form-row">
          <label for="asset-form-desc">For AI <small>generation prompt hint</small></label>
          <textarea id="asset-form-desc" class="cg-field asset-form-textarea" rows="3"
                    oninput="_saveAssetItemField('desc', this.value)">${escHtml(desc)}</textarea>
        </div>
      </div>

      ${duration !== null ? `
      <!-- ── Timing ── -->
      <div class="asset-form-section">
        <div class="asset-form-section-title">Timing</div>
        <div class="asset-form-row">
          <label for="asset-form-duration">Duration</label>
          <input id="asset-form-duration" class="cg-field" type="text" value="${va(duration)}"
                 placeholder="e.g. 1m 30s"
                 oninput="_saveAssetItemField('duration', this.value)">
        </div>
      </div>` : ''}

      <!-- ── Tags ── -->
      <div class="asset-form-section">
        <div class="asset-form-section-title">Tags</div>
        <div class="asset-form-row">
          <label for="asset-form-tags">Tags <small>comma-separated</small></label>
          <input id="asset-form-tags" class="cg-field" type="text" value="${va(tags)}"
                 placeholder="e.g. marcus, hero, scene-3"
                 oninput="_saveAssetItemField('tags', this.value)">
        </div>
        <div id="asset-form-tags-chips" class="asset-form-tags-chips">${tagsChips}</div>
      </div>

      <!-- ── Production notes ── -->
      <div class="asset-form-section">
        <div class="asset-form-section-title">Production notes</div>
        <div class="asset-form-row">
          <label for="asset-form-notes">Notes</label>
          <textarea id="asset-form-notes" class="cg-field asset-form-textarea" rows="4"
                    placeholder="Continuity requirements, generation rules, director notes…"
                    oninput="_saveAssetItemField('notes', this.value)">${escHtml(notes)}</textarea>
        </div>
      </div>

      <!-- ── Scene cross-references ── -->
      <div class="asset-form-section asset-form-section--refs">
        <div class="asset-form-section-title">
          <i class="fa-solid fa-link" aria-hidden="true"></i> Scene references
        </div>
        ${refsHtml}
      </div>

      <!-- ── Danger zone ── -->
      <div class="asset-form-section asset-form-section--danger">
        <button type="button" class="toolbar-btn asset-form-delete-btn"
                data-ws-delete-asset="${idx}">
          <i class="fa-solid fa-trash" aria-hidden="true"></i> Delete item
        </button>
      </div>

    </form>`;
}

export function _renderAssetFormEmpty(data: AssetData): string {
  const addLabel = (data && data.addLabel) || 'Add Item';
  return `
    <div class="asset-form-empty">
      <i class="fa-solid fa-arrow-left" aria-hidden="true" style="font-size:22px;opacity:0.25;"></i>
      <p>Select an item from the list, or click <strong>${escHtml(addLabel)}</strong> to create one.</p>
    </div>`;
}

