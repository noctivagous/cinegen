import {
  assetLibrary,
  locationLibrary,
  breakdownData,
  storyboardFrames,
} from '@/data/project-data';
import { getCinegenAssetsPanel, getCinegenLocationScout } from '@/panels/panel-hosts';
import { getCurrentScriptText } from '@/script/fountain-bundle';
import { alertCG } from '@/utils/alert-cg';
import { updateInspector } from '@/components/panels/cinegen-inspector';

/** Location scout, global assets, breakdown sheets */

declare global {
  function normalizeEntityName(name: string): string;
  function splitEntityValue(val: string): string[];
  function joinEntityValue(vals: string[]): string;
  function uniqueByName<T>(items: T[]): T[];
  function renderEntityChipsHtml(values: string[], attrFn: (v: string) => string, type: string): string;
  function getEntityCatalogForField(field: string): string[];
  function escapeHtml(str: string): string;
  function scheduleFountainRender(): void;
  function renderScriptInfoTables(): void;
  function renderStoryboard(): void;
  function switchView(view: string, label: string, mode: string): void;
  function renderTimeline(): void;
  function closeSaveExportMenu(): void;
  function addItemsToLibrary(category: string, items: string[], icon: string, desc: string): void;
  var scriptPaneTab: string;
}

// ==================== NEW VIEWS RENDERERS ====================
export function renderLocationScout() {
  const panel = getCinegenLocationScout();
  if (panel) {
    panel.refresh();
    return;
  }
  const grid = document.getElementById('location-grid');
  if (!grid) return;
  const searchEl = document.getElementById('location-search') as HTMLInputElement | null;
  const query = normalizeEntityName(searchEl?.value || '').toLowerCase();
  const visibleLocations = query
    ? locationLibrary.filter((loc) => `${loc.name} ${loc.tags}`.toLowerCase().includes(query))
    : locationLibrary;
  if (!visibleLocations.length) {
    grid.innerHTML = '<div class="text-[var(--text-dim)] text-xs p-3">No locations match that filter.</div>';
    return;
  }
  grid.innerHTML = visibleLocations.map(loc => `
    <div onclick="useLocation(${loc.id});" class="location-card">
      <div class="location-image"><i class="fa-solid ${loc.icon} text-6xl"></i></div>
      <div class="location-label">
        <div class="scene-ref">${loc.name}</div>
        <div class="text-[10px] text-[var(--text-dim)]">${loc.tags}</div>
      </div>
    </div>`).join('');
}

export function filterLocations() {
  renderLocationScout();
}

export function generateLocation() {
  const newLoc = {
    id: Date.now(),
    name: "Foggy Rooftop Chase - Midnight",
    tags: "noir, rooftop, fog, neon",
    icon: "fa-building"
  };
  locationLibrary.unshift(newLoc);
  renderLocationScout();
  alertCG('AI generated new location. Added to scout library and available for all scenes.');
  updateInspector('location', newLoc);
}

export function useLocation(id: number) {
  const loc = locationLibrary.find((l: any) => l.id === id);
  if (!loc) return;
  updateInspector('location', loc);
  alertCG(`Location "${loc.name}" assigned to current scene. Continuity reference locked.`);
}

export function renderGlobalAssets(tab: number) {
  const panel = getCinegenAssetsPanel();
  if (panel) {
    if (typeof tab === 'number') panel.switchTab(tab);
    else panel.refresh();
    return;
  }
  const grid = document.getElementById('asset-grid');
  if (!grid) return;
  let items = [];
  if (tab === 0) items = assetLibrary.characters;
  else if (tab === 1) items = assetLibrary.locations;
  else if (tab === 2) items = assetLibrary.props;
  else if (tab === 3) items = assetLibrary.vehicles;
  else if (tab === 4) items = assetLibrary.effects;

  grid.innerHTML = items.map((item: any) => `
    <div onclick="selectAsset('${item.name}')" class="asset-card flex flex-col items-center text-center p-3">
      <div class="asset-image w-20 h-20 flex items-center justify-center text-4xl mb-3"><i class="fa-solid ${item.icon || 'fa-cube'}"></i></div>
      <div class="asset-label text-xs">${item.name}</div>
      <div class="text-[10px] text-[var(--text-dim)]">${item.desc || ''}</div>
      <button onclick="event.stopImmediatePropagation();addAssetToScene('${item.name}');" class="toolbar-btn text-[10px] mt-2">Add to Scene</button>
    </div>`).join('');
}

