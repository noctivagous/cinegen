import { provide } from '@lit/context';
import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import { appShellStoreContext } from '@/context/app-shell-context';
import {
  initLayoutSplitDividers,
  applyLayoutChromeFromPreferences,
  setPrevisTimelineDockVisible,
  syncPrevisDrawerHeightFromPreferences,
  syncPrevisPaneSplitFromPreferences,
  setPreprodSplitPercent,
  syncLayoutSplitDividers,
  togglePrevisTimelineDock,
} from '@/services/layout-service';
import {
  CG_TREE_NODE_SELECT,
  CG_WORKSPACE_SCENE_TAB,
  CG_WORKSPACE_VIEW_CHANGE,
  type CgTreeNodeSelectDetail,
  type CgWorkspaceSceneTabDetail,
  type CgWorkspaceViewChangeDetail,
} from '@/events/shell-events';
import type { ContextMenuItem } from '@/services/context-menu-types';
import { CG_REF_CONTEXTMENU, CG_PRODUCTION_REF_ACTION } from '@/events/shell-events';
import {
  appShellStore,
  initAppShellStore,
  patchAppShellPreferences,
  syncAppShellFromSources,
} from '@/stores/app-shell';

@customElement('cinegen-app')
export class CinegenApp extends CgLightElement {
  @provide({ context: appShellStoreContext })
  private readonly _shellStore = appShellStore;

  private _layoutReady = false;

  connectedCallback(): void {
    super.connectedCallback();
    initAppShellStore();
    this.classList.add('flex', 'flex-col', 'h-screen');
    this.style.display = 'flex';
    this.style.flexDirection = 'column';
    this.style.height = '100vh';
    this.addEventListener(CG_TREE_NODE_SELECT, this._onTreeNodeSelect);
    this.addEventListener(CG_WORKSPACE_VIEW_CHANGE, this._onWorkspaceViewChange);
    this.addEventListener(CG_WORKSPACE_SCENE_TAB, this._onWorkspaceSceneTab);
    this.addEventListener(CG_REF_CONTEXTMENU, this._onRefContextMenu);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener(CG_TREE_NODE_SELECT, this._onTreeNodeSelect);
    this.removeEventListener(CG_WORKSPACE_VIEW_CHANGE, this._onWorkspaceViewChange);
    this.removeEventListener(CG_WORKSPACE_SCENE_TAB, this._onWorkspaceSceneTab);
    this.removeEventListener(CG_REF_CONTEXTMENU, this._onRefContextMenu);
  }

  private _onTreeNodeSelect = (e: Event): void => {
    const detail = (e as CustomEvent<CgTreeNodeSelectDetail>).detail;
    if (!detail?.name) return;
    // Selection styling + workspace routing run in legacy handlers; shell tracks context.
    void detail;
  };

  private _onWorkspaceViewChange = (e: Event): void => {
    const { viewName, label, sectionKey } = (e as CustomEvent<CgWorkspaceViewChangeDetail>)
      .detail;
    if (!viewName) return;
    appShellStore.setCurrentView(viewName, label);
    void sectionKey;
  };

  private _onWorkspaceSceneTab = (e: Event): void => {
    const { tabIndex, sceneId } = (e as CustomEvent<CgWorkspaceSceneTabDetail>).detail;
    if (typeof tabIndex !== 'number' || Number.isNaN(tabIndex)) return;
    void sceneId;
  };

