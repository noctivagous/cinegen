import { alertCG } from '@/utils/alert-cg';

/**
 * Script-info panel utilities: entity extraction from Fountain script,
 * add/remove entities, and render script-info tables.
 */

interface ScriptEntities {
  characters: string[];
  locations: string[];
}

export function extractScriptEntities(): ScriptEntities {
  const editor = document.getElementById('script-editor');
  if (!editor) return { characters: [], locations: [] };
  const lines = (editor as HTMLTextAreaElement).value.split('\n');
  const types = classifyFountainDocument(lines);
  const characters: string[] = [];
  const locations: string[] = [];

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (types[idx] === 'character') {
      const cleaned = normalizeFountainCharacterCue(trimmed);
      characters.push(cleaned);
    }
    if (types[idx] === 'scene') {
      let slug = trimmed.replace(/^(INT\.?|EXT\.?|EST\.?|INT\/EXT\.?|I\/E\.?)\s*/i, '').trim();
      slug = slug.split(/\s+-\s+/)[0].trim();
      if (slug) locations.push(slug);
    }
  });

  return {
    characters: uniqueByName(characters),
    locations: uniqueByName(locations)
  };
}

export function syncDetectedScriptEntitiesToProject(opts: Record<string, unknown> = {}) {
  const entities = extractScriptEntities();
  addItemsToLibrary('characters', entities.characters, 'fa-user', 'Detected in script');
  addItemsToLibrary('locations', entities.locations, 'fa-map-location-dot', 'Detected in script');
  renderBreakdownTable();
  scheduleFountainRender();
  if (opts.refreshScriptInfo || (window as unknown as Record<string, unknown>).scriptPaneTab === 'info') renderScriptInfoTables();
  if (opts.refreshGlobalAssets) renderGlobalAssets(0);
  return entities;
}

export function refreshScriptInfoFromScript() {
  syncDetectedScriptEntitiesToProject({ refreshScriptInfo: true });
  alertCG('Script info refreshed from recognized Fountain entities.');
}

export function addEntityFromScriptInfo(type: string) {
  const input = document.getElementById(`script-info-input-${type}`);
  if (!input) return;
  const name = normalizeEntityName((input as HTMLInputElement).value);
  if (!name) return;
  if (type === 'characters') addItemsToLibrary('characters', [name], 'fa-user', 'Added manually');
  if (type === 'locations') addItemsToLibrary('locations', [name], 'fa-map-location-dot', 'Added manually');
  if (type === 'props') addItemsToLibrary('props', [name], 'fa-box-open', 'Added manually');
  if (type === 'wardrobe') {
    (window as unknown as Record<string, unknown>).scriptInfoWardrobe = uniqueByName([...((window as unknown as Record<string, unknown>).scriptInfoWardrobe as string[] ?? []), name]);
  }
  if (type === 'sfx') addItemsToLibrary('effects', [name], 'fa-bolt', 'Added manually');
  (input as HTMLInputElement).value = '';
  renderScriptInfoTables();
  renderBreakdownTable();
  scheduleFountainRender();
}

export function removeEntityFromScriptInfo(type: string, value: string) {
  const lowered = normalizeEntityName(value).toLowerCase();
  if (!lowered) return;
  const w = window as unknown as Record<string, unknown>;
  const lib = w.assetLibrary as Record<string, Array<{ name: string }>>;
  const data = w.breakdownData as Array<Record<string, string>>;

  if (type === 'characters') {
    lib.characters = lib.characters.filter((item) => normalizeEntityName(item.name).toLowerCase() !== lowered);
  } else if (type === 'locations') {
    lib.locations = lib.locations.filter((item) => normalizeEntityName(item.name).toLowerCase() !== lowered);
  } else if (type === 'props') {
    lib.props = lib.props.filter((item) => normalizeEntityName(item.name).toLowerCase() !== lowered);
  } else {
    const field = type === 'wardrobe' ? 'wardrobe' : 'sfx';
    if (type === 'wardrobe') {
      w.scriptInfoWardrobe = ((w.scriptInfoWardrobe as string[]) ?? []).filter(
        (item) => item.toLowerCase() !== lowered
      );
    }
    data.forEach((row) => {
      row[field] = joinEntityValue(splitEntityValue(row[field]).filter((item) => item.toLowerCase() !== lowered));
    });
  }
  renderScriptInfoTables();
  renderBreakdownTable();
  scheduleFountainRender();
}

