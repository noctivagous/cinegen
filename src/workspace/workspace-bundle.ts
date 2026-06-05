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
import type { SceneShot } from '@/workspace/scene-types';
import { PREPROD_MODES, SUPPORTED_TREE_VIEWS } from '@/tree/tree-view-contract';
import { setActiveMoodBoard } from '@/data/project-data';
import { applyPreprodLayoutToDom, normalizePreprodLayoutMode } from '@/workspace/preprod-layout';
import {
  TREATMENT_FIELDS,
  TREATMENT_SECTIONS,
  renderTreatmentFieldHtml as _renderTreatmentFieldHtml,
} from '@/workspace/treatment-fields';
import type { TreatmentField } from '@/workspace/treatment-fields';
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
import {
  renderOverviewPanel,
  setOverviewViewMode,
  selectOverviewCard,
  _renderOverviewInlineDetail,
  gotoAssetItem,
  activateOverviewCard,
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
  _selectTreeItemByNode,
  _findNodePath,
  _renderNodeView,
  _sectionKeyForNode,
  _nodeContains,
} from '@/workspace/workspace-overview-panel';
import {
  renderAssetDetailPanel,
  _renderAssetMasterList,
  selectAssetItem,
  addAssetItem,
  deleteAssetItem,
  _saveAssetItemField,
  addContinuityRow,
} from '@/workspace/workspace-asset-detail-panel';

declare const projectTreatment: Record<string, string>;

declare function escapeHtml(str: unknown): string;
declare function renderGlobalAssets(idx: number): void;
declare function renderLocationScout(): void;
declare function renderTimeline(): void;
declare function renderCameraLighting(section: string | null): void;
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
  const boardId = (node as Record<string, unknown>).boardId as string | undefined;
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

function _populateTreeNodeView(node: TreeNode, sectionKey: string | null, resolvedView: string): void {
  if (resolvedView === 'preprod-workspace') {
    setPreprodMode(normalizePreprodMode(node.preprodMode));
  }
  if (resolvedView === 'assets') renderGlobalAssets(0);
  if (resolvedView === 'location-scout') renderLocationScout();
  if (resolvedView === 'timeline') renderTimeline();
  if (resolvedView === 'camera-lighting') renderCameraLighting(node.clSection || null);
  if (resolvedView === 'shot-designer') {
    const el = document.querySelector('cinegen-shot-designer') as HTMLElement & { clSection: string; refresh?: () => void } | null;
    if (el) {
      el.clSection = node.clSection || '';
      el.refresh?.();
    }
  }
  if (resolvedView === 'casting') (window as any).renderCastingView?.((window as any).chipNavFocus?.label);
  if (resolvedView === 'overview') renderOverviewPanel(node, sectionKey);
  if (resolvedView === 'asset-detail') renderAssetDetailPanel(node);
  if (node.type === 'scrap') {
    updateInspector('scrap', { items: (window as any).deletedStoryboardFrames });
  } else {
    updateInspector(node.type, node);
  }
}

