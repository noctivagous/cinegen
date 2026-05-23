import { emitTreeNodeSelect, treeNodeSelectDetail } from '@/events/shell-events';
import type { TreeNode, TreeProjectRoot } from '@/tree/tree-types';
import { sectionKeyForTopLevelName } from '@/tree/tree-constants';
import { selectTreeNode as selectWorkspaceTreeNode } from '@/workspace/workspace-bundle';

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

export function setSelectedTreeName(name: string | null): void {
  _selectedName = name;
  requestProjectTreeRefresh();
  requestAnimationFrame(() => {
    document
      .querySelector('#project-tree .tree-item.selected')
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}

export function getProjectTreeChildren(): TreeNode[] {
  ensureStoryboardReferenceNodes();
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
  nameEl.className = 'truncate min-w-0';
  nameEl.textContent = projectData.name || 'UNTITLED';
  el.appendChild(nameEl);
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
    ancestors.forEach((n) => {
      if (n.children?.length) n.expanded = true;
    });
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
  if (changed) requestProjectTreeRefresh();
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

export function activateProjectTreeNode(name: string): boolean {
  expandTreePathToName(name);
  const node = findProjectNodeByName(name);
  if (!node) return false;
  requestProjectTreeRefresh();
  const sectionKey = getTreeSectionKeyForNode(node);
  queueMicrotask(() => handleTreeNodeSelect(node, sectionKey));
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
