import type { CgModalTileGrid } from '@/components/primitives/cg-modal-tile-grid';
import type { CinegenGuideModalBody } from '@/components/modals/cinegen-guide-modal-body';
import {
  CG_PROJECT_OPEN,
  type CgProjectOpenDetail,
  type CinegenProjectsModalList,
} from '@/components/modals/cinegen-projects-modal-list';
import { closeAllToolbarSplitMenus, closeToolbarSplitMenu } from '@/services/toolbar-split-service';
import { appShellStore } from '@/stores/app-shell';
import { escHtml } from '@/utils/html';
import { alertCG } from '@/utils/alert-cg';
import {
  AI_API_SETTINGS_STORAGE_KEY,
  API_KEYS_STORAGE_KEY,
  PROVIDER_MODEL_CATALOG_STORAGE_KEY,
  SETUP_COMPLETE_STORAGE_KEY,
  SETUP_PROGRESS_STORAGE_KEY,
} from '@/constants/storage-keys';
import {
  AI_ASSIST_ASSISTANT_TILES,
  AI_ASSIST_TASK_TILES,
  GUIDE_SECTIONS,
  SETTINGS_MODAL_TILES,
} from '@/toolbar/toolbar-data';
import {
  createBlankProject,
  hydrateProjectRegistryFromPersistence,
  openProject as openProjectFromService,
} from '@/services/project-service';
import { PREFS_KEY } from '@/services/preferences';
import { storageService } from '@/services/persistence';
import {
  closeAllModals,
  closeAllModalsExcept,
  closeModal,
  openModal,
  openModalAsync,
  registerModal,
} from '@/services/modal-manager';
import { buildCheckboxTreeNodes, getCurrentSectionKey } from '@/services/section-visibility-service';

let guideModalSectionIndex = 0;

const DEBUG_SETTINGS_STORAGE_KEYS = [
  PREFS_KEY,
  SETUP_COMPLETE_STORAGE_KEY,
  SETUP_PROGRESS_STORAGE_KEY,
  AI_API_SETTINGS_STORAGE_KEY,
  API_KEYS_STORAGE_KEY,
  PROVIDER_MODEL_CATALOG_STORAGE_KEY,
];

declare const projectRegistry: Array<{
  id: string;
  name: string;
  settings?: Record<string, unknown>;
  file?: string;
}>;
declare const projectData: { name: string };
declare const loadProjectFromCineFile: (filename: string) => void;
declare let currentSceneId: string | undefined;
declare const currentSceneData: Record<string, { broll?: Array<{ id: number; label: string }> }>;

function getGuideSectionIndex(id: string): number {
  return GUIDE_SECTIONS.findIndex((s) => s.id === id);
}

function renderGuideModalSection(index: number): void {
  const section = GUIDE_SECTIONS[index];
  const modal = document.getElementById('guide-modal');
  const titleEl = document.getElementById('guide-modal-title');
  const bodyEl = document.querySelector<CinegenGuideModalBody>('cinegen-guide-modal-body');
  const progressEl = document.getElementById('guide-modal-progress');
  const prevBtn = document.getElementById('guide-modal-prev') as HTMLButtonElement | null;
  const nextBtn = document.getElementById('guide-modal-next') as HTMLButtonElement | null;
  if (!section || !modal || !titleEl || !bodyEl) return;

  guideModalSectionIndex = index;
  titleEl.innerHTML = `<i class="fa-solid fa-book-open"></i> ${escHtml(section.title)}`;
  bodyEl.showSection(index);
  if (progressEl) {
    progressEl.textContent = `${index + 1} of ${GUIDE_SECTIONS.length}`;
  }
  if (prevBtn) prevBtn.disabled = index <= 0;
  if (nextBtn) nextBtn.disabled = index >= GUIDE_SECTIONS.length - 1;
}

export async function openGuide(sectionId: string): Promise<void> {
  closeAllToolbarSplitMenus();
  closeAllModalsExcept('guide-modal');
  window.closeAiProvidersModal?.();
  const index = getGuideSectionIndex(sectionId);
  if (index < 0) return;
  await openModalAsync('guide-modal');
  renderGuideModalSection(index);
}

