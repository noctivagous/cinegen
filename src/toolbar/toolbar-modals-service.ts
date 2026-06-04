import { html } from 'lit';
import type { CgModalTileGrid } from '@/components/primitives/cg-modal-tile-grid';
import type { CinegenGuideModalBody } from '@/components/modals/cinegen-guide-modal-body';
import { closeAllToolbarSplitMenus, closeToolbarSplitMenu } from '@/services/toolbar-split-service';
import { appShellStore } from '@/stores/app-shell';
import { escHtml } from '@/utils/html';
import { alertCG } from '@/utils/alert-cg';
import { markProjectDirty, persistActiveProjectSnapshot } from '@/services/project-service';
import {
  AI_ASSIST_ASSISTANT_TILES,
  AI_ASSIST_TASK_TILES,
  GUIDE_SECTIONS,
  SETTINGS_MODAL_TILES,
  WIZARD_ENTRY_TILES,
} from '@/toolbar/toolbar-data';
import {
  buildNextUntitledName,
  createBlankProject,
  createNewProject,
  persistActiveProjectSettings,
} from '@/services/project-service';
import type { FeatureTreeNode } from '@/components/primitives/cg-feature-tree';
import {
  buildAllEnabledFeaturesConfig,
  buildBlankProjectFeaturesConfig,
  flattenCatalogIds,
} from '@/tree/project-feature-catalog';
import {
  buildFeatureTreeForModal,
  configFromFeatureTreeNodes,
  effectiveParentId,
  setProjectFeaturesConfig,
} from '@/services/project-features-service';
import { moodBoards } from '@/data/project-data';
import {
  closeAllModalsExcept,
  closeModal,
  openModal,
  openModalAsync,
  registerModal,
} from '@/services/modal-manager';
import { buildCheckboxTreeNodes, getCurrentSectionKey } from '@/services/section-visibility-service';
import { resetScriptWizardState } from '@/wizard/script-wizard-state';
import { createScriptWizardSlides } from '@/wizard/script-wizard-bundle';
import { VISUAL_WIZARD_SLIDES } from '@/toolbar/wizard-slides-visual';
import { CONCEPT_WIZARD_SLIDES } from '@/toolbar/wizard-slides-concept';
import { ASSET_WIZARD_SLIDES } from '@/toolbar/wizard-slides-asset';
import { STORYBOARD_WIZARD_SLIDES } from '@/toolbar/wizard-slides-storyboard';
import { syncFountainToProject } from '@/script/script-to-project';
import { SCRIPT_PREVIS_MARGIN_COLLAPSED_KEY } from '@/constants/storage-keys';
import { storageService } from '@/services/persistence';
import { requestProjectTreeRefresh } from '@/tree/project-tree-service';
import { openBlankProjectWizard, restoreProjectsList } from '@/toolbar/toolbar-blank-project-wizard';
import {
  closeDebugModal,
  openDebugModal,
  openSetupAssistantForDebug,
} from '@/toolbar/toolbar-debug-service';
import { closeAiProvidersModal, openAiProvidersModal } from '@/settings/ai-api-settings-bundle';
import { hydrateScriptEditorFromProject, scheduleFountainRender } from '@/script/fountain-bundle';
import { renderBreakdownTable } from '@/assets/assets-bundle';

export {
  clearProviderModelCacheForDebug,
  logSettingsStorageForDebug,
  openDebugGenerationForDebug,
  openSetupAssistantForDebug,
  reloadAppForDebug,
  resetAppSettingsForDebug,
  resetSetupAssistantProgressForDebug,
} from '@/toolbar/toolbar-debug-service';
import {
  closeProjectSettingsModal,
  closeProjectsModal,
  closeSettingsModal,
  initProjectSettingsAspectToResolutionSync,
  openProjectSettingsModal,
  openProjectsModal,
  openSettingsModal,
  renderProjectsModalList,
  saveProjectSettingsModal,
  syncActiveProjectName,
  wireProjectsModalList,
} from '@/toolbar/toolbar-project-modals-service';
import {
  closeAssetWizardModal as closeAssetWizardModalFromService,
  closeConceptWizardModal as closeConceptWizardModalFromService,
  closeScriptWizardModal as closeScriptWizardModalFromService,
  closeStoryboardWizardModal as closeStoryboardWizardModalFromService,
  closeVisualWizardModal as closeVisualWizardModalFromService,
  closeWizardsModal as closeWizardsModalFromService,
  launchWizardAction as launchWizardActionFromService,
  openAssetWizardModal as openAssetWizardModalFromService,
  openConceptWizardModal as openConceptWizardModalFromService,
  openScriptWizardModal as openScriptWizardModalFromService,
  openStoryboardWizardModal as openStoryboardWizardModalFromService,
  openVisualWizardModal as openVisualWizardModalFromService,
  openWizardsModal as openWizardsModalFromService,
  renderEntryWizardSlide as renderEntryWizardSlideFromService,
  type WizardSlide,
  wireWizardNavigationAndActions,
} from '@/toolbar/toolbar-wizard-modals-service';

