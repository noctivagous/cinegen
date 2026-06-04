/**
 * Per-project feature visibility and hierarchy order for the sidebar tree.
 */

import { activeProjectId, projectData } from '@/data/project-data';
import {
  BLANK_PROJECT_ENABLED_IDS,
  buildAllEnabledFeaturesConfig,
  buildBlankProjectFeaturesConfig,
  catalogNodeToTreeNode,
  findCatalogNode,
  flattenCatalogIds,
  flattenCatalogNodes,
  getProjectFeatureCatalog,
  type FeatureCatalogNode,
} from '@/tree/project-feature-catalog';
import type { TreeNode, TreeProjectRoot } from '@/tree/tree-types';
import type { CheckboxTreeNode } from '@/components/primitives/cg-checkbox-tree';
import type { FeatureTreeNode } from '@/components/primitives/cg-feature-tree';

export type ProjectFeaturesConfig = {
  version: 1;
  enabled: Record<string, boolean>;
  /** Depth-first catalog feature ids (sibling order + structure from catalog parent links). */
  order: string[];
  /** Sidebar folder expanded state keyed by feature id. */
  expanded?: Record<string, boolean>;
  /** Optional reparent overrides from the Features modal (child id → parent id, null = root). */
  parentById?: Record<string, string | null>;
};

let _runtimeConfig: ProjectFeaturesConfig | null = null;

export function getProjectFeaturesConfig(): ProjectFeaturesConfig {
  if (_runtimeConfig) return _runtimeConfig;
  const fromProject = (projectData as { projectFeatures?: ProjectFeaturesConfig }).projectFeatures;
  if (fromProject?.version === 1 && Array.isArray(fromProject.order)) {
    _runtimeConfig = normalizeProjectFeaturesConfig(fromProject);
    return _runtimeConfig;
  }
  _runtimeConfig = inferConfigFromProjectTree();
  return _runtimeConfig;
}

export function setProjectFeaturesConfig(
  config: ProjectFeaturesConfig,
  opts?: { persist?: boolean }
): void {
  _runtimeConfig = normalizeProjectFeaturesConfig(config);
  (projectData as { projectFeatures?: ProjectFeaturesConfig }).projectFeatures =
    structuredClone(_runtimeConfig);
  if (opts?.persist === false) return;
  void import('@/services/project-service').then(({ persistActiveProjectSnapshot, markProjectDirty }) => {
    markProjectDirty(['features']);
    persistActiveProjectSnapshot(activeProjectId);
  });
}

export function resetProjectFeaturesConfigCache(): void {
  _runtimeConfig = null;
}

/** Apply features from a loaded snapshot and refresh the sidebar tree when requested. */
export function applyProjectFeaturesFromSnapshot(
  applied: {
    projectData?: Record<string, unknown>;
    projectFeatures?: ProjectFeaturesConfig;
  },
  opts?: { refreshTree?: boolean }
): void {
  resetProjectFeaturesConfigCache();
  setProjectFeaturesConfig(normalizeConfigForProject(applied), { persist: false });
  if (opts?.refreshTree !== false && typeof window.refreshProjectTree === 'function') {
    window.refreshProjectTree();
  }
}

export function normalizeProjectFeaturesConfig(raw: ProjectFeaturesConfig): ProjectFeaturesConfig {
  const allIds = flattenCatalogIds();
  const idSet = new Set(allIds);
  const order: string[] = [];
  for (const id of raw.order ?? []) {
    if (idSet.has(id) && !order.includes(id)) order.push(id);
  }
  for (const id of allIds) {
    if (!order.includes(id)) order.push(id);
  }
  const enabled: Record<string, boolean> = {};
  for (const id of allIds) {
    enabled[id] = raw.enabled?.[id] !== false;
  }
  return {
    version: 1,
    enabled,
    order,
    expanded: raw.expanded ? { ...raw.expanded } : undefined,
    parentById: raw.parentById ? { ...raw.parentById } : undefined,
  };
}

