import { projectRegistry, projectData } from '@/data/project-data';
import {
  activatePersistedProjectTreeSelection,
  primePersistedProjectTreeUi,
  resetProjectTreeUiRestoreFlag,
} from '@/tree/project-tree-service';
import { getCinegenScriptEditor } from '@/panels/panel-hosts';
import { appShellStore } from '@/stores/app-shell';
import {
  initLayoutSplitDividers,
  setInspectorWidthPx,
  setPreprodSplitPercent,
  setSidebarWidthPx,
  syncLayoutSplitDividers,
} from '@/services/layout-service';
import { initModelStatusBar } from '@/services/status-bar-service';

declare global {
  function syncActiveProjectName(name: string): void;
  function hydrateScriptEditorFromProject(): void;
  function initStoryboardVisibilityToggles(): void;
  function initScriptEditorChipsToggle(): void;
  function initScriptEditorAnchorsToggle(): void;
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
  function scheduleFountainRender(): void;
  function scheduleScriptEditorProjectSync(): void;
  function syncScriptRenderScroll(): void;
  function syncProjectSidebarToggleButton(visible: boolean): void;
  function syncInspectorToggleButton(visible: boolean): void;
  function activateProjectTreeNode(node: string): void;
  function checkFirstLaunchSetup(): void;
}

const App = {
  _didInit: false,
  init(): void {
    if (App._didInit) return;
    App._didInit = true;

    const prefs = appShellStore.preferences;
    const w = window as unknown as Record<string, unknown>;

    if (typeof prefs.scriptEditorChipsEnabled === 'boolean') {
      w.scriptEditorChipsEnabled = prefs.scriptEditorChipsEnabled;
    }
    if (typeof prefs.scriptEditorAnchorsEnabled === 'boolean') {
      w.scriptEditorAnchorsEnabled = prefs.scriptEditorAnchorsEnabled;
    }
    if (typeof prefs.scriptEditorFontSizePx === 'number') {
      w.scriptEditorFontSizePx = prefs.scriptEditorFontSizePx;
    }
    if (typeof prefs.scriptEditorInsertBarVisible === 'boolean') {
      w.scriptEditorInsertBarVisible = prefs.scriptEditorInsertBarVisible;
    }
    if (typeof prefs.activeProjectId === 'string') {
      const exists = projectRegistry.some((p) => p.id === prefs.activeProjectId);
      if (exists) {
        appShellStore.setActiveProjectId(prefs.activeProjectId, { persist: false });
        resetProjectTreeUiRestoreFlag();
        window.refreshProjectTree?.();
      }
    }

    window.syncActiveProjectName?.(String(projectData.name ?? ''));
    window.hydrateScriptEditorFromProject?.();
    window.initStoryboardVisibilityToggles?.();
    window.initScriptEditorChipsToggle?.();
    window.initScriptEditorAnchorsToggle?.();
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

    const scriptHost = getCinegenScriptEditor();
    if (scriptHost) {
      scriptHost.wireTextarea();
      window.hydrateScriptEditorFromProject?.();
      scriptHost.scheduleBackdropRender();
    } else {
      const scriptEditor = document.getElementById('script-editor');
      if (scriptEditor) {
        scriptEditor.addEventListener('mouseup', () => window.syncScriptSelectionToStoryboard?.());
        scriptEditor.addEventListener('keyup', () => window.syncScriptSelectionToStoryboard?.());
        scriptEditor.addEventListener('input', () => {
          window.scheduleFountainRender?.();
          window.scheduleScriptEditorProjectSync?.();
        });
        scriptEditor.addEventListener('scroll', () => window.syncScriptRenderScroll?.(), {
          passive: true,
        });
        window.hydrateScriptEditorFromProject?.();
        window.scheduleFountainRender?.();
      }
    }

    const inspectorPanel = document.getElementById('inspector-panel');
    if (inspectorPanel && typeof prefs.inspectorVisible === 'boolean') {
      inspectorPanel.style.display = prefs.inspectorVisible ? 'flex' : 'none';
    }
    const projectSidebar = document.getElementById('project-hierarchy-sidebar');
    if (projectSidebar && typeof prefs.projectSidebarVisible === 'boolean') {
      projectSidebar.style.display = prefs.projectSidebarVisible ? 'flex' : 'none';
    }
    if (typeof prefs.projectSidebarWidthPx === 'number') {
      setSidebarWidthPx(prefs.projectSidebarWidthPx, false);
    }
    if (typeof prefs.inspectorWidthPx === 'number' && inspectorPanel) {
      setInspectorWidthPx(prefs.inspectorWidthPx, false);
    }

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

    queueMicrotask(() => {
      if (typeof window.activateProjectTreeNode === 'function') {
        activatePersistedProjectTreeSelection();
      } else {
        document
          .querySelector('.tree-item[data-view="preprod-workspace"][data-preprod-mode="both"]')
          ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    });

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
