import type { CgToolbarSplit } from '@/components/primitives/cg-toolbar-split';

export const TOOLBAR_SPLIT_IDS = [
  'projects-split',
  'guide-split',
  'import-split',
  'save-export-split',
  'settings-split',
  'ai-assist-split',
  'script-import-export-split',
  'script-fountain-insert-split',
] as const;

export type ToolbarSplitId = (typeof TOOLBAR_SPLIT_IDS)[number];

const TOOLBAR_SPLIT_PAD = 8;

type MenuOpenHandler = (splitId: string) => void;
const _menuOpenHandlers: MenuOpenHandler[] = [];

export function onToolbarSplitMenuOpen(handler: MenuOpenHandler): void {
  _menuOpenHandlers.push(handler);
}

export function notifyToolbarSplitMenuOpen(splitId: string): void {
  _menuOpenHandlers.forEach((h) => h(splitId));
}

function getSplitEl(splitId: string): HTMLElement | null {
  return document.getElementById(splitId);
}

function getMenuEl(menuId: string): HTMLElement | null {
  return document.getElementById(menuId);
}

export function positionToolbarSplitMenu(splitEl: HTMLElement, menuEl: HTMLElement): void {
  menuEl.style.position = 'fixed';
  menuEl.style.visibility = 'hidden';
  menuEl.style.pointerEvents = 'none';

  const splitRect = splitEl.getBoundingClientRect();
  const menuRect = menuEl.getBoundingClientRect();
  const pad = TOOLBAR_SPLIT_PAD;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxH = vh - pad * 2;
  menuEl.style.maxHeight = `${maxH}px`;

  const menuW = menuRect.width || menuEl.offsetWidth || 200;
  const menuH = Math.min(menuRect.height || menuEl.offsetHeight || 0, maxH);

  let top = splitRect.bottom + 2;
  let left = splitRect.left;

  if (top + menuH > vh - pad) {
    top = splitRect.top - menuH - 2;
  }
  if (left < pad) left = pad;
  if (left + menuW > vw - pad) left = vw - pad - menuW;
  if (top < pad) top = pad;
  if (top + menuH > vh - pad) top = vh - pad - menuH;

  menuEl.style.top = `${Math.round(top)}px`;
  menuEl.style.left = `${Math.round(left)}px`;
  menuEl.style.visibility = '';
  menuEl.style.pointerEvents = '';
}

export function closeToolbarSplitMenu(splitId: string): void {
  const host = getSplitEl(splitId);
  if (host instanceof HTMLElement && 'closeMenu' in host) {
    (host as CgToolbarSplit).closeMenu();
    return;
  }
  const menuId = host?.querySelector('.toolbar-split-menu')?.id;
  const menu = menuId ? getMenuEl(menuId) : host?.querySelector('.toolbar-split-menu');
  const trigger = host?.querySelector('.toolbar-split-trigger');
  if (menu) (menu as HTMLElement).hidden = true;
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
  host?.classList.remove('toolbar-split--open');
}

export function closeAllToolbarSplitMenus(): void {
  document.querySelectorAll('cg-toolbar-split').forEach((el) => {
    const split = el as CgToolbarSplit;
    if (split.isOpen) split.closeMenu();
  });
}

export function repositionOpenToolbarSplitMenus(): void {
  document.querySelectorAll('cg-toolbar-split.toolbar-split--open').forEach((splitEl) => {
    const split = splitEl as CgToolbarSplit;
    const menu = split.getMenuEl();
    if (menu && !menu.hidden) {
      positionToolbarSplitMenu(split, menu);
    }
  });
}

let _coordinatorReady = false;

export function initToolbarSplitCoordinator(): void {
  if (_coordinatorReady) return;
  _coordinatorReady = true;

  document.addEventListener('cg-menu-open', (e) => {
    const split = (e as CustomEvent<{ split: CgToolbarSplit }>).detail?.split;
    if (!split?.id) return;
    // Status-bar model menus build content and position in status-bar-service.
    if (split.classList.contains('toolbar-split--status-bar')) return;
    notifyToolbarSplitMenuOpen(split.id);
    const menu = split.getMenuEl();
    if (menu) {
      requestAnimationFrame(() => positionToolbarSplitMenu(split, menu));
    }
  });

  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (!target.closest('cg-toolbar-split') && !target.closest('.toolbar-split')) {
      closeAllToolbarSplitMenus();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (document.querySelector('cg-toolbar-split.toolbar-split--open')) {
      closeAllToolbarSplitMenus();
    }
  });

  window.addEventListener('resize', repositionOpenToolbarSplitMenus);
  window.addEventListener('scroll', repositionOpenToolbarSplitMenus, true);
}