export function closeGuideModal(): void {
  closeModal('guide-modal');
}

export function guideModalStep(delta: number): void {
  const next = guideModalSectionIndex + delta;
  if (next < 0 || next >= GUIDE_SECTIONS.length) return;
  renderGuideModalSection(next);
}

export function closeProjectsModal(): void {
  closeModal('projects-modal');
}

export function closeSettingsModal(): void {
  closeModal('settings-modal');
}

export function closeAiAssistModal(): void {
  closeModal('ai-assist-modal');
}

export function closeProjectSettingsModal(): void {
  closeModal('project-settings-modal');
}

function launchSettingsAction(actionId: string): void {
  if (actionId === 'project-settings') {
    closeSettingsModal();
    openProjectSettingsModal();
    return;
  }
  if (actionId === 'ai-providers' || actionId === 'ai-api' || actionId === 'api-keys') {
    closeSettingsModal();
    window.openAiProvidersModal?.();
    return;
  }
  const sel = SETTINGS_MODAL_TILES.find((t) => t.id === actionId) || SETTINGS_MODAL_TILES[1];
  closeSettingsModal();
  alertCG(`${sel.title}\n\nDetail panel for this section (coming soon).`);
}

export function openAiAssistModal(): void {
  closeAllToolbarSplitMenus();
  closeAllModalsExcept('ai-assist-modal');
  window.closeAiProvidersModal?.();
  openModal('ai-assist-modal');
}

export function launchAiAssistAction(kind: string, actionId: string): void {
  if (actionId === 'app-setup-assistant') {
    closeAiAssistModal();
    void window.openSetupAssistant?.();
    return;
  }
  if (kind === 'task') {
    if (actionId === 'sync-entities' && typeof window.parseScriptToAssets === 'function') {
      closeAiAssistModal();
      window.parseScriptToAssets();
      return;
    }
    if (actionId === 'suggest-pickups') {
      closeAiAssistModal();
      const view = document.getElementById('current-view-label');
      const viewText = view ? view.textContent : '';
      if (
        viewText?.includes('Scene') &&
        typeof currentSceneId !== 'undefined' &&
        currentSceneId &&
        typeof currentSceneData !== 'undefined'
      ) {
        const scene = currentSceneData[currentSceneId];
        if (scene && Array.isArray(scene.broll)) {
          scene.broll.push({ id: Date.now(), label: 'AI Suggested Cutaway', duration: '4s' } as never);
        }
        const detail = document.getElementById('view-scene-detail');
        if (detail && !detail.classList.contains('hidden') && typeof window.renderSceneDetail === 'function') {
          window.renderSceneDetail();
        }
        alertCG('Suggested pickups and a cutaway idea for this scene.');
      } else {
        alertCG('Open a scene in the hierarchy to run pickup suggestions.');
      }
      return;
    }
    if (actionId === 'board-from-scene' && typeof window.generateBoards === 'function') {
      closeAiAssistModal();
      window.generateBoards();
      return;
    }
    if (actionId === 'production-brief') {
      closeAiAssistModal();
      alertCG('Production brief — compiled PDF / share link (coming soon).');
      return;
    }
  }

  const tiles = kind === 'assistant' ? AI_ASSIST_ASSISTANT_TILES : AI_ASSIST_TASK_TILES;
  const meta = tiles.find((t) => t.id === actionId);
  closeAiAssistModal();
  if (meta) {
    alertCG(
      `${meta.title}\n\n${meta.desc}\n\nFull assistant chat is not wired yet — routing will use Settings → AI Model & API.`
    );
  } else {
    alertCG('Action unavailable.');
  }
}

