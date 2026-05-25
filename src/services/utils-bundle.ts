import { positionMenuWithinViewport } from '@/services/context-menu-position';
import { closeAllToolbarSplitMenus } from '@/services/toolbar-split-service';
import { escHtml as escapeHtml } from '@/utils/html';

import {
  TREE_SECTION_BY_NAME,
  WORKSPACE_SECTION_CLASSES,
} from '@/tree/hierarchy-section-theme';

// ==================== EXTENDED DATA STRUCTURES ====================
/** Tree depth (data-tree-depth): 0 = section header, 1+ = nested; each level darkens via --tree-tone-l* in CSS */

// Project seed data: projectRegistry, projectData, currentSceneData, storyboardFrames,
// timelineClips, locationLibrary, assetLibrary, breakdownData — loaded from projectData.js

let scriptPaneTab = 'script';
let scriptInfoWardrobe: any[] = [];
let scriptEditorChipsEnabled = true;
let scriptEditorAnchorsEnabled = false;
const SCRIPT_EDITOR_FONT_MIN = 10;
const SCRIPT_EDITOR_FONT_MAX = 28;
const SCRIPT_EDITOR_FONT_DEFAULT = 15;
let scriptEditorFontSizePx = SCRIPT_EDITOR_FONT_DEFAULT;
let scriptEditorInsertBarVisible = false;

function normalizeEntityName(value: any) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}


function splitEntityValue(value: any) {
  return String(value || '')
    .split(',')
    .map(normalizeEntityName)
    .filter(Boolean);
}

function joinEntityValue(values: any) {
  return values.map(normalizeEntityName).filter(Boolean).join(', ');
}

function uniqueByName(values: any) {
  const seen = new Set();
  const result: any[] = [];
  values.forEach((value: any) => {
    const normalized = normalizeEntityName(value);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(normalized);
  });
  return result;
}

function addItemsToLibrary(bucketName: any, values: any, icon = 'fa-tag', desc = 'Added from script') {
  if (!Array.isArray((window as any).assetLibrary[bucketName])) return;
  const bucket = (window as any).assetLibrary[bucketName];
  const existing = new Set(bucket.map((item: any) => normalizeEntityName(item.name).toLowerCase()));
  uniqueByName(values).forEach((name) => {
    const key = name.toLowerCase();
    if (existing.has(key)) return;
    bucket.push({ name, desc, icon });
    existing.add(key);
  });
}

function collectBreakdownFieldValues(field: any) {
  return uniqueByName(
    (window as any).breakdownData.flatMap((row: any) => splitEntityValue(row[field]))
  );
}

function getEntityCatalogForField(field: any) {
  if (field === 'characters') {
    return uniqueByName((window as any).assetLibrary.characters.map((item: any) => item.name));
  }
  if (field === 'location') {
    return uniqueByName((window as any).assetLibrary.locations.map((item: any) => item.name));
  }
  if (field === 'props') {
    return uniqueByName((window as any).assetLibrary.props.map((item: any) => item.name));
  }
  if (field === 'sfx') {
    return uniqueByName([
      ...(window as any).assetLibrary.effects.map((item: any) => item.name),
      ...collectBreakdownFieldValues('sfx')
    ]);
  }
  if (field === 'wardrobe') {
    return uniqueByName([
      ...scriptInfoWardrobe,
      ...collectBreakdownFieldValues('wardrobe')
    ]);
  }
  return [];
}

function chipDataAttrs(chipType: any, label: any) {
  if (!chipType) return '';
  return ` data-chip-type="${chipType}" data-chip-label="${encodeURIComponent(label)}"`;
}

function renderEntityChipsHtml(values: any, removeAction: any, chipType: any) {
  const emptyLabel = chipType ? 'No entities recognized yet' : 'No entities selected';
  if (!values.length) {
    return `<span class="script-info-empty${chipType ? ` script-info-empty--${chipType}` : ''}">${emptyLabel}</span>`;
  }
  const chipClass = chipType ? `entity-chip entity-chip--${chipType} chip-nav-target` : 'entity-chip';
  return values
    .map((value: any) => `
      <span class="${chipClass}"${chipDataAttrs(chipType, value)}>
        <span>${escapeHtml(value)}</span>
        <button type="button" class="remove-chip-btn" ${removeAction(value)} title="Remove ${escapeHtml(value)}">✕</button>
      </span>`)
    .join('');
}

