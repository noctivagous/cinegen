import { emitTreeNodeSelect, treeNodeSelectDetail } from '@/events/shell-events';
import { activeProjectId, getActiveProjectSettings } from '@/data/project-data';
import {
  persistProjectTreeExpandedState,
  restoreProjectTreeExpandedState,
} from '@/services/project-service';
import { loadPreferences, savePreferences } from '@/services/preferences';
import { ensurePanelForView } from '@/components/panels/panel-loader';
import {
  applyPreprodLayoutToDom,
  preprodModeForTreeNode,
  type PreprodLayoutMode,
} from '@/workspace/preprod-layout';
import { appShellStore } from '@/stores/app-shell-store';
import { SUPPORTED_TREE_VIEWS } from '@/tree/tree-view-contract';
import type { TreeNode, TreeProjectRoot } from '@/tree/tree-types';
import { sectionKeyForTopLevelName } from '@/tree/tree-constants';
import { selectTreeNode as selectWorkspaceTreeNode } from '@/workspace/workspace-bundle';
import {
  formatShotDisplayLabel,
  getFramesForShot,
  getShotsForScene,
  sceneNumberFromSceneId,
} from '@/workspace/shot-frame-bridge';
import type { SceneShot } from '@/workspace/scene-types';

type BreakdownRow = {
  scene: string;
  int_ext: string;
  location: string;
  time: string;
};

function getProjectData(): TreeProjectRoot {
  return ((window as unknown as Record<string, unknown>).projectData as TreeProjectRoot) ?? {
    name: 'Project',
    type: 'project',
    children: [],
  };
}

function getBreakdownData(): BreakdownRow[] {
  return (((window as unknown as Record<string, unknown>).breakdownData as BreakdownRow[]) ?? []);
}

function getDeletedStoryboardFrames(): unknown[] {
  return (((window as unknown as Record<string, unknown>).deletedStoryboardFrames as unknown[]) ?? []);
}

type TreeRefreshListener = () => void;

let _selectedName: string | null = null;
const _listeners = new Set<TreeRefreshListener>();
let _treeUiRestoredForProjectId: string | null = null;

const DEFAULT_PROJECT_TREE_SELECTION = 'Script + Storyboard';

function commitProjectTreeExpandedState(): void {
  persistProjectTreeExpandedState();
}

export function resetProjectTreeUiRestoreFlag(): void {
  _treeUiRestoredForProjectId = null;
}

