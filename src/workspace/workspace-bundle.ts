// @ts-nocheck — legacy port; tighten types incrementally.
/**
 * Workspace views — ported from gui-Workspace.js (Wave C).
 * @see wire-workspace-actions.ts for index.html control wiring
 */
import { emitWorkspaceSceneTab } from '@/events/shell-events';
import { switchView, updateWorkspaceSectionTheme } from '@/workspace/view-routing';
import { appShellStore } from '@/stores/app-shell-store';
import { getCinegenOverviewPanel, getCinegenSceneTabs, getCinegenTreatmentPanel } from '@/panels/panel-hosts';
import {
  applyTreatmentLayout as applyTreatmentLayoutFromService,
  getTreatmentForAI,
  getTreatmentForStoryAI,
  getTreatmentForVisualAI,
  migrateProjectTreatmentKeys,
  syncTreatmentFromForm,
} from '@/workspace/treatment-form-service';
import { workspaceState } from '@/workspace/workspace-state';
import { alertCG } from '@/utils/alert-cg';
import { updateInspector } from '@/components/panels/cinegen-inspector';
import type { TreeNode } from '@/tree/tree-types';
import { PREPROD_MODES, SUPPORTED_TREE_VIEWS } from '@/tree/tree-view-contract';
import { setActiveMoodBoard } from '@/data/project-data';
import { applyPreprodLayoutToDom, normalizePreprodLayoutMode } from '@/workspace/preprod-layout';
import {
  TREATMENT_FIELDS,
  TREATMENT_SECTIONS,
  TREATMENT_FULL_WIDTH_FIELDS,
  renderTreatmentFieldHtml as _renderTreatmentFieldHtml,
} from '@/workspace/treatment-fields';
import {
  renderContinuityTable as _extRenderContinuityTable,
  renderShotListTable as _extRenderShotListTable,
} from '@/workspace/table-renderers';
import {
  extractScriptEntities,
  syncDetectedScriptEntitiesToProject,
  refreshScriptInfoFromScript,
  addEntityFromScriptInfo,
  removeEntityFromScriptInfo,
  renderScriptInfoSection,
  renderScriptInfoTables,
} from '@/workspace/script-info-utils';
import {
  toggleOvColItem,
  showOvPreview,
  hideOvPreview,
  _dismissOvPreview,
  setOvHoverPreview,
} from '@/workspace/overview-preview';
import {
  _findSceneRefsForItem as _extFindSceneRefsForItem,
  _renderAssetDetailForm as _extRenderAssetDetailForm,
  _renderAssetFormEmpty as _extRenderAssetFormEmpty,
} from '@/workspace/asset-form-renderers';
import {
  highlightScriptForShot as bridgeHighlightScriptForShot,
  selectStoryboardFrameById as bridgeSelectStoryboardFrameById,
} from '@/workspace/shot-frame-bridge';

declare const projectData: { children?: TreeNode[]; name?: string };
declare const currentSceneData: Record<string, SceneData>;
declare const deletedStoryboardFrames: unknown[];
declare const breakdownData: Array<Record<string, string>>;
declare const assetDetailData: Record<string, AssetDetailData>;
declare const assetLibrary: Record<string, Array<{ name: string }>>;
declare const projectTreatment: Record<string, string>;
declare const SCRIPT_INFO_SECTIONS: Array<{ type: string; label: string; icon: string; chipType: string }>;
declare const WORKSPACE_SECTION_CLASSES: string[];
declare const scriptPaneTab: string;
declare const scriptInfoWardrobe: string[];
declare let chipNavFocus: { type: string | null; label: string | null };

declare function escapeHtml(str: unknown): string;
declare function renderGlobalAssets(idx: number): void;
declare function renderLocationScout(): void;
declare function renderTimeline(): void;
declare function renderCameraLighting(section: string | null): void;
declare function renderCastingView(label: string | null): void;
declare function renderBreakdownTable(): void;
declare function scheduleFountainRender(): void;
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
  onclickAttr: string,
  chipType: string
): string;

interface SceneData {
  title: string;
  master: { label: string; duration: string; status: string; prompt: string };
  coverage: Array<{ id: number; type: string; label: string; duration: string; bestTake?: boolean }>;
  broll: Array<{ id: number; label: string; duration: string }>;
  pickups: Array<{ id: number; label: string; duration: string }>;
  notes: string;
}

interface AssetDetailData {
  icon?: string;
  desc?: string;
  layout?: string;
  addLabel?: string;
  items?: Array<Record<string, unknown>>;
  rows?: string[][];
  columns?: string[];
}

/** Workspace views, pre-production script pane, scene detail */

function normalizePreprodMode(mode: unknown): 'script' | 'storyboard' | 'both' {
  const next = typeof mode === 'string' ? mode : '';
  if (PREPROD_MODES.has(next)) return next as 'script' | 'storyboard' | 'both';
  return 'both';
}

function warnTreeRoutingIssue(node: TreeNode, reason: string): void {
  const nodeName = node?.name ?? '(unnamed-node)';
  const requestedView = typeof node?.view === 'string' ? node.view : '(missing)';
  console.warn(`[cine-tree-routing] ${reason}. node="${nodeName}" requestedView="${requestedView}"`, node);
}

function resolveNodeViewOrFallback(node: TreeNode): string {
  if (node?.type === 'moodboard' || node?.type === 'moodboard-item') return 'moodboards';
  const requested = typeof node?.view === 'string' && node.view.trim() ? node.view : 'default';
  if (requested === 'moodboard-detail') return 'moodboards';
  if (!SUPPORTED_TREE_VIEWS.has(requested)) {
    warnTreeRoutingIssue(node, 'Unsupported view');
    return 'default';
  }
  if (requested === 'asset-detail' && !node?.detailKey) {
    warnTreeRoutingIssue(node, 'Missing detailKey for asset-detail node');
    return 'overview';
  }
  return requested;
}