  private _onRefContextMenu = (e: Event): void => {
    const { ref, x, y } = (e as CustomEvent).detail as { ref: Record<string, unknown>; x: number; y: number };
    if (!ref) return;
    const menu = this.renderRoot?.querySelector?.('#production-ref-context-menu') as
      | (HTMLElement & { open: (opts: Record<string, unknown>) => void })
      | null;
    if (!menu || typeof menu.open !== 'function') return;

    const items: ContextMenuItem[] = [
      { id: 'assign-moodboard', label: 'Assign to Mood Board', icon: 'fa-images' },
      { id: 'assign-beatboard', label: 'Assign to Beat Board', icon: 'fa-clapperboard' },
      { id: 'assign-character', label: 'Assign to Character Reference', icon: 'fa-user' },
      { id: 'assign-location', label: 'Assign to Location', icon: 'fa-location-dot' },
      { id: 'remove', label: 'Remove', icon: 'fa-trash-can' },
    ];

    menu.open({
      x,
      y,
      typeModifier: 'production-ref',
      header: { label: String(ref.title || 'Reference'), caption: 'Production Reference' },
      items,
      onSelect: (actionId: string) => {
        window.dispatchEvent(new CustomEvent(CG_PRODUCTION_REF_ACTION, {
          bubbles: true,
          detail: { action: actionId, refId: String(ref.id || '') },
        }));
      },
    });
  };

  firstUpdated(): void {
    if (this._layoutReady) return;
    this._layoutReady = true;
    syncAppShellFromSources();
    this._applyLayoutPreferences();
    initLayoutSplitDividers();
    syncLayoutSplitDividers();
  }

  private _applyLayoutPreferences(): void {
    const prefs = appShellStore.preferences;
    applyLayoutChromeFromPreferences(prefs);

    const inspectorPanel = document.getElementById('inspector-panel');
    const projectSidebar = document.getElementById('project-hierarchy-sidebar');
    if (typeof prefs.preprodSplitPercent === 'number') {
      setPreprodSplitPercent(prefs.preprodSplitPercent, false);
    }
    if (typeof prefs.previsTimelineDockVisible === 'boolean') {
      setPrevisTimelineDockVisible(prefs.previsTimelineDockVisible, false);
    }
    if (typeof prefs.previsPaneSplitPercent === 'number') {
      syncPrevisPaneSplitFromPreferences();
    }
    syncPrevisDrawerHeightFromPreferences();

    if (typeof window.syncProjectSidebarToggleButton === 'function') {
      window.syncProjectSidebarToggleButton(
        !projectSidebar || projectSidebar.style.display !== 'none'
      );
    }
    if (typeof window.syncInspectorToggleButton === 'function') {
      window.syncInspectorToggleButton(
        !inspectorPanel || inspectorPanel.style.display !== 'none'
      );
    }
  }

  render() {
    return html`
      <slot></slot>
      <cg-context-menu id="chip-context-menu"></cg-context-menu>
      <cg-context-menu id="storyboard-context-menu" class="storyboard-context-menu"></cg-context-menu>
      <cg-context-menu id="script-context-menu"></cg-context-menu>
      <cg-context-menu id="production-ref-context-menu"></cg-context-menu>
      <cinegen-overview-preview></cinegen-overview-preview>
    `;
  }
}

export function syncProjectSidebarToggleButton(visible: boolean): void {
  const btn = document.getElementById('project-sidebar-toggle-btn');
  if (!btn) return;
  btn.classList.toggle('active', visible);
  btn.setAttribute('aria-pressed', visible ? 'true' : 'false');
}

export function syncPrevisTimelineToggleButton(expanded: boolean): void {
  const btn = document.getElementById('previs-timeline-toggle-btn');
  if (!btn) return;
  btn.classList.toggle('active', expanded);
  btn.setAttribute('aria-pressed', expanded ? 'true' : 'false');
}

export function toggleProjectSidebar(): void {
  const panel = document.getElementById('project-hierarchy-sidebar');
  if (!panel) return;
  const visible = panel.style.display === 'none';
  panel.style.display = visible ? 'flex' : 'none';
  syncProjectSidebarToggleButton(visible);
  syncLayoutSplitDividers();
  patchAppShellPreferences({ projectSidebarVisible: visible });
}

export function togglePrevisTimelineDockGlobal(): void {
  togglePrevisTimelineDock();
}
