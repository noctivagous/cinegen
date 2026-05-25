import { registerKeybinding, handleKeydown } from '@/keybindings/keybinding-registry';
// import { toggleConsoleDrawer } from '@/console/console-service';
import { HIERARCHY_SECTIONS } from '@/tree/hierarchy-section-theme';
import { handleTreeNodeSelect } from '@/tree/project-tree-service';

function platformCombo(base: string): string {
  const isMac = navigator.platform.toLowerCase().includes('mac');
  return isMac ? base.replace('Ctrl', 'Cmd') : base;
}

function selectTreeSectionByName(name: string): void {
  const tree = document.querySelector('cinegen-project-tree');
  if (!tree) return;
  const el = (tree as HTMLElement).querySelector(`[data-name="${name}"]`);
  if (!el) return;
  (el as HTMLElement).click();
}

export function initKeybindings(): void {
  const sections = HIERARCHY_SECTIONS.map((s) => s.treeNames[0]);

  // registerKeybinding({
  //   id: 'console-toggle',
  //   combo: 'Alt+K',
  //   description: 'Toggle developer console',
  //   action: () => toggleConsoleDrawer(),
  //   allowInInput: true,
  // });

  for (let i = 0; i < sections.length; i++) {
    const name = sections[i];
    const num = i + 1;
    registerKeybinding({
      id: `section-${name}`,
      combo: platformCombo(`Ctrl+${num}`),
      description: `Select "${name}" tree section`,
      action: () => selectTreeSectionByName(name),
    });
  }

  registerKeybinding({
    id: 'open-projects',
    combo: platformCombo('Ctrl+O'),
    description: 'Open projects hub',
    action: () => window.openProjectsModal?.(),
  });

  registerKeybinding({
    id: 'save-project',
    combo: platformCombo('Ctrl+S'),
    description: 'Save project',
    action: () => window.saveProject?.(),
  });

  registerKeybinding({
    id: 'open-settings',
    combo: platformCombo('Ctrl+,'),
    description: 'Open settings',
    action: () => window.openSettingsModal?.(),
  });

  document.addEventListener('keydown', handleKeydown);
}

export function getSectionShortcutChip(name: string): string {
  const idx = HIERARCHY_SECTIONS.findIndex((s) => s.treeNames.includes(name));
  if (idx < 0) return '';
  const num = idx + 1;
  const isMac = navigator.platform.toLowerCase().includes('mac');
  return isMac ? `⌘${num}` : `Ctrl+${num}`;
}