const SCRIPT_INFO_SECTIONS = [
  { type: 'characters', label: 'Characters', icon: 'fa-user', chipType: 'character' },
  { type: 'locations', label: 'Locations', icon: 'fa-map-location-dot', chipType: 'location' },
  { type: 'props', label: 'Props', icon: 'fa-box-open', chipType: 'prop' },
  { type: 'wardrobe', label: 'Wardrobe', icon: 'fa-shirt', chipType: 'wardrobe' },
  { type: 'sfx', label: 'SFX / Makeup', icon: 'fa-bolt', chipType: 'effect' }
];

/** Screenplay slug prefixes — always rendered as chips in the script backdrop */
const FOUNTAIN_SLUG_CONVENTIONS = [
  'INT./EXT.',
  'INT/EXT.',
  'INT.',
  'EXT.',
  'EST.',
  'I/E.'
];

function escapeRegExp(value: any) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function characterMatchAliases(name: any) {
  const normalized = normalizeEntityName(name);
  if (!normalized) return [];
  const withoutParens = normalized.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const aliases = [normalized];
  if (withoutParens && withoutParens !== normalized) aliases.push(withoutParens);
  if (withoutParens) aliases.push(withoutParens.toUpperCase());
  return uniqueByName(aliases);
}

function normalizeFountainCharacterCue(value: any) {
  return normalizeEntityName(String(value || '').replace(/^@\s*/, '').replace(/\s*\([^)]*\)\s*$/, ''));
}

function getProjectRegistryMatchTokens() {
  const tokens = FOUNTAIN_SLUG_CONVENTIONS.map((text) => ({ text, type: 'slug' }));

  const pushAliases = (names: any, type: any) => {
    uniqueByName(names).forEach((name) => {
      const aliases = type === 'character' ? characterMatchAliases(name) : [name];
      aliases.forEach((text: any) => tokens.push({ text, type }));
    });
  };

  const fromScript =
    typeof (window as any).extractScriptEntities === 'function'
      ? (window as any).extractScriptEntities()
      : { characters: [], locations: [] };
  pushAliases((window as any).assetLibrary.characters.map((item: any) => item.name), 'character');
  pushAliases(fromScript.characters, 'character');
  pushAliases((window as any).assetLibrary.locations.map((item: any) => item.name), 'location');
  pushAliases(
    uniqueByName([
      ...collectBreakdownFieldValues('location'),
      ...fromScript.locations
    ]),
    'location'
  );
  pushAliases((window as any).assetLibrary.props.map((item: any) => item.name), 'prop');
  pushAliases((window as any).assetLibrary.vehicles.map((item: any) => item.name), 'vehicle');
  pushAliases((window as any).assetLibrary.effects.map((item: any) => item.name), 'effect');
  pushAliases(getEntityCatalogForField('wardrobe'), 'wardrobe');
  pushAliases(getEntityCatalogForField('sfx'), 'effect');

  return tokens.sort((a: any, b: any) => b.text.length - a.text.length);
}

function buildScriptInlineChip(label: any, type: any, extraClass = '') {
  const safe = escapeHtml(label);
  const extra = extraClass ? ` ${extraClass.trim()}` : '';
  return `<span class="script-inline-chip script-inline-chip--${type}${extra} chip-nav-target"${chipDataAttrs(type, label)} title="${safe} — double-click to open">${safe}</span>`;
}

function buildScriptInlineAnchor(label: any) {
  const safe = escapeHtml(label);
  return `<span class="script-inline-anchor" title="Storyboard anchor">${safe}</span>`;
}

function getScriptAnchorMatchTokens() {
  if (!Array.isArray((window as any).storyboardFrames)) return [];
  const seen = new Set();
  const tokens: any[] = [];
  (window as any).storyboardFrames.forEach((frame: any) => {
    const text = String(frame.scriptLink || '').trim();
    if (!text) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    tokens.push({ text, type: 'anchor' });
  });
  return tokens.sort((a: any, b: any) => b.text.length - a.text.length);
}