function activateMoodBoardFromTree(node: TreeNode, sectionKey: string | null, itemId?: string): void {
  const boardId = node.boardId;
  if (!boardId) return;
  void switchView('moodboards', node.name, sectionKey).then(() => {
    setActiveMoodBoard(boardId);
    const view = document.querySelector('cinegen-moodboards-view') as
      | (HTMLElement & { requestUpdate?: () => void })
      | null;
    view?.requestUpdate?.();
    if (itemId && view) {
      view.dispatchEvent(
        new CustomEvent('moodboard-item-view', {
          bubbles: true,
          detail: { boardId, itemId },
        })
      );
    }
    updateInspector(node.type, node);
  });
}

// ==================== VIEW SWITCHING & SCENE DETAIL ====================

function _populateTreeNodeView(node, sectionKey, resolvedView) {
  if (resolvedView === 'preprod-workspace') {
    setPreprodMode(normalizePreprodMode(node.preprodMode));
  }
  if (resolvedView === 'assets') renderGlobalAssets(0);
  if (resolvedView === 'location-scout') renderLocationScout();
  if (resolvedView === 'timeline') renderTimeline();
  if (resolvedView === 'camera-lighting') renderCameraLighting(node.clSection || null);
  if (resolvedView === 'casting') window.renderCastingView?.(window.chipNavFocus?.label);
  if (resolvedView === 'overview') renderOverviewPanel(node, sectionKey);
  if (resolvedView === 'asset-detail') renderAssetDetailPanel(node);
  if (node.type === 'scrap') {
    updateInspector('scrap', { items: window.deletedStoryboardFrames });
  } else {
    updateInspector(node.type, node);
  }
}

function selectTreeNode(element, node, sectionKeyOverride) {
  const sectionKey =
    sectionKeyOverride ??
    element?.dataset?.section ??
    (typeof window.getTreeSectionKeyForNode === 'function'
      ? window.getTreeSectionKeyForNode(node)
      : null);

  if (typeof window.setProjectTreeSelection === 'function') {
    if (node?.name) window.setProjectTreeSelection(node.name);
  } else if (element) {
    document.querySelectorAll('.tree-item').forEach((el) => el.classList.remove('selected'));
    element.classList.add('selected');
  }

  if (node.type === 'scene-shot' && node.sceneId && node.shotId != null) {
    workspaceState.currentSceneId = node.sceneId;
    void switchView('scene-detail', node.name, sectionKey).then(() => {
      renderSceneDetail();
      switchSceneTab(2);
      inspectShot(node.shotId);
      const scene = window.currentSceneData?.[node.sceneId];
      const shot = scene?.coverage?.find((s) => s.id === node.shotId);
      if (shot) bridgeHighlightScriptForShot(node.sceneId, shot);
    });
  } else if (node.type === 'storyboard-frame' && node.frameId != null) {
    void switchView('preprod-workspace', node.name, sectionKey).then(() => {
      setPreprodMode('storyboard');
      if (node.sceneId) workspaceState.currentSceneId = node.sceneId;
      bridgeSelectStoryboardFrameById(node.frameId);
    });
  } else if (node.type === 'scene' && node.sceneId) {
    workspaceState.currentSceneId = node.sceneId;
    void switchView('scene-detail', node.name, sectionKey).then(() => {
      renderSceneDetail();
      updateInspector('scene', window.currentSceneData?.[node.sceneId]);
    });
  } else if (node.type === 'moodboard' && node.boardId) {
    activateMoodBoardFromTree(node, sectionKey);
  } else if (node.type === 'moodboard-item' && node.boardId) {
    activateMoodBoardFromTree(node, sectionKey, node.itemId);
  } else if (node.view === 'moodboards') {
    void switchView('moodboards', node.name, sectionKey).then(() => {
      _populateTreeNodeView(node, sectionKey, 'moodboards');
    });
  } else {
    const resolvedView = resolveNodeViewOrFallback(node);
    void switchView(resolvedView, node.name, sectionKey).then(() => {
      _populateTreeNodeView(node, sectionKey, resolvedView);
    });
  }
}

function setPreprodMode(mode) {
  applyPreprodLayoutToDom(normalizePreprodLayoutMode(mode));
}

function syncSegmentedControlValue(segEl, value, valueAttr = 'data-segmented-value') {
  if (!segEl) return;
  if (segEl.tagName === 'CG-SEGMENTED-CONTROL') {
    segEl.value = value;
    return;
  }
  segEl.querySelectorAll('.cg-segmented-segment').forEach((btn) => {
    const segmentValue = btn.getAttribute(valueAttr);
    const isActive = segmentValue === value;
    btn.classList.toggle('active', isActive);
    if (btn.getAttribute('role') === 'tab') {
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    }
  });
}

function initSegmentedControl(segEl, options = {}) {
  if (!segEl || segEl.dataset.segmentedInit === 'true') return;
  const valueAttr = options.valueAttr || 'data-segmented-value';
  const onChange = options.onChange;
  segEl.querySelectorAll('.cg-segmented-segment').forEach((btn) => {
    btn.addEventListener('click', () => {
      const value = btn.getAttribute(valueAttr);
      if (!value) return;
      if (onChange) onChange(value, btn);
    });
  });
  segEl.dataset.segmentedInit = 'true';
}

function initScriptPaneSegmentedControl() {
  const seg = document.querySelector('[data-segmented="script-pane"]');
  if (!seg) return;
  if (seg.tagName === 'CG-SEGMENTED-CONTROL') {
    if (seg.dataset.segmentedInit === 'true') return;
    seg.addEventListener('cg-change', (e) => {
      const value = e.detail?.value;
      if (value) switchScriptPaneTab(value);
    });
    seg.value = window.scriptPaneTab ?? 'script';
    seg.dataset.segmentedInit = 'true';
    return;
  }
  initSegmentedControl(seg, {
    valueAttr: 'data-script-pane-tab',
    onChange: (tab) => switchScriptPaneTab(tab)
  });
  syncSegmentedControlValue(seg, window.scriptPaneTab ?? 'script', 'data-script-pane-tab');
}

