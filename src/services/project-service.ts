/**
 * ── NOTE ──
 * Project metadata (id, name, timestamps) is persisted via the abstracted
 * storageService. Persistence is server-backed so project records sync across
 * browser instances connected to the same backend.
 * This file stores project metadata ONLY — no API keys or auth tokens.
 * ─────────
 */

import type { AppliedCineProject } from '@/data/cine-project-loader';
import {
  DEFAULT_PROJECT_SETTINGS,
  activeProjectId,
  applyProjectSnapshot,
  ensureProjectSettingsRecord,
  mergeDefaultProjectSettings,
  assetDetailData,
  assetLibrary,
  breakdownData,
  currentSceneData,
  deletedStoryboardFrames,
  locationLibrary,
  projectData,
  projectRegistry,
  projectScreenplay,
  projectTreatment,
  previsSelectionState,
  referenceGenerationStatus,
  sceneReferenceOverrides,
  selectedStoryboardFrameId,
  storyboardFrames,
  storyboardReferenceBank,
  storyboardVisibility,
  timelineClips,
} from '@/data/project-data';
import {
  LOCAL_PROJECTS_STORAGE_KEY,
  PROJECT_SETTINGS_STORAGE_KEY,
  PROJECT_TREE_UI_STORAGE_KEY,
} from '@/constants/storage-keys';
import { storageService } from '@/services/persistence';
import type { TreeNode } from '@/tree/tree-types';

export type CreateBlankProjectResult = {
  id: string;
  name: string;
};

type PersistedProjectRecord = {
  id: string;
  name: string;
  settings: Record<string, unknown>;
  snapshot: AppliedCineProject;
  updatedAt: string;
};

type PersistedProjectSettingsEntry = {
  name?: string;
  settings: Record<string, unknown>;
  updatedAt: string;
};

function buildNextUntitledName(): string {
  const base = 'Untitled Production';
  const taken = new Set(
    projectRegistry.map((project) => String(project.name || '').trim().toLowerCase()).filter(Boolean)
  );
  if (!taken.has(base.toLowerCase())) return base;
  let idx = 2;
  while (taken.has(`${base} ${idx}`.toLowerCase())) idx += 1;
  return `${base} ${idx}`;
}

function generateLocalProjectId(): string {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `proj-local-${stamp}-${rand}`;
}

function createBlankSnapshot(projectName: string): AppliedCineProject {
  return {
    projectScreenplay: { format: 'fountain', text: '' },
    projectData: { name: projectName, type: 'project', icon: 'fa-film', expanded: true, children: [] },
    projectTreatment: {},
    currentSceneData: {},
    storyboardFrames: [],
    deletedStoryboardFrames: [],
    selectedStoryboardFrameId: null,
    storyboardVisibility: { scene: true, frame: true, notes: true },
    storyboardReferenceBank: { characters: [], locations: [], interiors: [], exteriors: [] },
    sceneReferenceOverrides: {},
    referenceGenerationStatus: 'idle',
    previsSelectionState: {
      sceneId: null,
      shotId: null,
      frameId: null,
      scriptRange: null,
      timelineItemId: null,
    },
    timelineClips: [],
    locationLibrary: [],
    assetLibrary: {
      characters: [],
      locations: [],
      props: [],
      wardrobe: [],
      vehicles: [],
      effects: [],
      media: { generated: [], imported: [] },
    },
    breakdownData: [],
    assetDetailData: {},
  };
}

function readPersistedLocalProjects(): PersistedProjectRecord[] {
  try {
    const raw = storageService.getItem(LOCAL_PROJECTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as PersistedProjectRecord[]) : [];
  } catch (error) {
    console.warn('CineGen: failed to read local project store.', error);
    return [];
  }
}

function writePersistedLocalProjects(records: PersistedProjectRecord[]): void {
  try {
    storageService.setItem(LOCAL_PROJECTS_STORAGE_KEY, JSON.stringify(records));
  } catch (error) {
    console.warn('CineGen: failed to persist local projects.', error);
  }
}

function persistLocalProject(record: PersistedProjectRecord): void {
  const current = readPersistedLocalProjects();
  const next = current.filter((item) => item.id !== record.id);
  next.push(record);
  writePersistedLocalProjects(next);
}

