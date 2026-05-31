import { clamp, getPrevisDrawerMaxHeightPx, LAYOUT_LIMITS } from '@/services/layout-metrics';
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
  type CineGenPreferences,
} from '@/services/preferences';

export { LAYOUT_LIMITS, LAYOUT_DIVIDER_WIDTH_PX, clamp, getPanelWidthPx, getWorkspaceRowRect } from '@/services/layout-metrics';

/** Apply saved sidebar/inspector width + visibility before first paint when possible. */
export function applyLayoutChromeFromPreferences(
  prefs: CineGenPreferences = window.CineGen?.preferences ?? loadPreferences()
): void {
  const projectSidebar =
    document.getElementById('project-hierarchy-sidebar') ??
    document.querySelector('cinegen-project-sidebar');
  const inspectorPanel =
    document.getElementById('inspector-panel') ??
    document.querySelector('cinegen-inspector-shell');

  if (projectSidebar) {
    if (typeof prefs.projectSidebarVisible === 'boolean') {
      projectSidebar.style.display = prefs.projectSidebarVisible ? 'flex' : 'none';
    }
    if (typeof prefs.projectSidebarWidthPx === 'number') {
      const clamped = Math.max(LAYOUT_LIMITS.minSidebarPx, Math.round(prefs.projectSidebarWidthPx));
      projectSidebar.style.width = `${clamped}px`;
      projectSidebar.style.flex = '0 0 auto';
    }
  }

  if (inspectorPanel) {
    if (typeof prefs.inspectorVisible === 'boolean') {
      inspectorPanel.style.display = prefs.inspectorVisible ? 'flex' : 'none';
    }
    if (typeof prefs.inspectorWidthPx === 'number') {
      const clamped = Math.max(LAYOUT_LIMITS.minInspectorPx, Math.round(prefs.inspectorWidthPx));
      inspectorPanel.style.width = `${clamped}px`;
      inspectorPanel.style.minWidth = `${LAYOUT_LIMITS.minInspectorPx}px`;
      inspectorPanel.style.flex = '0 0 auto';
    }
  }
}

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

export function setPrevisTimelineDockVisible(visible: boolean, shouldPersist = true): void {
  const dock = document.getElementById('previs-timeline-dock');
  if (!dock) return;
  dock.classList.toggle('previs-timeline-dock--expanded', visible);
  window.dispatchEvent(new CustomEvent('previs-timeline-dock-toggle', { detail: { expanded: visible } }));
  window.syncPrevisTimelineToggleButton?.(visible);
  if (shouldPersist) {
    savePreferences({ previsTimelineDockVisible: visible });
  }
}

export function togglePrevisTimelineDock(): void {
  const dock = document.getElementById('previs-timeline-dock');
  if (!dock) return;
  const next = !dock.classList.contains('previs-timeline-dock--expanded');
  setPrevisTimelineDockVisible(next, true);
}

export function setPrevisDrawerHeightPx(nextHeightPx: number, shouldPersist = true): void {
  const overlay = document.getElementById('previs-drawer-overlay');
  if (!overlay) return;
  const contentMin = getPrevisDrawerContentMinHeightPx();
  const clamped = clamp(
    Math.round(nextHeightPx),
    Math.max(LAYOUT_LIMITS.minPrevisDrawerPx, contentMin),
    getPrevisDrawerMaxHeightPx()
  );
  overlay.style.height = `${clamped}px`;
  overlay.style.flex = '0 0 auto';
  overlay.classList.remove('is-accordion-compact');
  if (shouldPersist) {
    savePreferences({ previsDrawerHeightPx: clamped });
  }
}

/** Minimum overlay height for the current accordion open/closed mix (prevents clipping). */
function getPrevisDrawerContentMinHeightPx(): number {
  const dock = document.getElementById('previs-timeline-dock');
  const stack = document.getElementById('previs-drawer-stack');
  if (!dock?.classList.contains('previs-timeline-dock--expanded') || !stack) {
    return LAYOUT_LIMITS.minPrevisDrawerPx;
  }
  if (dock.querySelector('.previs-drawer-unit.is-open.is-fullscreen')) {
    return LAYOUT_LIMITS.minPrevisDrawerPx;
  }

  const playback = stack.querySelector<HTMLDetailsElement>('#previs-playback-pane');
  const timeline = stack.querySelector<HTMLDetailsElement>('#previs-timeline-pane');
  const anyOpen = Boolean(playback?.open || timeline?.open);
  return anyOpen
    ? measurePrevisDrawerAccordionExpandedHeight()
    : measurePrevisDrawerAccordionCompactHeight();
}

