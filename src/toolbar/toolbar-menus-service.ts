import { closeToolbarSplitMenu } from '@/services/toolbar-split-service';
import { onToolbarSplitMenuOpen } from '@/services/toolbar-split-service';
import { alertCG } from '@/utils/alert-cg';
import {
  hydrateProjectRegistryFromPersistence,
  openProject as openProjectFromService,
  prepareActiveProjectTreeUiForSwitch,
} from '@/services/project-service';
import {
  activatePersistedProjectTreeSelection,
  primePersistedProjectTreeUi,
  resetProjectTreeUiRestoreFlag,
} from '@/tree/project-tree-service';
import { appShellStore } from '@/stores/app-shell';
import { AI_ASSIST_ASSISTANT_TILES, AI_ASSIST_TASK_TILES } from '@/toolbar/toolbar-data';
import {
  launchAiAssistAction,
  openAiProviderInfoModal,
  openAssetWizardModal,
  openConceptWizardModal,
  openScriptWizardModal,
  openStoryboardWizardModal,
  openVisualWizardModal,
  openDebugGenerationForDebug,
  openGuide,
  openSettings,
  openSetupAssistantForDebug,
  resetSetupAssistantProgressForDebug,
  resetAppSettingsForDebug,
  clearProviderModelCacheForDebug,
  logSettingsStorageForDebug,
  reloadAppForDebug,
} from '@/toolbar/toolbar-modals-service';

declare const projectRegistry: Array<{ id: string; name: string; file?: string }>;
declare const projectData: { name: string };
declare const loadProjectFromCineFile: (filename: string) => void;

export function renderProjectsMenu(): void {
  const menu = document.getElementById('projects-menu');
  if (!menu) return;
  hydrateProjectRegistryFromPersistence();
  menu.replaceChildren();
  projectRegistry.forEach((proj) => {
    const isActive = proj.id === appShellStore.activeProjectId;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toolbar-split-menu-item toolbar-split-menu-item--with-check';
    btn.setAttribute('role', 'menuitem');
    if (isActive) {
      btn.classList.add('is-active');
      btn.setAttribute('aria-current', 'true');
    }
    const check = document.createElement('span');
    check.className = 'toolbar-menu-check';
    check.setAttribute('aria-hidden', 'true');
    check.textContent = isActive ? '✓' : '';
    const label = document.createElement('span');
    label.className = 'toolbar-menu-label';
    label.textContent = proj.name;
    btn.append(check, label);
    btn.addEventListener('click', () => switchProject(proj.id));
    menu.appendChild(btn);
  });
}

function switchProject(projectId: string): void {
  const proj = projectRegistry.find((p) => p.id === projectId);
  if (!proj) return;
  if (projectId === appShellStore.activeProjectId) {
    closeToolbarSplitMenu('projects-split');
    return;
  }
  prepareActiveProjectTreeUiForSwitch();
  resetProjectTreeUiRestoreFlag();
  let activeName = proj.name;
  if (proj.file) {
    loadProjectFromCineFile(proj.file);
    activeName = projectData.name || proj.name;
  } else {
    const local = openProjectFromService(projectId);
    if (local?.name) activeName = local.name;
  }
  appShellStore.setActiveProjectId(projectId);
  window.syncActiveProjectName?.(activeName);
  const refresh = window as unknown as Record<string, (() => void) | undefined>;
  refresh.renderFullTree?.();
  refresh.renderBreakdownTable?.();
  refresh.renderStoryboard?.();
  refresh.renderTimeline?.();
  refresh.hydrateScriptEditorFromProject?.();
  renderProjectsMenu();
  primePersistedProjectTreeUi(projectId);
  queueMicrotask(() => activatePersistedProjectTreeSelection(projectId));
  closeToolbarSplitMenu('projects-split');
  alertCG(`Opened project: ${proj.name}\n\nAll references and AI locks restored.`);
}

export function buildAiAssistToolbarMenu(): void {
  const menu = document.getElementById('ai-assist-menu');
  if (!menu) return;
  menu.replaceChildren();

  const assistantHeading = document.createElement('div');
  assistantHeading.className = 'toolbar-split-menu-heading';
  assistantHeading.textContent = 'Assistants';
  menu.appendChild(assistantHeading);

  AI_ASSIST_ASSISTANT_TILES.forEach((tile) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'toolbar-split-menu-item ai-assist-menu-item';
    item.setAttribute('role', 'menuitem');
    item.dataset.aiAssistKind = 'assistant';
    item.dataset.aiAssistId = tile.id;
    const icon = document.createElement('i');
    icon.className = tile.icon;
    icon.setAttribute('aria-hidden', 'true');
    item.append(icon, document.createTextNode(tile.title));
    menu.appendChild(item);
  });

  const sep = document.createElement('div');
  sep.className = 'toolbar-split-menu-sep';
  sep.setAttribute('role', 'separator');
  sep.setAttribute('aria-hidden', 'true');
  menu.appendChild(sep);

  const taskHeading = document.createElement('div');
  taskHeading.className = 'toolbar-split-menu-heading';
  taskHeading.textContent = 'Project tasks';
  menu.appendChild(taskHeading);

  AI_ASSIST_TASK_TILES.forEach((tile) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'toolbar-split-menu-item ai-assist-menu-item';
    item.setAttribute('role', 'menuitem');
    item.dataset.aiAssistKind = 'task';
    item.dataset.aiAssistId = tile.id;
    const icon = document.createElement('i');
    icon.className = tile.icon;
    icon.setAttribute('aria-hidden', 'true');
    item.append(icon, document.createTextNode(tile.title));
    menu.appendChild(item);
  });
}