export {
  closeProjectSettingsModal,
  closeProjectsModal,
  closeSettingsModal,
  openProjectSettingsModal,
  openProjectsModal,
  openSettingsModal,
  saveProjectSettingsModal,
  syncActiveProjectName,
  wireProjectsModalList,
};

import {
  setProjectFountainText,
} from '@/data/project-data';
import { generateBoards, renderStoryboard } from '@/storyboard/storyboard-bundle';
import { activateProjectTreeNode } from '@/tree/project-tree-service';
import { saveFountainFile, triggerFDXImport } from '@/script/fountain-bundle';
import { renderScriptInfoTables } from '@/workspace/script-info-utils';
import { parseScriptToAssets } from '@/ai/ai-stubs-bundle';
import { renderTimeline } from '@/timeline/timeline-bundle';

const _w = window as any;

let guideModalSectionIndex = 0;

/* ── Entry-point wizard slide data ─────────────────────────────────────────── */

const WIZARD_SLIDES: Record<string, WizardSlide[]> = {
  'script-wizard-modal': createScriptWizardSlides({
    createNewProject,
    setActiveProjectId: (projectId: string) => appShellStore.setActiveProjectId(projectId),
    syncActiveProjectName,
    setProjectFountainText,
    hydrateScriptEditorFromProject,
    renderProjectsModalList,
    renderEntryWizardSlide: (modalId: string, index: number) => renderEntryWizardSlide(modalId, index),
    generateStoryboardReferences: async () => {
      const fn = _w.generateStoryboardReferences;
      if (typeof fn === 'function') await (fn as () => Promise<void>)();
    },
    generateBoards,
    closeScriptWizardModal,
    addItemsToLibrary: (bucket: string, values: string[], icon?: string, desc?: string) => {
      const fn = _w.addItemsToLibrary;
      if (typeof fn === 'function') (fn as (b: string, v: string[], i?: string, d?: string) => void)(bucket, values, icon, desc);
    },
    renderBreakdownTable,
    scheduleFountainRender,
    syncFountainToProject,
  }),
  'visual-wizard-modal': VISUAL_WIZARD_SLIDES,
  'concept-wizard-modal': CONCEPT_WIZARD_SLIDES,
  'asset-wizard-modal': ASSET_WIZARD_SLIDES,
  'storyboard-wizard-modal': STORYBOARD_WIZARD_SLIDES,
};

declare let currentSceneId: string | undefined;
declare const currentSceneData: Record<string, { broll?: Array<{ id: number; label: string }> }>;
declare function renderGlobalAssets(tabIndex?: number): void;
declare function refreshShotFrameTree(): void;

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
  closeAiProvidersModal();
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

/* ── Entry-point wizard navigation (generic + per-modal) ───────────────────── */

function renderEntryWizardSlide(modalId: string, index: number): void {
  renderEntryWizardSlideFromService(modalId, index, WIZARD_SLIDES);
}

export function openScriptWizardModal(): void {
  openScriptWizardModalFromService(WIZARD_SLIDES);
}
export function closeScriptWizardModal(): void {
  closeScriptWizardModalFromService();
}

export function openVisualWizardModal(): void {
  openVisualWizardModalFromService(WIZARD_SLIDES);
}
export function closeVisualWizardModal(): void {
  closeVisualWizardModalFromService();
}

export function openConceptWizardModal(): void {
  openConceptWizardModalFromService(WIZARD_SLIDES);
}
export function closeConceptWizardModal(): void {
  closeConceptWizardModalFromService();
}

export function openAssetWizardModal(): void {
  openAssetWizardModalFromService(WIZARD_SLIDES);
}
export function closeAssetWizardModal(): void {
  closeAssetWizardModalFromService();
}

export function openStoryboardWizardModal(): void {
  openStoryboardWizardModalFromService(WIZARD_SLIDES);
}
export function closeStoryboardWizardModal(): void {
  closeStoryboardWizardModalFromService();
}

export function closeAiAssistModal(): void {
  closeModal('ai-assist-modal');
}

