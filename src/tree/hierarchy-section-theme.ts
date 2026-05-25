/**
 * Single source of truth for project-hierarchy section colors and name → key mapping.
 * Injected onto :root as --tree-section-{key} / --tree-section-{key}-item at boot.
 * CSS uses those variables for tree depth tones, grid tiles, workspace headers, and overview cards.
 */

export interface HierarchySectionTheme {
  /** Stable id used in CSS classes (tree-section-*, workspace-section-*, overview-card--section-*) */
  key: string;
  /** L0 — top-level folder / grid tile label */
  header: string;
  /** L1 — direct children; deeper levels darken via --tree-depth-mix-* in CSS */
  item: string;
  /** Tree folder display names that resolve to this section */
  treeNames: string[];
}

/** Display order for shortcuts (Ctrl/Cmd+1…n) and grid layout */
export const HIERARCHY_SECTIONS: HierarchySectionTheme[] = [
  {
    key: 'preprod',
    header: '#b8d8f4',
    item: '#8eb8dc',
    treeNames: ['Production Office', 'Pre-Production'],
  },
  {
    key: 'cinematography',
    header: '#f4b8b8',
    item: '#dc8e8e',
    treeNames: ['Cinematography'],
  },
  {
    key: 'design',
    header: '#f0c898',
    item: '#d4a870',
    treeNames: ['Production Design'],
  },
  {
    key: 'casting',
    header: '#e8c0d8',
    item: '#c898b8',
    treeNames: ['Casting'],
  },
  {
    key: 'sound',
    header: '#d4b8f0',
    item: '#b098d8',
    treeNames: ['Sound Department'],
  },
  {
    key: 'post',
    header: '#f0a8b0',
    item: '#d88898',
    treeNames: ['Post Production', 'Assembly'],
  },
  {
    key: 'ai-director',
    header: '#a8b8d8',
    item: '#7a8cb8',
    treeNames: ['AI Director'],
  },
  {
    key: 'scenes',
    header: '#98e0b8',
    item: '#78c098',
    treeNames: ['Scenes'],
  },
  {
    key: 'global',
    header: '#b0b0b0',
    item: '#909090',
    treeNames: ['Global Assets'],
  },
];

export const HIERARCHY_SECTION_KEYS = HIERARCHY_SECTIONS.map((s) => s.key);

/** Top-level sidebar folder name → section key */
export const TREE_SECTION_BY_NAME: Record<string, string> = Object.fromEntries(
  HIERARCHY_SECTIONS.flatMap((s) => s.treeNames.map((name) => [name, s.key] as const))
);

export const WORKSPACE_SECTION_CLASSES = HIERARCHY_SECTION_KEYS.map(
  (key) => `workspace-section-${key}`
);

export function sectionKeyForTopLevelName(name: string): string | null {
  return TREE_SECTION_BY_NAME[name] ?? null;
}

export function hierarchySectionByKey(key: string): HierarchySectionTheme | undefined {
  return HIERARCHY_SECTIONS.find((s) => s.key === key);
}

/** Apply --tree-section-* custom properties on :root (and legacy --tree-section-assembly → post). */
export function applyHierarchySectionCssVars(doc: Document = document): void {
  const root = doc.documentElement;
  for (const s of HIERARCHY_SECTIONS) {
    root.style.setProperty(`--tree-section-${s.key}`, s.header);
    root.style.setProperty(`--tree-section-${s.key}-item`, s.item);
  }
  const post = hierarchySectionByKey('post');
  if (post) {
    root.style.setProperty('--tree-section-assembly', post.header);
    root.style.setProperty('--tree-section-assembly-item', post.item);
  }
}
