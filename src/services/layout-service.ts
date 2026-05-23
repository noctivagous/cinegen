import { clamp, LAYOUT_LIMITS } from '@/services/layout-metrics';
import { savePreferences } from '@/services/preferences';

export { LAYOUT_LIMITS, LAYOUT_DIVIDER_WIDTH_PX, clamp, getPanelWidthPx, getWorkspaceRowRect } from '@/services/layout-metrics';

export function setSidebarWidthPx(nextWidthPx: number, shouldPersist = true): void {
  const sidebar = document.getElementById('project-hierarchy-sidebar');
  if (!sidebar) return;
  const clamped = Math.max(LAYOUT_LIMITS.minSidebarPx, Math.round(nextWidthPx));
  sidebar.style.width = `${clamped}px`;
  sidebar.style.flex = '0 0 auto';
  if (shouldPersist) {
    savePreferences({ projectSidebarWidthPx: clamped });
  }
}

export function setInspectorWidthPx(nextWidthPx: number, shouldPersist = true): void {
  const inspector = document.getElementById('inspector-panel');
  if (!inspector) return;
  const clamped = Math.max(LAYOUT_LIMITS.minInspectorPx, Math.round(nextWidthPx));
  inspector.style.width = `${clamped}px`;
  inspector.style.flex = '0 0 auto';
  if (shouldPersist) {
    savePreferences({ inspectorWidthPx: clamped });
  }
}

export function setPreprodSplitPercent(nextPercent: number, shouldPersist = true): void {
  const percent = clamp(
    nextPercent,
    LAYOUT_LIMITS.minPreprodPercent,
    LAYOUT_LIMITS.maxPreprodPercent
  );
  const scriptPane = document.getElementById('preprod-script-pane');
  const storyboardPane = document.getElementById('preprod-story-pane');
  if (!scriptPane || !storyboardPane) return;
  scriptPane.style.flex = `0 0 ${percent}%`;
  scriptPane.style.width = '';
  storyboardPane.style.flex = '1 1 0';
  storyboardPane.style.width = '';
  if (shouldPersist) {
    savePreferences({ preprodSplitPercent: percent });
  }
}

export function syncLayoutSplitDividers(): void {
  const sidebar = document.getElementById('project-hierarchy-sidebar');
  const inspector = document.getElementById('inspector-panel');
  const sidebarDivider = document.getElementById('project-sidebar-divider');
  const inspectorDivider = document.getElementById('inspector-split-divider');
  if (sidebarDivider) {
    sidebarDivider.style.display =
      !sidebar || sidebar.style.display === 'none' ? 'none' : 'block';
  }
  if (inspectorDivider) {
    inspectorDivider.style.display =
      !inspector || inspector.style.display === 'none' ? 'none' : 'block';
  }
}

/** @deprecated Dividers self-wire via `LayoutResizeController` on `cg-split-divider`. */
export function initLayoutSplitDividers(): void {
  syncLayoutSplitDividers();
}