export function syncPrevisDrawerHeightFromPreferences(): void {
  const overlay = document.getElementById('previs-drawer-overlay');
  if (!overlay) return;
  const prefs = window.CineGen?.preferences;
  const stored = prefs?.previsDrawerHeightPx;
  if (typeof stored === 'number' && stored >= LAYOUT_LIMITS.minPrevisDrawerPx) {
    setPrevisDrawerHeightPx(stored, false);
    syncPrevisDrawerHeightToAccordion();
    return;
  }
  overlay.style.removeProperty('height');
  overlay.style.flex = '';
  syncPrevisDrawerHeightToAccordion();
}

/** Shrink or restore drawer overlay height based on accordion open state. */
export function syncPrevisDrawerHeightToAccordion(): void {
  const overlay = document.getElementById('previs-drawer-overlay');
  const dock = document.getElementById('previs-timeline-dock');
  const stack = document.getElementById('previs-drawer-stack');
  if (!overlay || !stack || !dock?.classList.contains('previs-timeline-dock--expanded')) return;
  if (dock.querySelector('.previs-drawer-unit.is-open.is-fullscreen')) {
    overlay.classList.remove('is-accordion-compact');
    return;
  }

  const playback = stack.querySelector<HTMLDetailsElement>('#previs-playback-pane');
  const timeline = stack.querySelector<HTMLDetailsElement>('#previs-timeline-pane');
  const anyOpen = Boolean(playback?.open || timeline?.open);

  if (!anyOpen) {
    const compact = measurePrevisDrawerAccordionCompactHeight();
    overlay.style.height = `${compact}px`;
    overlay.style.flex = '0 0 auto';
    overlay.classList.add('is-accordion-compact');
    return;
  }

  overlay.classList.remove('is-accordion-compact');
  const openCount =
    (playback?.open ? 1 : 0) + (timeline?.open ? 1 : 0);
  const measured = measurePrevisDrawerAccordionExpandedHeight();
  const currentPx = parseFloat(overlay.style.height) || 0;
  const maxPx = getPrevisDrawerMaxHeightPx();
  // Preserve user-dragged height only when multiple sections are open.
  // When a section is closed, shrink to the measured content height.
  const rawTarget = openCount >= 2 ? Math.max(measured, currentPx) : measured;
  const target = clamp(
    rawTarget,
    Math.max(LAYOUT_LIMITS.minPrevisDrawerPx, measured),
    maxPx
  );
  overlay.style.height = `${target}px`;
  overlay.style.flex = '0 0 auto';
  overlay.classList.toggle('is-height-capped', measured > maxPx);

  // Re-check after layout: avoid clipping when scrollHeight exceeds bbox height.
  const needPx = Math.ceil(stack.scrollHeight);
  if (needPx > overlay.clientHeight + 1) {
    const bumped = clamp(needPx, Math.max(LAYOUT_LIMITS.minPrevisDrawerPx, measured), maxPx);
    overlay.style.height = `${bumped}px`;
    overlay.classList.toggle('is-height-capped', needPx > maxPx);
  }
}

/** Natural stack height (scrollHeight) for the current accordion open/closed mix. */
function measurePrevisDrawerStackHeightPx(expandedOpenSections: boolean): number {
  const stack = document.getElementById('previs-drawer-stack');
  const overlay = document.getElementById('previs-drawer-overlay');
  if (!stack || !overlay) return LAYOUT_LIMITS.minPrevisDrawerPx;

  if (expandedOpenSections) {
    overlay.classList.add('is-measuring-accordion');
  }
  const prevHeight = overlay.style.height;
  const prevFlex = overlay.style.flex;
  overlay.style.height = 'auto';
  overlay.style.flex = '0 0 auto';
  const height = Math.ceil(stack.scrollHeight);
  overlay.style.height = prevHeight;
  overlay.style.flex = prevFlex;
  if (expandedOpenSections) {
    overlay.classList.remove('is-measuring-accordion');
  }

  return Math.max(LAYOUT_LIMITS.minPrevisDrawerPx, height);
}