function launchSettingsAction(actionId: string): void {
  if (actionId === 'project-settings') {
    closeSettingsModal();
    openProjectSettingsModal();
    return;
  }
  if (actionId === 'ai-providers' || actionId === 'ai-api' || actionId === 'api-keys') {
    closeSettingsModal();
    void openAiProvidersModal();
    return;
  }
  const sel = SETTINGS_MODAL_TILES.find((t) => t.id === actionId) || SETTINGS_MODAL_TILES[1];
  closeSettingsModal();
  alertCG(`${sel.title}\n\nDetail panel for this section (coming soon).`);
}

export function openAiAssistModal(): void {
  closeAllToolbarSplitMenus();
  closeAllModalsExcept('ai-assist-modal');
  closeAiProvidersModal();
  openModal('ai-assist-modal');
}

export function openWizardsModal(): void {
  openWizardsModalFromService(WIZARD_SLIDES);
}

export function openMoodBoardsModal(): void {
  closeAllToolbarSplitMenus();
  activateProjectTreeNode?.('Mood Boards');
}

export function openMoodBoardItemDetail(boardId: string, itemId: string): void {
  const board = moodBoards.find((b) => b.id === boardId);
  if (!board) return;
  const item = board.items.find((i) => i.id === itemId);
  if (!item) return;
  openModal('moodboard-item-detail');
  queueMicrotask(() => {
    const el = document.getElementById('view-moodboard-detail');
    if (el && 'loadItem' in el && typeof (el as { loadItem: (boardId: string, itemId: string) => void }).loadItem === 'function') {
      (el as { loadItem: (boardId: string, itemId: string) => void }).loadItem(boardId, itemId);
    }
  });
}

export function closeWizardsModal(): void {
  closeWizardsModalFromService();
}

const WIZARD_ACTIONS: Record<string, () => void> = {
  'script-wizard': openScriptWizardModal,
  'visual-wizard': openVisualWizardModal,
  'concept-wizard': openConceptWizardModal,
  'asset-wizard': openAssetWizardModal,
  'storyboard-wizard': openStoryboardWizardModal,
};

export function launchWizardAction(wizardId: string): void {
  launchWizardActionFromService(wizardId, WIZARD_ACTIONS);
}