function inferConfigFromProjectTree(): ProjectFeaturesConfig {
  const children = (projectData.children ?? []) as TreeNode[];
  if (!children.length) {
    return buildBlankProjectFeaturesConfig();
  }
  const config = buildAllEnabledFeaturesConfig();
  config.order = orderFromRuntimeTree(children, getProjectFeatureCatalog());
  return config;
}

function orderFromRuntimeTree(
  runtimeChildren: TreeNode[],
  catalog: FeatureCatalogNode[],
  parentPath = ''
): string[] {
  const out: string[] = [];
  const catalogByName = new Map<string, FeatureCatalogNode>();

  const indexCatalog = (nodes: FeatureCatalogNode[], path: string) => {
    for (const n of nodes) {
      catalogByName.set(`${path}\0${n.name}`, n);
      if (n.children?.length) indexCatalog(n.children, n.id);
    }
  };
  indexCatalog(catalog, '');

  const walkRuntime = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      if (node.type === 'tree-divider') continue;
      const key = `${parentPath}\0${node.name}`;
      const cat = catalogByName.get(key) ?? findCatalogByName(node.name, catalog);
      if (cat) out.push(cat.id);
      if (node.children?.length && node.type !== 'scene' && node.type !== 'moodboard') {
        walkRuntime(node.children);
      }
    }
  };
  walkRuntime(runtimeChildren);

  const allIds = flattenCatalogIds();
  for (const id of allIds) {
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

function findCatalogByName(name: string, nodes: FeatureCatalogNode[]): FeatureCatalogNode | null {
  for (const n of nodes) {
    if (n.name === name) return n;
    if (n.children) {
      const found = findCatalogByName(name, n.children);
      if (found) return found;
    }
  }
  return null;
}

export function defaultParentId(id: string): string | null {
  const slash = id.lastIndexOf('/');
  if (slash <= 0) return null;
  const parent = id.slice(0, slash);
  if (findCatalogNode(parent)) return parent;
  return defaultParentId(parent);
}

export function effectiveParentId(id: string, config: ProjectFeaturesConfig): string | null {
  if (config.parentById && id in config.parentById) {
    return config.parentById[id] ?? null;
  }
  return defaultParentId(id);
}

export function isFeatureEnabled(id: string, config = getProjectFeaturesConfig()): boolean {
  if (config.enabled[id] === false) return false;
  let parent = effectiveParentId(id, config);
  while (parent) {
    if (config.enabled[parent] === false) return false;
    parent = effectiveParentId(parent, config);
  }
  return true;
}

function siblingSortIndex(id: string, order: string[]): number {
  const i = order.indexOf(id);
  return i >= 0 ? i : Number.MAX_SAFE_INTEGER;
}

function getCatalogChildren(parentId: string | null, config: ProjectFeaturesConfig): FeatureCatalogNode[] {
  const all = flattenCatalogNodes();
  return all.filter((n) => effectiveParentId(n.id, config) === parentId);
}

function buildCatalogTreeNodes(config: ProjectFeaturesConfig): TreeNode[] {
  const order = config.order;
  const expandedMap = config.expanded ?? {};

  const buildLevel = (parentId: string | null): TreeNode[] => {
    const nodes = getCatalogChildren(parentId, config);
    const sorted = [...nodes].sort(
      (a, b) => siblingSortIndex(a.id, order) - siblingSortIndex(b.id, order)
    );
    const out: TreeNode[] = [];
    for (const cat of sorted) {
      if (!isFeatureEnabled(cat.id, config)) continue;
      const expanded = expandedMap[cat.id] ?? (cat.type === 'studio-group');
      const tree = catalogNodeToTreeNode(cat, expanded);
      if (cat.dynamicChildren) {
        tree.children = [];
      } else if (cat.children?.length) {
        tree.children = buildLevel(cat.id);
      }
      out.push(tree);
    }
    return out;
  };

  return buildLevel(null);
}

export function setFeatureExpanded(featureId: string, expanded: boolean): void {
  const config = getProjectFeaturesConfig();
  const next = { ...config, expanded: { ...(config.expanded ?? {}), [featureId]: expanded } };
  setProjectFeaturesConfig(next);
}

function findNodeByNameRecursive(nodes: TreeNode[], name: string): TreeNode | null {
  for (const node of nodes) {
    if (node.name === name) return node;
    if (node.children?.length) {
      const found = findNodeByNameRecursive(node.children, name);
      if (found) return found;
    }
  }
  return null;
}

/** Merge runtime dynamic nodes (mood boards, scenes) into display tree. */
export function mergeDynamicTreeNodes(displayTree: TreeNode[]): TreeNode[] {
  const runtimeRoot = projectData;
  const runtimeChildren = (runtimeRoot.children ?? []) as TreeNode[];

  const runtimeMood = findNodeByNameRecursive(runtimeChildren, 'Mood Boards');
  const runtimeScenes = findScenesFolder(runtimeChildren);

  const mergeInto = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      if (node.name === 'Mood Boards' && runtimeMood?.children?.length) {
        node.children = structuredClone(runtimeMood.children) as TreeNode[];
      }
      if (node.name === 'Scenes' && runtimeScenes) {
        const sceneNodes = (runtimeScenes.children ?? []).filter((c) => c.type === 'scene');
        if (sceneNodes.length) {
          node.children = structuredClone(sceneNodes) as TreeNode[];
        }
      }
      if (node.children?.length) mergeInto(node.children);
    }
  };

  const out = structuredClone(displayTree) as TreeNode[];
  mergeInto(out);
  return out;
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