function lineSegmentIsScriptAnchor(segment: any, anchorTokens: any) {
  if (!segment || !anchorTokens.length) return false;
  const lower = segment.toLowerCase();
  return anchorTokens.some((token: any) => {
    const anchor = token.text.toLowerCase();
    return lower === anchor || lower.includes(anchor);
  });
}

function findAnchorSubstringMatches(line: any, anchorTokens: any) {
  const matches: any[] = [];
  const lower = line.toLowerCase();
  anchorTokens.forEach((token: any) => {
    const search = token.text.toLowerCase();
    if (!search) return;
    let idx = 0;
    while ((idx = lower.indexOf(search, idx)) !== -1) {
      matches.push({
        start: idx,
        end: idx + token.text.length,
        text: line.slice(idx, idx + token.text.length),
        type: 'anchor'
      });
      idx += search.length;
    }
  });
  matches.sort((a: any, b: any) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const kept: any[] = [];
  let cursor = 0;
  matches.forEach((m: any) => {
    if (m.start < cursor) return;
    kept.push(m);
    cursor = m.end;
  });
  return kept;
}

function findNonOverlappingMatches(line: any, tokens: any) {
  const matches: any[] = [];
  tokens.forEach((token: any) => {
    if (!token.text) return;
    const pattern =
      token.type === 'slug'
        ? escapeRegExp(token.text)
        : `\\b${escapeRegExp(token.text)}\\b`;
    const re = new RegExp(pattern, 'gi');
    let match;
    while ((match = re.exec(line)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        text: match[0],
        type: token.type
      });
    }
  });

  matches.sort((a: any, b: any) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const kept: any[] = [];
  let cursor = 0;
  matches.forEach((m: any) => {
    if (m.start < cursor) return;
    kept.push(m);
    cursor = m.end;
  });
  return kept;
}

function decorateLineWithRegistryChips(line: any) {
  return decorateLineForScriptBackdrop(line, 'action');
}

function decorateCharacterCueLine(line: any) {
  return decorateLineForScriptBackdrop(line, 'character');
}

function decorateLineForScriptBackdrop(line: any, lineType: any) {
  const chips = scriptEditorChipsEnabled;
  const anchors = scriptEditorAnchorsEnabled;
  if (!line) return '\u00a0';
  if (!chips && !anchors) return escapeHtml(line);

  const anchorTokens = anchors ? getScriptAnchorMatchTokens() : [];

  if (chips && lineType === 'character') {
    const m = line.match(/^(\s*)(.*?)(\s*)$/);
    if (!m || !m[2]) return decorateLineContent(line, chips, anchors, anchorTokens);
    const [, lead, core, trail] = m;
    const anchorClass =
      anchors && lineSegmentIsScriptAnchor(core, anchorTokens) ? 'script-inline-anchor' : '';
    return escapeHtml(lead) + buildScriptInlineChip(core, 'character', anchorClass) + escapeHtml(trail);
  }

  return decorateLineContent(line, chips, anchors, anchorTokens);
}

function decorateLineContent(line: any, chips: any, anchors: any, anchorTokens: any) {
  const chipMatches = chips
    ? findNonOverlappingMatches(line, getProjectRegistryMatchTokens())
    : [];
  const anchorMatches = anchors
    ? findAnchorSubstringMatches(line, anchorTokens)
    : [];
  const anchorOnly = anchorMatches.filter(
    (am) => !chipMatches.some((cm) => am.start < cm.end && am.end > cm.start)
  );
  const allMatches = [...chipMatches, ...anchorOnly].sort(
    (a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start)
  );
  const kept: any[] = [];
  let cursor = 0;
  allMatches.forEach((m: any) => {
    if (m.start < cursor) return;
    kept.push(m);
    cursor = m.end;
  });

  if (!kept.length) return escapeHtml(line);

  let html = '';
  let pos = 0;
  kept.forEach((m: any) => {
    html += escapeHtml(line.slice(pos, m.start));
    const slice = line.slice(m.start, m.end);
    if (m.type === 'anchor') {
      html += buildScriptInlineAnchor(slice);
    } else {
      const anchorClass =
        anchors && lineSegmentIsScriptAnchor(slice, anchorTokens) ? 'script-inline-anchor' : '';
      html += buildScriptInlineChip(slice, m.type, anchorClass);
    }
    pos = m.end;
  });
  html += escapeHtml(line.slice(pos));
  return html;
}

export function decorateFountainLine(line: any, lineType: any) {
  return decorateLineForScriptBackdrop(line, lineType);
}

function setScriptEditorChipsEnabled(enabled: any) {
  scriptEditorChipsEnabled = !!enabled;
  document.querySelectorAll('input[data-script-editor-chips]').forEach((input) => {
    (input as HTMLInputElement).checked = scriptEditorChipsEnabled;
  });
  window.scheduleFountainRender?.();
}

function initScriptEditorChipsToggle() {
  document.querySelectorAll('input[data-script-editor-chips]').forEach((input) => {
    (input as HTMLInputElement).checked = scriptEditorChipsEnabled;
    input.addEventListener('change', () => {
      setScriptEditorChipsEnabled((input as HTMLInputElement).checked);
    });
  });
}

function setScriptEditorAnchorsEnabled(enabled: any) {
  scriptEditorAnchorsEnabled = !!enabled;
  document.querySelectorAll('input[data-script-editor-anchors]').forEach((input) => {
    (input as HTMLInputElement).checked = scriptEditorAnchorsEnabled;
  });
  persistScriptEditorPreferences({ scriptEditorAnchorsEnabled: scriptEditorAnchorsEnabled });
  window.scheduleFountainRender?.();
}

function initScriptEditorAnchorsToggle() {
  document.querySelectorAll('input[data-script-editor-anchors]').forEach((input) => {
    (input as HTMLInputElement).checked = scriptEditorAnchorsEnabled;
    input.addEventListener('change', () => {
      setScriptEditorAnchorsEnabled((input as HTMLInputElement).checked);
    });
  });
}

function persistScriptEditorPreferences(patch: any) {
  void import('@/stores/app-shell-store').then(({ appShellStore }) => {
    appShellStore.patchPreferences({ ...appShellStore.preferences, ...patch });
  });
}

function applyScriptEditorFontSize(px: any) {
  const size = Math.max(
    SCRIPT_EDITOR_FONT_MIN,
    Math.min(SCRIPT_EDITOR_FONT_MAX, Math.round(Number(px) || SCRIPT_EDITOR_FONT_DEFAULT))
  );
  scriptEditorFontSizePx = size;
  const stack = document.getElementById('script-editor-stack');
  if (stack) stack.style.setProperty('--script-editor-font-size', `${size}px`);
  const input = document.getElementById('script-editor-font-size-input');
  if (input) (input as HTMLInputElement).value = String(size);
  window.syncScriptRenderScroll?.();
  persistScriptEditorPreferences({ scriptEditorFontSizePx: size });
}

function setScriptEditorInsertBarVisible(visible: any) {
  scriptEditorInsertBarVisible = !!visible;
  const bar = document.getElementById('script-fountain-insert-toolbar');
  const btn = document.getElementById('script-insert-bar-toggle');
  if (bar) bar.hidden = !scriptEditorInsertBarVisible;
  if (btn) btn.setAttribute('aria-pressed', scriptEditorInsertBarVisible ? 'true' : 'false');
  closeAllToolbarSplitMenus();
  persistScriptEditorPreferences({ scriptEditorInsertBarVisible: scriptEditorInsertBarVisible });
}

function initScriptEditorOptionsToolbar() {
  setScriptEditorInsertBarVisible(scriptEditorInsertBarVisible);
  applyScriptEditorFontSize(scriptEditorFontSizePx);

  const toggleBtn = document.getElementById('script-insert-bar-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setScriptEditorInsertBarVisible(!scriptEditorInsertBarVisible);
    });
  }

  const stepper = document.querySelector('[data-script-editor-font-stepper]');
  if (stepper) {
    const min = Number(stepper.getAttribute('data-min')) || SCRIPT_EDITOR_FONT_MIN;
    const max = Number(stepper.getAttribute('data-max')) || SCRIPT_EDITOR_FONT_MAX;
    const step = Number(stepper.getAttribute('data-step')) || 1;
    stepper.querySelectorAll('button[data-step]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dir = Number(btn.getAttribute('data-step'));
        const next = scriptEditorFontSizePx + dir * step;
        applyScriptEditorFontSize(Math.min(max, Math.max(min, next)));
      });
    });
  }
}


