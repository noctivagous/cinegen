import '@/tailwind.css';
import '@/components/primitives/index';
import '@/components/layout/index';
import '@/components/panels/shell-index';
import '@/components/modals/shell-modals';
import '@/console/console-element';

import { installCompatBridges } from '@/bridge/compat';
import { initCineGenPreferences } from '@/services/preferences';
import { appShellStore, initAppShellStore, syncAppShellFromSources } from '@/stores/app-shell';
import { initApp } from '@/app/app-init';
import { markBootReady } from '@/app/boot-coordinator';
import { initLegacyModules } from '@/legacy/init-legacy-modules';
import { getPackageLoadErrors } from '@/data/cine-project-loader';
import { preloadPanelChunksIdle } from '@/components/panels/panel-loader';
import { alertCG } from '@/utils/alert-cg';
import { initKeybindings } from '@/keybindings/init-keybindings';
import { initConsoleCommands } from '@/console/init-console';
import { initDebugModule } from '@/debug/init-debug';
import { initMcpBridge } from '@/console/mcp-bridge';
import { preloadServerPersistence } from '@/services/persistence';
import { initStateSync } from '@/services/state-sync';
import { subscribeModalSync, loadModalState } from '@/services/modal-manager';
import {
  PREFERENCES_STORAGE_KEY,
  SETUP_COMPLETE_STORAGE_KEY,
  SETUP_PROGRESS_STORAGE_KEY,
  AI_API_SETTINGS_STORAGE_KEY,
  API_KEYS_STORAGE_KEY,
  PROVIDER_MODEL_CATALOG_STORAGE_KEY,
  LOCAL_PROJECTS_STORAGE_KEY,
} from '@/constants/storage-keys';

const SERVER_PRELOAD_KEYS = [
  PREFERENCES_STORAGE_KEY,
  SETUP_COMPLETE_STORAGE_KEY,
  SETUP_PROGRESS_STORAGE_KEY,
  AI_API_SETTINGS_STORAGE_KEY,
  API_KEYS_STORAGE_KEY,
  PROVIDER_MODEL_CATALOG_STORAGE_KEY,
  LOCAL_PROJECTS_STORAGE_KEY,
];

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
  const mode = (import.meta.env.VITE_PROJECT_PERSISTENCE_MODE as string) || 'local';

  if (mode === 'server') {
    const healthy = await checkServerHealth();
    if (!healthy) {
      console.warn('[CineGen] Server persistence not available. Falling back to local defaults.');
      const modal = document.createElement('cinegen-no-persistence-modal');
      modal.id = 'no-persistence-modal';
      document.body.appendChild(modal);
    }
    await preloadServerPersistence(SERVER_PRELOAD_KEYS);
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

  if (mode === 'server') {
    const serverState = await loadServerState();
    if (serverState && Object.keys(serverState).length) {
      appShellStore.patchServerState(serverState);
    }
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
  }

  const { initCoreServices } = await import('./services/init-core-services');
  initCoreServices();
  markBootReady('coreServices');

  const { initProjectTree } = await import('./tree/init-project-tree');
  initProjectTree();
  markBootReady('projectTree');

  const { initWorkspace } = await import('./workspace/init-workspace');
  initWorkspace();
  markBootReady('workspace');

  const { initToolbar } = await import('./toolbar/init-toolbar');
  initToolbar();
  markBootReady('toolbar');

  const { initAiSettings } = await import('./settings/init-ai-settings');
  initAiSettings();
  markBootReady('aiSettings');

  const { initSetupAssistant } = await import('./setup-assistant/init-setup-assistant');
  initSetupAssistant();
  markBootReady('setupAssistant');

  const { initShell } = await import('./shell/init-shell');
  initShell();
  markBootReady('shell');

  initKeybindings();
  markBootReady('keybindings');

  initConsoleCommands();
  markBootReady('console');

  initDebugModule();
  markBootReady('debug');

  initMcpBridge();
  markBootReady('mcpBridge');

  initApp();
  markBootReady('app');

  preloadPanelChunksIdle();

  // Log package load errors (missing files, schema issues) without blocking the app
  const pkgErrors = getPackageLoadErrors();
  if (pkgErrors.length > 0) {
    const msg = pkgErrors.slice(0, 10).join('\n\n');
    const summary = `${pkgErrors.length} project package load error(s) found`;
    console.warn(`[CineGen] ${summary}\n${msg}${pkgErrors.length > 10 ? `\n… and ${pkgErrors.length - 10} more` : ''}`);
    // Queue an alert that will show after any overlapping modals are dismissed
    setTimeout(() => alertCG(`Project package load errors (${pkgErrors.length}):\n\n${msg}`), 2000);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void bootstrap(), { once: true });
} else {
  void bootstrap();
}