/** Sidebar / grid source: catalog + features + dynamic children. */
export function buildDisplayProjectTree(): TreeNode[] {
  const config = getProjectFeaturesConfig();
  const staticTree = buildCatalogTreeNodes(config);
  return mergeDynamicTreeNodes(staticTree);
}

export function getDisplayTreeRoot(): TreeProjectRoot {
  const data = projectData as TreeProjectRoot;
  return {
    name: data.name || 'Project',
    type: 'project',
    icon: data.icon,
    children: buildDisplayProjectTree(),
  };
}

export function configFromFeatureTreeNodes(
  nodes: FeatureTreeNode[],
  order: string[]
): ProjectFeaturesConfig {
  const enabled: Record<string, boolean> = {};
  const parentById: Record<string, string | null> = {};
  const walk = (list: FeatureTreeNode[], parentId: string | null) => {
    for (const n of list) {
      enabled[n.id] = n.checked !== false;
      parentById[n.id] = parentId;
      if (n.children?.length) walk(n.children, n.id);
    }
  };
  walk(nodes, null);
  const allIds = flattenCatalogIds();
  for (const id of allIds) {
    if (!(id in enabled)) enabled[id] = false;
  }
  return normalizeProjectFeaturesConfig({ version: 1, enabled, order, parentById });
}

export function buildFeatureTreeForModal(config = getProjectFeaturesConfig()): FeatureTreeNode[] {
  const order = config.order;

  const buildLevel = (parentId: string | null): FeatureTreeNode[] => {
    const nodes = getCatalogChildren(parentId, config);
    const sorted = [...nodes].sort(
      (a, b) => siblingSortIndex(a.id, order) - siblingSortIndex(b.id, order)
    );
    return sorted.map((cat) => ({
      id: cat.id,
      label: cat.name,
      checked: config.enabled[cat.id] !== false,
      icon: cat.icon,
      children: cat.children?.length || cat.dynamicChildren ? buildLevel(cat.id) : undefined,
    }));
  };

  return buildLevel(null);
}

