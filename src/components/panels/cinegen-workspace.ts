import { consume } from '@lit/context';
import { nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import { appShellStoreContext } from '@/context/app-shell-context';
import { appShellStore, type AppShellStore } from '@/stores/app-shell-store';
import { getCinegenSceneTabs } from '@/panels/panel-hosts';
import { renderOverviewPanel, renderTreatmentView, switchView } from '@/workspace/workspace-bundle';

/** Main workspace container; view panes remain as light-DOM children in index.html. */
@customElement('cinegen-workspace')
export class CinegenWorkspace extends CgLightElement {
  @consume({ context: appShellStoreContext })
  private _shellStore?: AppShellStore;

  private _shellUnsub: (() => void) | null = null;
  private _allowShellUpdate = false;

  connectedCallback(): void {
    const preservedViews = Array.from(this.children);
    super.connectedCallback();
    if (
      !this.querySelector('#view-preprod-workspace') &&
      !this.querySelector('cinegen-preprod-workspace') &&
      preservedViews.length
    ) {
      preservedViews.forEach((node) => this.appendChild(node));
    }
    this.classList.add('flex-1', 'flex', 'flex-col', 'min-h-0');
    this.id = 'main-workspace';
    const store = this._shellStore ?? appShellStore;
    this._shellUnsub = store.subscribe(() => {
      this._allowShellUpdate = true;
      this.requestUpdate();
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._shellUnsub?.();
    this._shellUnsub = null;
  }

  /** Native &lt;slot&gt; only works with shadow DOM; do not re-render and wipe view panes. */
  protected shouldUpdate(_changed: Map<PropertyKey, unknown>): boolean {
    if (this._allowShellUpdate) {
      this._allowShellUpdate = false;
      return true;
    }
    return false;
  }

  setViewLabel(label: string): void {
    const store = this._shellStore ?? appShellStore;
    store.setCurrentView(store.currentView, label);
  }

  showView(viewName: string, label: string, sectionKey?: string | null): void {
    (switchView as (v: string, l: string, s?: string | null) => void)(
      viewName,
      label,
      sectionKey
    );
  }

  /** Scene detail sub-tab (overview, master shot, coverage, …). */
  switchSceneTab(tabIndex: number): void {
    const host = getCinegenSceneTabs();
    if (host) host.switchTab(tabIndex);
    else window.switchSceneTab?.(tabIndex);
  }

  /** Section/folder overview (Lit panel + bundle state). */
  renderOverview(node: unknown, sectionKey?: string | null): void {
    (renderOverviewPanel as (n: unknown, s?: string | null) => void)(node, sectionKey);
  }

  /** Treatment tab in script pane. */
  renderTreatment(): void {
    renderTreatmentView();
  }

  render() {
    return nothing;
  }
}

