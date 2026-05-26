import { syncInspectorToggleButton } from '@/components/panels/cinegen-inspector';
import {
  syncPrevisTimelineToggleButton,
  syncProjectSidebarToggleButton,
  togglePrevisTimelineDockGlobal,
  toggleProjectSidebar,
} from '@/components/layout/cinegen-app';
import { installStatusBarGlobals, openModelStatusConfig } from '@/services/status-bar-service';
import { alertCG, initAlertCG } from '@/utils/alert-cg';

export function installCompatBridges(): void {
  installStatusBarGlobals();
  initAlertCG();

  window.syncProjectSidebarToggleButton = syncProjectSidebarToggleButton;
  window.syncPrevisTimelineToggleButton = syncPrevisTimelineToggleButton;
  window.syncInspectorToggleButton = syncInspectorToggleButton;
  window.toggleProjectSidebar = toggleProjectSidebar;
  window.togglePrevisTimelineDock = togglePrevisTimelineDockGlobal;
  window.alertCG = alertCG;

  window.testModelStatusConnection = (modality) => {
    openModelStatusConfig(modality);
  };
}
