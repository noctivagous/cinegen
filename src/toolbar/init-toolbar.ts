import { initToolbarSplitCoordinator } from '@/services/toolbar-split-service';
import { initModalManager } from '@/services/modal-manager';
import {
  buildAiAssistModalGrids,
  buildSettingsModalGrid,
  buildWizardsModalGrid,
  installToolbarModalGlobals,
  registerToolbarModals,
  wireProjectsModalList,
  wireToolbarModalDismissals,
} from '@/toolbar/toolbar-modals-service';
import { installToolbarMenuGlobals, renderProjectsMenu, wireToolbarMenus } from '@/toolbar/toolbar-menus-service';
import { wireToolbarSplitMainActions } from '@/toolbar/wire-toolbar-splits';

export function initToolbar(): void {
  initModalManager();
  registerToolbarModals();

  installToolbarModalGlobals();
  installToolbarMenuGlobals();

  initToolbarSplitCoordinator();
  wireToolbarMenus();
  wireToolbarSplitMainActions();
  wireToolbarModalDismissals();

  buildSettingsModalGrid();
  buildAiAssistModalGrids();
  buildWizardsModalGrid();
  wireProjectsModalList();
  renderProjectsMenu();

  console.log('CineGen: toolbar (Lit splits + modals) initialized');
}