function switchScriptPaneTab(tab) {
  const validTabs = ['script', 'info', 'treatment'];
  const nextTab = validTabs.includes(tab) ? tab : 'script';
  window.scriptPaneTab = nextTab;
  const scriptView = document.getElementById('script-pane-script');
  const infoView = document.getElementById('script-pane-info');
  const treatmentView = document.getElementById('script-pane-treatment');
  const headerActions = document.getElementById('script-pane-header-actions');
  const segmented = document.querySelector('[data-segmented="script-pane"]');
  if (scriptView) scriptView.classList.toggle('hidden', nextTab !== 'script');
  if (infoView) infoView.classList.toggle('hidden', nextTab !== 'info');
  if (treatmentView) treatmentView.classList.toggle('hidden', nextTab !== 'treatment');
  if (headerActions) headerActions.classList.toggle('hidden', nextTab !== 'script');
  syncSegmentedControlValue(segmented, nextTab, 'data-script-pane-tab');
  if (nextTab === 'info') {
    renderScriptInfoTables();
  }
  if (nextTab === 'treatment') {
    renderTreatmentView();
  }
}

/* Script-info utilities are now in @/workspace/script-info-utils.ts (imported above). */

function renderSceneDetail() {
  const scene = window.currentSceneData?.[workspaceState.currentSceneId];
  const titleEl = document.getElementById('scene-detail-title');
  if (titleEl && scene) {
    titleEl.innerHTML = `<i class="fa-solid fa-photo-film"></i> ${scene.title}`;
  }
  getCinegenSceneTabs()?.setScene(workspaceState.currentSceneId, scene ?? null);
}

function switchSceneTab(tabIndex) {
  const host = getCinegenSceneTabs();
  if (host) {
    host.switchTab(tabIndex);
    return;
  }
  workspaceState.activeSceneTab = tabIndex;
  emitWorkspaceSceneTab({
    tabIndex,
    sceneId: workspaceState.currentSceneId ?? null,
  });
}

function inspectShot(id) {
  const sceneId = workspaceState.currentSceneId;
  const scene = window.currentSceneData?.[sceneId];
  const shot = scene?.coverage?.find((s) => s.id === id);
  updateInspector('shot', shot);
  if (shot && typeof window.highlightScriptForShot === 'function') {
    window.highlightScriptForShot(sceneId, shot);
  } else if (shot) {
    bridgeHighlightScriptForShot(sceneId, shot);
  }
}

/* Treatment field constants are now in @/workspace/treatment-fields.ts */

