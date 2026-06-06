// @ts-nocheck — legacy port from gui-Chip.js (Wave F).
/**
 * Ported from source/js/gui-Chip.js
 */
/** Entity chip navigation and cross-references */

import { STORYBOARD_FRAME_DESTINATIONS } from '@/storyboard/storyboard-destinations';
import { updateInspector } from '@/components/panels/cinegen-inspector';
import { persistProjectTreeExpandedState } from '@/services/project-service';
import { sceneIdFromStoryboardFrame } from '@/workspace/shot-frame-bridge';
import { getCinegenScriptEditor } from '@/panels/panel-hosts';
import { getCurrentScriptText } from '@/script/fountain-bundle';
import { SCRIPT_INFO_SECTIONS } from '@/services/utils-bundle';
import {
  projectData,
  breakdownData,
  assetLibrary,
  storyboardFrames,
  currentSceneData,
} from '@/data/project-data';
import { switchView } from '@/workspace/view-routing';
import { hideStoryboardContextMenu as hideSbContextMenu } from '@/storyboard/storyboard-context-menus';

// ==================== CHIP NAVIGATION ====================
let chipNavFocus = { type: null, label: null };

const CHIP_NAV_CONFIG = {
  character: {
    defaultDest: 'casting',
    destinations: [
      { id: 'casting', label: 'Casting / Characters', icon: 'fa-users' },
      { id: 'global', label: 'Global view — all mentions', icon: 'fa-globe' },
      { id: 'script', label: 'Script', icon: 'fa-scroll' },
      { id: 'script-info', label: 'Script Info', icon: 'fa-list' },
      { id: 'breakdown', label: 'Breakdown Sheets', icon: 'fa-table-list' },
      { id: 'studio-space/global-assets', label: 'Global Assets — Characters', icon: 'fa-cube', assetTab: 0 },
      { id: 'sound-adr', label: 'Sound — ADR / Loop Group', icon: 'fa-microphone' }
    ]
  },
  location: {
    defaultDest: 'location-scout',
    destinations: [
      { id: 'location-scout', label: 'Virtual Location Scout', icon: 'fa-map' },
      { id: 'global', label: 'Global view — all mentions', icon: 'fa-globe' },
      { id: 'script', label: 'Script', icon: 'fa-scroll' },
      { id: 'breakdown', label: 'Breakdown Sheets', icon: 'fa-table-list' },
      { id: 'studio-space/global-assets', label: 'Global Assets — Locations', icon: 'fa-cube', assetTab: 1 }
    ]
  },
  prop: {
    defaultDest: 'prop-library',
    destinations: [
      { id: 'prop-library', label: 'Prop Library', icon: 'fa-boxes-stacked' },
      { id: 'global', label: 'Global view — all mentions', icon: 'fa-globe' },
      { id: 'script', label: 'Script', icon: 'fa-scroll' },
      { id: 'breakdown', label: 'Breakdown Sheets', icon: 'fa-table-list' },
      { id: 'studio-space/global-assets', label: 'Global Assets — Props', icon: 'fa-cube', assetTab: 2 }
    ]
  },
  wardrobe: {
    defaultDest: 'outfit-sets',
    destinations: [
      { id: 'outfit-sets', label: 'Outfit Sets', icon: 'fa-vest' },
      { id: 'casting', label: 'Casting / Characters', icon: 'fa-users' },
      { id: 'breakdown', label: 'Breakdown Sheets', icon: 'fa-table-list' },
      { id: 'global', label: 'Global view — all mentions', icon: 'fa-globe' },
      { id: 'script', label: 'Script', icon: 'fa-scroll' },
      { id: 'script-info', label: 'Script Info', icon: 'fa-list' }
    ]
  },
  effect: {
    defaultDest: 'sound-sfx',
    destinations: [
      { id: 'sound-sfx', label: 'Sound Design & SFX', icon: 'fa-bolt' },
      { id: 'global', label: 'Global view — all mentions', icon: 'fa-globe' },
      { id: 'script', label: 'Script', icon: 'fa-scroll' },
      { id: 'breakdown', label: 'Breakdown Sheets', icon: 'fa-table-list' },
      { id: 'studio-space/global-assets', label: 'Global Assets — Effects', icon: 'fa-cube', assetTab: 4 }
    ]
  },
  vehicle: {
    defaultDest: 'studio-space/global-assets',
    destinations: [
      { id: 'studio-space/global-assets', label: 'Global Assets — Vehicles', icon: 'fa-car', assetTab: 3 },
      { id: 'global', label: 'Global view — all mentions', icon: 'fa-globe' },
      { id: 'script', label: 'Script', icon: 'fa-scroll' }
    ]
  },
  slug: {
    defaultDest: 'breakdown',
    destinations: [
      { id: 'breakdown', label: 'Breakdown Sheets', icon: 'fa-table-list' },
      { id: 'global', label: 'Global view — all mentions', icon: 'fa-globe' },
      { id: 'script', label: 'Script', icon: 'fa-scroll' }
    ]
  }
};

