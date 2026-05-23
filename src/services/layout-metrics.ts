/** Layout resize constants and DOM measurement helpers. */

export const LAYOUT_LIMITS = {
  minSidebarPx: 200,
  minInspectorPx: 240,
  minMainWorkspacePx: 520,
  minPreprodPercent: 20,
  maxPreprodPercent: 80,
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
