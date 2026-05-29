import { registerKeybinding } from '@/keybindings/keybinding-registry';
import { formatShortcutLabel } from '@/keybindings/shortcut-display';
import { getProjectTreeChildren } from '@/tree/project-tree-service';
import { HIERARCHY_SECTIONS } from '@/tree/hierarchy-section-theme';

/** Modifier for section jumps (Production Office = Alt+1, …). */
export const HIERARCHY_SECTION_SHORTCUT_MODIFIER = 'Alt';

export function hierarchySectionShortcutCombo(sectionIndex: number): string {
  return `${HIERARCHY_SECTION_SHORTCUT_MODIFIER}+${sectionIndex + 1}`;
}

export function hierarchySectionIndexForName(name: string): number {
  return HIERARCHY_SECTIONS.findIndex((s) => s.treeNames.includes(name));
}

export function getHierarchySectionShortcutChip(sectionName: string): string {
  const idx = hierarchySectionIndexForName(sectionName);
  if (idx < 0) return '';
  return formatShortcutLabel(hierarchySectionShortcutCombo(idx));
}

function selectTreeSectionByName(name: string): void {
  const tree = document.querySelector('cinegen-project-tree');
  if (!tree) return;
  const el = (tree as HTMLElement).querySelector(`[data-name="${name}"]`);
  if (!el) return;
  (el as HTMLElement).click();
}

export function registerHierarchySectionKeybindings(): void {
  const sections = HIERARCHY_SECTIONS.map((s) => s.treeNames[0]);

  for (let i = 0; i < sections.length; i++) {
    const name = sections[i];
    registerKeybinding({
      id: `hierarchy-section-${HIERARCHY_SECTIONS[i].key}`,
      combo: hierarchySectionShortcutCombo(i),
      description: `Select "${name}" hierarchy section`,
      action: () => {
        const visible = getProjectTreeChildren().some((n) => n.name === name);
        if (!visible) return;
        selectTreeSectionByName(name);
      },
    });
  }
}