export function launchAiAssistAction(kind: string, actionId: string): void {
  if (actionId === 'app-setup-assistant') {
    closeAiAssistModal();
    void _w.openSetupAssistant?.();
    return;
  }
  if (kind === 'task') {
    if (actionId === 'sync-entities') {
      closeAiAssistModal();
      parseScriptToAssets();
      return;
    }
    if (actionId === 'suggest-pickups') {
      closeAiAssistModal();
      const viewText = appShellStore.currentViewLabel || '';
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
        if (detail && !detail.classList.contains('hidden') && typeof _w.renderSceneDetail === 'function') {
          _w.renderSceneDetail();
        }
        alertCG('Suggested pickups and a cutaway idea for this scene.');
      } else {
        alertCG('Open a scene in the hierarchy to run pickup suggestions.');
      }
      return;
    }
    if (actionId === 'board-from-scene') {
      closeAiAssistModal();
      generateBoards();
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

export function buildWizardsModalGrid(): void {
  wireModalTileGrid(
    document.querySelector<CgModalTileGrid>('#wizards-modal-grid'),
    WIZARD_ENTRY_TILES,
    (id) => launchWizardAction(id)
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

export function importScript(): void {
  closeToolbarSplitMenu('import-split');
  triggerFDXImport();
}

export function saveProject(): void {
  persistActiveProjectSnapshot();
  alertCG('Project saved.');
}

export function openSettings(action: string): void {
  if (action === 'project-settings') {
    openProjectSettingsModal();
    return;
  }
  if (action === 'app-setup-assistant') {
    openSetupAssistantForDebug();
    return;
  }
  if (action === 'ai-providers' || action === 'ai-api' || action === 'api-keys') {
    void openAiProvidersModal();
    return;
  }
  openSettingsModal();
}

export function exportScreenplay(): void {
  _w.closeSaveExportMenu?.();
  saveFountainFile();
}

export function registerToolbarModals(): void {
  registerModal({ id: 'guide-modal', bodyClass: 'guide-modal-open' });
  registerModal({ id: 'projects-modal' });
  registerModal({ id: 'settings-modal' });
  registerModal({ id: 'ai-assist-modal' });
  registerModal({ id: 'wizards-modal' });
  registerModal({ id: 'project-settings-modal' });
  registerModal({ id: 'debug-modal', hostOverflowY: 'auto' });
  registerModal({ id: 'section-settings-modal' });
  registerModal({ id: 'project-features-modal' });
  registerModal({ id: 'ai-provider-info-modal' });
  registerModal({ id: 'sound-editor-modal', hostOverflowY: 'hidden' });
  registerModal({ id: 'script-wizard-modal' });
  registerModal({ id: 'visual-wizard-modal' });
  registerModal({ id: 'concept-wizard-modal' });
  registerModal({ id: 'asset-wizard-modal' });
  registerModal({ id: 'storyboard-wizard-modal' });
  registerModal({ id: 'moodboard-item-detail', elementId: 'view-moodboard-detail' });
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

export async function openProjectFeaturesModal(): Promise<void> {
  closeAllToolbarSplitMenus();
  closeAllModalsExcept('project-features-modal');
  await openModalAsync('project-features-modal');
  const modalBody = document.querySelector('cinegen-project-features-modal');
  if (modalBody && 'refresh' in modalBody && typeof (modalBody as { refresh?: () => void }).refresh === 'function') {
    (modalBody as { refresh: () => void }).refresh();
  }
}

export function closeProjectFeaturesModal(): void {
  closeModal('project-features-modal');
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
  window.openWizardsModal = openWizardsModal;
  window.closeWizardsModal = closeWizardsModal;
  window.openProjectSettingsModal = openProjectSettingsModal;
  window.closeProjectSettingsModal = closeProjectSettingsModal;
  window.openDebugModal = openDebugModal;
  window.closeDebugModal = closeDebugModal;
  window.openSectionSettingsModal = openSectionSettingsModal;
  window.closeSectionSettingsModal = closeSectionSettingsModal;
  window.openProjectFeaturesModal = openProjectFeaturesModal;
  window.closeProjectFeaturesModal = closeProjectFeaturesModal;
  window.openAiProviderInfoModal = openAiProviderInfoModal;
  window.closeAiProviderInfoModal = closeAiProviderInfoModal;
  window.saveProjectSettingsModal = saveProjectSettingsModal;
  window.saveProject = saveProject;
  window.openSettings = openSettings;
  window.exportScreenplay = exportScreenplay;
  window.syncActiveProjectName = syncActiveProjectName;
  window.openBlankProjectWizard = openBlankProjectWizard;
  window.importScript = importScript;
  window.openScriptWizardModal = openScriptWizardModal;
  window.closeScriptWizardModal = closeScriptWizardModal;
  window.openVisualWizardModal = openVisualWizardModal;
  window.closeVisualWizardModal = closeVisualWizardModal;
  window.openConceptWizardModal = openConceptWizardModal;
  window.closeConceptWizardModal = closeConceptWizardModal;
  window.openAssetWizardModal = openAssetWizardModal;
  window.closeAssetWizardModal = closeAssetWizardModal;
  window.openStoryboardWizardModal = openStoryboardWizardModal;
  window.closeStoryboardWizardModal = closeStoryboardWizardModal;
}

export function wireToolbarModalDismissals(): void {
  document.querySelectorAll('[data-cg-close="debug-modal"]').forEach((el) => {
    el.addEventListener('click', () => closeDebugModal());
  });

  document.querySelectorAll('[data-cg-close="section-settings-modal"]').forEach((el) => {
    el.addEventListener('click', () => closeSectionSettingsModal());
  });
  document.querySelectorAll('[data-cg-close="project-features-modal"]').forEach((el) => {
    el.addEventListener('click', () => closeProjectFeaturesModal());
  });
  document.querySelector('#project-features-modal .cg-modal-backdrop')?.addEventListener('click', () =>
    closeProjectFeaturesModal()
  );
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
  const projectSettingsModal = document.getElementById('project-settings-modal');
  if (projectSettingsModal && projectSettingsModal.dataset.cgProjectSettingsWired !== '1') {
    projectSettingsModal.dataset.cgProjectSettingsWired = '1';
    projectSettingsModal.addEventListener('click', (e) => {
      const actionEl = (e.target as HTMLElement).closest('[data-project-settings-action]');
      if (!actionEl) return;
      const action = (actionEl as HTMLElement).dataset.projectSettingsAction;
      if (action === 'save') {
        e.preventDefault();
        saveProjectSettingsModal();
        return;
      }
      if (action === 'back') {
        closeProjectSettingsModal();
        openSettingsModal();
      }
    });
  }

  const projectActions: Record<string, () => void | Promise<void>> = {
    'blank-project': openBlankProjectWizard,
    'script-wizard': openScriptWizardModal,
    'visual-wizard': openVisualWizardModal,
    'concept-wizard': openConceptWizardModal,
    'asset-wizard': openAssetWizardModal,
    'storyboard-wizard': openStoryboardWizardModal,
  };
  wireWizardNavigationAndActions(WIZARD_SLIDES, projectActions);
}