function _exposeMutableStateOnWindow(): void {
  const w = window as unknown as Record<string, unknown>;
  Object.defineProperty(w, 'scriptPaneTab', {
    configurable: true,
    enumerable: true,
    get() { return scriptPaneTab; },
    set(v) { scriptPaneTab = v; },
  });
  Object.defineProperty(w, 'scriptInfoWardrobe', {
    configurable: true,
    enumerable: true,
    get() { return scriptInfoWardrobe; },
    set(v) { scriptInfoWardrobe = v; },
  });
  Object.defineProperty(w, 'scriptEditorChipsEnabled', {
    configurable: true,
    enumerable: true,
    get() { return scriptEditorChipsEnabled; },
    set(v) { scriptEditorChipsEnabled = v; },
  });
  Object.defineProperty(w, 'scriptEditorAnchorsEnabled', {
    configurable: true,
    enumerable: true,
    get() { return scriptEditorAnchorsEnabled; },
    set(v) { scriptEditorAnchorsEnabled = v; },
  });
  Object.defineProperty(w, 'scriptEditorFontSizePx', {
    configurable: true,
    enumerable: true,
    get() { return scriptEditorFontSizePx; },
    set(v) { scriptEditorFontSizePx = v; },
  });
  Object.defineProperty(w, 'scriptEditorInsertBarVisible', {
    configurable: true,
    enumerable: true,
    get() { return scriptEditorInsertBarVisible; },
    set(v) { scriptEditorInsertBarVisible = v; },
  });
  w.WORKSPACE_SECTION_CLASSES = WORKSPACE_SECTION_CLASSES;
  w.TREE_SECTION_BY_NAME = TREE_SECTION_BY_NAME;
}

