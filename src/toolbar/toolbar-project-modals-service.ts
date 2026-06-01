import type {
  CgProjectOpenDetail,
  CinegenProjectsModalList,
} from '@/components/modals/cinegen-projects-modal-list';
import { CG_PROJECT_OPEN } from '@/components/modals/cinegen-projects-modal-list';
import { activeProjectId, getActiveProjectRegistryEntry } from '@/data/project-data';
import { closeAllModalsExcept, closeModal, openModal } from '@/services/modal-manager';
import {
  hydrateProjectRegistryFromPersistence,
  loadServerProject,
  openProject as openProjectFromService,
  persistActiveProjectSettings,
  prepareActiveProjectTreeUiForSwitch,
} from '@/services/project-service';
import { closeAllToolbarSplitMenus } from '@/services/toolbar-split-service';
import { appShellStore } from '@/stores/app-shell';
import {
  activatePersistedProjectTreeSelection,
  primePersistedProjectTreeUi,
  resetProjectTreeUiRestoreFlag,
} from '@/tree/project-tree-service';
import { closeAiProvidersModal } from '@/settings/ai-api-settings-bundle';

declare const projectRegistry: Array<{
  id: string;
  name: string;
  settings?: Record<string, unknown>;
  file?: string;
}>;
declare const projectData: { name: string };
declare const loadProjectFromCineFile: (filename: string) => void;

export function closeProjectsModal(): void {
  const layout = document.getElementById('projects-modal-layout');
  const wizardBody = document.getElementById('projects-modal-wizard-body');
  if (layout) layout.style.removeProperty('display');
  if (wizardBody) wizardBody.style.display = 'none';
  closeModal('projects-modal');
}

export function closeSettingsModal(): void {
  closeModal('settings-modal');
}

export function closeProjectSettingsModal(): void {
  closeModal('project-settings-modal');
}

export function syncActiveProjectName(name: string): void {
  const trimmed = (name || '').trim();
  if (!trimmed) return;
  projectData.name = trimmed;
  const active = projectRegistry.find((p) => p.id === appShellStore.activeProjectId);
  if (active) active.name = trimmed;
  window.updateProjectTreeHeader?.();
  window.dispatchEvent(new CustomEvent('cinegen:project-name-changed', { detail: { name: trimmed } }));
}

export function renderProjectsModalList(): void {
  document.querySelector<CinegenProjectsModalList>('cinegen-projects-modal-list')?.refresh();
}

async function openProjectFromProjectsHub(projectId: string): Promise<void> {
  const isAlreadyActive = projectId === appShellStore.activeProjectId;

  // Try server-resident project first (new P0 tier)
  const serverResult = isAlreadyActive ? null : await loadServerProject(projectId);
  if (serverResult) {
    prepareActiveProjectTreeUiForSwitch();
    resetProjectTreeUiRestoreFlag();
    appShellStore.setActiveProjectId(projectId);
    syncActiveProjectName(projectData.name || serverResult.name);
    const refresh = window as unknown as Record<string, (() => void) | undefined>;
    refresh.renderFullTree?.();
    refresh.renderBreakdownTable?.();
    refresh.renderStoryboard?.();
    refresh.renderTimeline?.();
    refresh.hydrateScriptEditorFromProject?.();
    window.renderProjectsMenu?.();
    primePersistedProjectTreeUi(projectId);
    queueMicrotask(() => activatePersistedProjectTreeSelection(projectId));
    closeProjectsModal();
    return;
  }

  if (isAlreadyActive) {
    closeProjectsModal();
    return;
  }

  // Fallback to existing registry entry (bundled sample or flat local)
  const proj = projectRegistry.find((p) => p.id === projectId);
  if (!proj) return;
  prepareActiveProjectTreeUiForSwitch();
  resetProjectTreeUiRestoreFlag();
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
  primePersistedProjectTreeUi(projectId);
  queueMicrotask(() => activatePersistedProjectTreeSelection(projectId));
  closeProjectsModal();
}

export function wireProjectsModalList(): void {
  if ((window as any).__cgProjectOpenWired) return;
  (window as any).__cgProjectOpenWired = true;
  document.addEventListener(CG_PROJECT_OPEN, (e: Event) => {
    const { projectId } = (e as CustomEvent<CgProjectOpenDetail>).detail;
    void openProjectFromProjectsHub(projectId);
  });
}

export function openProjectsModal(): void {
  closeAllToolbarSplitMenus();
  closeAllModalsExcept('projects-modal');
  closeAiProvidersModal();
  hydrateProjectRegistryFromPersistence();
  renderProjectsModalList();
  const layout = document.getElementById('projects-modal-layout');
  const wizardBody = document.getElementById('projects-modal-wizard-body');
  if (layout) layout.style.removeProperty('display');
  if (wizardBody) wizardBody.style.display = 'none';
  openModal('projects-modal');
}

export function openSettingsModal(): void {
  closeAllToolbarSplitMenus();
  closeAllModalsExcept('settings-modal');
  closeAiProvidersModal();
  openModal('settings-modal');
}

export function initProjectSettingsAspectToResolutionSync(): void {
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

function readProjectSettingsSelectValue(id: string, fallback = ''): string {
  const el = document.getElementById(id) as HTMLSelectElement | null;
  return el?.value ?? fallback;
}

function populateProjectSettingsForm(): void {
  const active = getActiveProjectRegistryEntry();
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
  closeAiProvidersModal();
  populateProjectSettingsForm();
  openModal('project-settings-modal');
  (document.getElementById('project-settings-name') as HTMLInputElement | null)?.focus?.();
}

export function saveProjectSettingsModal(): void {
  const project = getActiveProjectRegistryEntry();
  const nameEl = document.getElementById('project-settings-name') as HTMLInputElement | null;
  if (!project || !nameEl) {
    console.warn('CineGen: cannot save project settings — no active project.');
    return;
  }

  const rawName = String(nameEl.value || '').trim();
  if (!rawName) {
    nameEl.focus();
    return;
  }

  window.ensureProjectSettingsRecord?.(project);
  const aspectRaw = readProjectSettingsSelectValue('project-settings-aspect', '16:9');
  project.settings = project.settings || {};
  project.settings.aspectRatio =
    typeof window.normalizeProjectAspectRatio === 'function'
      ? window.normalizeProjectAspectRatio(aspectRaw)
      : aspectRaw;
  const resRaw = readProjectSettingsSelectValue('project-settings-resolution');
  project.settings.defaultResolution =
    typeof window.normalizeProjectResolutionForAspect === 'function'
      ? window.normalizeProjectResolutionForAspect(project.settings.aspectRatio as string, resRaw)
      : resRaw;
  project.settings.frameRate = readProjectSettingsSelectValue(
    'project-settings-fps',
    String(project.settings.frameRate ?? '24')
  );
  project.settings.timecodeMode = readProjectSettingsSelectValue(
    'project-settings-tc-mode',
    String(project.settings.timecodeMode ?? 'ndf')
  );
  project.settings.colorSpace = readProjectSettingsSelectValue(
    'project-settings-colorspace',
    String(project.settings.colorSpace ?? 'Rec.709')
  );

  project.name = rawName;
  syncActiveProjectName(rawName);
  persistActiveProjectSettings(activeProjectId);
  window.updateProjectTreeHeader?.();
  window.renderProjectsMenu?.();

  const hintEl = document.getElementById('project-settings-save-hint');
  if (hintEl) hintEl.textContent = 'Saved.';
  closeProjectSettingsModal();
}