function decodeChipLabel(encoded) {
  try {
    return decodeURIComponent(encoded || '');
  } catch {
    return encoded || '';
  }
}

function chipLabelMatches(text, label, chipType) {
  if (!text || !label) return false;
  const aliases =
    chipType === 'character' ? characterMatchAliases(label) : [normalizeEntityName(label)];
  const useWordBoundary = chipType === 'character' || chipType === 'slug';
  return aliases.some((alias) => {
    const needle = alias.toLowerCase();
    if (!needle) return false;
    if (useWordBoundary) {
      return new RegExp(`\\b${escapeRegExp(needle)}\\b`, 'i').test(text);
    }
    return text.toLowerCase().includes(needle);
  });
}

function findProjectNode(predicate, node = projectData) {
  if (predicate(node)) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findProjectNode(predicate, child);
      if (found) return found;
    }
  }
  return null;
}

function findProjectNodeByName(name, node = projectData) {
  return findProjectNode((candidate) => candidate.name === name, node);
}

function findProjectNodeBySceneId(sceneId, node = projectData) {
  return findProjectNode((candidate) => candidate.sceneId === sceneId, node);
}

function expandTreePathToNode(targetName, node = projectData, ancestors = []) {
  if (node.name === targetName) {
    let changed = false;
    ancestors.forEach((n) => {
      if (n.children && n.children.length && !n.expanded) {
        n.expanded = true;
        changed = true;
      }
    });
    if (changed) persistProjectTreeExpandedState();
    return true;
  }
  if (node.children) {
    for (const child of node.children) {
      if (expandTreePathToNode(targetName, child, [...ancestors, node])) return true;
    }
  }
  return false;
}

function activateTreeNodeByName(name) {
  if (typeof window.activateProjectTreeNode === 'function') {
    return window.activateProjectTreeNode(name);
  }
  expandTreePathToNode(name);
  window.renderFullTree?.();
  const el = document.querySelector(`.tree-item[data-name="${CSS.escape(name)}"]`);
  const node = findProjectNodeByName(name);
  if (el && node) {
    window.selectTreeNode?.(el, node);
    return true;
  }
  return false;
}

export function getChipAtScriptCaret() {
  const view = getCinegenScriptEditor()?.editorView;
  if (!view) return null;
  const text = view.state.doc.toString();
  const pos = view.state.selection.main.head;
  const lineInfo = view.state.doc.lineAt(pos);
  const line = lineInfo.text;
  const col = pos - lineInfo.from;
  const lineIdx = lineInfo.number - 1;
  const types = classifyFountainDocument(text.split('\n'));
  const lineType = types[lineIdx];

  if (lineType === 'character') {
    const core = normalizeFountainCharacterCue(line);
    if (core) return { type: 'character', label: core };
  }

  const matches = findNonOverlappingMatches(line, getProjectRegistryMatchTokens());
  for (const m of matches) {
    if (col >= m.start && col < m.end) {
      return { type: m.type, label: line.slice(m.start, m.end) };
    }
  }
  return null;
}