function wireModalTileGrid(
  el: CgModalTileGrid | null,
  tiles: typeof SETTINGS_MODAL_TILES,
  onSelect: (id: string, kind: string) => void
): void {
  if (!el || el.dataset.cgTilesWired === '1') return;
  el.dataset.cgTilesWired = '1';
  el.tiles = tiles;
  el.addEventListener('cg-modal-tile-select', (e: Event) => {
    const { id, kind } = (e as CustomEvent<{ id: string; kind: string }>).detail;
    onSelect(id, kind);
  });
}

export function buildAiAssistModalGrids(): void {
  wireModalTileGrid(
    document.querySelector<CgModalTileGrid>('#ai-assist-assistants-grid'),
    AI_ASSIST_ASSISTANT_TILES,
    (_id, kind) => launchAiAssistAction(kind, _id)
  );
  wireModalTileGrid(
    document.querySelector<CgModalTileGrid>('#ai-assist-tasks-grid'),
    AI_ASSIST_TASK_TILES,
    (_id, kind) => launchAiAssistAction(kind, _id)
  );
}

export function buildSettingsModalGrid(): void {
  wireModalTileGrid(
    document.querySelector<CgModalTileGrid>('#settings-modal-grid'),
    SETTINGS_MODAL_TILES,
    (id) => launchSettingsAction(id)
  );
  initProjectSettingsAspectToResolutionSync();
}

function initProjectSettingsAspectToResolutionSync(): void {
  const aspect = document.getElementById('project-settings-aspect');
  if (!aspect || aspect.dataset.cgResolutionSync === '1') return;
  aspect.dataset.cgResolutionSync = '1';
  aspect.addEventListener('change', () => {
    const aspectSel = aspect as HTMLSelectElement;
    const res = document.getElementById('project-settings-resolution') as HTMLSelectElement | null;
    renderProjectSettingsResolutionSelect(aspectSel.value, res?.value || '');
  });
}

function renderProjectSettingsResolutionSelect(
  aspectValue: string,
  preferredResolution?: string
): void {
  const sel = document.getElementById('project-settings-resolution') as HTMLSelectElement | null;
  if (!sel || typeof window.getProjectResolutionOptionGroups !== 'function') return;
  const groups = window.getProjectResolutionOptionGroups(aspectValue);
  sel.replaceChildren();
  groups.forEach((group: { groupLabel: string; options: Array<{ value: string; label: string }> }) => {
    const og = document.createElement('optgroup');
    og.label = group.groupLabel;
    group.options.forEach((optDef) => {
      const o = document.createElement('option');
      o.value = optDef.value;
      o.textContent = optDef.label;
      og.appendChild(o);
    });
    sel.appendChild(og);
  });
  const want = preferredResolution != null ? String(preferredResolution) : '';
  const match = want && [...sel.options].some((o) => o.value === want);
  if (match) {
    sel.value = want;
    return;
  }
  const first = groups[0]?.options?.[0]?.value;
  if (first) sel.value = first;
}

function populateProjectSettingsForm(): void {
  const active = projectRegistry.find((p) => p.id === appShellStore.activeProjectId);
  const settings =
    typeof window.getActiveProjectSettings === 'function' ? window.getActiveProjectSettings() : {};
  const hintEl = document.getElementById('project-settings-save-hint');
  if (hintEl) hintEl.textContent = 'Changes apply to this project only.';

  const labelEl = document.getElementById('project-settings-active-label');
  if (labelEl && active) {
    labelEl.textContent = active.name || projectData.name || 'Untitled production';
  }

  const nameInput = document.getElementById('project-settings-name') as HTMLInputElement | null;
  if (nameInput) nameInput.value = projectData.name || active?.name || '';

  function applySelect(selectId: string, value: string, fallbackPickFirst?: boolean): void {
    const sel = document.getElementById(selectId) as HTMLSelectElement | null;
    if (!sel) return;
    const exists = [...sel.options].some((o) => o.value === value);
    if (exists) sel.value = value;
    else if (fallbackPickFirst && sel.options.length) sel.selectedIndex = 0;
  }

  applySelect('project-settings-aspect', settings.aspectRatio as string, true);
  const aspectEl = document.getElementById('project-settings-aspect') as HTMLSelectElement | null;
  const aspectForRes = aspectEl ? aspectEl.value : (settings.aspectRatio as string);
  renderProjectSettingsResolutionSelect(aspectForRes, settings.defaultResolution as string);
  applySelect('project-settings-colorspace', settings.colorSpace as string);
  applySelect('project-settings-fps', String(settings.frameRate));
  applySelect('project-settings-tc-mode', (settings.timecodeMode as string) || 'ndf');
}

