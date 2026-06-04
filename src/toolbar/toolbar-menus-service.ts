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
  refreshProjectTree,
  resetProjectTreeUiRestoreFlag,
} from '@/tree/project-tree-service';
import { appShellStore } from '@/stores/app-shell';
import { AI_ASSIST_ASSISTANT_TILES, AI_ASSIST_TASK_TILES, WIZARD_ENTRY_TILES } from '@/toolbar/toolbar-data';
import {
  launchAiAssistAction,
  launchWizardAction,
  openAiProviderInfoModal,
  openDebugGenerationForDebug,
  openGuide,
  openMoodBoardsModal,
  openSettings,
  openSetupAssistantForDebug,
  resetSetupAssistantProgressForDebug,
  resetAppSettingsForDebug,
  clearProviderModelCacheForDebug,
  logSettingsStorageForDebug,
  reloadAppForDebug,
  exportScreenplay,
  syncActiveProjectName,
} from '@/toolbar/toolbar-modals-service';
import { projectRegistry, projectData, loadProjectFromCineFile } from '@/data/project-data';
import {
  renderBreakdownTable,
} from '@/assets/assets-bundle';
import { renderStoryboard } from '@/storyboard/storyboard-bundle';
import { renderTimeline } from '@/timeline/timeline-bundle';
import { hydrateScriptEditorFromProject, runImportMenuAction, runScriptImportExportMenuAction } from '@/script/fountain-bundle';

function closeSaveExportMenuLocal(): void {
  closeToolbarSplitMenu('save-export-split');
}

async function _fetchAndMergeProjects(): Promise<Array<{ id: string; name: string; file?: string }>> {
  hydrateProjectRegistryFromPersistence();
  const byId = new Map<string, { id: string; name: string; file?: string }>();
  for (const p of projectRegistry) byId.set(p.id, p);
  try {
    const res = await fetch('/api/projects');
    if (res.ok) {
      const data = await res.json();
      for (const sp of data.projects || []) {
        if (!byId.has(sp.id)) byId.set(sp.id, { id: sp.id, name: sp.name });
      }
    }
  } catch {
    /* network fail — use registry only */
  }
  return Array.from(byId.values());
}

function _renderProjectList(projects: Array<{ id: string; name: string; file?: string }>): void {
  const menu = document.getElementById('projects-menu');
  if (!menu) return;
  menu.replaceChildren();
  for (const proj of projects) {
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
  }
}

export async function renderProjectsMenu(): Promise<void> {
  const projects = await _fetchAndMergeProjects();
  _renderProjectList(projects);
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
    activeName = (projectData.name as string) || proj.name;
  } else {
    const local = openProjectFromService(projectId);
    if (local?.name) activeName = local.name;
  }
  appShellStore.setActiveProjectId(projectId);
  syncActiveProjectName?.(activeName);
  refreshProjectTree?.();
  renderBreakdownTable?.();
  renderStoryboard?.();
  renderTimeline?.();
  hydrateScriptEditorFromProject?.();
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
      if (action) runImportMenuAction(action);
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
  'cine-package': () => {
    void import('@/services/project-service').then(({ exportProject }) => {
      exportProject().catch((err: unknown) => {
        import('@/utils/alert-cg').then(({ alertCG }) => {
          alertCG(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
        });
      });
    });
  },
  screenplay: () => exportScreenplay?.(),
  pdf: () => (window as Window & { exportPDF?: () => void }).exportPDF?.(),
};

function initSaveExportMenu(): void {
  const menu = document.getElementById('save-export-menu');
  menu?.querySelectorAll('[data-export-action]').forEach((item) => {
    const action = (item as HTMLElement).dataset.exportAction;
    if (!action) return;
    item.addEventListener('click', () => {
      EXPORT_ACTIONS[action]?.();
      closeSaveExportMenuLocal();
    });
  });
  menu?.querySelectorAll('.toolbar-split-menu-item:not([data-export-action])').forEach((item) => {
    if ((item as HTMLElement).dataset.wsAction) return;
    item.addEventListener('click', () => closeSaveExportMenuLocal());
  });
}

export function buildWizardsToolbarMenu(): void {
  const menu = document.getElementById('wizards-menu');
  if (!menu) return;
  menu.replaceChildren();

  let lastGroup = '';
  WIZARD_ENTRY_TILES.forEach((tile) => {
    if (lastGroup && tile.group !== lastGroup) {
      const sep = document.createElement('div');
      sep.className = 'toolbar-split-menu-sep';
      sep.setAttribute('role', 'separator');
      sep.setAttribute('aria-hidden', 'true');
      menu.appendChild(sep);
    }
    lastGroup = tile.group;
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'toolbar-split-menu-item';
    item.setAttribute('role', 'menuitem');
    item.dataset.wizardAction = tile.id;
    const icon = document.createElement('i');
    icon.className = tile.icon;
    icon.setAttribute('aria-hidden', 'true');
    item.append(icon, document.createTextNode(` ${tile.title}…`));
    menu.appendChild(item);
  });
}

const WIZARD_ACTIONS: Record<string, () => void> = {};

function initWizardsMenu(): void {
  const menu = document.getElementById('wizards-menu');
  menu?.addEventListener('click', (e) => {
    const item = (e.target as HTMLElement).closest('[data-wizard-action]');
    if (!item) return;
    const action = (item as HTMLElement).dataset.wizardAction || '';
    closeToolbarSplitMenu('wizards-split');
    launchWizardAction(action);
  });
}

function initMoodBoardsMenu(): void {
  const menu = document.getElementById('moodboards-menu');
  menu?.addEventListener('click', (e) => {
    const item = (e.target as HTMLElement).closest('[data-moodboard-action]');
    if (!item) return;
    const action = (item as HTMLElement).dataset.moodboardAction || '';
    closeToolbarSplitMenu('moodboards-split');
    if (action === 'open') {
      openMoodBoardsModal();
      return;
    }
    if (action === 'new-board') {
      openMoodBoardsModal();
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('moodboard-new-board'));
      }, 100);
      return;
    }
    if (action === 'quick-generate') {
      openMoodBoardsModal();
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('moodboard-quick-generate'));
      }, 100);
    }
  });
}

function initScriptImportExportMenu(): void {
  const menu = document.getElementById('script-import-export-menu');
  menu?.querySelectorAll('[data-script-io-action]').forEach((item) => {
    item.addEventListener('click', () => {
      const action = (item as HTMLElement).dataset.scriptIoAction;
      if (action) runScriptImportExportMenuAction(action);
    });
  });
}

export function wireToolbarMenus(): void {
  onToolbarSplitMenuOpen((splitId) => {
    if (splitId === 'projects-split') renderProjectsMenu();
    if (splitId === 'ai-assist-split') buildAiAssistToolbarMenu();
    if (splitId === 'wizards-split') buildWizardsToolbarMenu();
  });

  initGuideMenu();
  initSettingsMenu();
  initImportMenu();
  initAiAssistMenu();
  initDebugMenu();
  initSaveExportMenu();
  initWizardsMenu();
  initMoodBoardsMenu();
  initScriptImportExportMenu();
}

export function installToolbarMenuGlobals(): void {
  window.renderProjectsMenu = renderProjectsMenu;
  window.buildAiAssistToolbarMenu = buildAiAssistToolbarMenu;
  window.buildWizardsToolbarMenu = buildWizardsToolbarMenu;
  window.closeSaveExportMenu = closeSaveExportMenuLocal;
  window.launchAiAssistAction = launchAiAssistAction;
  window.launchWizardAction = launchWizardAction;
}