function createBlankProjectLocal(projectName?: string): CreateBlankProjectResult {
  const name = String(projectName || '').trim() || buildNextUntitledName();
  const id = generateLocalProjectId();
  const settings = { ...DEFAULT_PROJECT_SETTINGS };
  const snapshot = createBlankSnapshot(name);

  applyProjectSnapshot(snapshot, { id, name, settings });
  persistLocalProject({
    id,
    name,
    settings,
    snapshot,
    updatedAt: new Date().toISOString(),
  });

  return { id, name };
}

export function createBlankProject(projectName?: string): CreateBlankProjectResult {
  return createBlankProjectLocal(projectName);
}

function hydrateLocalProjectRegistry(): void {
  const records = readPersistedLocalProjects();
  if (!records.length) return;
  const knownIds = new Set(projectRegistry.map((project) => project.id));
  for (const record of records) {
    if (knownIds.has(record.id)) continue;
    projectRegistry.push({
      id: record.id,
      name: record.name,
      settings: { ...DEFAULT_PROJECT_SETTINGS, ...(record.settings || {}) },
    });
    knownIds.add(record.id);
  }
}

function openProjectLocal(projectId: string): CreateBlankProjectResult | null {
  const record = readPersistedLocalProjects().find((item) => item.id === projectId);
  if (!record) return null;
  applyProjectSnapshot(record.snapshot, {
    id: record.id,
    name: record.name,
    settings: record.settings,
  });
  return { id: record.id, name: record.name };
}

export function openProject(projectId: string): CreateBlankProjectResult | null {
  return openProjectLocal(projectId);
}

function readProjectSettingsStore(): Record<string, PersistedProjectSettingsEntry> {
  try {
    const raw = storageService.getItem(PROJECT_SETTINGS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, PersistedProjectSettingsEntry>)
      : {};
  } catch (error) {
    console.warn('CineGen: failed to read project settings store.', error);
    return {};
  }
}

function writeProjectSettingsStore(store: Record<string, PersistedProjectSettingsEntry>): void {
  try {
    storageService.setItem(PROJECT_SETTINGS_STORAGE_KEY, JSON.stringify(store));
  } catch (error) {
    console.warn('CineGen: failed to persist project settings.', error);
  }
}

/** Merge saved settings/name onto registry entries (bundled `.cine` + local). */
export function hydrateProjectSettingsFromPersistence(): void {
  const store = readProjectSettingsStore();
  for (const project of projectRegistry) {
    const saved = store[project.id];
    if (!saved) continue;
    if (saved.settings && typeof saved.settings === 'object') {
      project.settings = mergeDefaultProjectSettings({
        ...(project.settings || {}),
        ...saved.settings,
      });
    }
    const savedName = saved.name == null ? '' : String(saved.name).trim();
    if (savedName) project.name = savedName;
  }
}

/** Persist active project settings to local storage (and local-project snapshot when applicable). */
export function persistActiveProjectSettings(projectId = activeProjectId): void {
  if (!projectId) return;

  const entry = projectRegistry.find((p) => p.id === projectId);
  if (!entry) return;

  ensureProjectSettingsRecord(entry);
  const store = readProjectSettingsStore();
  store[projectId] = {
    name: entry.name,
    settings: { ...(entry.settings || {}) },
    updatedAt: new Date().toISOString(),
  };
  writeProjectSettingsStore(store);

  if (!entry.file) {
    const record = readPersistedLocalProjects().find((item) => item.id === projectId);
    if (record) {
      persistLocalProject({
        ...record,
        name: entry.name,
        settings: { ...(entry.settings || {}) },
        updatedAt: new Date().toISOString(),
      });
    }
  }
}

export function hydrateProjectRegistryFromPersistence(): void {
  hydrateLocalProjectRegistry();
  hydrateProjectSettingsFromPersistence();
}

function cloneProjectDataTree(): Record<string, unknown> {
  return structuredClone(projectData) as Record<string, unknown>;
}