export function switchAssetTab(tab: number) {
  const panel = getCinegenAssetsPanel();
  if (panel) {
    panel.switchTab(tab);
    return;
  }
  const seg = document.querySelector('cg-segmented-control[data-segmented="asset-tabs"]') as
    | (HTMLElement & { value: string })
    | null;
  if (seg) seg.value = String(tab);
  else {
    document.querySelectorAll('[data-ws-asset-tab]').forEach((b, i) =>
      b.classList.toggle('active', i === tab)
    );
  }
  renderGlobalAssets(tab);
}

export function autoSuggestBreakdown() {
  const scriptText = getCurrentScriptText();
  const propValues = splitEntityValue(breakdownData[0].props);
  propValues.push('AI-detected: wet footprints');
  breakdownData[0].props = joinEntityValue(uniqueByName(propValues));
  const sfxValues = splitEntityValue(breakdownData[0].sfx);
  sfxValues.push('Thunder rumble');
  breakdownData[0].sfx = joinEntityValue(uniqueByName(sfxValues));
  addItemsToLibrary('effects', ['Thunder rumble'], 'fa-bolt', 'Detected by AI');
  if (scriptText && scriptPaneTab === 'info') renderScriptInfoTables();
  renderBreakdownTable();
  alertCG('AI parsed script and enriched breakdown with hidden production elements.');
}

export function renderBreakdownTable() {
  const tbody = document.getElementById('breakdown-tbody') as HTMLTableSectionElement | null;
  if (!tbody) return;
  tbody.innerHTML = '';
  breakdownData.forEach((row, idx) => {
    const locationValues = splitEntityValue(row.location);
    const characterValues = splitEntityValue(row.characters);
    const propValues = splitEntityValue(row.props);
    const wardrobeValues = splitEntityValue(row.wardrobe);
    const sfxValues = splitEntityValue(row.sfx);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" value="${row.scene}" data-field="scene" data-idx="${idx}"></td>
      <td><input type="text" value="${row.int_ext}" data-field="int_ext" data-idx="${idx}"></td>
      <td class="breakdown-chip-cell">
        <div class="breakdown-chip-list">${renderEntityChipsHtml(locationValues, (value) => `data-breakdown-remove="true" data-field="location" data-value="${encodeURIComponent(value)}"`, 'location')}
        </div>
        <div class="breakdown-chip-picker">
          <select data-breakdown-add="true" data-field="location" data-idx="${idx}">
            <option value="">Add location…</option>
            ${getEntityCatalogForField('location').map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('')}
          </select>
        </div>
      </td>
      <td><input type="text" value="${row.time}" data-field="time" data-idx="${idx}"></td>
      <td class="breakdown-chip-cell">
        <div class="breakdown-chip-list">${renderEntityChipsHtml(characterValues, (value) => `data-breakdown-remove="true" data-field="characters" data-value="${encodeURIComponent(value)}"`, 'character')}
        </div>
        <div class="breakdown-chip-picker">
          <select data-breakdown-add="true" data-field="characters" data-idx="${idx}">
            <option value="">Add character…</option>
            ${getEntityCatalogForField('characters').map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('')}
          </select>
        </div>
      </td>
      <td class="breakdown-chip-cell">
        <div class="breakdown-chip-list">${renderEntityChipsHtml(propValues, (value) => `data-breakdown-remove="true" data-field="props" data-value="${encodeURIComponent(value)}"`, 'prop')}
        </div>
        <div class="breakdown-chip-picker">
          <select data-breakdown-add="true" data-field="props" data-idx="${idx}">
            <option value="">Add prop…</option>
            ${getEntityCatalogForField('props').map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('')}
          </select>
        </div>
      </td>
      <td class="breakdown-chip-cell">
        <div class="breakdown-chip-list">${renderEntityChipsHtml(wardrobeValues, (value) => `data-breakdown-remove="true" data-field="wardrobe" data-value="${encodeURIComponent(value)}"`, 'wardrobe')}
        </div>
        <div class="breakdown-chip-picker">
          <select data-breakdown-add="true" data-field="wardrobe" data-idx="${idx}">
            <option value="">Add wardrobe…</option>
            ${getEntityCatalogForField('wardrobe').map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('')}
          </select>
        </div>
      </td>
      <td class="breakdown-chip-cell">
        <div class="breakdown-chip-list">${renderEntityChipsHtml(sfxValues, (value) => `data-breakdown-remove="true" data-field="sfx" data-value="${encodeURIComponent(value)}"`, 'effect')}
        </div>
        <div class="breakdown-chip-picker">
          <select data-breakdown-add="true" data-field="sfx" data-idx="${idx}">
            <option value="">Add SFX…</option>
            ${getEntityCatalogForField('sfx').map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('')}
          </select>
        </div>
      </td>
      <td><textarea rows="2" data-field="notes" data-idx="${idx}">${row.notes}</textarea></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('input, textarea').forEach((el) => {
    el.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement;
      const idx = target.dataset.idx;
      const field = target.dataset.field;
      if (idx !== undefined && field !== undefined) (breakdownData as any)[Number(idx)][field] = target.value;
    });
  });

  tbody.querySelectorAll('select[data-breakdown-add="true"]').forEach((el) => {
    el.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      const idx = Number(target.dataset.idx);
      const field = target.dataset.field;
      const value = normalizeEntityName(target.value);
      if (!value || !field) return;
      const existing = splitEntityValue((breakdownData as any)[idx][field]);
      if (!existing.find((item) => item.toLowerCase() === value.toLowerCase())) {
        existing.push(value);
        (breakdownData as any)[idx][field] = joinEntityValue(existing);
      }
      target.value = '';
      renderBreakdownTable();
      scheduleFountainRender();
    });
  });

  tbody.querySelectorAll('[data-breakdown-remove="true"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const et = e.target as HTMLElement;
      const td = et.closest('td');
      const rowEl = et.closest('tr');
      if (!tbody || !rowEl) return;
      const idx = Array.from(tbody.children).indexOf(rowEl);
      if (!td || idx < 0) return;
      const field = et.dataset.field;
      const value = normalizeEntityName(decodeURIComponent(et.dataset.value || ''));
      if (!field) return;
      (breakdownData as any)[idx][field] = joinEntityValue(
        splitEntityValue((breakdownData as any)[idx][field]).filter((item) => item.toLowerCase() !== value.toLowerCase())
      );
      renderBreakdownTable();
      scheduleFountainRender();
    });
  });
}