function setTreatmentLayoutPreference(mode) {
  if (mode !== 'one-column' && mode !== 'two-column') return;
  workspaceState.treatmentLayoutPreference = mode;
  const seg = document.querySelector('cg-segmented-control[data-segmented="treatment-layout"]');
  if (seg && 'value' in seg) {
    (seg as { value: string }).value = mode;
  } else {
    document.querySelectorAll('.treatment-layout-btn').forEach((btn) => {
      const active = btn.dataset.layout === mode;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }
  applyTreatmentLayout();
}

function applyTreatmentLayout() {
  applyTreatmentLayoutFromService();
}

function initTreatmentLayoutControl() {
  const control = document.getElementById('treatment-layout-control');
  if (!control) return;

  if (!control.dataset.bound) {
    control.dataset.bound = 'true';
    const seg = control.querySelector('cg-segmented-control[data-segmented="treatment-layout"]');
    if (seg) {
      seg.addEventListener('cg-change', (e) => {
        const value = e.detail?.value;
        if (value) setTreatmentLayoutPreference(value);
      });
    } else {
      control.querySelectorAll('.treatment-layout-btn').forEach((btn) => {
        btn.addEventListener('click', () => setTreatmentLayoutPreference(btn.dataset.layout));
      });
    }
    const pane = document.getElementById('script-pane-treatment');
    if (pane) {
      if (workspaceState.treatmentLayoutObserver) workspaceState.treatmentLayoutObserver.disconnect();
      workspaceState.treatmentLayoutObserver = new ResizeObserver(() => applyTreatmentLayout());
      workspaceState.treatmentLayoutObserver.observe(pane);
    }
  }

  setTreatmentLayoutPreference(workspaceState.treatmentLayoutPreference);
}

function renderTreatmentFieldHtml(field) {
  return _renderTreatmentFieldHtml(field, projectTreatment);
}

function renderTreatmentView() {
  const panel = getCinegenTreatmentPanel();
  if (panel) {
    panel.refresh();
    initTreatmentLayoutControl();
    return;
  }
  const host = document.getElementById('treatment-form');
  if (!host) return;
  const fieldByKey = Object.fromEntries(TREATMENT_FIELDS.map((field) => [field.key, field]));
  host.innerHTML = `
    <p class="treatment-intro">Define the story guide before the script. Screenplay and story AI use all fields here. Visual look is driven by properties and your Look Library—not movie titles from Treatment unless you add them there yourself.</p>
    ${TREATMENT_SECTIONS.map((section) => `
      <section class="treatment-section" aria-labelledby="treatment-section-${section.title.replace(/\s+/g, '-').toLowerCase()}">
        <h3 class="treatment-section-title" id="treatment-section-${section.title.replace(/\s+/g, '-').toLowerCase()}">${escapeHtml(section.title)}</h3>
        <motion.div class="treatment-fields">
          ${section.fieldKeys.map((key) => (fieldByKey[key] ? renderTreatmentFieldHtml(fieldByKey[key]) : '')).join('')}
        </div>
      </section>`).join('')}`;
  host.querySelectorAll('[data-treatment-field]').forEach((el) => {
    el.addEventListener('input', syncTreatmentFromForm);
    el.addEventListener('change', syncTreatmentFromForm);
  });
  initTreatmentLayoutControl();
  applyTreatmentLayout(host);
  updateInspector('treatment', getTreatmentForAI());
  window.CineGen = window.CineGen || {};
  window.CineGen.getTreatmentForStoryAI = getTreatmentForStoryAI;
  window.CineGen.getTreatmentForVisualAI = getTreatmentForVisualAI;
  window.CineGen.lastTreatmentVisualContext = getTreatmentForVisualAI();
}

function applyTreatmentToScriptGeneration() {
  const treatment = getTreatmentForStoryAI();
  window.CineGen = window.CineGen || {};
  window.CineGen.lastTreatmentContext = treatment;
  window.CineGen.lastTreatmentVisualContext = getTreatmentForVisualAI();
  window.CineGen.getTreatmentForStoryAI = getTreatmentForStoryAI;
  window.CineGen.getTreatmentForVisualAI = getTreatmentForVisualAI;
  const summary = [treatment.logline, treatment.genre, treatment.tone].filter(Boolean).join(' · ');
  alertCG(
    `Treatment context saved for AI script generation.\n\n${summary || '(Add logline and genre in Treatment.)'}\n\nScript AI uses logline, genre, synopsis, themes, movie references, and notes. Image/video look uses the same fields except movie references—describe visuals with properties or Look Library entries.`
  );
}

// ==================== OVERVIEW PANEL ====================

/** Node refs populated each time renderOverviewPanel runs (index → child node). */
/**
 * Switch the overview view mode and re-render only the content area.
 * Called by the segmented control buttons.
 */
function setOverviewViewMode(mode) {
  workspaceState.overviewViewMode        = mode;
  workspaceState.overviewSelectedCardIdx = -1;

  document.querySelectorAll('.ov-mode-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  const panel = getCinegenOverviewPanel();
  if (panel && workspaceState.overviewCurrentNode) {
    panel.setMode(mode);
    return;
  }

  const contentEl = document.getElementById('overview-panel-content');
  if (!workspaceState.overviewCurrentNode || !contentEl) return;

  const visibleChildren = _overviewVisibleChildren(workspaceState.overviewCurrentNode);
  const accentClass     = _overviewAccentClass(workspaceState.overviewCurrentNode);
  contentEl.innerHTML   = _renderOverviewContent(mode, visibleChildren, accentClass, workspaceState.overviewCurrentNode);
}

/**
 * Render the generic section/folder overview into #view-overview.
 */
function renderOverviewPanel(node, sectionKey) {
  const titleEl   = document.getElementById('overview-panel-title');
  const actionsEl = document.getElementById('overview-panel-actions');
  const contentEl = document.getElementById('overview-panel-content');
  if (!titleEl) return;

  workspaceState.overviewNodeRefs.length = 0;
  workspaceState.overviewCurrentNode     = node;
  workspaceState.overviewSectionKey      = sectionKey ?? null;
  workspaceState.overviewSelectedCardIdx = -1;

  const icon = node.icon || 'fa-folder';
  titleEl.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i> ${escapeHtml(node.name.toUpperCase())}`;

  // Segmented control lives inline in the content area (rendered by _renderOvModeHeader)
  if (actionsEl) actionsEl.innerHTML = '';

  const visibleChildren = _overviewVisibleChildren(node);
  visibleChildren.forEach((child) => workspaceState.overviewNodeRefs.push(child));

  const panel = getCinegenOverviewPanel();
  if (panel) {
    panel.syncFromWorkspace();
    return;
  }

  if (!contentEl) return;
  const accentClass   = _overviewAccentClass(node, sectionKey);
  contentEl.innerHTML = _renderOverviewContent(workspaceState.overviewViewMode, visibleChildren, accentClass, node);
}

/* ── Shared helpers ──────────────────────────────────────────────────── */

function _overviewVisibleChildren(node) {
  const result = [];
  (node.children || []).forEach((child) => {
    if (child.type === 'group') {
      (child.children || []).forEach((gc) => result.push(gc));
    } else if (child.type !== 'tree-divider') {
      result.push(child);
    }
  });
  return result;
}

function _overviewAccentClass(node, sectionKey) {
  const key = sectionKey || _sectionKeyForNode(node);
  return key ? ` overview-card--section-${key}` : '';
}

function _renderOverviewContent(mode, visibleChildren, accentClass, node) {
  const desc       = (node && node.desc) || '';
  const headerHtml = _renderOvModeHeader(mode, desc);
  if (mode === 'column') return headerHtml + _renderOverviewColumnView(visibleChildren, accentClass);
  if (mode === 'row')    return headerHtml + _renderOverviewRowView(visibleChildren, accentClass);
  return _renderOverviewMasterView(visibleChildren, accentClass, headerHtml);
}

/** Inline header bar: mode-select buttons on the left, description text on the right. */
function _renderOvModeHeader(mode, desc) {
  const modeDefs = [
    { id: 'column', icon: 'fa-table-columns',    label: 'Columns' },
    { id: 'row',    icon: 'fa-bars',              label: 'Rows'    },
    { id: 'master', icon: 'fa-table-cells-large', label: 'Browse'  }
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

/** Render a single overview card, with a configurable click handler. */
function _ovCardHtml(
  child: TreeNode,
  idx: number,
  accentClass: string,
  mode: 'activate' | 'select',
  selClass?: string
) {
  const childIcon = child.icon || 'fa-file';
  const childDesc = child.desc || '';
  const count = _nodeItemCount(child);
  const countBadge = count > 0 ? `<span class="overview-card-count">${count}</span>` : '';
  const dataAttr =
    mode === 'select' ? `data-ws-ov-select="${idx}"` : `data-ws-ov-activate="${idx}"`;
  return `
    <div class="overview-card${accentClass}${selClass || ''}" role="button" tabindex="0"
         ${dataAttr}
      <span class="overview-card-icon"><i class="fa-solid ${childIcon}" aria-hidden="true"></i></span>
      <div class="overview-card-body">
        <span class="overview-card-title">${escapeHtml(child.name)}${countBadge}</span>
        ${childDesc ? `<span class="overview-card-desc">${escapeHtml(childDesc)}</span>` : ''}
      </div>
    </div>`;
}

/** Return up to 50 items for a child node — used by column and row companion areas. */
function _overviewChildItems(child) {
  if (child.view === 'asset-detail' && child.detailKey) {
    const data = (typeof assetDetailData !== 'undefined') ? assetDetailData[child.detailKey] : null;
    if (!data) return [];
    if (data.items) return data.items.slice(0, 50);
    if (data.rows)  return data.rows.slice(0, 50).map((row, i) => ({
      name: row[0] || `Row ${i + 1}`, icon: 'fa-table-cells', status: null
    }));
  }
  if (child.children) {
    return child.children
      .filter((c) => c.type !== 'tree-divider')
      .slice(0, 50)
      .map((c) => ({ name: c.name, icon: c.icon || 'fa-folder', status: null }));
  }
  return [];
}

function _nodeItemCount(node) {
  if (node.children) return node.children.filter((c) => c.type !== 'tree-divider').length;
  if (node.detailKey) {
    const data = (typeof assetDetailData !== 'undefined') ? assetDetailData[node.detailKey] : null;
    if (data && data.items) return data.items.length;
    if (data && data.rows)  return data.rows.length;
  }
  return 0;
}

/* ── View 1: Column (card + vertical companion) ──────────────────────── */

function _renderOverviewColumnView(visibleChildren, accentClass) {
  if (!visibleChildren.length) return '<p class="overview-lead" style="padding:24px">No sections.</p>';

  const cols = visibleChildren.map((child, idx) => {
    const cardHtml = _ovCardHtml(child, idx, accentClass, 'activate');
    const items    = _overviewChildItems(child);
    const hasLinks = child.view === 'asset-detail' && child.detailKey;

    const listHtml = items.length
      ? items.map((item, itemIdx) => {
          const statusClass = `asset-status-${(item.status || 'pending').replace(/\s+/g, '-')}`;
          return `
            <div class="ov-col-item-wrap">
              <div class="ov-col-item" role="button" tabindex="0"
                   data-ws-ov-toggle-wrap
                   
                   data-ws-ov-preview="${idx}:${itemIdx}"
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
                  ${_renderOvColItemBody(item, idx, itemIdx, hasLinks)}
                </div>
              </div>
            </div>`;
        }).join('')
      : `<p class="ov-col-empty">No items yet.</p>`;

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

/** Renders the expanded accordion body for a column list item. */
function _renderOvColItemBody(item, childIdx, itemIdx, hasLinks) {
  const statusClass = `asset-status-${(item.status || 'pending').replace(/\s+/g, '-')}`;
  const statusLabel = (item.status || 'pending').replace(/-/g, ' ');
  const tagsHtml    = (item.tags || []).map((t) => `<span class="asset-tag">${escapeHtml(t)}</span>`).join('');
  return `
    <div class="ov-col-acc-body">
      ${item.desc ? `<p class="ov-col-acc-desc">${escapeHtml(item.desc)}</p>` : '<p class="ov-col-acc-desc" style="color:#484848">No description.</p>'}
      <div class="ov-col-acc-meta">
        <span class="asset-status-dot ${statusClass}"></span>
        <span class="ov-col-acc-status">${escapeHtml(statusLabel)}</span>
      </div>
      ${tagsHtml ? `<div class="ov-col-acc-tags">${tagsHtml}</div>` : ''}
      ${hasLinks ? `
        <button class="toolbar-btn ov-col-acc-open-btn" data-ws-goto-asset="${childIdx}:${itemIdx}">
          <i class="fa-solid fa-arrow-right" aria-hidden="true"></i> Open in detail
        </button>` : ''}
    </div>`;
}

/* Overview preview utilities are now in @/workspace/overview-preview.ts (imported above). */

/* ── View 2: Row (card + horizontal companion) ───────────────────────── */

function _renderOverviewRowView(visibleChildren, accentClass) {
  if (!visibleChildren.length) return '<p class="overview-lead" style="padding:24px">No sections.</p>';

  const rows = visibleChildren.map((child, idx) => {
    const cardHtml = _ovCardHtml(child, idx, accentClass, 'activate');
    const items    = _overviewChildItems(child);
    const hasLinks = child.view === 'asset-detail' && child.detailKey;

    const listHtml = items.length
      ? items.map((item, itemIdx) => {
          const statusClass = `asset-status-${(item.status || 'pending').replace(/\s+/g, '-')}`;
          return `
            <div class="ov-row-item-wrap">
              <div class="ov-row-item" role="button" tabindex="0"
                   data-ws-ov-toggle-wrap
                   
                   data-ws-ov-preview="${idx}:${itemIdx}"
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
                    ${_renderOvColItemBody(item, idx, itemIdx, hasLinks)}
                  </div>
                </div>
              </div>
            </div>`;
        }).join('')
      : `<p class="ov-row-empty">No items yet.</p>`;

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

function _renderOverviewMasterView(visibleChildren, accentClass, headerHtml) {
  if (!visibleChildren.length) return headerHtml + '<p style="padding:16px 24px;font-size:11px;color:var(--text-dim);">No sections.</p>';

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

function selectOverviewCard(idx) {
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
    : `<div class="ov-master-placeholder"><p>No content available.</p></div>`;
}

function _renderOverviewInlineDetail(child) {
  if (!child) return '';

  if (child.view === 'asset-detail' && child.detailKey) {
    const data = (typeof assetDetailData !== 'undefined') ? assetDetailData[child.detailKey] : null;
    if (!data) return `<div class="ov-master-placeholder"><p>No data configured for <strong>${escapeHtml(child.name)}</strong>.</p></div>`;

    // Set shared asset-detail state so selectAssetItem() works seamlessly
    workspaceState.assetDetailCurrentNode = child;
    const items = data.items || [];
    if (workspaceState.assetDetailSelectedIdx < 0 || workspaceState.assetDetailSelectedIdx >= items.length) workspaceState.assetDetailSelectedIdx = 0;

    if (data.layout === 'shot-table') {
      return `<div class="ov-master-table-wrap">${_renderShotListTable()}</div>`;
    }
    if (data.layout === 'continuity') {
      return `<div class="ov-master-table-wrap">${_renderContinuityTable(data)}</div>`;
    }

    const selectedItem = items[workspaceState.assetDetailSelectedIdx];
    return `
      <div class="asset-master-detail">
        <div id="asset-master-pane" class="asset-master">
          <div class="asset-master-header">
            <span>${escapeHtml(data.addLabel || 'Items')}</span>
            <span class="asset-master-count">${items.length}</span>
          </div>
          ${_renderAssetMasterList(items, workspaceState.assetDetailSelectedIdx)}
        </div>
        <div id="asset-form-pane" class="asset-form-pane">
          ${selectedItem
            ? _renderAssetDetailForm(selectedItem, data, workspaceState.assetDetailSelectedIdx)
            : _renderAssetFormEmpty(data)}
        </div>
      </div>`;
  }

  // Sub-folder: offer to navigate into it
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

/* ── Card navigation ─────────────────────────────────────────────────── */

/** Navigate to a leaf node AND pre-select a specific item in its master list. */
function gotoAssetItem(childIdx, itemIdx) {
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
function activateOverviewCard(idx) {
  const child = workspaceState.overviewNodeRefs[idx];
  if (!child) return;
  _selectTreeItemByNode(child);
  _renderNodeView(child);
}

/** Find the tree item whose data-name matches node.name and highlight it. */
function _selectTreeItemByNode(node) {
  if (!node || !node.name) return;

  if (typeof window.expandProjectTreeToNode === 'function') {
    window.expandProjectTreeToNode(node);
  } else {
    const path = _findNodePath(projectData, node);
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

  if (typeof window.setProjectTreeSelection === 'function') {
    window.setProjectTreeSelection(node.name);
    return;
  }

  const items = document.querySelectorAll('.tree-item');
  for (const item of items) {
    if (item.dataset.name === node.name) {
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
function _findNodePath(root, target) {
  if (root === target) return [root];
  for (const child of (root.children || [])) {
    const sub = _findNodePath(child, target);
    if (sub) return [root, ...sub];
  }
  return null;
}

/**
 * Render the appropriate workspace view for a node.
 * Mirrors selectTreeNode but takes a node object directly (used from overview cards).
 */
function _renderNodeView(node) {
  if (!node) return;
  const sectionKey = _sectionKeyForNode(node);

  if (node.type === 'scene-shot' && node.sceneId && node.shotId != null) {
    workspaceState.currentSceneId = node.sceneId;
    void switchView('scene-detail', node.name, sectionKey).then(() => {
      renderSceneDetail();
      switchSceneTab(2);
      inspectShot(node.shotId);
    });
    return;
  }

  if (node.type === 'storyboard-frame' && node.frameId != null) {
    void switchView('preprod-workspace', node.name, sectionKey).then(() => {
      setPreprodMode('storyboard');
      if (node.sceneId) workspaceState.currentSceneId = node.sceneId;
      bridgeSelectStoryboardFrameById(node.frameId);
    });
    return;
  }

  if (node.type === 'scene' && node.sceneId) {
    workspaceState.currentSceneId = node.sceneId;
    void switchView('scene-detail', node.name, sectionKey).then(() => {
      renderSceneDetail();
      updateInspector('scene', window.currentSceneData?.[node.sceneId]);
    });
    return;
  }

  const resolvedView = resolveNodeViewOrFallback(node);
  void switchView(resolvedView, node.name, sectionKey).then(() => {
    _populateTreeNodeView(node, sectionKey, resolvedView);
  });
}

/** Best-effort section key lookup by walking top-level section names. */
function _sectionKeyForNode(node) {
  if (!node) return null;
  if (typeof window.getTreeSectionKeyForNode === 'function') {
    return window.getTreeSectionKeyForNode(node);
  }
  return null;
}

function _nodeContains(parent, target) {
  if (parent === target) return true;
  for (const child of parent.children || []) {
    if (_nodeContains(child, target)) return true;
  }
  return false;
}

// ==================== ASSET DETAIL PANEL ====================

/**
 * Render a leaf-node content panel into #view-asset-detail.
 * Items arrays → master-detail split.
 * Continuity / shot-table layouts → full-width scrollable table.
 */
function renderAssetDetailPanel(node, attempt = 0) {
  const titleEl   = document.getElementById('asset-detail-title');
  const actionsEl = document.getElementById('asset-detail-actions');
  const contentEl = document.getElementById('asset-detail-content');
  if (!titleEl || !contentEl) {
    if (attempt < 24) {
      requestAnimationFrame(() => renderAssetDetailPanel(node, attempt + 1));
    }
    return;
  }

  workspaceState.assetDetailCurrentNode = node;

  const detailKey = node.detailKey;
  const data      = (detailKey && typeof assetDetailData !== 'undefined')
    ? assetDetailData[detailKey]
    : null;

  const icon = (data && data.icon) || node.icon || 'fa-file';
  titleEl.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i> ${escapeHtml(node.name.toUpperCase())}`;

  if (!data) {
    actionsEl.innerHTML = '';
    contentEl.innerHTML = `<div class="asset-form-empty"><p>Content for <strong>${escapeHtml(node.name)}</strong> is not yet configured.</p></div>`;
    return;
  }

  // ── Table-only layouts (no master-detail) ──────────────────────────
  if (data.layout === 'shot-table') {
    actionsEl.innerHTML = '';
    contentEl.innerHTML = `<div class="asset-table-scroll">${data.desc ? `<p class="asset-detail-lead">${escapeHtml(data.desc)}</p>` : ''}${_renderShotListTable()}</div>`;
    return;
  }

  if (data.layout === 'continuity') {
    actionsEl.innerHTML = `
      <button type="button" class="toolbar-btn" style="padding:2px 8px;font-size:10px;" data-ws-continuity-key="${detailKey}">
        <i class="fa-solid fa-plus" aria-hidden="true"></i> Add Row
      </button>`;
    contentEl.innerHTML = `<div class="asset-table-scroll">${data.desc ? `<p class="asset-detail-lead">${escapeHtml(data.desc)}</p>` : ''}${_renderContinuityTable(data)}</div>`;
    return;
  }

  // ── Master-detail for grid / list layouts ──────────────────────────
  const addLabel = data.addLabel || 'Add Item';
  actionsEl.innerHTML = `
    <button type="button" class="toolbar-btn btn-ai" style="padding:2px 8px;font-size:10px;" data-ws-action="addAssetItem">
      <i class="fa-solid fa-plus" aria-hidden="true"></i> ${escapeHtml(addLabel)}
    </button>`;

  const items = data.items || [];
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

/* ── Master list ─────────────────────────────────────────────────────── */

function _renderAssetMasterList(items, selectedIdx) {
  if (!items.length) return `<p class="asset-master-empty">No items yet. Click Add to create one.</p>`;
  return items.map((item, idx) => {
    const statusClass = `asset-status-${(item.status || 'pending').replace(/\s+/g, '-')}`;
    const sel = idx === selectedIdx ? ' selected' : '';
    return `
      <div class="asset-master-item${sel}" data-idx="${idx}" role="button" tabindex="0"
           data-ws-asset-idx="${idx}"
           >
        <span class="asset-master-item-icon"><i class="fa-solid ${item.icon || 'fa-box'}" aria-hidden="true"></i></span>
        <span class="asset-master-item-name">${escapeHtml(item.name || 'Untitled')}</span>
        <span class="asset-status-dot ${statusClass}"></span>
      </div>`;
  }).join('');
}

/* ── Item selection ──────────────────────────────────────────────────── */

function selectAssetItem(idx) {
  const node = workspaceState.assetDetailCurrentNode;
  if (!node || !node.detailKey) return;
  const data = assetDetailData[node.detailKey];
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
  const item = data.items[idx];
  formPane.innerHTML = item
    ? _renderAssetDetailForm(item, data, idx)
    : _renderAssetFormEmpty(data);
}

/* ── Add / delete items ──────────────────────────────────────────────── */

function addAssetItem() {
  const node = workspaceState.assetDetailCurrentNode;
  if (!node || !node.detailKey) return;
  const data = assetDetailData[node.detailKey];
  if (!data) return;
  if (!data.items) data.items = [];
  const newItem = {
    name: 'New Item',
    desc: '',
    icon: data.icon || 'fa-box',
    tags: [],
    status: 'pending',
    notes: ''
  };
  if (data.layout === 'list') newItem.duration = '';
  data.items.push(newItem);
  workspaceState.assetDetailSelectedIdx = data.items.length - 1;
  const overviewPanel = getCinegenOverviewPanel();
  if (overviewPanel?.querySelector('cinegen-overview-master-detail')) {
    overviewPanel.refreshMasterDetail();
  } else {
    renderAssetDetailPanel(node);
  }
  requestAnimationFrame(() => {
    const last = document.querySelector('#asset-master-pane .asset-master-item:last-child');
    if (last) last.scrollIntoView({ block: 'nearest' });
    const nameInput = document.getElementById('asset-form-name');
    if (nameInput) { nameInput.select(); }
  });
}

function deleteAssetItem(idx) {
  const node = workspaceState.assetDetailCurrentNode;
  if (!node || !node.detailKey) return;
  const data = assetDetailData[node.detailKey];
  if (!data || !data.items || idx < 0 || idx >= data.items.length) return;
  const itemName = data.items[idx].name || 'this item';
  if (!confirm(`Delete "${itemName}"?`)) return;
  data.items.splice(idx, 1);
  workspaceState.assetDetailSelectedIdx = Math.min(idx, data.items.length - 1);
  const overviewPanel = getCinegenOverviewPanel();
  if (overviewPanel?.querySelector('cinegen-overview-master-detail')) {
    overviewPanel.refreshMasterDetail();
  } else {
    renderAssetDetailPanel(node);
  }
}

/* ── Live field saving ───────────────────────────────────────────────── */

function _saveAssetItemField(key, value) {
  const node = workspaceState.assetDetailCurrentNode;
  if (!node || !node.detailKey) return;
  const data = assetDetailData[node.detailKey];
  if (!data || !data.items) return;
  const item = data.items[workspaceState.assetDetailSelectedIdx];
  if (!item) return;

  if (key === 'tags') {
    item.tags = value.split(',').map((t) => t.trim()).filter(Boolean);
    const chipsEl = document.getElementById('asset-form-tags-chips');
    if (chipsEl) chipsEl.innerHTML = item.tags.map((t) => `<span class="asset-tag">${escapeHtml(t)}</span>`).join('');
  } else {
    item[key] = value;
  }

  // Mirror changes into master list row
  const masterItem = document.querySelector(`#asset-master-pane .asset-master-item[data-idx="${workspaceState.assetDetailSelectedIdx}"]`);
  if (masterItem) {
    if (key === 'name') {
      const nameEl = masterItem.querySelector('.asset-master-item-name');
      if (nameEl) nameEl.textContent = value || 'Untitled';
      // Also update thumbnail title
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

/* Asset detail form renderers are now in @/workspace/asset-form-renderers.ts */
function _renderAssetDetailForm(item, data, idx) {
  return _extRenderAssetDetailForm(item, data, idx);
}
function _renderAssetFormEmpty(data) {
  return _extRenderAssetFormEmpty(data);
}
function _findSceneRefsForItem(itemName) {
  return _extFindSceneRefsForItem(itemName);
}

/* ── Continuity add-row stub ─────────────────────────────────────────── */

function addContinuityRow(detailKey) {
  const data = (typeof assetDetailData !== 'undefined') ? assetDetailData[detailKey] : null;
  if (!data || !data.rows) return;
  const emptyRow = new Array((data.columns || []).length).fill('—');
  emptyRow[0] = `Row ${data.rows.length + 1}`;
  data.rows.push(emptyRow);
  const contentEl = document.getElementById('asset-detail-content');
  if (contentEl) {
    const leadHtml = data.desc ? `<p class="asset-detail-lead">${escapeHtml(data.desc)}</p>` : '';
    contentEl.innerHTML = `<div class="asset-table-scroll">${leadHtml}${_renderContinuityTable(data)}</div>`;
  }
}

/* Table renderers are now in @/workspace/table-renderers.ts */
function _renderContinuityTable(data) {
  return _extRenderContinuityTable(data);
}
function _renderShotListTable() {
  return _extRenderShotListTable();
}

export {
  switchView,
  setPreprodMode,
  selectTreeNode,
  renderSceneDetail,
  renderOverviewPanel,
  renderTreatmentView,
  renderAssetDetailPanel,
  initScriptPaneSegmentedControl,
};

export function installWorkspaceBundleGlobals(): void {
  const w = window as Window & Record<string, unknown>;
  const names = ['selectTreeNode', 'updateWorkspaceSectionTheme', 'switchView', 'setPreprodMode', 'syncSegmentedControlValue', 'initSegmentedControl', 'initScriptPaneSegmentedControl', 'switchScriptPaneTab', 'extractScriptEntities', 'syncDetectedScriptEntitiesToProject', 'refreshScriptInfoFromScript', 'addEntityFromScriptInfo', 'removeEntityFromScriptInfo', 'renderScriptInfoSection', 'renderScriptInfoTables', 'renderSceneDetail', 'switchSceneTab', 'inspectShot', 'setTreatmentLayoutPreference', 'applyTreatmentLayout', 'initTreatmentLayoutControl', 'renderTreatmentFieldHtml', 'syncTreatmentFromForm', 'migrateProjectTreatmentKeys', 'getTreatmentForAI', 'getTreatmentForStoryAI', 'getTreatmentForVisualAI', 'renderTreatmentView', 'applyTreatmentToScriptGeneration', 'setOverviewViewMode', 'renderOverviewPanel', '_overviewVisibleChildren', '_overviewAccentClass', '_renderOverviewContent', '_renderOvModeHeader', '_ovCardHtml', '_overviewChildItems', '_nodeItemCount', '_renderOverviewColumnView', '_renderOvColItemBody', 'toggleOvColItem', 'showOvPreview', 'hideOvPreview', '_dismissOvPreview', 'setOvHoverPreview', '_renderOverviewRowView', '_renderOverviewMasterView', 'selectOverviewCard', '_renderOverviewInlineDetail', 'gotoAssetItem', 'activateOverviewCard', '_selectTreeItemByNode', '_findNodePath', '_renderNodeView', '_sectionKeyForNode', '_nodeContains', 'renderAssetDetailPanel', '_renderAssetMasterList', 'selectAssetItem', 'addAssetItem', 'deleteAssetItem', '_saveAssetItemField', '_renderAssetDetailForm', '_renderAssetFormEmpty', '_findSceneRefsForItem', 'addContinuityRow', '_renderContinuityTable', '_renderShotListTable', 'highlightScriptForShot', 'selectStoryboardFrameById'];
  const fns: Record<string, unknown> = {
    selectTreeNode: selectTreeNode,
    updateWorkspaceSectionTheme: updateWorkspaceSectionTheme,
    switchView: switchView,
    setPreprodMode: setPreprodMode,
    syncSegmentedControlValue: syncSegmentedControlValue,
    initSegmentedControl: initSegmentedControl,
    initScriptPaneSegmentedControl: initScriptPaneSegmentedControl,
    switchScriptPaneTab: switchScriptPaneTab,
    extractScriptEntities: extractScriptEntities,
    syncDetectedScriptEntitiesToProject: syncDetectedScriptEntitiesToProject,
    refreshScriptInfoFromScript: refreshScriptInfoFromScript,
    addEntityFromScriptInfo: addEntityFromScriptInfo,
    removeEntityFromScriptInfo: removeEntityFromScriptInfo,
    renderScriptInfoSection: renderScriptInfoSection,
    renderScriptInfoTables: renderScriptInfoTables,
    renderSceneDetail: renderSceneDetail,
    switchSceneTab: switchSceneTab,
    inspectShot: inspectShot,
    setTreatmentLayoutPreference: setTreatmentLayoutPreference,
    applyTreatmentLayout: applyTreatmentLayout,
    initTreatmentLayoutControl: initTreatmentLayoutControl,
    renderTreatmentFieldHtml: renderTreatmentFieldHtml,
    syncTreatmentFromForm: syncTreatmentFromForm,
    migrateProjectTreatmentKeys: migrateProjectTreatmentKeys,
    getTreatmentForAI: getTreatmentForAI,
    getTreatmentForStoryAI: getTreatmentForStoryAI,
    getTreatmentForVisualAI: getTreatmentForVisualAI,
    renderTreatmentView: renderTreatmentView,
    applyTreatmentToScriptGeneration: applyTreatmentToScriptGeneration,
    setOverviewViewMode: setOverviewViewMode,
    renderOverviewPanel: renderOverviewPanel,
    _overviewVisibleChildren: _overviewVisibleChildren,
    _overviewAccentClass: _overviewAccentClass,
    _renderOverviewContent: _renderOverviewContent,
    _renderOvModeHeader: _renderOvModeHeader,
    _ovCardHtml: _ovCardHtml,
    _overviewChildItems: _overviewChildItems,
    _nodeItemCount: _nodeItemCount,
    _renderOverviewColumnView: _renderOverviewColumnView,
    _renderOvColItemBody: _renderOvColItemBody,
    toggleOvColItem: toggleOvColItem,
    showOvPreview: showOvPreview,
    hideOvPreview: hideOvPreview,
    _dismissOvPreview: _dismissOvPreview,
    setOvHoverPreview: setOvHoverPreview,
    _renderOverviewRowView: _renderOverviewRowView,
    _renderOverviewMasterView: _renderOverviewMasterView,
    selectOverviewCard: selectOverviewCard,
    _renderOverviewInlineDetail: _renderOverviewInlineDetail,
    gotoAssetItem: gotoAssetItem,
    activateOverviewCard: activateOverviewCard,
    _selectTreeItemByNode: _selectTreeItemByNode,
    _findNodePath: _findNodePath,
    _renderNodeView: _renderNodeView,
    _sectionKeyForNode: _sectionKeyForNode,
    _nodeContains: _nodeContains,
    renderAssetDetailPanel: renderAssetDetailPanel,
    _renderAssetMasterList: _renderAssetMasterList,
    selectAssetItem: selectAssetItem,
    addAssetItem: addAssetItem,
    deleteAssetItem: deleteAssetItem,
    _saveAssetItemField: _saveAssetItemField,
    _renderAssetDetailForm: _renderAssetDetailForm,
    _renderAssetFormEmpty: _renderAssetFormEmpty,
    _findSceneRefsForItem: _findSceneRefsForItem,
    addContinuityRow: addContinuityRow,
    _renderContinuityTable: _renderContinuityTable,
    _renderShotListTable: _renderShotListTable,
    highlightScriptForShot: bridgeHighlightScriptForShot,
    selectStoryboardFrameById: bridgeSelectStoryboardFrameById,
  };
  for (const n of names) {
    w[n] = fns[n];
  }
  Object.defineProperty(window, 'currentSceneId', {
    get: () => workspaceState.currentSceneId,
    set: (v: string | null) => { workspaceState.currentSceneId = v; },
    configurable: true,
  });

}