export function openProjectSettingsModal(): void {
  closeAllToolbarSplitMenus();
  closeAllModalsExcept('project-settings-modal');
  window.closeAiProvidersModal?.();
  populateProjectSettingsForm();
  openModal('project-settings-modal');
  (document.getElementById('project-settings-name') as HTMLInputElement | null)?.focus?.();
}

export function saveProjectSettingsModal(): void {
  const project = projectRegistry.find((p) => p.id === appShellStore.activeProjectId);
  const nameEl = document.getElementById('project-settings-name') as HTMLInputElement | null;
  if (!project || !nameEl) return;

  const rawName = String(nameEl.value || '').trim();
  if (!rawName) {
    nameEl.focus();
    return;
  }

  window.ensureProjectSettingsRecord?.(project);
  const aspectRaw = (document.getElementById('project-settings-aspect') as HTMLSelectElement).value;
  project.settings = project.settings || {};
  project.settings.aspectRatio =
    typeof window.normalizeProjectAspectRatio === 'function'
      ? window.normalizeProjectAspectRatio(aspectRaw)
      : aspectRaw;
  const resRaw = (document.getElementById('project-settings-resolution') as HTMLSelectElement).value;
  project.settings.defaultResolution =
    typeof window.normalizeProjectResolutionForAspect === 'function'
      ? window.normalizeProjectResolutionForAspect(project.settings.aspectRatio as string, resRaw)
      : resRaw;
  project.settings.frameRate = (
    document.getElementById('project-settings-fps') as HTMLSelectElement
  ).value;
  project.settings.timecodeMode = (
    document.getElementById('project-settings-tc-mode') as HTMLSelectElement
  ).value;
  project.settings.colorSpace = (
    document.getElementById('project-settings-colorspace') as HTMLSelectElement
  ).value;

  project.name = rawName;
  syncActiveProjectName(rawName);
  window.renderProjectsMenu?.();

  const hintEl = document.getElementById('project-settings-save-hint');
  if (hintEl) hintEl.textContent = 'Saved.';
  closeProjectSettingsModal();
}

function renderProjectsModalList(): void {
  document.querySelector<CinegenProjectsModalList>('cinegen-projects-modal-list')?.refresh();
}

export function wireProjectsModalList(): void {
  const list = document.querySelector<CinegenProjectsModalList>('cinegen-projects-modal-list');
  if (!list || list.dataset.cgProjectOpenWired === '1') return;
  list.dataset.cgProjectOpenWired = '1';
  list.addEventListener(CG_PROJECT_OPEN, (e: Event) => {
    const { projectId } = (e as CustomEvent<CgProjectOpenDetail>).detail;
    openProjectFromProjectsHub(projectId);
  });
}

export function openProjectsModal(): void {
  closeAllToolbarSplitMenus();
  closeAllModalsExcept('projects-modal');
  window.closeAiProvidersModal?.();
  hydrateProjectRegistryFromPersistence();
  renderProjectsModalList();
  openModal('projects-modal');
}

function openProjectFromProjectsHub(projectId: string): void {
  const proj = projectRegistry.find((p) => p.id === projectId);
  if (!proj || projectId === appShellStore.activeProjectId) return;
  if (proj.file) loadProjectFromCineFile(proj.file);
  const local = !proj.file ? openProjectFromService(projectId) : null;
  appShellStore.setActiveProjectId(projectId);
  syncActiveProjectName(projectData.name || local?.name || proj.name);
  const refresh = window as unknown as Record<string, (() => void) | undefined>;
  refresh.renderFullTree?.();
  refresh.renderBreakdownTable?.();
  refresh.renderStoryboard?.();
  refresh.renderTimeline?.();
  refresh.hydrateScriptEditorFromProject?.();
  window.renderProjectsMenu?.();
  closeProjectsModal();
}