export function syncScriptToStoryboard() {
  const scriptText = getCurrentScriptText();
  window.storyboardFrames = storyboardFrames.map(frame => {
    if (frame.scriptLink) return frame;
    const labelCandidate = frame.label.split('-').pop().trim();
    if (labelCandidate && scriptText.toLowerCase().includes(labelCandidate.toLowerCase())) {
      return { ...frame, scriptLink: labelCandidate };
    }
    return frame;
  });
  renderStoryboard();
  scheduleFountainRender();
  alertCG('Script and storyboard synchronized. Unlinked frames were auto-anchored where possible.');
}

export function exportBreakdown() {
  closeSaveExportMenu();
  let csv = 'Scene,INT/EXT,Location,Time,Characters,Props,Wardrobe,SFX/Makeup,Notes\n';
  breakdownData.forEach(row => {
    csv += `"${row.scene}","${row.int_ext}","${row.location}","${row.time}","${row.characters}","${row.props}","${row.wardrobe}","${row.sfx}","${row.notes}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'breakdown_sheet.csv'; a.click();
}

export function openTimeline() {
  switchView('timeline', 'Rough Cut Timeline', 'assembly');
  renderTimeline();
}
export function installAssetsBundleGlobals(): void {
  const w = window as unknown as Record<string, unknown>;
  w.renderLocationScout = renderLocationScout;
  w.filterLocations = filterLocations;
  w.generateLocation = generateLocation;
  w.useLocation = useLocation;
  w.renderGlobalAssets = renderGlobalAssets;
  w.switchAssetTab = switchAssetTab;
  w.autoSuggestBreakdown = autoSuggestBreakdown;
  w.renderBreakdownTable = renderBreakdownTable;
  w.syncScriptToStoryboard = syncScriptToStoryboard;
  w.exportBreakdown = exportBreakdown;
  w.openTimeline = openTimeline;
}
