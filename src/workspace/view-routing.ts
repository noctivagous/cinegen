import { emitWorkspaceViewChange } from '@/events/shell-events';
import {
  ensurePanelForView,
  isPanelChunkLoaded,
  VIEW_HOST_TAG,
} from '@/components/panels/panel-loader';
import { appShellStore } from '@/stores/app-shell-store';
import { renderStoryboard } from '@/storyboard/storyboard-bundle';

export function updateWorkspaceSectionTheme(sectionKey: string | null): void {
  const container = document.getElementById('main-workspace-container');
  if (!container) return;
  const sectionClasses =
    (window as Window & { WORKSPACE_SECTION_CLASSES?: string[] }).WORKSPACE_SECTION_CLASSES ?? [];
  container.classList.remove(...sectionClasses);
  if (sectionKey && sectionClasses.includes(`workspace-section-${sectionKey}`)) {
    container.classList.add(`workspace-section-${sectionKey}`);
  }
}

export function applyWorkspaceViewDom(
  viewName: string,
  label: string,
  sectionKey: string | null = null
): void {
  document.querySelectorAll('[id^="view-"]').forEach((el) => el.classList.add('hidden'));
  const view = document.getElementById(`view-${viewName}`);
  if (view) view.classList.remove('hidden');
  else document.getElementById('view-default')?.classList.remove('hidden');

  updateWorkspaceSectionTheme(sectionKey);
  appShellStore.setCurrentView(viewName, label || viewName);
  emitWorkspaceViewChange({
    viewName,
    label: label || viewName,
    sectionKey,
  });
  if (viewName === 'preprod-workspace') {
    renderStoryboard();
  }

  // Sync browser URL with current view
  import('@/routing/project-routing').then(({ syncUrlFromView }) =>
    syncUrlFromView(viewName, label || viewName, sectionKey)
  );
}

/** Wait for the view's custom element module and first Lit render. */
export async function awaitViewHostReady(viewName: string): Promise<void> {
  const tag = VIEW_HOST_TAG[viewName];
  if (tag) await customElements.whenDefined(tag);
  const host = document.getElementById(`view-${viewName}`) as
    | (HTMLElement & { updateComplete?: Promise<unknown> })
    | null;
  if (host?.updateComplete) await host.updateComplete;
}

/** Switches workspace view; loads panel chunk first when needed. */
export async function switchView(
  viewName: string,
  label: string,
  sectionKey: string | null = null
): Promise<void> {
  await ensurePanelForView(viewName);
  await awaitViewHostReady(viewName);
  applyWorkspaceViewDom(viewName, label, sectionKey);
}
