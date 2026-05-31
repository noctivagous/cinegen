import type { TreeNode } from '@/tree/tree-types';

/** Project tree: user or programmatic node activation. */
export const CG_TREE_NODE_SELECT = 'cg-tree-node-select';

/** Workspace: primary view pane changed (`view-*` visibility). */
export const CG_WORKSPACE_VIEW_CHANGE = 'cg-workspace-view-change';

/** Workspace: scene detail inner tab changed (overview, master shot, …). */
export const CG_WORKSPACE_SCENE_TAB = 'cg-workspace-scene-tab';

/** Previs: shot / frame selection changed. */
export const CG_PREVIS_SELECTION_CHANGED = 'previs-selection-changed';

/** Storyboard: a frame was selected (script wraps, grid, inspector sync). */
export const CG_STORYBOARD_FRAME_SELECTED = 'storyboard-frame-selected';

export interface CgTreeNodeSelectDetail {
  name: string;
  type: string;
  view: string;
  sceneId?: string;
  sectionKey: string | null;
  preprodMode?: string;
}

export interface CgWorkspaceViewChangeDetail {
  viewName: string;
  label: string;
  sectionKey: string | null;
}

export interface CgWorkspaceSceneTabDetail {
  tabIndex: number;
  sceneId: string | null;
}

export interface CgStoryboardFrameSelectedDetail {
  frameId: number;
}

export function treeNodeSelectDetail(
  node: TreeNode,
  sectionKey: string | null
): CgTreeNodeSelectDetail {
  return {
    name: node.name,
    type: node.type,
    view: node.view ?? 'default',
    sceneId: node.sceneId,
    sectionKey,
    preprodMode: node.preprodMode,
  };
}

function workspaceHost(): HTMLElement | null {
  return document.querySelector('cinegen-workspace');
}

function treeHost(): HTMLElement | null {
  return document.querySelector('cinegen-project-tree');
}

export function emitTreeNodeSelect(
  detail: CgTreeNodeSelectDetail,
  target?: EventTarget | null
): void {
  const host = (target as HTMLElement | null) ?? treeHost();
  host?.dispatchEvent(
    new CustomEvent<CgTreeNodeSelectDetail>(CG_TREE_NODE_SELECT, {
      bubbles: true,
      composed: true,
      detail,
    })
  );
}

export function emitWorkspaceViewChange(detail: CgWorkspaceViewChangeDetail): void {
  const host = workspaceHost();
  host?.dispatchEvent(
    new CustomEvent<CgWorkspaceViewChangeDetail>(CG_WORKSPACE_VIEW_CHANGE, {
      bubbles: true,
      composed: true,
      detail,
    })
  );
}

export function emitWorkspaceSceneTab(detail: CgWorkspaceSceneTabDetail): void {
  const host = workspaceHost();
  host?.dispatchEvent(
    new CustomEvent<CgWorkspaceSceneTabDetail>(CG_WORKSPACE_SCENE_TAB, {
      bubbles: true,
      composed: true,
      detail,
    })
  );
}

export function emitStoryboardFrameSelected(frameId: number): void {
  window.dispatchEvent(
    new CustomEvent<CgStoryboardFrameSelectedDetail>(CG_STORYBOARD_FRAME_SELECTED, {
      detail: { frameId },
    })
  );
}