function scrollScriptToLine(lineIndex) {
  const view = getCinegenScriptEditor()?.editorView;
  if (!view || lineIndex < 0) return;
  try {
    const line = view.state.doc.line(lineIndex + 1);
    view.dispatch({
      selection: { anchor: line.from, head: line.to },
      scrollIntoView: true,
    });
    view.focus();
  } catch {
    /* line number out of range */
  }
}

function collectChipMentions(chipType, label) {
  const mentions = [];
  const push = (area, detail, meta = {}) => mentions.push({ area, detail, ...meta });

  const text = getCurrentScriptText();
  if (text) {
    const lines = text.split('\n');
    const types = classifyFountainDocument(lines);
    lines.forEach((line, idx) => {
      if (!line.trim()) return;
      const lineType = types[idx];
      if (lineType === 'character' && chipType === 'character') {
        const core = normalizeFountainCharacterCue(line);
        if (chipLabelMatches(core, label, chipType)) {
          push('Script', `Line ${idx + 1} — character cue: ${core}`, { dest: 'script', line: idx });
        }
        return;
      }
      if (chipLabelMatches(line, label, chipType)) {
        const trimmed = line.trim();
        push('Script', `Line ${idx + 1}: ${trimmed.slice(0, 72)}${trimmed.length > 72 ? '…' : ''}`, { dest: 'script', line: idx });
      }
    });
  }

  SCRIPT_INFO_SECTIONS.forEach((sec) => {
    if (sec.chipType !== chipType) return;
    const field = sec.type === 'locations' ? 'location' : sec.type;
    getEntityCatalogForField(field).forEach((name) => {
      if (chipLabelMatches(name, label, chipType)) {
        push('Script Info', `${sec.label}: ${name}`, { dest: 'script-info' });
      }
    });
  });

  breakdownData.forEach((row) => {
    const fields = [
      { key: 'location', chip: 'location', label: 'Location' },
      { key: 'characters', chip: 'character', label: 'Characters' },
      { key: 'props', chip: 'prop', label: 'Props' },
      { key: 'wardrobe', chip: 'wardrobe', label: 'Wardrobe' },
      { key: 'sfx', chip: 'effect', label: 'SFX / Makeup' }
    ];
    fields.forEach(({ key, chip, label: fieldLabel }) => {
      if (chip !== chipType) return;
      splitEntityValue(row[key]).forEach((value) => {
        if (chipLabelMatches(value, label, chipType)) {
          push('Breakdown', `Scene ${row.scene} — ${fieldLabel}: ${value}`, { dest: 'breakdown', scene: row.scene });
        }
      });
    });
    if (chipType === 'slug' && chipLabelMatches(`${row.int_ext} ${row.location}`, label, chipType)) {
      push('Breakdown', `Scene ${row.scene} heading — ${row.int_ext} ${row.location}`, { dest: 'breakdown', scene: row.scene });
    }
  });

  const libMap = {
    character: assetLibrary.characters,
    location: assetLibrary.locations,
    prop: assetLibrary.props,
    vehicle: assetLibrary.vehicles,
    effect: assetLibrary.effects
  };
  const lib = libMap[chipType];
  if (lib) {
    lib.forEach((item) => {
      if (chipLabelMatches(item.name, label, chipType)) {
        push('Global Assets', item.name, { dest: 'studio-space/global-assets', assetTab: { character: 0, location: 1, prop: 2, vehicle: 3, effect: 4 }[chipType] ?? 0 });
      }
    });
  }

  storyboardFrames.forEach((frame) => {
    const blob = `${frame.label || ''} ${frame.scriptLink || ''} ${frame.notes || ''}`;
    if (chipLabelMatches(blob, label, chipType)) {
      push('Storyboard', frame.label || frame.id, { dest: 'script' });
    }
  });

  Object.entries(currentSceneData).forEach(([sceneId, scene]) => {
    (scene.coverage || []).forEach((shot) => {
      if (chipLabelMatches(shot.label, label, chipType)) {
        push('Scene coverage', `${scene.title} — ${shot.label}`, { dest: 'scene', sceneId: sceneId });
      }
    });
  });

  if (chipType === 'character') {
    assetLibrary.characters.forEach((item) => {
      if (chipLabelMatches(item.name, label, chipType)) {
        push('Casting / Characters', item.desc ? `${item.name} — ${item.desc}` : item.name, { dest: 'casting' });
      }
    });
  }

  return mentions;
}