export function flattenFeatureTreeOrder(nodes: FeatureTreeNode[]): string[] {
  const out: string[] = [];
  const walk = (list: FeatureTreeNode[]) => {
    for (const n of list) {
      out.push(n.id);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
  const allIds = flattenCatalogIds();
  for (const id of allIds) {
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

export function normalizeConfigForProject(applied: {
  projectData?: Record<string, unknown>;
  projectFeatures?: ProjectFeaturesConfig;
}): ProjectFeaturesConfig {
  if (applied.projectFeatures?.version === 1) {
    const config = normalizeProjectFeaturesConfig(applied.projectFeatures);
    // If the saved config is the blank default but the project has actual tree
    // children, infer enabled features from the tree so existing content is visible.
    const isBlankDefault = Object.entries(config.enabled).every(
      ([id, v]) => v === BLANK_PROJECT_ENABLED_IDS.has(id)
    );
    const hasTreeChildren = ((applied.projectData?.children ?? []) as TreeNode[]).length > 0;
    if (!isBlankDefault || !hasTreeChildren) return config;
    // Fall through to tree inference
  }
  const children = (applied.projectData?.children ?? []) as TreeNode[];
  if (!children.length) return buildBlankProjectFeaturesConfig();
  const config = buildAllEnabledFeaturesConfig();
  config.order = orderFromRuntimeTree(children, getProjectFeatureCatalog());
  return config;
}

function findNodeByNameInTree(nodes: TreeNode[], name: string): TreeNode | null {
  for (const n of nodes) {
    if (n.name === name) return n;
    if (n.children?.length) {
      const found = findNodeByNameInTree(n.children, name);
      if (found) return found;
    }
  }
  return null;
}

export function getFirstEnabledTreeNodeName(): string | null {
  const tree = buildDisplayProjectTree();
  const findFirst = (nodes: TreeNode[]): TreeNode | null => {
    for (const n of nodes) {
      if (n.type === 'tree-divider') continue;
      if (n.type === 'folder' || n.type === 'studio-group' || n.type === 'moodboard' || n.type === 'script') return n;
      if (n.children?.length) {
        const inner = findFirst(n.children);
        if (inner) return inner;
      }
      if (n.view && n.view !== 'overview') return n;
    }
    return nodes[0] ?? null;
  };
  const node = findFirst(tree);
  if (!node) return null;
  if (node.type === 'moodboard' || node.name === 'Mood Boards') {
    const mb = findNodeByNameInTree(tree, 'Mood Boards');
    const board = mb?.children?.find((c) => c.type === 'moodboard');
    return board?.name ?? mb?.name ?? node.name;
  }
  return node.name;
}

/** Enable a catalog branch (node + descendants) — for wizards hydrating departments. */
export function enableFeatureBranch(rootId: string, opts?: { persist?: boolean }): void {
  const config = getProjectFeaturesConfig();
  const prefix = rootId ? `${rootId}/` : '';
  for (const id of flattenCatalogIds()) {
    if (id === rootId || id.startsWith(prefix)) {
      config.enabled[id] = true;
      let parent = effectiveParentId(id, config);
      while (parent) {
        config.enabled[parent] = true;
        parent = effectiveParentId(parent, config);
      }
    }
  }
  setProjectFeaturesConfig(config, opts);
}

export function rerouteSelectionIfDisabled(): boolean {
  const selected = (window as unknown as { getSelectedTreeName?: () => string | null }).getSelectedTreeName?.();
  if (!selected) return false;
  const { findProjectNodeByName } = window as unknown as {
    findProjectNodeByName?: (name: string) => TreeNode | null;
  };
  if (findProjectNodeByName?.(selected)) return false;
  const fallback = getFirstEnabledTreeNodeName();
  if (!fallback) return false;
  window.activateProjectTreeNode?.(fallback);
  return true;
}

/** Legacy checkbox tree shape for tests. */
export function buildCatalogCheckboxTree(config = getProjectFeaturesConfig()): CheckboxTreeNode[] {
  return buildFeatureTreeForModal(config).map((n) => featureToCheckbox(n));
}

function featureToCheckbox(n: FeatureTreeNode): CheckboxTreeNode {
  return {
    id: n.id,
    label: n.label,
    checked: n.checked,
    children: n.children?.map(featureToCheckbox),
  };
}