function selectTreeNode(element: HTMLElement | null, node: TreeNode, sectionKeyOverride: string | null | undefined): void {
  const w = window as any;
  const sectionKey =
    sectionKeyOverride ??
    (element as HTMLElement | null)?.dataset?.section ??
    (typeof w.getTreeSectionKeyForNode === 'function'
      ? w.getTreeSectionKeyForNode(node)
      : null);

  if (typeof w.setProjectTreeSelection === 'function') {
    if (node?.name) w.setProjectTreeSelection(node.name);
  } else if (element) {
    document.querySelectorAll('.tree-item').forEach((el) => el.classList.remove('selected'));
    element.classList.add('selected');
  }

  if (node.type === 'scene-shot' && node.sceneId && node.shotId != null) {
    workspaceState.currentSceneId = node.sceneId;
    void switchView('scene-detail', node.name, sectionKey).then(() => {
      renderSceneDetail();
      switchSceneTab(2);
      inspectShot(Number(node.shotId));
      const scene = w.currentSceneData?.[node.sceneId!];
      const shot = scene?.coverage?.find((s: Record<string, unknown>) => s.id === node.shotId);
      if (shot) bridgeHighlightScriptForShot(node.sceneId!, shot as SceneShot);
    });
  } else if (node.type === 'storyboard-frame' && node.frameId != null) {
    void switchView('preprod-workspace', node.name, sectionKey).then(() => {
      setPreprodMode('storyboard');
      if (node.sceneId) workspaceState.currentSceneId = node.sceneId;
      bridgeSelectStoryboardFrameById(Number(node.frameId));
    });
  } else if (node.type === 'scene' && node.sceneId) {
    workspaceState.currentSceneId = node.sceneId;
    void switchView('scene-detail', node.name, sectionKey).then(() => {
      renderSceneDetail();
      updateInspector('scene', w.currentSceneData?.[node.sceneId!]);
    });
  } else if (node.type === 'moodboard' && node.boardId) {
    activateMoodBoardFromTree(node, sectionKey);
  } else if (node.type === 'moodboard-item' && node.boardId) {
    activateMoodBoardFromTree(node, sectionKey, node.itemId as string | undefined);
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

function setPreprodMode(mode: string): void {
  applyPreprodLayoutToDom(normalizePreprodLayoutMode(mode));
}

function syncSegmentedControlValue(segEl: Element | null, value: string, valueAttr = 'data-segmented-value'): void {
  if (!segEl) return;
  if (segEl.tagName === 'CG-SEGMENTED-CONTROL') {
    (segEl as unknown as { value: string }).value = value;
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

function initSegmentedControl(segEl: HTMLElement | null, options: { valueAttr?: string; onChange?: (value: string, btn: Element) => void } = {}): void {
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

function initScriptPaneSegmentedControl(): void {
  const w = window as any;
  const seg = document.querySelector('[data-segmented="script-pane"]') as HTMLElement | null;
  if (!seg) return;
  if (seg.tagName === 'CG-SEGMENTED-CONTROL') {
    if (seg.dataset.segmentedInit === 'true') return;
    seg.addEventListener('cg-change', (e: Event) => {
      const value = (e as CustomEvent).detail?.value;
      if (value) switchScriptPaneTab(value);
    });
    (seg as unknown as { value: string }).value = w.scriptPaneTab ?? 'script';
    seg.dataset.segmentedInit = 'true';
    return;
  }
  initSegmentedControl(seg, {
    valueAttr: 'data-script-pane-tab',
    onChange: (tab: string) => switchScriptPaneTab(tab)
  });
  syncSegmentedControlValue(seg, w.scriptPaneTab ?? 'script', 'data-script-pane-tab');
}

function switchScriptPaneTab(tab: string): void {
  const validTabs = ['script', 'info', 'treatment'];
  const nextTab = validTabs.includes(tab) ? tab : 'script';
  (window as any).scriptPaneTab = nextTab;
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

function renderSceneDetail(): void {
  const w = window as any;
  const scene = w.currentSceneData?.[workspaceState.currentSceneId!];
  const titleEl = document.getElementById('scene-detail-title');
  if (titleEl && scene) {
    titleEl.innerHTML = `<i class="fa-solid fa-photo-film"></i> ${scene.title}`;
  }
  getCinegenSceneTabs()?.setScene(workspaceState.currentSceneId, scene ?? null);
}

function switchSceneTab(tabIndex: number): void {
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

function inspectShot(id: number): void {
  const w = window as any;
  const sceneId = workspaceState.currentSceneId;
  const scene = w.currentSceneData?.[sceneId!];
  const shot = scene?.coverage?.find((s: Record<string, unknown>) => s.id === id);
  updateInspector('shot', shot);
  if (shot && typeof w.highlightScriptForShot === 'function') {
    w.highlightScriptForShot(sceneId, shot);
  } else if (shot) {
    bridgeHighlightScriptForShot(sceneId!, shot);
  }
}

/* Treatment field constants are now in @/workspace/treatment-fields.ts */

function setTreatmentLayoutPreference(mode: string): void {
  if (mode !== 'one-column' && mode !== 'two-column') return;
  workspaceState.treatmentLayoutPreference = mode;
  const seg = document.querySelector('cg-segmented-control[data-segmented="treatment-layout"]') as HTMLElement | null;
  if (seg && 'value' in seg) {
    (seg as unknown as { value: string }).value = mode;
  } else {
    document.querySelectorAll('.treatment-layout-btn').forEach((btn) => {
      const el = btn as HTMLElement;
      const active = el.dataset.layout === mode;
      el.classList.toggle('active', active);
      el.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }
  applyTreatmentLayout();
}

function applyTreatmentLayout(): void {
  applyTreatmentLayoutFromService();
}

function initTreatmentLayoutControl(): void {
  const control = document.getElementById('treatment-layout-control') as HTMLElement | null;
  if (!control) return;

  if (!control.dataset.bound) {
    control.dataset.bound = 'true';
    const seg = control.querySelector('cg-segmented-control[data-segmented="treatment-layout"]') as HTMLElement | null;
    if (seg) {
      seg.addEventListener('cg-change', (e: Event) => {
        const value = (e as CustomEvent).detail?.value;
        if (value) setTreatmentLayoutPreference(value);
      });
    } else {
      control.querySelectorAll('.treatment-layout-btn').forEach((btn) => {
        const el = btn as HTMLElement;
        el.addEventListener('click', () => setTreatmentLayoutPreference(el.dataset.layout!));
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

function renderTreatmentFieldHtml(field: TreatmentField): string {
  return _renderTreatmentFieldHtml(field, projectTreatment);
}

function renderTreatmentView(): void {
  const panel = getCinegenTreatmentPanel();
  if (panel) {
    panel.refresh();
    initTreatmentLayoutControl();
    return;
  }
  const host = document.getElementById('treatment-form') as HTMLElement | null;
  if (!host) return;
  const fieldByKey = Object.fromEntries(
    (TREATMENT_FIELDS as TreatmentField[]).map((field) => [field.key, field] as const)
  ) as unknown as Record<string, TreatmentField>;
  host.innerHTML = `
    <p class="treatment-intro">Define the story guide before the script. Screenplay and story AI use all fields here. Visual look is driven by properties and your Look Library—not movie titles from Treatment unless you add them there yourself.</p>
    ${(TREATMENT_SECTIONS as Array<Record<string, unknown>>).map((section) => `
      <section class="treatment-section" aria-labelledby="treatment-section-${String(section.title).replace(/\s+/g, '-').toLowerCase()}">
        <h3 class="treatment-section-title" id="treatment-section-${String(section.title).replace(/\s+/g, '-').toLowerCase()}">${escapeHtml(String(section.title))}</h3>
        <motion.div class="treatment-fields">
          ${(section.fieldKeys as string[]).map((key) => (fieldByKey[key] ? renderTreatmentFieldHtml(fieldByKey[key]) : '')).join('')}
        </div>
      </section>`).join('')}`;
  host.querySelectorAll('[data-treatment-field]').forEach((el) => {
    el.addEventListener('input', () => syncTreatmentFromForm());
    el.addEventListener('change', () => syncTreatmentFromForm());
  });
  initTreatmentLayoutControl();
  applyTreatmentLayout();
  updateInspector('treatment', getTreatmentForAI());
  window.CineGen = window.CineGen || {};
  window.CineGen.getTreatmentForStoryAI = getTreatmentForStoryAI;
  window.CineGen.getTreatmentForVisualAI = getTreatmentForVisualAI;
  window.CineGen.lastTreatmentVisualContext = getTreatmentForVisualAI();
}

function applyTreatmentToScriptGeneration(): void {
  const treatment = getTreatmentForStoryAI() as Record<string, unknown>;
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
// Extracted to workspace-overview-panel.ts; functions imported above.

// ==================== ASSET DETAIL PANEL ====================
// Extracted to workspace-asset-detail-panel.ts; functions imported above.
// Thin re-export wrappers kept for installWorkspaceBundleGlobals.
/* Asset detail form renderers are now in @/workspace/asset-form-renderers.ts */
function _renderAssetDetailForm(item: unknown, data: unknown, idx: number): string {
  return _extRenderAssetDetailForm(item as any, data as any, idx);
}
function _renderAssetFormEmpty(data: unknown): string {
  return _extRenderAssetFormEmpty(data as any);
}
function _findSceneRefsForItem(itemName: string): string[] {
  return _extFindSceneRefsForItem(itemName);
}

/* Table renderers are now in @/workspace/table-renderers.ts */
function _renderContinuityTable(data: unknown): string {
  return _extRenderContinuityTable(data as any);
}
function _renderShotListTable(): string {
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
  const w = window as unknown as Record<string, unknown>;
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
