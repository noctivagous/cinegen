/** Layout resize constants and DOM measurement helpers. */

export const LAYOUT_LIMITS = {
  minSidebarPx: 200,
  minInspectorPx: 240,
  minMainWorkspacePx: 520,
  minPreprodPercent: 20,
  maxPreprodPercent: 80,
  minPrevisDrawerPx: 120,
  minPrevisPanePercent: 18,
  maxPrevisPanePercent: 82,
  minPrevisPanePx: 56,
} as const;

export const LAYOUT_DIVIDER_WIDTH_PX = 5;

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getPanelWidthPx(panel: HTMLElement | null): number {
  if (!panel || panel.style.display === 'none') return 0;
  return panel.getBoundingClientRect().width || panel.offsetWidth || 0;
}

export function getWorkspaceRowRect(): DOMRect | null {
  return (
    document.getElementById('main-workspace-container')?.parentElement?.getBoundingClientRect() ??
    null
  );
}

/** Max previs overlay height (px) before the dock head meets the toolbar. */
export function getPrevisDrawerMaxHeightPx(): number {
  const statusTop =
    document.querySelector('cinegen-status-bar')?.getBoundingClientRect().top ?? window.innerHeight;
  const toolbarBottom =
    document.querySelector('cinegen-toolbar')?.getBoundingClientRect().bottom ?? 0;
  const dockHead =
    document.querySelector('.previs-timeline-dock-head')?.getBoundingClientRect().height ?? 28;
  return Math.max(
    LAYOUT_LIMITS.minPrevisDrawerPx,
    Math.floor(statusTop - toolbarBottom - dockHead - 48)
  );
}