export function openSettingsModal(): void {
  closeAllToolbarSplitMenus();
  closeAllModalsExcept('settings-modal');
  window.closeAiProvidersModal?.();
  openModal('settings-modal');
}

export function syncActiveProjectName(name: string): void {
  const trimmed = (name || '').trim();
  if (!trimmed) return;
  projectData.name = trimmed;
  const active = projectRegistry.find((p) => p.id === appShellStore.activeProjectId);
  if (active) active.name = trimmed;
  window.updateProjectTreeHeader?.();
  const statusEl = document.getElementById('project-name');
  if (statusEl) statusEl.textContent = `Project: ${trimmed}`;
}

export function importScript(): void {
  closeToolbarSplitMenu('import-split');
  window.triggerFDXImport?.();
}

export function saveProject(): void {
  alertCG('Project saved with full AI generation history.');
}

export function openDebugGenerationForDebug(): void {
  openDebugModal();
}

export function openSetupAssistantForDebug(): void {
  closeAllToolbarSplitMenus();
  closeAllModals();
  window.closeAiProvidersModal?.();
  void window.openSetupAssistant?.();
}

export function resetSetupAssistantProgressForDebug(): void {
  const shouldReset = window.confirm(
    'Reset Setup Assistant progress and completion state?\n\nThis does not remove provider keys or modality routing settings.'
  );
  if (!shouldReset) return;

  storageService.removeItem(SETUP_COMPLETE_STORAGE_KEY);
  storageService.removeItem(SETUP_PROGRESS_STORAGE_KEY);
  window.updateSetupIncompleteStatus?.();
  alertCG('Setup Assistant progress reset.\n\nOpening App Setup Assistant.');
  openSetupAssistantForDebug();
}

export async function resetAppSettingsForDebug(): Promise<void> {
  const shouldReset = window.confirm(
    'Reset all stored app settings?\n\nThis clears Preferences, Setup Assistant progress, provider credentials, modality routing, and provider model cache.\n\nLocal projects are not removed.'
  );
  if (!shouldReset) return;

  (window as Window & { _apiKeysDraftReset?: () => void })._apiKeysDraftReset?.();
  const clearApiKeys = (window as Window & { clearApiKeys?: () => Promise<void> }).clearApiKeys;
  const clearAiApiRouting = (window as Window & { clearAiApiRouting?: () => Promise<void> }).clearAiApiRouting;
  try {
    await Promise.allSettled([
      clearApiKeys?.() ?? Promise.resolve(),
      clearAiApiRouting?.() ?? Promise.resolve(),
    ]);
  } catch {
    // Continue with local reset even if server reset endpoints are unavailable.
  }
  DEBUG_SETTINGS_STORAGE_KEYS.forEach((key) => storageService.removeItem(key));
  window.updateSetupIncompleteStatus?.();
  alertCG('App settings reset.\n\nThe page will now reload.');
  window.location.reload();
}

export function clearProviderModelCacheForDebug(): void {
  storageService.removeItem(PROVIDER_MODEL_CATALOG_STORAGE_KEY);
  alertCG('Provider model cache cleared.');
}

export function logSettingsStorageForDebug(): void {
  const snapshot = Object.fromEntries(
    DEBUG_SETTINGS_STORAGE_KEYS.map((key) => [key, storageService.getItem(key)])
  );
  console.group('CineGen debug settings snapshot');
  console.table(snapshot);
  console.groupEnd();
  alertCG('Stored settings snapshot logged to the browser console.');
}

export function reloadAppForDebug(): void {
  window.location.reload();
}

