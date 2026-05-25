import { handleKeydown } from '@/keybindings/keybinding-registry';
import { registerHierarchySectionKeybindings } from '@/keybindings/hierarchy-keybindings';
import { registerPrevisTimelineKeybinding } from '@/keybindings/previs-keybindings';
import { registerKeybinding } from '@/keybindings/keybinding-registry';

export {
  getHierarchySectionShortcutChip,
  hierarchySectionShortcutCombo,
  HIERARCHY_SECTION_SHORTCUT_MODIFIER,
} from '@/keybindings/hierarchy-keybindings';

export {
  getPrevisTimelineShortcutChip,
  PREVIS_TIMELINE_TOGGLE_COMBO,
} from '@/keybindings/previs-keybindings';

export { formatShortcutLabel, isMacPlatform } from '@/keybindings/shortcut-display';

/** @deprecated Use `getHierarchySectionShortcutChip` */
export { getHierarchySectionShortcutChip as getSectionShortcutChip } from '@/keybindings/hierarchy-keybindings';

function platformCmdCombo(base: string): string {
  const isMac = navigator.platform.toLowerCase().includes('mac');
  return isMac ? base.replace('Ctrl', 'Cmd') : base;
}

export function initKeybindings(): void {
  registerHierarchySectionKeybindings();
  registerPrevisTimelineKeybinding();

  registerKeybinding({
    id: 'open-projects',
    combo: platformCmdCombo('Ctrl+O'),
    description: 'Open projects hub',
    action: () => window.openProjectsModal?.(),
  });

  registerKeybinding({
    id: 'save-project',
    combo: platformCmdCombo('Ctrl+S'),
    description: 'Save project',
    action: () => window.saveProject?.(),
  });

  registerKeybinding({
    id: 'open-settings',
    combo: platformCmdCombo('Ctrl+,'),
    description: 'Open settings',
    action: () => window.openSettingsModal?.(),
  });

  document.addEventListener('keydown', handleKeydown);
}
