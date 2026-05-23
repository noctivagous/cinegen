import { scanAllInteractables } from '@/debug/dom-inventory';
import { clickButton, openWindow, closeWindow, selectDropdown, typeInput, toggleSection } from '@/debug/debug-actions';

export function initDebugModule(): void {
  const w = window as unknown as Record<string, unknown>;
  const cg = (w.CineGen as Record<string, unknown> | undefined) ?? {};
  cg.debug = {
    clickButton,
    openWindow,
    closeWindow,
    selectDropdown,
    typeInput,
    toggleSection,
    scanAllInteractables,
    readGUIState: () => ({
      openModal: (window as unknown as { getOpenModalId?: () => string | undefined }).getOpenModalId?.() ?? null,
      currentView: (window as unknown as { CineGen?: { appShell?: { currentView?: string } } }).CineGen?.appShell?.currentView ?? null,
    }),
    readGUIContents: scanAllInteractables,
  };
  w.CineGen = cg;
}
