import '@/tailwind.css';
import '@/components/primitives/index';
import '@/components/layout/index';
import '@/components/panels/shell-index';
import '@/components/modals/shell-modals';
// import '@/console/console-element';

import { installCompatBridges } from '@/bridge/compat';
import { initCineGenPreferences } from '@/services/preferences';
import { appShellStore, initAppShellStore, syncAppShellFromSources } from '@/stores/app-shell';
import { initApp } from '@/app/app-init';
import { markBootReady } from '@/app/boot-coordinator';
import { initLegacyModules } from '@/legacy/init-legacy-modules';
import { getPackageLoadErrors } from '@/data/cine-project-loader';
import { preloadPanelChunksIdle, ensurePanelForView } from '@/components/panels/panel-loader';
import { alertCG } from '@/utils/alert-cg';
import { initKeybindings } from '@/keybindings/init-keybindings';
// import { initConsoleCommands } from '@/console/init-console';
import { initDebugModule } from '@/debug/init-debug';
// import { initMcpBridge } from '@/console/mcp-bridge';
import { initStateSync } from '@/services/state-sync';
import { subscribeModalSync, loadModalState } from '@/services/modal-manager';
import { applyBootWorkspaceVisibility } from '@/workspace/boot-workspace-visibility';

async function checkServerHealth(): Promise<boolean> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) return false;
    const data = await res.json();
    return data.persistence === true;
  } catch {
    return false;
  }
}

async function loadServerState(): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch('/api/state/app-shell');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function bootstrap(): Promise<void> {
  const healthy = await checkServerHealth();
  if (!healthy) {
    console.warn('[CineGen] Server persistence not available. Some state may not load or save.');
    const modal = document.createElement('cinegen-no-persistence-modal');
    modal.id = 'no-persistence-modal';
    document.body.appendChild(modal);
  }

  initCineGenPreferences();
  markBootReady('preferences');
  window.CineGen.appShell = appShellStore;
  installCompatBridges();

  await initLegacyModules();
  markBootReady('legacyModules');

  initAppShellStore();
  syncAppShellFromSources();
  markBootReady('store');

  const serverState = await loadServerState();
  if (serverState && Object.keys(serverState).length) {
    appShellStore.patchServerState(serverState);
  }
  await ensurePanelForView(appShellStore.currentView);
  applyBootWorkspaceVisibility(appShellStore.currentView);
  try {
    const modalRes = await fetch('/api/state/modal');
    if (modalRes.ok) {
      const modalState = await modalRes.json();
      loadModalState(modalState);
    }
  } catch { /* ignore */ }
  initStateSync();
  appShellStore.startServerSync();
  subscribeModalSync();

  const { initCoreServices } = await import('../services/init-core-services');
  initCoreServices();
  markBootReady('coreServices');

  import('../services/ai/agents-service').then((mod) => {
    window.CineGen.agents = {
      analyzeScript: mod.analyzeScript,
      getProductionContext: mod.getProductionContext,
      updateProductionContext: mod.updateProductionContext,
      getReviewQueue: mod.getReviewQueue,
      approveReviewItem: mod.approveReviewItem,
      rejectReviewItem: mod.rejectReviewItem,
      getAgentHealth: mod.getAgentHealth,
      runScriptWizardStep2: mod.runScriptWizardStep2,
      buildCharacterGuides: mod.buildCharacterGuides,
      buildLocationGuides: mod.buildLocationGuides,
      generateStoryboardFrames: mod.generateStoryboardFrames,
      buildGenerationPrompt: mod.buildGenerationPrompt,
      routeGenerationJob: mod.routeGenerationJob,
      auditGeneratedClip: mod.auditGeneratedClip,
      translateSpatialAnnotations: mod.translateSpatialAnnotations,
      prepareAudioPlan: mod.prepareAudioPlan,
      assembleSequence: mod.assembleSequence,
      colorGradeSequence: mod.colorGradeSequence,
      identifyVisualElements: mod.identifyVisualElements,
      extractColorPalette: mod.extractColorPalette,
      generateScriptFromVisuals: mod.generateScriptFromVisuals,
      generateConcepts: mod.generateConcepts,
      generateConceptImage: mod.generateConceptImage,
      generateOutlineFromBeats: mod.generateOutlineFromBeats,
    };
  }).catch(() => { /* agent layer unavailable */ });

  const { initProjectTree } = await import('../tree/init-project-tree');
  initProjectTree();
  markBootReady('projectTree');

  const { initWorkspace } = await import('../workspace/init-workspace');
  initWorkspace();
  markBootReady('workspace');

  const { initToolbar } = await import('../toolbar/init-toolbar');
  initToolbar();
  markBootReady('toolbar');

  const { initAiSettings } = await import('../settings/init-ai-settings');
  initAiSettings();
  markBootReady('aiSettings');

  const { initSetupAssistant } = await import('../setup-assistant/init-setup-assistant');
  initSetupAssistant();
  markBootReady('setupAssistant');

  const { initVisualWizard } = await import('../wizard/init-visual-wizard');
  initVisualWizard();

  const { initConceptWizard } = await import('../wizard/init-concept-wizard');
  initConceptWizard();

  const { initAssetWizard } = await import('../wizard/init-asset-wizard');
  initAssetWizard();

  const { initBeatBoard } = await import('../wizard/init-beat-board');
  initBeatBoard();

  const { initShell } = await import('../shell/init-shell');
  initShell();
  markBootReady('shell');

  initKeybindings();
  markBootReady('keybindings');

  initDebugModule();
  markBootReady('debug');

  const bootProjectId =
    appShellStore.activeProjectId || appShellStore.preferences.activeProjectId;
  if (bootProjectId) {
    const { restoreActiveProjectOnBoot } = await import('../services/project-service');
    const restored = await restoreActiveProjectOnBoot(bootProjectId);
    if (restored) {
      appShellStore.syncActiveProjectFromModule(bootProjectId);
    }
  }

  initApp();
  markBootReady('app');

  preloadPanelChunksIdle();

  const pkgErrors = getPackageLoadErrors();
  if (pkgErrors.length > 0) {
    const msg = pkgErrors.slice(0, 10).join('\n\n');
    const summary = `${pkgErrors.length} project package load error(s) found`;
    console.warn(`[CineGen] ${summary}\n${msg}${pkgErrors.length > 10 ? `\n… and ${pkgErrors.length - 10} more` : ''}`);
    setTimeout(() => alertCG(`Project package load errors (${pkgErrors.length}):\n\n${msg}`), 2000);
  }
}

export function startAppBootstrap(): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => void bootstrap(), { once: true });
  } else {
    void bootstrap();
  }
}
