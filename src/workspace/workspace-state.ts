import type { TreeNode } from '@/tree/tree-types';

/** Mutable workspace UI state (legacy globals bridged on init). */
export const workspaceState = {
  currentSceneId: null as string | null,
  activeSceneTab: 0,
  treatmentLayoutPreference: 'two-column' as 'one-column' | 'two-column',
  treatmentLayoutObserver: null as ResizeObserver | null,
  overviewNodeRefs: [] as TreeNode[],
  overviewViewMode: 'row' as 'column' | 'row' | 'master',
  overviewSelectedCardIdx: -1,
  overviewCurrentNode: null as TreeNode | null,
  overviewSectionKey: null as string | null,
  ovShowHoverPreview: true,
  ovPreviewHideTimer: null as ReturnType<typeof setTimeout> | null,
  assetDetailCurrentNode: null as TreeNode | null,
  assetDetailSelectedIdx: 0,
};
