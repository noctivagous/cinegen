import { syncInspectorToggleButton } from '@/components/panels/cinegen-inspector';
import {
  syncProjectSidebarToggleButton,
  toggleProjectSidebar,
} from '@/components/layout/cinegen-app';
import { installStatusBarGlobals } from '@/services/status-bar-service';
import { alertCG, initAlertCG } from '@/utils/alert-cg';

export function installCompatBridges(): void {
  installStatusBarGlobals();
  initAlertCG();

  window.syncProjectSidebarToggleButton = syncProjectSidebarToggleButton;
  window.syncInspectorToggleButton = syncInspectorToggleButton;
  window.toggleProjectSidebar = toggleProjectSidebar;
  window.alertCG = alertCG;

  window.testModelStatusConnection = (modality) => {
    window.openModelStatusConfig?.(modality);
  };
}