export function captureRuntimeProjectSnapshot(): AppliedCineProject {
  return {
    projectScreenplay: { ...projectScreenplay },
    projectData: cloneProjectDataTree(),
    projectTreatment: structuredClone(projectTreatment) as Record<string, unknown>,
    currentSceneData: structuredClone(currentSceneData) as Record<string, unknown>,
    storyboardFrames: structuredClone(storyboardFrames),
    deletedStoryboardFrames: structuredClone(deletedStoryboardFrames),
    selectedStoryboardFrameId: selectedStoryboardFrameId,
    storyboardVisibility: { ...storyboardVisibility },
    storyboardReferenceBank: structuredClone(storyboardReferenceBank) as Record<string, unknown>,
    sceneReferenceOverrides: structuredClone(sceneReferenceOverrides) as Record<string, unknown>,
    referenceGenerationStatus,
    previsSelectionState: structuredClone(previsSelectionState),
    timelineClips: structuredClone(timelineClips),
    locationLibrary: structuredClone(locationLibrary),
    assetLibrary: structuredClone(assetLibrary) as Record<string, unknown>,
    breakdownData: structuredClone(breakdownData),
    assetDetailData: structuredClone(assetDetailData) as Record<string, unknown>,
  };
}

function treeNodesMatch(saved: TreeNode, target: TreeNode): boolean {
  if (saved.type !== target.type) return false;
  if (saved.sceneId && target.sceneId) return saved.sceneId === target.sceneId;
  if (saved.shotId != null && target.shotId != null) return saved.shotId === target.shotId;
  if (saved.frameId != null && target.frameId != null) return saved.frameId === target.frameId;
  if (saved.referenceCategory && target.referenceCategory) {
    return saved.referenceCategory === target.referenceCategory;
  }
  if (saved.detailKey && target.detailKey) return saved.detailKey === target.detailKey;
  return saved.name === target.name;
}

function applyExpandedFromSavedTree(target: TreeNode, saved: TreeNode): void {
  if (typeof saved.expanded === 'boolean') target.expanded = saved.expanded;
  const savedChildren = saved.children ?? [];
  for (const child of target.children ?? []) {
    const match = savedChildren.find((s) => treeNodesMatch(s, child));
    if (match) applyExpandedFromSavedTree(child, match);
  }
}

function readProjectTreeUiStore(): Record<string, Record<string, unknown>> {
  try {
    const raw = storageService.getItem(PROJECT_TREE_UI_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, Record<string, unknown>>)
      : {};
  } catch (error) {
    console.warn('CineGen: failed to read project tree UI store.', error);
    return {};
  }
}

function writeProjectTreeUiStore(store: Record<string, Record<string, unknown>>): void {
  try {
    storageService.setItem(PROJECT_TREE_UI_STORAGE_KEY, JSON.stringify(store));
  } catch (error) {
    console.warn('CineGen: failed to persist project tree UI store.', error);
  }
}

function savedTreeForProject(projectId: string): TreeNode | null {
  const entry = projectRegistry.find((p) => p.id === projectId);
  if (!entry) return null;
  if (!entry.file) {
    const record = readPersistedLocalProjects().find((item) => item.id === projectId);
    const tree = record?.snapshot?.projectData;
    return tree && typeof tree === 'object' ? (tree as TreeNode) : null;
  }
  const stored = readProjectTreeUiStore()[projectId];
  return stored && typeof stored === 'object' ? (stored as TreeNode) : null;
}

/** Persist sidebar hierarchy open/closed state for the active project (immediate). */
export function persistProjectTreeExpandedState(): void {
  const projectId = activeProjectId;
  if (!projectId) return;

  const entry = projectRegistry.find((p) => p.id === projectId);
  const treeSnapshot = cloneProjectDataTree();

  if (entry && !entry.file) {
    const record = readPersistedLocalProjects().find((item) => item.id === projectId);
    if (!record) return;
    persistLocalProject({
      ...record,
      snapshot: { ...record.snapshot, projectData: treeSnapshot },
      updatedAt: new Date().toISOString(),
    });
    return;
  }

  const store = readProjectTreeUiStore();
  store[projectId] = treeSnapshot;
  writeProjectTreeUiStore(store);
}

/** Merge saved `expanded` flags onto the in-memory project tree. */
export function restoreProjectTreeExpandedState(projectId?: string): void {
  const id = projectId || activeProjectId;
  if (!id) return;
  const saved = savedTreeForProject(id);
  if (!saved) return;
  applyExpandedFromSavedTree(projectData as TreeNode, saved);
}

export function prepareActiveProjectTreeUiForSwitch(): void {
  persistProjectTreeExpandedState();
}