interface ScriptInfoSection {
  type: string;
  label: string;
  icon: string;
  chipType: string;
}

const DEFAULT_SCRIPT_INFO_SECTIONS: ScriptInfoSection[] = [
  { type: 'characters', label: 'Characters', icon: 'fa-user', chipType: 'character' },
  { type: 'locations', label: 'Locations', icon: 'fa-map-location-dot', chipType: 'location' },
  { type: 'props', label: 'Props', icon: 'fa-box-open', chipType: 'prop' },
  { type: 'wardrobe', label: 'Wardrobe', icon: 'fa-shirt', chipType: 'wardrobe' },
  { type: 'sfx', label: 'SFX / Makeup', icon: 'fa-bolt', chipType: 'effect' },
];

export function renderScriptInfoSection(section: ScriptInfoSection) {
  const { type, label, icon, chipType } = section;
  const singularByType: Record<string, string> = {
    characters: 'character',
    locations: 'location',
    props: 'prop',
    wardrobe: 'wardrobe item',
    sfx: 'SFX item'
  };
  const field = type === 'locations' ? 'location' : type;
  const values = getEntityCatalogForField(field);
  const chipHtml = renderEntityChipsHtml(
    values,
    (value) => `data-ws-remove-entity="${type}:${encodeURIComponent(value)}"`,
    chipType
  );
  return `
    <section class="script-info-section script-info-section--${chipType}">
      <div class="script-info-section-header">
        <span class="script-info-section-title"><i class="fa-solid ${icon}" aria-hidden="true"></i> ${label}</span>
        <span class="script-info-section-count">${values.length} recognized</span>
      </div>
      <div class="script-info-entity-list">${chipHtml}</div>
      <div class="script-info-add-inline">
        <input id="script-info-input-${type}" type="text" placeholder="Add ${singularByType[type] || 'item'}">
        <button type="button" class="toolbar-btn script-info-add-btn" data-ws-add-entity="${type}">
          <i class="fa-solid fa-plus"></i> Add
        </button>
      </div>
    </section>`;
}

export function renderScriptInfoTables() {
  const host = document.getElementById('script-info-content');
  if (!host) return;
  const w = window as unknown as Record<string, unknown>;
  const sections = Array.isArray(w.SCRIPT_INFO_SECTIONS) && (w.SCRIPT_INFO_SECTIONS as unknown[]).length
    ? (w.SCRIPT_INFO_SECTIONS as ScriptInfoSection[])
    : DEFAULT_SCRIPT_INFO_SECTIONS;
  host.innerHTML = sections.map(renderScriptInfoSection).join('');
}

/* ── Globals used by this module (declared in workspace-bundle.ts) ───────── */

declare function classifyFountainDocument(lines: string[]): string[];
declare function normalizeFountainCharacterCue(line: string): string;
declare function uniqueByName(values: string[]): string[];
declare function normalizeEntityName(value: string): string;
declare function joinEntityValue(values: string[]): string;
declare function splitEntityValue(value: string): string[];
declare function addItemsToLibrary(
  bucket: string,
  values: string[],
  icon?: string,
  desc?: string
): void;
declare function getEntityCatalogForField(field: string): string[];
declare function renderEntityChipsHtml(
  values: string[],
  onclickAttr: (value: string) => string,
  chipType: string
): string;
declare function renderBreakdownTable(): void;
declare function scheduleFountainRender(): void;
declare function renderGlobalAssets(idx: number): void;

function escHtml(str: unknown): string {
  if (typeof str !== 'string') str = String(str ?? '');
  return (str as string)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
