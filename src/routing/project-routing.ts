/**
 * URL routing bridge between catalog node IDs and browser history.
 * Each view switch updates the URL; popstate navigates back/forward.
 */

import { switchView, updateWorkspaceSectionTheme } from '@/workspace/view-routing';
import {
  getProjectFeatureCatalog,
  flattenCatalogNodes,
  findCatalogNode,
  type FeatureCatalogNode,
} from '@/tree/project-feature-catalog';
import { TREE_SECTION_BY_NAME } from '@/tree/hierarchy-section-theme';

/* ── URL path ↔ catalog id helpers ────────────────────────────────────── */

/** Convert a slug to a URL path segment: "cinematography/shot-designer" → "/cinematography/shot-designer/" */
export function idToUrlPath(id: string): string {
  return `/${id}/`;
}

/** Convert a URL path back to a catalog id: "/cinematography/shot-designer/" → "cinematography/shot-designer" */
export function urlPathToId(path: string): string | null {
  const withoutQuery = path.replace(/\?.*$/, '').replace(/^\/+|\/+$/g, '');
  return withoutQuery || null;
}

/* ── View mode (query param v) ────────────────────────────────────────── */

const VIEW_MODE_PARAM = 'v';

const VIEW_MODE_MAP: Record<string, string> = {
  'grid-plus': 'column',
  'list': 'row',
  'browse': 'master',
};

const VIEW_MODE_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(VIEW_MODE_MAP).map(([k, v]) => [v, k])
);

export function getViewModeFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get(VIEW_MODE_PARAM);
  return raw ? (VIEW_MODE_MAP[raw] ?? null) : null;
}

export function buildViewModeQuery(viewMode: string): string {
  const key = VIEW_MODE_REVERSE[viewMode] ?? viewMode;
  return `?${VIEW_MODE_PARAM}=${key}`;
}

/* ── Section key from catalog node id ─────────────────────────────────── */

/** Extract the section key from a catalog node id by looking up the root node's display name. */
export function sectionKeyFromId(id: string): string | null {
  const rootSegment = id.split('/')[0];
  const catalog = getProjectFeatureCatalog();
  const rootNode = findCatalogNode(rootSegment, catalog);
  if (!rootNode) return null;
  return TREE_SECTION_BY_NAME[rootNode.name] ?? null;
}

/* ── URL building ─────────────────────────────────────────────────────── */

export function buildUrlForNode(node: FeatureCatalogNode, viewMode?: string): string {
  let url = idToUrlPath(node.id);
  if (viewMode) url += buildViewModeQuery(viewMode);
  return url;
}

/* ── Prevent URL sync during popstate back/forward ───────────────────── */

let _skipUrlSync = false;

/* ── Find catalog node by view name + section key + optional label ────── */

function findCatalogNodeByViewAndSection(
  viewName: string,
  sectionKey: string | null,
  label?: string
): FeatureCatalogNode | null {
  const catalog = getProjectFeatureCatalog();
  const all = flattenCatalogNodes(catalog);

  // Prefer an exact name match when label is provided
  if (label) {
    const exact = all.find((n) => n.view === viewName && n.name === label);
    if (exact) return exact;
  }

  // Fall back to view + section matching
  for (const node of all) {
    if (node.view === viewName) {
      if (!sectionKey) return node;
      const nodeSection = sectionKeyFromId(node.id);
      if (nodeSection === sectionKey) return node;
    }
  }
  return null;
}

/* ── View mode setter (used after switchView resolves) ────────────────── */

function setViewModeFromUrl(): void {
  const viewMode = getViewModeFromUrl();
  if (!viewMode) return;
  const w = window as any;
  if (typeof w.setOverviewViewMode === 'function') {
    w.setOverviewViewMode(viewMode);
  }
}

/* ── Sync URL after view switch ──────────────────────────────────────── */

export function syncUrlFromView(
  viewName: string,
  label: string,
  sectionKey: string | null
): void {
  if (_skipUrlSync) return;

  const node = findCatalogNodeByViewAndSection(viewName, sectionKey, label);

  let url: string;
  let state: Record<string, unknown>;

  if (node) {
    url = idToUrlPath(node.id);
    state = { view: viewName, nodeId: node.id, sectionKey, label };
  } else {
    // Fallback for dynamic/uncatalogued views
    const slug = label
      ? label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      : viewName;
    url = `/${slug}/`;
    state = { view: viewName, label, sectionKey };
  }

  history.replaceState(state, '', url);
}

/* ── Popstate handler (back/forward) ──────────────────────────────────── */

function handlePopState(e: PopStateEvent): void {
  _skipUrlSync = true;
  try {
    const state = e.state;

    if (state?.view) {
      switchView(state.view as string, (state.label as string) || '', (state.sectionKey as string) || null).finally(() => {
        _skipUrlSync = false;
      });
      return;
    }

    const path = urlPathToId(window.location.pathname);
    if (!path) return;

    const node = findCatalogNode(path);
    if (!node) return;

    const sectionKey = sectionKeyFromId(path);
    switchView(node.view || 'overview', node.name, sectionKey).finally(() => {
      _skipUrlSync = false;
      setViewModeFromUrl();
    });
  } finally {
    // Ensure _skipUrlSync is reset even on early returns or errors
    if (_skipUrlSync) _skipUrlSync = false;
  }
}

/* ── Deep linking on page load ────────────────────────────────────────── */

export async function initRouting(): Promise<void> {
  window.addEventListener('popstate', handlePopState);

  const path = urlPathToId(window.location.pathname);
  if (!path || window.location.pathname === '/') return;

  const node = findCatalogNode(path);
  if (!node) return;

  const sectionKey = sectionKeyFromId(path);
  await switchView(node.view || 'overview', node.name, sectionKey);
  setViewModeFromUrl();
}

/* ── Programmatic navigation ──────────────────────────────────────────── */

export function navigateById(nodeId: string, label?: string): void {
  const node = findCatalogNode(nodeId, getProjectFeatureCatalog());
  if (!node) return;

  const sectionKey = sectionKeyFromId(nodeId);
  const url = buildUrlForNode(node);

  history.pushState({ view: node.view, nodeId, sectionKey, label: label || node.name }, '', url);
  switchView(node.view || 'overview', label || node.name, sectionKey).then(() => {
    setViewModeFromUrl();
  });
}