export function subscribeProjectTree(listener: TreeRefreshListener): () => void {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

export function requestProjectTreeRefresh(): void {
  _listeners.forEach((fn) => fn());
}

export function getSelectedTreeName(): string | null {
  return _selectedName;
}

export function persistProjectTreeSelection(nodeName: string, projectId = activeProjectId): void {
  if (!projectId || !nodeName) return;
  const prefs = window.CineGen?.preferences ?? loadPreferences();
  savePreferences({
    projectTreeSelectedByProjectId: {
      ...(prefs.projectTreeSelectedByProjectId ?? {}),
      [projectId]: nodeName,
    },
  });
}

export function getPersistedProjectTreeSelection(projectId = activeProjectId): string {
  if (!projectId) return DEFAULT_PROJECT_TREE_SELECTION;
  const prefs = window.CineGen?.preferences ?? loadPreferences();
  return prefs.projectTreeSelectedByProjectId?.[projectId] ?? DEFAULT_PROJECT_TREE_SELECTION;
}

function resolveActivatableTreeNodeName(preferredName: string): string {
  if (findProjectNodeByName(preferredName)) return preferredName;
  if (findProjectNodeByName(DEFAULT_PROJECT_TREE_SELECTION)) return DEFAULT_PROJECT_TREE_SELECTION;
  return preferredName;
}

function initialTreeSelectionName(projectId = activeProjectId): string {
  const fromShell = appShellStore.currentViewLabel?.trim();
  if (fromShell && findProjectNodeByName(fromShell)) return fromShell;
  return resolveActivatableTreeNodeName(getPersistedProjectTreeSelection(projectId));
}

export function getPersistedPreprodMode(projectId = activeProjectId): PreprodLayoutMode {
  ensureStoryboardReferenceNodes();
  ensureSceneShotListNodes();
  const preferred = initialTreeSelectionName(projectId);
  return preprodModeForTreeNode(findProjectNodeByName(preferred));
}

/** Sync tree highlight + preprod layout before first paint (no workspace routing). */
export function primePersistedProjectTreeUi(projectId = activeProjectId): void {
  ensureStoryboardReferenceNodes();
  ensureSceneShotListNodes();
  const name = initialTreeSelectionName(projectId);
  _selectedName = name;
  const node = findProjectNodeByName(name);
  if (node?.view === 'preprod-workspace') {
    applyPreprodLayoutToDom(preprodModeForTreeNode(node));
  }
  expandTreePathToName(name);
  requestProjectTreeRefresh();
}

/** Restore last hierarchy selection for a project (falls back to Script + Storyboard). */
export function activatePersistedProjectTreeSelection(projectId = activeProjectId): boolean {
  const preferred = getPersistedProjectTreeSelection(projectId);
  return activateProjectTreeNode(resolveActivatableTreeNodeName(preferred));
}

export function setSelectedTreeName(name: string | null): void {
  _selectedName = name;
  if (name) persistProjectTreeSelection(name);
  requestProjectTreeRefresh();
  requestAnimationFrame(() => {
    document
      .querySelector('#project-tree .tree-item.selected')
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}

export function getProjectTreeChildren(): TreeNode[] {
  ensureStoryboardReferenceNodes();
  ensureSceneShotListNodes();
  return getProjectData().children ?? [];
}

function ensureStoryboardReferenceNodes(): void {
  const projectData = getProjectData();
  const top = projectData.children ?? [];
  const storyboardNode = top.find((n) => n?.type === 'storyboard' || n?.name === 'Storyboard');
  if (!storyboardNode) return;
  storyboardNode.children ??= [];
  const wanted: Array<{ key: string; label: string; icon: string }> = [
    { key: 'characters', label: 'Character Appearance', icon: 'fa-user' },
    { key: 'locations', label: 'Locations', icon: 'fa-location-dot' },
    { key: 'interiors', label: 'Interiors', icon: 'fa-house' },
    { key: 'exteriors', label: 'Exteriors', icon: 'fa-mountain-city' },
  ];
  for (const w of wanted) {
    const existing = storyboardNode.children.find(
      (c) => c.type === 'storyboard-reference-category' && c.referenceCategory === w.key
    );
    if (existing) continue;
    storyboardNode.children.push({
      name: w.label,
      type: 'storyboard-reference-category',
      icon: w.icon,
      view: 'preprod-workspace',
      preprodMode: 'storyboard',
      referenceCategory: w.key,
    });
  }
}

function findScenesFolder(nodes: TreeNode[]): TreeNode | null {
  for (const node of nodes) {
    if (node.type === 'folder' && node.name === 'Scenes') return node;
    if (node.children?.length) {
      const found = findScenesFolder(node.children);
      if (found) return found;
    }
  }
  return null;
}

function shotTreeNodeName(sceneId: string, shot: SceneShot): string {
  const sceneNum = sceneNumberFromSceneId(sceneId);
  const num = shot.number ?? shot.id;
  const prefix = formatShotDisplayLabel(sceneNum, num);
  const label = shot.label.length > 42 ? `${shot.label.slice(0, 39)}…` : shot.label;
  return `Scene ${String(sceneNum).padStart(2, '0')} — Shot ${prefix} — ${label}`;
}

function frameTreeNodeName(sceneId: string, shot: SceneShot, frameIndex: number, frameLabel: string): string {
  const sceneNum = sceneNumberFromSceneId(sceneId);
  const num = shot.number ?? shot.id;
  const prefix = formatShotDisplayLabel(sceneNum, num);
  const label = frameLabel.length > 36 ? `${frameLabel.slice(0, 33)}…` : frameLabel;
  return `Scene ${String(sceneNum).padStart(2, '0')} — ${prefix}.${frameIndex} — ${label}`;
}

/** Inject coverage shots and storyboard frames under each scene node. */
function ensureSceneShotListNodes(): void {
  const projectData = getProjectData();
  const scenesFolder = findScenesFolder(projectData.children ?? []);
  if (!scenesFolder?.children?.length) return;

  for (const sceneNode of scenesFolder.children) {
    if (sceneNode.type !== 'scene' || !sceneNode.sceneId) continue;
    const sceneId = sceneNode.sceneId;
    const shots = [...getShotsForScene(sceneId)].sort(
      (a, b) => (a.number ?? 0) - (b.number ?? 0) || a.id - b.id
    );

    if (!shots.length) {
      if (sceneNode.children?.length) delete sceneNode.children;
      continue;
    }

    const shotChildren: TreeNode[] = [];
    for (const shot of shots) {
      const frames = getFramesForShot(sceneId, shot.id);
      const frameChildren: TreeNode[] = frames.map((frame, idx) => ({
        name: frameTreeNodeName(sceneId, shot, idx + 1, frame.label),
        type: 'storyboard-frame',
        icon: 'fa-image',
        view: 'preprod-workspace',
        preprodMode: 'storyboard',
        sceneId,
        shotId: shot.id,
        frameId: frame.id,
      }));

      shotChildren.push({
        name: shotTreeNodeName(sceneId, shot),
        type: 'scene-shot',
        icon: 'fa-video',
        view: 'scene-detail',
        sceneId,
        shotId: shot.id,
        children: frameChildren.length ? frameChildren : undefined,
      });
    }

    sceneNode.children = shotChildren;
    if (sceneNode.expanded == null) sceneNode.expanded = false;
  }
}

export function breakdownRowForSceneId(sceneId: string | undefined): BreakdownRow | null {
  if (!sceneId || typeof sceneId !== 'string') return null;
  const m = sceneId.match(/^scene(\d+)$/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (Number.isNaN(n)) return null;
  const key = String(n);
  const breakdownData = getBreakdownData();
  return (
    breakdownData.find((row) => row.scene === key || row.scene === key.padStart(2, '0')) || null
  );
}

export function sceneTreeSubtitle(node: TreeNode): string {
  const br = breakdownRowForSceneId(node.sceneId);
  if (br) return `${br.int_ext} ${br.location} — ${br.time}`;
  if (typeof node.name === 'string') {
    const dash = node.name.indexOf(' - ');
    if (dash > 0) return node.name.slice(dash + 3).trim();
  }
  return '';
}

export function updateProjectTreeHeader(): void {
  const el = document.getElementById('project-tree-header-label');
  if (!el) return;
  const projectData = getProjectData();
  el.replaceChildren();
  const icon = document.createElement('i');
  icon.className = `fa-solid ${projectData.icon || 'fa-film'}`;
  icon.setAttribute('aria-hidden', 'true');
  el.appendChild(icon);
  const nameEl = document.createElement('span');
  nameEl.className = 'truncate min-w-0 flex-1';
  nameEl.textContent = projectData.name || 'UNTITLED';
  el.appendChild(nameEl);

  const settings = getActiveProjectSettings();
  const aspect = settings.aspectRatio ? String(settings.aspectRatio) : '';
  if (aspect) {
    const aspectEl = document.createElement('span');
    aspectEl.className = 'project-tree-header-aspect shrink-0';
    aspectEl.textContent = aspect;
    aspectEl.title = 'Aspect ratio';
    el.appendChild(aspectEl);
  }
}

export function findProjectNode(
  predicate: (node: TreeNode) => boolean,
  node: TreeNode = getProjectData()
): TreeNode | null {
  if (predicate(node)) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findProjectNode(predicate, child);
      if (found) return found;
    }
  }
  return null;
}

export function findProjectNodeByName(name: string): TreeNode | null {
  return findProjectNode((n) => n.name === name);
}

export function findProjectNodeBySceneId(sceneId: string): TreeNode | null {
  return findProjectNode((n) => n.sceneId === sceneId);
}

export function expandTreePathToName(
  targetName: string,
  node: TreeNode = getProjectData(),
  ancestors: TreeNode[] = []
): boolean {
  if (node.name === targetName) {
    let changed = false;
    ancestors.forEach((n) => {
      if (n.children?.length && !n.expanded) {
        n.expanded = true;
        changed = true;
      }
    });
    if (changed) {
      requestProjectTreeRefresh();
      commitProjectTreeExpandedState();
    }
    return true;
  }
  if (node.children) {
    for (const child of node.children) {
      if (expandTreePathToName(targetName, child, [...ancestors, node])) return true;
    }
  }
  return false;
}

export function expandProjectTreeToNode(target: TreeNode): boolean {
  const path = findNodePath(getProjectData(), target);
  if (!path || path.length < 2) return false;
  let changed = false;
  for (let i = 0; i < path.length - 1; i++) {
    if (path[i].children?.length && !path[i].expanded) {
      path[i].expanded = true;
      changed = true;
    }
  }
  if (changed) {
    requestProjectTreeRefresh();
    commitProjectTreeExpandedState();
  }
  return changed;
}

function findNodePath(root: TreeNode, target: TreeNode): TreeNode[] | null {
  if (root === target) return [root];
  for (const child of root.children ?? []) {
    const sub = findNodePath(child, target);
    if (sub) return [root, ...sub];
  }
  return null;
}

export function toggleTreeNodeExpanded(node: TreeNode): boolean {
  if (!node.children?.length) return false;
  node.expanded = !node.expanded;
  requestProjectTreeRefresh();
  if (node.name) setSelectedTreeName(node.name);
  commitProjectTreeExpandedState();
  return true;
}

export function getScrapFrameCount(): number {
  const deletedStoryboardFrames = getDeletedStoryboardFrames();
  return Array.isArray(deletedStoryboardFrames) ? deletedStoryboardFrames.length : 0;
}

export function handleTreeNodeSelect(node: TreeNode, sectionKey: string | null): void {
  emitTreeNodeSelect(treeNodeSelectDetail(node, sectionKey));
  if (typeof window.selectTreeNode === 'function') {
    window.selectTreeNode(null, node, sectionKey);
    return;
  }
  // Fallback path if global bridges are not yet attached.
  // Keeps tree clicks and initial default activation functional.
  selectWorkspaceTreeNode(null, node, sectionKey);
}

function resolveTreeNodeViewName(node: TreeNode): string {
  const requested = typeof node?.view === 'string' && node.view.trim() ? node.view : 'default';
  return SUPPORTED_TREE_VIEWS.has(requested) ? requested : 'default';
}

export function activateProjectTreeNode(name: string): boolean {
  expandTreePathToName(name);
  const node = findProjectNodeByName(name);
  if (!node) return false;
  requestProjectTreeRefresh();
  const sectionKey = getTreeSectionKeyForNode(node);
  void ensurePanelForView(resolveTreeNodeViewName(node)).then(() => {
    handleTreeNodeSelect(node, sectionKey);
  });
  return true;
}

export function getTreeSectionKeyForNode(node: TreeNode): string | null {
  if (!node) return null;
  const direct = sectionKeyForTopLevelName(node.name);
  if (direct) return direct;
  const projectData = getProjectData();
  for (const top of projectData.children ?? []) {
    if (top.type === 'tree-divider') continue;
    if (nodeContains(top, node)) return sectionKeyForTopLevelName(top.name);
  }
  return null;
}

function nodeContains(parent: TreeNode, target: TreeNode): boolean {
  if (parent === target) return true;
  for (const child of parent.children ?? []) {
    if (nodeContains(child, target)) return true;
  }
  return false;
}

export function refreshProjectTree(): void {
  ensureStoryboardReferenceNodes();
  ensureSceneShotListNodes();
  const activeId = activeProjectId || '';
  if (activeId && _treeUiRestoredForProjectId !== activeId) {
    restoreProjectTreeExpandedState(activeId);
    _treeUiRestoredForProjectId = activeId;
  }
  updateProjectTreeHeader();
  requestProjectTreeRefresh();
}

export function installProjectTreeGlobals(): void {
  window.renderFullTree = refreshProjectTree;
  window.updateProjectTreeHeader = updateProjectTreeHeader;
  window.refreshProjectTree = refreshProjectTree;
  window.setProjectTreeSelection = setSelectedTreeName;
  window.activateProjectTreeNode = activateProjectTreeNode;
  window.expandProjectTreeToNode = (node) =>
    expandProjectTreeToNode(node as TreeNode);
  window.getTreeSectionKeyForNode = (node) =>
    getTreeSectionKeyForNode(node as TreeNode);
  window.findProjectNodeByName = findProjectNodeByName;
}