function renderCastingView(focusLabel) {
  const host = document.getElementById('casting-character-list');
  if (!host) return;
  const focus = focusLabel ? normalizeEntityName(focusLabel).toLowerCase() : '';
  host.innerHTML = assetLibrary.characters
    .map((item) => {
      const isFocus = focus && chipLabelMatches(item.name, focusLabel, 'character');
      return `
        <article class="casting-card${isFocus ? ' casting-card--focus' : ''}" data-casting-name="${encodeURIComponent(item.name)}">
          <div class="casting-card-icon"><i class="fa-solid ${item.icon || 'fa-user'}"></i></div>
          <h3 class="casting-card-name">${escapeHtml(item.name)}</h3>
          <p class="casting-card-desc">${escapeHtml(item.desc || 'No casting notes yet.')}</p>
          <p class="casting-card-voice"><i class="fa-solid fa-microphone"></i> Voice: <span class="text-[var(--text-dim)]">Not set — cross-ref Sound when added</span></p>
        </article>`;
    })
    .join('') || '<p class="casting-empty">No characters in the project yet. Parse the script or add them in Script Info.</p>';

  if (focus) {
    const card = host.querySelector('.casting-card--focus');
    card?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function renderChipGlobalView(chipType, label) {
  const titleEl = document.getElementById('chip-global-title');
  const listEl = document.getElementById('chip-global-list');
  if (!titleEl || !listEl) return;
  const config = CHIP_NAV_CONFIG[chipType];
  const typeLabel = chipType.charAt(0).toUpperCase() + chipType.slice(1);
  titleEl.innerHTML = `<i class="fa-solid fa-globe"></i> ${escapeHtml(label)} <span class="chip-global-type">(${typeLabel})</span>`;
  const mentions = collectChipMentions(chipType, label);
  if (!mentions.length) {
    listEl.innerHTML = '<p class="chip-global-empty">No mentions found in this project yet.</p>';
    return;
  }
  listEl.innerHTML = mentions
    .map(
      (m, i) => `
      <button type="button" class="chip-global-row" data-mention-idx="${i}">
        <span class="chip-global-area">${escapeHtml(m.area)}</span>
        <span class="chip-global-detail">${escapeHtml(m.detail)}</span>
      </button>`
    )
    .join('');
  listEl.querySelectorAll('.chip-global-row').forEach((btn) => {
    btn.addEventListener('click', () => {
      const m = mentions[Number(btn.dataset.mentionIdx)];
      if (m) jumpToChipMention(m, chipType, label);
    });
  });
}

function jumpToChipMention(mention, chipType, label) {
  if (mention.dest === 'script' && typeof mention.line === 'number') {
    activateTreeNodeByName('Script');
    window.setPreprodMode?.('script');
    window.switchScriptPaneTab?.('script');
    scrollScriptToLine(mention.line);
    return;
  }
  if (mention.dest === 'scene' && mention.sceneId) {
    navigateChipDestination('scene', chipType, label, mention);
    return;
  }
  navigateChipDestination(mention.dest || CHIP_NAV_CONFIG[chipType]?.defaultDest, chipType, label, mention);
}

function navigateChipDestination(destId, chipType, label, mentionMeta) {
  chipNavFocus = { type: chipType, label };
  hideChipContextMenu();

  const treeTargets = {
    casting: 'Casting / Characters',
    script: 'Script',
    'script-info': 'Script',
    breakdown: 'Breakdown Sheets',
    'location-scout': 'Virtual Location Scout',
    'prop-library': 'Prop Library',
    'outfit-sets': 'Outfit Sets',
    'sound-sfx': 'Sound Design & SFX',
    'sound-adr': 'ADR / Loop Group'
  };

  if (destId === 'global') {
    switchView?.('chip-global', `Global — ${label}`, 'preprod');
    renderChipGlobalView(chipType, label);
    return;
  }

  if (destId === 'studio-space/global-assets') {
    const tab = mentionMeta?.assetTab ?? CHIP_NAV_CONFIG[chipType]?.destinations?.find((d) => d.id === 'studio-space/global-assets')?.assetTab ?? 0;
    activateTreeNodeByName('Library Browser');
    window.switchAssetTab?.(tab);
    return;
  }

  if (destId === 'casting') {
    activateTreeNodeByName('Casting / Characters');
    renderCastingView(label);
    return;
  }

  if (destId === 'script') {
    activateTreeNodeByName('Script');
    window.setPreprodMode?.('script');
    window.switchScriptPaneTab?.('script');
    if (typeof mentionMeta?.line === 'number') scrollScriptToLine(mentionMeta.line);
    return;
  }

  if (destId === 'script-info') {
    activateTreeNodeByName('Script');
    window.setPreprodMode?.('script');
    window.switchScriptPaneTab?.('info');
    return;
  }

  if (destId === 'scene' && mentionMeta?.sceneId) {
    const sceneTreeNode = findProjectNodeBySceneId(mentionMeta.sceneId);
    if (sceneTreeNode?.name) activateTreeNodeByName(sceneTreeNode.name);
    return;
  }

  const treeName = treeTargets[destId];
  if (treeName) activateTreeNodeByName(treeName);
}

function navigateChipDefault(chipType, label) {
  const config = CHIP_NAV_CONFIG[chipType];
  if (!config) return;
  const destMeta = config.destinations.find((d) => d.id === config.defaultDest) || {};
  navigateChipDestination(config.defaultDest, chipType, label, destMeta);
}

let chipContextState = null;

function stripChipContextMenuTypeClass(menu) {
  menu?.close?.();
}

function applyChipContextMenuTypeClass(_menu, _chipType) {
  /* Type modifier applied by cg-context-menu.open() */
}

const CHIP_TYPE_MENU_LABELS = {
  character: 'Character',
  location: 'Location',
  prop: 'Prop',
  wardrobe: 'Wardrobe',
  effect: 'SFX / Makeup',
  vehicle: 'Vehicle',
  slug: 'Scene heading'
};

function showChipContextMenu(chipEl, clientX, clientY) {
  const chipType = chipEl.dataset.chipType;
  const label = decodeChipLabel(chipEl.dataset.chipLabel);
  showChipContextMenuAt(chipType, label, clientX, clientY);
}

export function showChipContextMenuAt(chipType, label, clientX, clientY) {
  const config = CHIP_NAV_CONFIG[chipType];
  const menu = document.getElementById('chip-context-menu');
  if (!menu || typeof menu.open !== 'function' || !config || !label) return;

  hideSbContextMenu?.();
  chipContextState = { chipType, label };
  updateInspectorChip(chipType, label);
  const typeCaption = CHIP_TYPE_MENU_LABELS[chipType] || chipType;
  menu.open({
    x: clientX,
    y: clientY,
    typeModifier: chipType,
    header: { label, caption: typeCaption },
    items: config.destinations.map((d) => ({
      id: d.id,
      label: d.label,
      icon: d.icon,
    })),
    onSelect: (destId) => navigateChipDestination(destId, chipType, label),
  });
}

export function hideChipContextMenu() {
  document.getElementById('chip-context-menu')?.close?.();
  chipContextState = null;
}

export function extractChipsFromText(text) {
  if (!text) return [];
  return findNonOverlappingMatches(text, getProjectRegistryMatchTokens()).map((m) => ({
    type: m.type,
    label: text.slice(m.start, m.end)
  }));
}

export function extractChipsFromTexts(texts) {
  const seen = new Set();
  const chips = [];
  texts.forEach((text) => {
    extractChipsFromText(text).forEach((chip) => {
      const key = `${chip.type}:${chip.label.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        chips.push(chip);
      }
    });
  });
  return chips;
}

export function renderInspectorChipsSection(chips, opts = {}) {
  if (!chips || !chips.length) return '';
  const title = opts.title || 'Chips';
  const chipsHtml = chips
    .map((c) => {
      const safe = escapeHtml(c.label);
      return `<span class="entity-chip entity-chip--${c.type} chip-nav-target"${chipDataAttrs(c.type, c.label)}>${safe}</span>`;
    })
    .join('');
  return `
    <div class="inspector-chips-section">
      <div class="inspector-chips-title">${escapeHtml(title)}</div>
      <div class="inspector-chips-list">${chipsHtml}</div>
    </div>`;
}

function updateInspectorChip(chipType, label) {
  const mentions = collectChipMentions(chipType, label);
  updateInspector('chip', { type: chipType, label, mentionCount: mentions.length });
}

function initChipNavigation() {
  if (document.body.dataset.cgChipNavInit === '1') return;
  document.body.dataset.cgChipNavInit = '1';

  const menu = document.getElementById('chip-context-menu');
  if (!menu) return;

  document.addEventListener('click', (e) => {
    if (e.target.closest('.remove-chip-btn')) return;
    if (e.target.closest('#chip-context-menu')) return;

    const chip = e.target.closest('[data-chip-type]');
    if (chip) {
      showChipContextMenu(chip, e.clientX, e.clientY);
      return;
    }

    if (typeof menu.containsTarget === 'function' && menu.containsTarget(e.target)) return;
    if (!menu.hidden) hideChipContextMenu();
  });

  document.addEventListener('contextmenu', (e) => {
    const chip = e.target.closest('[data-chip-type]');
    if (!chip) return;
    e.preventDefault();
    showChipContextMenu(chip, e.clientX, e.clientY);
  });

  document.addEventListener('dblclick', (e) => {
    if (e.target.closest('.remove-chip-btn')) return;
    const chip = e.target.closest('[data-chip-type]');
    if (!chip) return;
    e.preventDefault();
    navigateChipDefault(chip.dataset.chipType, decodeChipLabel(chip.dataset.chipLabel));
  });

  const scriptEditor = document.querySelector('cinegen-script-editor');
  if (scriptEditor) {
    scriptEditor.addEventListener('click', (e) => {
      requestAnimationFrame(() => {
        const atChip = getChipAtScriptCaret();
        if (!atChip) return;
        showChipContextMenuAt(atChip.type, atChip.label, e.clientX, e.clientY);
      });
    });
    scriptEditor.addEventListener('dblclick', (e) => {
      const atChip = getChipAtScriptCaret();
      if (!atChip) return;
      e.preventDefault();
      navigateChipDefault(atChip.type, atChip.label);
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideChipContextMenu();
      hideSbContextMenu?.();
    }
  });
}


function collectStoryboardFrameMentions(frame) {
  const chips = extractChipsFromTexts([frame.label, frame.notes, frame.scriptLink]);
  const mentions = [];
  chips.forEach((chip) => {
    collectChipMentions(chip.type, chip.label).forEach((m) => {
      mentions.push({ ...m, chipType: chip.type, chipLabel: chip.label });
    });
  });
  return { chips, mentions };
}

export function navigateStoryboardDestination(destId, frame) {
  hideSbContextMenu?.();

  if (destId === 'script') {
    activateTreeNodeByName('Script');
    window.setPreprodMode?.('script');
    window.switchScriptPaneTab?.('script');
    highlightScriptForFrame(frame);
    updateInspector('storyboard-frame', frame);
    return;
  }
  if (destId === 'preprod-both') {
    activateTreeNodeByName('Script + Storyboard');
    window.setPreprodMode?.('both');
    window.selectedStoryboardFrameId = frame.id;
    window.renderStoryboard?.();
    updateInspector('storyboard-frame', frame);
    return;
  }
  if (destId === 'storyboard') {
    activateTreeNodeByName('Storyboard');
    window.setPreprodMode?.('storyboard');
    window.selectedStoryboardFrameId = frame.id;
    window.renderStoryboard?.();
    updateInspector('storyboard-frame', frame);
    return;
  }
  if (destId === 'scene') {
    const node = findProjectNodeBySceneId(sceneIdFromStoryboardFrame(frame));
    if (node?.name) {
      window.selectedStoryboardFrameId = frame.id;
      activateTreeNodeByName(node.name);
    }
    return;
  }
  if (destId === 'breakdown') {
    activateTreeNodeByName('Breakdown Sheets');
    updateInspector('storyboard-frame', frame);
    return;
  }
  if (destId === 'global') {
    renderStoryboardFrameGlobalView(frame);
    updateInspector('storyboard-frame', frame);
  }
}

function renderStoryboardFrameGlobalView(frame) {
  const titleEl = document.getElementById('chip-global-title');
  const listEl = document.getElementById('chip-global-list');
  if (!titleEl || !listEl) return;

  const { chips, mentions } = collectStoryboardFrameMentions(frame);
  titleEl.innerHTML = `<i class="fa-solid fa-globe"></i> ${escapeHtml(frame.label)} <span class="chip-global-type">(storyboard frame)</span>`;

  if (!mentions.length) {
    listEl.innerHTML = chips.length
      ? '<p class="chip-global-empty">No cross-references found for entities in this frame yet.</p>'
      : '<p class="chip-global-empty">No recognized entity chips in this frame.</p>';
    switchView?.('chip-global', `Global — ${frame.label}`, 'preprod');
    return;
  }

  listEl.innerHTML = mentions
    .map(
      (m, i) => `
      <button type="button" class="chip-global-row" data-mention-idx="${i}">
        <span class="chip-global-area">${escapeHtml(m.area)}</span>
        <span class="chip-global-detail">${escapeHtml(m.detail)}</span>
      </button>`
    )
    .join('');

  listEl.querySelectorAll('.chip-global-row').forEach((btn) => {
    btn.addEventListener('click', () => {
      const m = mentions[Number(btn.dataset.mentionIdx)];
      if (m) jumpToChipMention(m, m.chipType, m.chipLabel);
    });
  });

  switchView?.('chip-global', `Global — ${frame.label}`, 'preprod');
}


function _exposeMutableStateOnWindow(): void {
  const w = window as unknown as Record<string, unknown>;
  Object.defineProperty(w, 'chipNavFocus', {
    configurable: true,
    enumerable: true,
    get() { return chipNavFocus; },
    set(v) { chipNavFocus = v; },
  });
}

export function installChipBundleGlobals(): void {
  const w = window as unknown as Record<string, unknown>;
  w.decodeChipLabel = decodeChipLabel;
  w.chipLabelMatches = chipLabelMatches;
  w.findProjectNode = findProjectNode;
  w.findProjectNodeBySceneId = findProjectNodeBySceneId;
  w.expandTreePathToNode = expandTreePathToNode;
  w.activateTreeNodeByName = activateTreeNodeByName;
  w.getChipAtScriptCaret = getChipAtScriptCaret;
  w.scrollScriptToLine = scrollScriptToLine;
  w.collectChipMentions = collectChipMentions;
  w.renderCastingView = renderCastingView;
  w.renderChipGlobalView = renderChipGlobalView;
  w.jumpToChipMention = jumpToChipMention;
  w.navigateChipDestination = navigateChipDestination;
  w.navigateChipDefault = navigateChipDefault;
  w.stripChipContextMenuTypeClass = stripChipContextMenuTypeClass;
  w.applyChipContextMenuTypeClass = applyChipContextMenuTypeClass;
  w.showChipContextMenu = showChipContextMenu;
  w.showChipContextMenuAt = showChipContextMenuAt;
  w.hideChipContextMenu = hideChipContextMenu;
  w.extractChipsFromText = extractChipsFromText;
  w.extractChipsFromTexts = extractChipsFromTexts;
  w.renderInspectorChipsSection = renderInspectorChipsSection;
  w.updateInspectorChip = updateInspectorChip;
  w.initChipNavigation = initChipNavigation;
  w.sceneIdFromStoryboardFrame = sceneIdFromStoryboardFrame;
  w.collectStoryboardFrameMentions = collectStoryboardFrameMentions;
  w.navigateStoryboardDestination = navigateStoryboardDestination;
  w.renderStoryboardFrameGlobalView = renderStoryboardFrameGlobalView;
  w.escapeHtml = escapeHtml;
  w.escHtml = escapeHtml;
  _exposeMutableStateOnWindow();
}