function initGuideMenu(): void {
  const menu = document.getElementById('guide-menu');
  if (!menu) return;
  menu.querySelectorAll('[data-guide-section]').forEach((item) => {
    item.addEventListener('click', () => {
      const section = (item as HTMLElement).dataset.guideSection;
      if (section) openGuide(section);
    });
  });
}

function initSettingsMenu(): void {
  const settingsMenu = document.getElementById('settings-menu');
  settingsMenu?.querySelectorAll('[data-settings-action]').forEach((item) => {
    item.addEventListener('click', () => {
      openSettings((item as HTMLElement).dataset.settingsAction || '');
    });
  });
}

function initImportMenu(): void {
  const importMenu = document.getElementById('import-menu');
  importMenu?.querySelectorAll('[data-import-action]').forEach((item) => {
    item.addEventListener('click', () => {
      const action = (item as HTMLElement).dataset.importAction;
      if (typeof window.runImportMenuAction === 'function' && action) {
        window.runImportMenuAction(action);
      }
    });
  });
}

function initAiAssistMenu(): void {
  document.getElementById('ai-assist-menu')?.addEventListener('click', (e) => {
    const item = (e.target as HTMLElement).closest('[data-ai-assist-id]');
    if (!item) return;
    const kind = (item as HTMLElement).dataset.aiAssistKind;
    const id = (item as HTMLElement).dataset.aiAssistId;
    if (!kind || !id) return;
    closeToolbarSplitMenu('ai-assist-split');
    launchAiAssistAction(kind, id);
  });
}

const DEBUG_ACTIONS: Record<string, () => void> = {
  'open-setup-assistant': openSetupAssistantForDebug,
  'open-debug-generation': openDebugGenerationForDebug,
  'open-ai-provider-info': openAiProviderInfoModal,
  'reset-setup-assistant': resetSetupAssistantProgressForDebug,
  'reset-app-settings': resetAppSettingsForDebug,
  'clear-provider-cache': clearProviderModelCacheForDebug,
  'log-settings-storage': logSettingsStorageForDebug,
  'reload-app': reloadAppForDebug,
};

function initDebugMenu(): void {
  const menu = document.getElementById('debug-menu');
  menu?.querySelectorAll('[data-debug-action]').forEach((item) => {
    item.addEventListener('click', () => {
      const action = (item as HTMLElement).dataset.debugAction || '';
      closeToolbarSplitMenu('debug-split');
      DEBUG_ACTIONS[action]?.();
    });
  });
}

const EXPORT_ACTIONS: Record<string, () => void> = {
  screenplay: () => window.exportScreenplay?.(),
  pdf: () => (window as Window & { exportPDF?: () => void }).exportPDF?.(),
};

function initSaveExportMenu(): void {
  const menu = document.getElementById('save-export-menu');
  menu?.querySelectorAll('[data-export-action]').forEach((item) => {
    const action = (item as HTMLElement).dataset.exportAction;
    if (!action) return;
    item.addEventListener('click', () => {
      EXPORT_ACTIONS[action]?.();
      window.closeSaveExportMenu?.();
    });
  });
  menu?.querySelectorAll('.toolbar-split-menu-item:not([data-export-action])').forEach((item) => {
    if ((item as HTMLElement).dataset.wsAction) return;
    item.addEventListener('click', () => window.closeSaveExportMenu?.());
  });
}

const WIZARD_ACTIONS: Record<string, () => void> = {
  'script-wizard': openScriptWizardModal,
  'visual-wizard': openVisualWizardModal,
  'concept-wizard': openConceptWizardModal,
  'asset-wizard': openAssetWizardModal,
  'storyboard-wizard': openStoryboardWizardModal,
};

function initWizardsMenu(): void {
  const menu = document.getElementById('wizards-menu');
  menu?.querySelectorAll('[data-wizard-action]').forEach((item) => {
    item.addEventListener('click', () => {
      const action = (item as HTMLElement).dataset.wizardAction || '';
      closeToolbarSplitMenu('wizards-split');
      WIZARD_ACTIONS[action]?.();
    });
  });
}

function initScriptImportExportMenu(): void {
  const menu = document.getElementById('script-import-export-menu');
  menu?.querySelectorAll('[data-script-io-action]').forEach((item) => {
    item.addEventListener('click', () => {
      const action = (item as HTMLElement).dataset.scriptIoAction;
      if (typeof window.runScriptImportExportMenuAction === 'function' && action) {
        window.runScriptImportExportMenuAction(action);
      }
    });
  });
}

export function wireToolbarMenus(): void {
  onToolbarSplitMenuOpen((splitId) => {
    if (splitId === 'projects-split') renderProjectsMenu();
    if (splitId === 'ai-assist-split') buildAiAssistToolbarMenu();
  });

  initGuideMenu();
  initSettingsMenu();
  initImportMenu();
  initAiAssistMenu();
  initDebugMenu();
  initSaveExportMenu();
  initWizardsMenu();
  initScriptImportExportMenu();
}

export function installToolbarMenuGlobals(): void {
  window.renderProjectsMenu = renderProjectsMenu;
  window.buildAiAssistToolbarMenu = buildAiAssistToolbarMenu;
  window.closeSaveExportMenu = () => closeToolbarSplitMenu('save-export-split');
  window.launchAiAssistAction = launchAiAssistAction;
}