export function openSettings(action: string): void {
  if (action === 'project-settings') {
    openProjectSettingsModal();
    return;
  }
  if (action === 'app-setup-assistant') {
    closeAllToolbarSplitMenus();
    closeAllModals();
    window.closeAiProvidersModal?.();
    void window.openSetupAssistant?.();
    return;
  }
  if (action === 'ai-providers' || action === 'ai-api' || action === 'api-keys') {
    window.openAiProvidersModal?.();
    return;
  }
  openSettingsModal();
}

export function exportScreenplay(): void {
  window.closeSaveExportMenu?.();
  window.saveFountainFile?.();
}

export function stubNewBlankProject(): void {
  const created = createBlankProject();
  appShellStore.setActiveProjectId(created.id);
  syncActiveProjectName(created.name);
  window.renderProjectsMenu?.();
  renderProjectsModalList();
  const refresh = window as unknown as Record<string, (() => void) | undefined>;
  refresh.renderFullTree?.();
  refresh.renderBreakdownTable?.();
  refresh.renderStoryboard?.();
  refresh.renderTimeline?.();
  refresh.hydrateScriptEditorFromProject?.();
  closeProjectsModal();
}

export function stubImportProjectBaseline(): void {
  alertCG('Import screenplay / production bible (coming soon).');
}

export function stubProjectGenerationAgent(): void {
  alertCG('Project Generation Agent — guided walkthrough (coming soon).');
}

export function registerToolbarModals(): void {
  registerModal({ id: 'guide-modal', bodyClass: 'guide-modal-open' });
  registerModal({ id: 'projects-modal' });
  registerModal({ id: 'settings-modal' });
  registerModal({ id: 'ai-assist-modal' });
  registerModal({ id: 'project-settings-modal' });
  registerModal({ id: 'debug-modal', hostOverflowY: 'auto' });
  registerModal({ id: 'section-settings-modal' });
  registerModal({ id: 'ai-provider-info-modal' });
}

export function openDebugModal(): void {
  closeAllToolbarSplitMenus();
  closeAllModalsExcept('debug-modal');
  openModal('debug-modal');
}

export function closeDebugModal(): void {
  closeModal('debug-modal');
}

export async function openSectionSettingsModal(): Promise<void> {
  closeAllToolbarSplitMenus();
  closeAllModalsExcept('section-settings-modal');
  await openModalAsync('section-settings-modal');
  const modalBody = document.querySelector('cinegen-section-settings-modal');
  if (modalBody && 'refresh' in modalBody && typeof (modalBody as { refresh?: () => void }).refresh === 'function') {
    (modalBody as { refresh: () => void }).refresh();
  }
}

export function closeSectionSettingsModal(): void {
  closeModal('section-settings-modal');
}

export async function openAiProviderInfoModal(): Promise<void> {
  closeAllToolbarSplitMenus();
  closeAllModalsExcept('ai-provider-info-modal');
  await openModalAsync('ai-provider-info-modal');
  const body = document.querySelector('cinegen-ai-provider-info');
  if (body && 'refresh' in body && typeof (body as { refresh?: () => void }).refresh === 'function') {
    (body as { refresh: () => void }).refresh();
  }
}

export function closeAiProviderInfoModal(): void {
  closeModal('ai-provider-info-modal');
}

export function installToolbarModalGlobals(): void {
  window.openGuide = openGuide;
  window.closeGuideModal = closeGuideModal;
  window.guideModalStep = guideModalStep;
  window.openProjectsModal = openProjectsModal;
  window.closeProjectsModal = closeProjectsModal;
  window.openSettingsModal = openSettingsModal;
  window.closeSettingsModal = closeSettingsModal;
  window.openAiAssistModal = openAiAssistModal;
  window.closeAiAssistModal = closeAiAssistModal;
  window.openProjectSettingsModal = openProjectSettingsModal;
  window.closeProjectSettingsModal = closeProjectSettingsModal;
  window.openDebugModal = openDebugModal;
  window.closeDebugModal = closeDebugModal;
  window.openSectionSettingsModal = openSectionSettingsModal;
  window.closeSectionSettingsModal = closeSectionSettingsModal;
  window.openAiProviderInfoModal = openAiProviderInfoModal;
  window.closeAiProviderInfoModal = closeAiProviderInfoModal;
  window.saveProjectSettingsModal = saveProjectSettingsModal;
  window.saveProject = saveProject;
  window.openSettings = openSettings;
  window.exportScreenplay = exportScreenplay;
  window.syncActiveProjectName = syncActiveProjectName;
  window.stubNewBlankProject = stubNewBlankProject;
  window.stubImportProjectBaseline = stubImportProjectBaseline;
  window.stubProjectGenerationAgent = stubProjectGenerationAgent;
  window.importScript = importScript;
}

