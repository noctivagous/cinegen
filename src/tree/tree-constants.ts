/** Top-level sidebar sections → color theme key (see .tree-section-* in CSS). */
export const TREE_SECTION_BY_NAME: Record<string, string> = {
  'Pre-Production': 'preprod',
  'Production Design': 'design',
  'Sound Department': 'sound',
  Scenes: 'scenes',
  Assembly: 'assembly',
  'Global Assets': 'global',
};

export function sectionKeyForTopLevelName(name: string): string | null {
  return TREE_SECTION_BY_NAME[name] ?? null;
}