function measurePrevisDrawerAccordionCompactHeight(): number {
  return Math.max(52, measurePrevisDrawerStackHeightPx(false));
}

function measurePrevisDrawerAccordionExpandedHeight(): number {
  return measurePrevisDrawerStackHeightPx(true);
}

export function setPrevisPaneSplitPercent(nextPercent: number, shouldPersist = true): void {
  const percent = clamp(
    nextPercent,
    LAYOUT_LIMITS.minPrevisPanePercent,
    LAYOUT_LIMITS.maxPrevisPanePercent
  );
  const playback = document.getElementById('previs-playback-pane');
  const timeline = document.getElementById('previs-timeline-pane');
  if (!playback || !timeline) return;
  playback.style.flex = `0 0 ${percent}%`;
  timeline.style.flex = '1 1 0';
  if (shouldPersist) {
    savePreferences({ previsPaneSplitPercent: percent });
  }
}

export function syncPrevisPaneSplitFromPreferences(): void {
  const playback = document.getElementById('previs-playback-pane') as HTMLDetailsElement | null;
  const timeline = document.getElementById('previs-timeline-pane') as HTMLDetailsElement | null;
  if (!playback?.open || !timeline?.open) return;
  const prefs = window.CineGen?.preferences;
  const percent =
    typeof prefs?.previsPaneSplitPercent === 'number'
      ? prefs.previsPaneSplitPercent
      : DEFAULT_PREFERENCES.previsPaneSplitPercent;
  setPrevisPaneSplitPercent(percent, false);
}

/** Reset overlay sizing so fullscreen flex layout can fill the fixed drawer unit. */
export function preparePrevisFullscreenLayout(): void {
  const overlay = document.getElementById('previs-drawer-overlay');
  if (!overlay) return;
  overlay.classList.remove('is-accordion-compact');
  overlay.style.removeProperty('height');
  overlay.style.removeProperty('flex');
}

/** Apply pane flex split / single-pane fill while the previs drawer is fullscreen. */
export function syncPrevisFullscreenPaneLayout(): void {
  const dock = document.getElementById('previs-timeline-dock');
  if (!dock?.querySelector('.previs-drawer-unit.is-open.is-fullscreen')) return;

  const playback = document.getElementById('previs-playback-pane') as HTMLDetailsElement | null;
  const timeline = document.getElementById('previs-timeline-pane') as HTMLDetailsElement | null;
  const accordion = dock.querySelector('.previs-drawer-accordion');
  if (!playback || !timeline || !accordion) return;

  const playbackOpen = playback.open;
  const timelineOpen = timeline.open;
  const bothOpen = playbackOpen && timelineOpen;

  accordion.classList.toggle('is-fullscreen-split', bothOpen);
  accordion.classList.toggle('is-fullscreen-single', !bothOpen && (playbackOpen || timelineOpen));

  if (bothOpen) {
    syncPrevisPaneSplitFromPreferences();
    return;
  }

  playback.style.removeProperty('flex');
  timeline.style.removeProperty('flex');

  if (playbackOpen) {
    playback.style.flex = '1 1 0';
    playback.style.minHeight = '0';
    timeline.style.removeProperty('min-height');
    playback.style.removeProperty('min-height');
    return;
  }

  if (timelineOpen) {
    timeline.style.flex = '1 1 0';
    timeline.style.minHeight = '0';
    playback.style.removeProperty('min-height');
    timeline.style.removeProperty('min-height');
  }
}

export function clearPrevisFullscreenPaneLayout(): void {
  const playback = document.getElementById('previs-playback-pane');
  const timeline = document.getElementById('previs-timeline-pane');
  playback?.style.removeProperty('flex');
  playback?.style.removeProperty('min-height');
  timeline?.style.removeProperty('flex');
  timeline?.style.removeProperty('min-height');
  document
    .querySelector('.previs-drawer-accordion')
    ?.classList.remove('is-fullscreen-split', 'is-fullscreen-single');
}

/** @deprecated Dividers self-wire via `LayoutResizeController` on `cg-split-divider`. */
export function initLayoutSplitDividers(): void {
  syncLayoutSplitDividers();
}

