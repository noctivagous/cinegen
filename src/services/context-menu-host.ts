import type { CgContextMenu } from '@/components/primitives/cg-context-menu';

export function getChipContextMenu(): CgContextMenu | null {
  return document.querySelector<CgContextMenu>('#chip-context-menu');
}

export function getStoryboardContextMenu(): CgContextMenu | null {
  return document.querySelector<CgContextMenu>('#storyboard-context-menu');
}

export function getScriptContextMenu(): CgContextMenu | null {
  return document.querySelector<CgContextMenu>('#script-context-menu');
}

export function closeAllContextMenus(): void {
  getChipContextMenu()?.close();
  getStoryboardContextMenu()?.close();
  getScriptContextMenu()?.close();
}
