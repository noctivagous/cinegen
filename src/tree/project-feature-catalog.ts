/**
 * Canonical static project hierarchy for the Features modal and display-tree builder.
 * Dynamic nodes (scene instances, mood board items) are merged at runtime — not listed here.
 */

import type { TreeNode } from '@/tree/tree-types';

export interface FeatureCatalogNode {
  id: string;
  name: string;
  type: string;
  icon?: string;
  view?: string;
  preprodMode?: string;
  detailKey?: string;
  clSection?: string;
  desc?: string;
  /** When true, children come from runtime project state (scenes folder). */
  dynamicChildren?: boolean;
  children?: FeatureCatalogNode[];
}

function slugSegment(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

type RawNode = Record<string, unknown>;

function isSceneInstance(node: RawNode): boolean {
  return node.type === 'scene' && typeof node.sceneId === 'string';
}

function catalogFromRaw(node: RawNode, parentPath: string): FeatureCatalogNode | null {
  if (node.type === 'tree-divider') return null;

  const name = typeof node.name === 'string' ? node.name : '';
  const segment =
    node.type === 'group'
      ? 'group'
      : name
        ? slugSegment(name)
        : 'node';
  const id = parentPath ? `${parentPath}/${segment}` : segment;

  if (isSceneInstance(node)) {
    return null;
  }

  const out: FeatureCatalogNode = {
    id,
    name: name || (node.type === 'group' ? 'Group' : 'Untitled'),
    type: String(node.type || 'folder'),
  };

  if (typeof node.icon === 'string') out.icon = node.icon;
  if (typeof node.view === 'string') out.view = node.view;
  if (typeof node.preprodMode === 'string') out.preprodMode = node.preprodMode;
  if (typeof node.detailKey === 'string') out.detailKey = node.detailKey;
  if (typeof node.clSection === 'string') out.clSection = node.clSection;
  if (typeof node.desc === 'string') out.desc = node.desc;

  const rawChildren = Array.isArray(node.children) ? (node.children as RawNode[]) : [];
  const childPath = node.type === 'group' ? parentPath : id;

  if (node.dynamicChildren === true) {
    out.dynamicChildren = true;
    out.children = [];
    return out;
  }

  const children = catalogChildrenFromRaw(rawChildren, childPath || id);
  if (children.length) out.children = children;

  return out;
}

function catalogChildrenFromRaw(rawChildren: RawNode[], parentPath: string): FeatureCatalogNode[] {
  const children: FeatureCatalogNode[] = [];
  for (const child of rawChildren) {
    if (child.type === 'group') {
      const inner = Array.isArray(child.children) ? (child.children as RawNode[]) : [];
      children.push(...catalogChildrenFromRaw(inner, parentPath));
      continue;
    }
    const built = catalogFromRaw(child, parentPath);
    if (built) children.push(built);
  }
  return children;
}

const ascensionTreeRaw = import.meta.glob(
  '../data/project-files/ascension-stream.cine/project-tree.cinetree',
  { query: '?raw', import: 'default', eager: true }
) as Record<string, string>;

function parseAscensionCatalog(): FeatureCatalogNode[] {
  try {
    const raw = Object.values(ascensionTreeRaw)[0] ?? '{}';
    const root = JSON.parse(raw) as RawNode;
    const kids = Array.isArray(root.children) ? (root.children as RawNode[]) : [];
    const catalog: FeatureCatalogNode[] = [];
    for (const child of kids) {
      const built = catalogFromRaw(child, '');
      if (built) catalog.push(built);
    }
    return catalog;
  } catch {
    return [];
  }
}

const BEATBOARD_CATALOG: FeatureCatalogNode = {
  id: 'studio-space/beatboard',
  name: 'Beatboard',
  type: 'folder',
  icon: 'fa-clapperboard',
  view: 'beat-board',
  desc: 'Beat-based storyboarding and scene planning',
};

let _catalog: FeatureCatalogNode[] | null = null;

export function getProjectFeatureCatalog(): FeatureCatalogNode[] {
  if (!_catalog) {
    const fromSample = parseAscensionCatalog();
    const withoutScenes = fromSample.filter((n) => n.id !== 'scenes' && n.id !== 'studio-space');
    const scenes = fromSample.find((n) => n.id === 'scenes') ?? {
      id: 'scenes',
      name: 'Scenes',
      type: 'folder',
      icon: 'fa-video',
      view: 'overview',
      dynamicChildren: true,
      children: [],
    };
    const studioSpace = fromSample.find((n) => n.id === 'studio-space') ?? {
      id: 'studio-space',
      name: 'Studio Space',
      type: 'studio-group',
      icon: 'fa-wand-magic-sparkles',
      children: [
        {
          id: 'studio-space/global-assets',
          name: 'Global Assets',
          type: 'folder',
          icon: 'fa-cube',
          view: 'overview',
          children: [],
        },
        {
          id: 'studio-space/mood-boards',
          name: 'Mood Boards',
          type: 'folder',
          icon: 'fa-images',
          view: 'moodboards',
          desc: 'Visual DNA, reference stills, and mood research',
          dynamicChildren: true,
          children: [],
        },
        {
          id: 'studio-space/scratchpad',
          name: 'ScratchPad',
          type: 'folder',
          icon: 'fa-pen-fancy',
          view: 'scratchpad',
          desc: 'Generative scratch surface — free-form ideation and prompt experiments',
        },
        {
          id: 'studio-space/drafts',
          name: 'Drafts',
          type: 'folder',
          icon: 'fa-flask',
          view: 'drafts',
          desc: 'Generative sketchbook — experiment freely, promote to shots, boards, or references',
        },
        BEATBOARD_CATALOG,
      ],
    };
    _catalog = [...withoutScenes, studioSpace, scenes];
  }
  return _catalog;
}

export function flattenCatalogNodes(nodes: FeatureCatalogNode[] = getProjectFeatureCatalog()): FeatureCatalogNode[] {
  const out: FeatureCatalogNode[] = [];
  const walk = (list: FeatureCatalogNode[]) => {
    for (const n of list) {
      out.push(n);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

export function flattenCatalogIds(nodes: FeatureCatalogNode[] = getProjectFeatureCatalog()): string[] {
  const out: string[] = [];
  const walk = (list: FeatureCatalogNode[]) => {
    for (const n of list) {
      out.push(n.id);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

export function findCatalogNode(id: string, nodes: FeatureCatalogNode[] = getProjectFeatureCatalog()): FeatureCatalogNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) {
      const found = findCatalogNode(id, n.children);
      if (found) return found;
    }
  }
  return null;
}

export function catalogNodeToTreeNode(node: FeatureCatalogNode, expanded = false): TreeNode {
  const tree: TreeNode = {
    name: node.name,
    type: node.type,
    icon: node.icon,
    view: node.view,
    preprodMode: node.preprodMode,
    detailKey: node.detailKey,
    clSection: node.clSection,
    desc: node.desc,
    expanded,
    featureId: node.id,
  };
  if (node.children?.length && !node.dynamicChildren) {
    tree.children = node.children.map((c) => catalogNodeToTreeNode(c, false));
  } else {
    tree.children = [];
  }
  return tree;
}

/** Default blank-project features: Studio Space group + mood boards + scratchpad + drafts. */
export const BLANK_PROJECT_ENABLED_IDS = new Set([
  'studio-space',
  'studio-space/mood-boards',
  'studio-space/scratchpad',
  'studio-space/drafts',
]);

export function buildBlankProjectFeaturesOrder(): string[] {
  return ['studio-space', 'studio-space/mood-boards', 'studio-space/scratchpad', 'studio-space/drafts'];
}

export function buildAllEnabledFeaturesConfig(): { version: 1; enabled: Record<string, boolean>; order: string[] } {
  const order = flattenCatalogIds();
  const enabled: Record<string, boolean> = {};
  for (const id of order) enabled[id] = true;
  return { version: 1, enabled, order };
}

export function buildBlankProjectFeaturesConfig(): { version: 1; enabled: Record<string, boolean>; order: string[] } {
  const order = flattenCatalogIds();
  const enabled: Record<string, boolean> = {};
  for (const id of order) {
    enabled[id] = BLANK_PROJECT_ENABLED_IDS.has(id);
  }
  return { version: 1, enabled, order };
}
