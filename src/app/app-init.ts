import { projectRegistry, projectData } from '@/data/project-data';
import {
  activateProjectTreeNode,
  activatePersistedProjectTreeSelection,
  findProjectNodeByName,
  primePersistedProjectTreeUi,
} from '@/tree/project-tree-service';
import { appShellStore } from '@/stores/app-shell';
import {
  applyLayoutChromeFromPreferences,
  initLayoutSplitDividers,
  setPreprodSplitPercent,
  syncLayoutSplitDividers,
} from '@/services/layout-service';
import { initModelStatusBar } from '@/services/status-bar-service';

declare global {
  function syncActiveProjectName(name: string): void;
  function hydrateScriptEditorFromProject(): void;
  function initStoryboardVisibilityToggles(): void;
  function initScriptEditorOptionsToolbar(): void;
  function initChipNavigation(): void;
  function initStoryboardNavigation(): void;
  function renderFullTree(): void;
  function renderBreakdownTable(): void;
  function renderScriptInfoTables(): void;
  function renderStoryboard(): void;
  function renderTimeline(): void;
  function setPreprodMode(mode: string): void;
  function initScriptPaneSegmentedControl(): void;
  function switchScriptPaneTab(tab: string): void;
  function syncScriptSelectionToStoryboard(): void;
  function scheduleScriptEditorProjectSync(): void;
  function syncProjectSidebarToggleButton(visible: boolean): void;
  function syncInspectorToggleButton(visible: boolean): void;
  function activateProjectTreeNode(node: string): void;
  function checkFirstLaunchSetup(): void;
  function setScriptContent(text: string): void;
}

const App = {
  _didInit: false,
  init(): void {
    if (App._didInit) return;
    App._didInit = true;

    const prefs = appShellStore.preferences;
    const w = window as unknown as Record<string, unknown>;

    if (typeof prefs.scriptEditorInsertBarVisible === 'boolean') {
      w.scriptEditorInsertBarVisible = prefs.scriptEditorInsertBarVisible;
    }
    if (typeof prefs.activeProjectId === 'string') {
      appShellStore.setActiveProjectId(prefs.activeProjectId, { persist: false });
    }

    window.syncActiveProjectName?.(String(projectData.name ?? ''));
    window.hydrateScriptEditorFromProject?.();
    window.initStoryboardVisibilityToggles?.();
    window.initScriptEditorOptionsToolbar?.();
    window.initChipNavigation?.();
    window.initStoryboardNavigation?.();
    window.renderFullTree?.();
    primePersistedProjectTreeUi();
    window.renderBreakdownTable?.();
    window.renderScriptInfoTables?.();
    window.renderStoryboard?.();
    window.renderTimeline?.();
    window.initScriptPaneSegmentedControl?.();
    window.switchScriptPaneTab?.('script');

    window.hydrateScriptEditorFromProject?.();

    applyLayoutChromeFromPreferences(prefs);

    const projectSidebar = document.getElementById('project-hierarchy-sidebar');
    const inspectorPanel = document.getElementById('inspector-panel');

    initLayoutSplitDividers();
    syncLayoutSplitDividers();

    window.syncProjectSidebarToggleButton?.(
      !projectSidebar || projectSidebar.style.display !== 'none'
    );
    window.syncInspectorToggleButton?.(
      !inspectorPanel || inspectorPanel.style.display !== 'none'
    );

    if (typeof prefs.preprodSplitPercent === 'number') {
      setPreprodSplitPercent(prefs.preprodSplitPercent, false);
    }

    // Restore the visible workspace/tree selection from app-shell first.
    const appStateLabel = appShellStore.currentViewLabel?.trim();
    let restoredFromAppState = false;
    if (appStateLabel && findProjectNodeByName(appStateLabel)) {
      restoredFromAppState = activateProjectTreeNode(appStateLabel);
    }
    if (!restoredFromAppState) {
      restoredFromAppState = activatePersistedProjectTreeSelection();
    }
    if (!restoredFromAppState) {
      document
        .querySelector('.tree-item[data-view="preprod-workspace"][data-preprod-mode="both"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }

    console.log(
      '%cCineFlow Studio Pro initialized — structure and flow in perfect balance',
      'font-size:10px;color:#5a8cd6'
    );

    initModelStatusBar();
    // Suspended: automatic provider catalog refresh on app load
    // import('@/components/settings/cinegen-provider-catalog-sync')
    //   .then(({ startProviderCatalogSync }) => startProviderCatalogSync())
    //   .catch((e: Error) => {
    //     console.warn('CineGen: provider catalog refresh failed.', e);
    //   });
    window.checkFirstLaunchSetup?.();
  },
};

export function initApp(): void {
  App.init();
}
