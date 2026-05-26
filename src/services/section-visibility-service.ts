/**
 * ── NOTE ──
 * Section visibility is a pure UI preference (checked/unchecked tree state).
 * It uses the abstracted storageService so it can be local or server-backed.
 * No sensitive data is stored here.
 * ─────────
 */

import type { TreeNode } from '@/tree/tree-types';
import { projectData } from '@/data/project-data';
import { storageService } from '@/services/persistence';
import { sectionKeyForTopLevelName } from '@/tree/hierarchy-section-theme';
import { SECTION_VISIBILITY_STORAGE_KEY } from '@/constants/storage-keys';

const STORAGE_KEY = SECTION_VISIBILITY_STORAGE_KEY;

export type SectionVisibilityMap = Record<string, Record<string, boolean>>;

let _cache: SectionVisibilityMap | null = null;

function loadMap(): SectionVisibilityMap {
  if (_cache) return _cache;
  try {
    const raw = storageService.getItem(STORAGE_KEY);
    if (raw) {
      _cache = JSON.parse(raw) as SectionVisibilityMap;
      return _cache;
    }
  } catch {
    /* noop */
  }
  _cache = {};
  return _cache;
}

function saveMap(): void {
  if (_cache) {
    storageService.setItem(STORAGE_KEY, JSON.stringify(_cache));
  }
}

export function getSectionVisibility(sectionKey: string): Record<string, boolean> {
  const map = loadMap();
  return { ...(map[sectionKey] || {}) };
}

export function setNodeVisibility(sectionKey: string, nodeId: string, visible: boolean): void {
  const map = loadMap();
  map[sectionKey] = map[sectionKey] || {};
  map[sectionKey][nodeId] = visible;
  saveMap();
}

export function isNodeVisible(sectionKey: string | null, nodeName: string): boolean {
  if (!sectionKey) return true;
  const map = loadMap();
  const section = map[sectionKey];
  if (!section) return true;
  return section[nodeName] !== false;
}

export function filterVisibleNodes(nodes: TreeNode[], sectionKey: string | null): TreeNode[] {
  if (!sectionKey) return nodes;
  const map = loadMap();
  const section = map[sectionKey];
  if (!section) return nodes;
  return nodes.filter((n) => section[n.name] !== false);
}

export function getCurrentSectionKey(): string | null {
  const container = document.getElementById('main-workspace-container');
  if (!container) return null;
  const match = Array.from(container.classList).find((c) => c.startsWith('workspace-section-'));
  return match ? match.replace('workspace-section-', '') : null;
}

export function getSectionRootNode(sectionKey: string | null): TreeNode | null {
  if (!sectionKey) return null;
  const children = (projectData.children ?? []) as TreeNode[];
  return (
    children.find((n) => {
      const key = _nameToKey(n.name);
      return key === sectionKey;
    }) || null
  );
}

function _nameToKey(name: string): string | null {
  return sectionKeyForTopLevelName(name);
}

export function buildCheckboxTreeNodes(sectionKey: string | null): import('@/components/primitives/cg-checkbox-tree').CheckboxTreeNode[] {
  const root = getSectionRootNode(sectionKey);
  if (!root || !root.children) return [];
  const vis = getSectionVisibility(sectionKey || '');

  function build(node: TreeNode): import('@/components/primitives/cg-checkbox-tree').CheckboxTreeNode {
    const children = (node.children || []).filter((c) => c.type !== 'tree-divider');
    return {
      id: node.name,
      label: node.name,
      checked: vis[node.name] !== false,
      children: children.length ? children.map(build) : undefined,
    };
  }

  return root.children
    .filter((c) => c.type !== 'tree-divider')
    .map(build);
}

export function installSectionVisibilityGlobals(): void {
  (window as unknown as Record<string, unknown>).getSectionVisibility = getSectionVisibility;
  (window as unknown as Record<string, unknown>).setNodeVisibility = setNodeVisibility;
  (window as unknown as Record<string, unknown>).isNodeVisible = isNodeVisible;
  (window as unknown as Record<string, unknown>).filterVisibleNodes = filterVisibleNodes;
  (window as unknown as Record<string, unknown>).getCurrentSectionKey = getCurrentSectionKey;
  (window as unknown as Record<string, unknown>).getSectionRootNode = getSectionRootNode;
  (window as unknown as Record<string, unknown>).buildCheckboxTreeNodes = buildCheckboxTreeNodes;
}
