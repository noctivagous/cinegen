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

/** Storyboard: frames array or link metadata changed. */
export const CG_STORYBOARD_FRAMES_CHANGED = 'storyboard-frames-changed';

/** Storyboard: reference bank or scene reference overrides changed. */
export const CG_STORYBOARD_REFERENCES_CHANGED = 'storyboard-references-changed';

/** Drafts: entries array changed (append or patch). */
export const CG_DRAFTS_CHANGED = 'cg-drafts-changed';

/** Project: name or scene data changed (status bar refresh). */
export const CG_PROJECT_NAME_CHANGED = 'cinegen:project-name-changed';

/** Production references: context menu requested (right-click on a reference item). */
export const CG_REF_CONTEXTMENU = 'cg-ref-contextmenu';

/** Production references: action dispatched from context menu. */
export const CG_PRODUCTION_REF_ACTION = 'cg-production-ref-action';

/** Production references: list changed (added or removed). */
export const CG_PRODUCTION_REFERENCES_CHANGED = 'cg-production-references-changed';

/** Assets: upload files requested. */
export const CG_ASSETS_UPLOAD = 'cg-assets-upload';

/** Assets: AI fetch assets requested. */
export const CG_ASSETS_FETCH = 'cg-assets-fetch';

/** Assets: AI generate asset requested. */
export const CG_ASSETS_GENERATE = 'cg-assets-generate';

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
  frameId: number | null;
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

export function emitStoryboardFrameSelected(frameId: number | null): void {
  window.dispatchEvent(
    new CustomEvent<CgStoryboardFrameSelectedDetail>(CG_STORYBOARD_FRAME_SELECTED, {
      detail: { frameId },
    })
  );
}
