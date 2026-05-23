import { emitWorkspaceViewChange } from '@/events/shell-events';
import { ensurePanelForView, isPanelChunkLoaded } from '@/components/panels/panel-loader';
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

  const labelEl = document.getElementById('current-view-label');
  if (labelEl) labelEl.textContent = label || viewName;

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
}

/** Switches workspace view; loads panel chunk first when needed. */
export function switchView(
  viewName: string,
  label: string,
  sectionKey: string | null = null
): void {
  if (isPanelChunkLoaded(viewName)) {
    applyWorkspaceViewDom(viewName, label, sectionKey);
    return;
  }
  void ensurePanelForView(viewName).then(() => {
    applyWorkspaceViewDom(viewName, label, sectionKey);
  });
}