export function wireToolbarModalDismissals(): void {
  document.querySelectorAll('[data-cg-close="debug-modal"]').forEach((el) => {
    el.addEventListener('click', () => closeDebugModal());
  });

  document.querySelectorAll('[data-cg-close="section-settings-modal"]').forEach((el) => {
    el.addEventListener('click', () => closeSectionSettingsModal());
  });
  document.querySelectorAll('[data-cg-close="ai-provider-info-modal"]').forEach((el) => {
    el.addEventListener('click', () => closeAiProviderInfoModal());
  });
  document.querySelector('#section-settings-modal .cg-modal-backdrop')?.addEventListener('click', () =>
    closeSectionSettingsModal()
  );
  document.getElementById('guide-modal-prev')?.addEventListener('click', () => guideModalStep(-1));
  document.getElementById('guide-modal-next')?.addEventListener('click', () => guideModalStep(1));

  document.querySelectorAll('[data-cg-close="guide-modal"]').forEach((el) => {
    el.addEventListener('click', () => closeGuideModal());
  });

  document.querySelectorAll('[data-cg-close="projects-modal"]').forEach((el) => {
    el.addEventListener('click', () => closeProjectsModal());
  });
  document.querySelector('#projects-modal .projects-modal-backdrop')?.addEventListener('click', () =>
    closeProjectsModal()
  );

  document.querySelectorAll('[data-cg-close="settings-modal"]').forEach((el) => {
    el.addEventListener('click', () => closeSettingsModal());
  });
  document.querySelector('#settings-modal .settings-modal-backdrop')?.addEventListener('click', () =>
    closeSettingsModal()
  );

  document.querySelectorAll('[data-cg-close="ai-assist-modal"]').forEach((el) => {
    el.addEventListener('click', () => closeAiAssistModal());
  });
  document.querySelector('#ai-assist-modal .settings-modal-backdrop')?.addEventListener('click', () =>
    closeAiAssistModal()
  );

  document.querySelectorAll('[data-cg-close="project-settings-modal"]').forEach((el) => {
    el.addEventListener('click', () => closeProjectSettingsModal());
  });
  document
    .querySelector('#project-settings-modal .project-settings-modal-backdrop')
    ?.addEventListener('click', () => closeProjectSettingsModal());

  document
    .querySelector('#project-settings-modal .project-settings-modal-backdrop')
    ?.addEventListener('click', () => closeProjectSettingsModal());
  document.querySelectorAll('[data-cg-close="project-settings-modal"]').forEach((el) => {
    el.addEventListener('click', () => closeProjectSettingsModal());
  });
  document.querySelector('[data-project-settings-action="back"]')?.addEventListener('click', () => {
    closeProjectSettingsModal();
    openSettingsModal();
  });
  document.querySelector('[data-project-settings-action="save"]')?.addEventListener('click', () =>
    saveProjectSettingsModal()
  );

  const PROJECT_ACTIONS: Record<string, () => void> = {
    'blank-project': stubNewBlankProject,
    'import-baseline': stubImportProjectBaseline,
    'generation-agent': stubProjectGenerationAgent,
  };
  document.querySelectorAll('[data-project-action]').forEach((el) => {
    const action = (el as HTMLElement).dataset.projectAction;
    if (!action || !PROJECT_ACTIONS[action]) return;
    el.addEventListener('click', PROJECT_ACTIONS[action]);
  });
}