export function installUtilsBundleGlobals(): void {
  const w = window as unknown as Record<string, unknown>;
  w.normalizeEntityName = normalizeEntityName;
  w.splitEntityValue = splitEntityValue;
  w.joinEntityValue = joinEntityValue;
  w.uniqueByName = uniqueByName;
  w.addItemsToLibrary = addItemsToLibrary;
  w.collectBreakdownFieldValues = collectBreakdownFieldValues;
  w.getEntityCatalogForField = getEntityCatalogForField;
  w.chipDataAttrs = chipDataAttrs;
  w.renderEntityChipsHtml = renderEntityChipsHtml;
  w.escapeRegExp = escapeRegExp;
  w.characterMatchAliases = characterMatchAliases;
  w.normalizeFountainCharacterCue = normalizeFountainCharacterCue;
  w.getProjectRegistryMatchTokens = getProjectRegistryMatchTokens;
  w.buildScriptInlineChip = buildScriptInlineChip;
  w.buildScriptInlineAnchor = buildScriptInlineAnchor;
  w.getScriptAnchorMatchTokens = getScriptAnchorMatchTokens;
  w.lineSegmentIsScriptAnchor = lineSegmentIsScriptAnchor;
  w.findAnchorSubstringMatches = findAnchorSubstringMatches;
  w.findNonOverlappingMatches = findNonOverlappingMatches;
  w.decorateLineWithRegistryChips = decorateLineWithRegistryChips;
  w.decorateCharacterCueLine = decorateCharacterCueLine;
  w.decorateLineForScriptBackdrop = decorateLineForScriptBackdrop;
  w.decorateLineContent = decorateLineContent;
  w.decorateFountainLine = decorateFountainLine;
  w.setScriptEditorChipsEnabled = setScriptEditorChipsEnabled;
  w.initScriptEditorChipsToggle = initScriptEditorChipsToggle;
  w.setScriptEditorAnchorsEnabled = setScriptEditorAnchorsEnabled;
  w.initScriptEditorAnchorsToggle = initScriptEditorAnchorsToggle;
  w.persistScriptEditorPreferences = persistScriptEditorPreferences;
  w.applyScriptEditorFontSize = applyScriptEditorFontSize;
  w.setScriptEditorInsertBarVisible = setScriptEditorInsertBarVisible;
  w.initScriptEditorOptionsToolbar = initScriptEditorOptionsToolbar;
  w.positionMenuWithinViewport = positionMenuWithinViewport;
  w.escapeHtml = escapeHtml;
  _exposeMutableStateOnWindow();
}
