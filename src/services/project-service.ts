/**
 * ── NOTE ──
 * Project metadata (id, name, timestamps) is persisted via the abstracted
 * storageService. Persistence is server-backed so project records sync across
 * browser instances connected to the same backend.
 * This file stores project metadata ONLY — no API keys or auth tokens.
 * ─────────
 */

import type { AppliedCineProject } from '@/data/cine-project-loader';
import { buildBlankProjectFeaturesConfig } from '@/tree/project-feature-catalog';
import { getProjectFeaturesConfig } from '@/services/project-features-service';
import {
  activatePersistedProjectTreeSelection,
  primePersistedProjectTreeUi,
  resetProjectTreeUiRestoreFlag,
} from '@/tree/project-tree-service';
import {
  DEFAULT_PROJECT_SETTINGS,
  activeProjectId,
  applyProjectSnapshot,
  ensureProjectSettingsRecord,
  loadProjectFromCineFile,
  mergeDefaultProjectSettings,
  activeMoodBoardId,
  assetDetailData,
  assetLibrary,
  breakdownData,
  currentSceneData,
  deletedStoryboardFrames,
  locationLibrary,
  moodBoards,
  projectData,
  projectScratchPad,
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
  styleGuide,
  timelineClips,
  generationQueue,
} from '@/data/project-data';
import {
  LOCAL_PROJECTS_STORAGE_KEY,
  PROJECT_SETTINGS_STORAGE_KEY,
  PROJECT_TREE_UI_STORAGE_KEY,
} from '@/constants/storage-keys';
import { storageService } from '@/services/persistence';
import type { TreeNode } from '@/tree/tree-types';
import { serializeAppliedProject } from '@/services/project-serializer';
import { updateSaveStatus } from '@/services/status-bar-service';
import { loadAndApplyCineFile } from '@/data/cine-project-loader';
import { colorState } from '@/color/color-state';

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

export function buildNextUntitledName(): string {
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
  const defaultMoodBoardId = `mb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
    referenceImages: {
      moodBoards: [
        {
          id: defaultMoodBoardId,
          name: 'Visual DNA',
          items: [],
          viewMode: 'grid',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      activeMoodBoardId: defaultMoodBoardId,
    },
    styleGuide: {
      colorPalette: [],
      lightingMood: '',
      lensStyle: '',
      visualTone: '',
      styleReference: '',
    },
    projectFeatures: buildBlankProjectFeaturesConfig(),
    generationQueue: [],
    reviewQueue: [],
    agentLog: [],
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

function refreshWorkspaceAfterProjectSwitch(projectId: string, displayName?: string): void {
  const name = displayName || String((projectData as { name?: unknown }).name ?? '');
  window.syncActiveProjectName?.(name);
  const refresh = window as unknown as Record<string, (() => void) | undefined>;
  refresh.renderFullTree?.();
  refresh.renderBreakdownTable?.();
  refresh.renderStoryboard?.();
  refresh.renderTimeline?.();
  refresh.hydrateScriptEditorFromProject?.();
  window.renderProjectsMenu?.();
  primePersistedProjectTreeUi(projectId);
  queueMicrotask(() => activatePersistedProjectTreeSelection(projectId));
}

/**
 * Load the project the user last had open (local snapshot, bundled `.cine`, or server project).
 * Call during boot before the first sidebar tree render.
 */
export async function restoreActiveProjectOnBoot(projectId: string): Promise<boolean> {
  if (!projectId) return false;

  hydrateProjectRegistryFromPersistence();
  prepareActiveProjectTreeUiForSwitch();
  resetProjectTreeUiRestoreFlag();

  const serverResult = await loadServerProject(projectId);
  if (serverResult) {
    refreshWorkspaceAfterProjectSwitch(projectId, serverResult.name);
    return true;
  }

  const entry = projectRegistry.find((p) => p.id === projectId);
  if (!entry) return false;

  let opened: CreateBlankProjectResult | null = null;
  if (entry.file) {
    if (activeProjectId !== projectId) {
      loadProjectFromCineFile(entry.file);
    }
    opened = { id: entry.id, name: String(projectData.name || entry.name) };
  } else {
    opened = openProject(projectId);
  }

  if (!opened) return false;
  refreshWorkspaceAfterProjectSwitch(projectId, opened.name);
  return true;
}

/** Load a server-resident writable .cine project via the /api/projects/:id/load endpoint. */
export async function loadServerProject(projectId: string): Promise<CreateBlankProjectResult | null> {
  try {
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/load`);
    if (!res.ok) {
      console.warn('CineGen: server project load failed', res.status);
      return null;
    }
    const payload = await res.json();
    const applied = payload.applied as AppliedCineProject;
    const meta = payload.meta as { id: string; name: string; writable?: boolean };
    if (!applied || !meta) return null;
    applyProjectSnapshot(applied, {
      id: meta.id,
      name: meta.name,
      // no 'file' → marks as server-resident (writable)
    });
    updateSaveStatus('idle');
    // Prime dirty set lightly so an immediate explicit Save or first mutation will flush real docs
    markProjectDirty(['screenplay']);
    return { id: meta.id, name: meta.name };
  } catch (err) {
    console.warn('CineGen: failed to fetch server project', err);
    updateSaveStatus('error', 'Failed to load project from server');
    return null;
  }
}

/** Create a new server-resident .cine project, write initial manifest + documents, and load it back. */
export async function createNewProject(
  name: string,
  opts?: { screenplay?: string; entryMode?: string }
): Promise<CreateBlankProjectResult | null> {
  const id = `proj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        name,
        screenplay: opts?.screenplay || '',
        entryMode: opts?.entryMode || 'blank',
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('CineGen: create project failed', res.status, err);
      updateSaveStatus('error', 'Failed to create project');
      return null;
    }
    // Register in local registry so it appears in the project list immediately
    const payload = await res.json();
    if (!projectRegistry.find((p) => p.id === payload.id)) {
      projectRegistry.push({
        id: payload.id,
        name: payload.name,
        settings: { ...DEFAULT_PROJECT_SETTINGS },
      });
    }
    // Load back through the same server-resident path
    return await loadServerProject(payload.id);
  } catch (err) {
    console.warn('CineGen: failed to create new project', err);
    updateSaveStatus('error', 'Failed to create project');
    return null;
  }
}

/** Duplicate a bundled read-only sample into a new writable server-resident .cine project. */
export async function duplicateBundledProject(
  sampleFile: string,
  newName: string
): Promise<CreateBlankProjectResult | null> {
  try {
    const applied = loadAndApplyCineFile(sampleFile);
    const id = `proj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    // Create the server-resident project directory
    const createRes = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: newName, screenplay: applied.projectScreenplay?.text || '' }),
    });
    if (!createRes.ok) {
      console.warn('CineGen: duplicate project create failed', createRes.status);
      updateSaveStatus('error', 'Failed to duplicate project');
      return null;
    }

    // Serialize the loaded sample state and write documents
    const { documents } = serializeAppliedProject(applied, id, newName);
    const docRes = await fetch(`/api/projects/${encodeURIComponent(id)}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documents }),
    });
    if (!docRes.ok) {
      console.warn('CineGen: duplicate project document write failed', docRes.status);
      updateSaveStatus('error', 'Failed to write duplicated project documents');
      return null;
    }

    // Register and load back
    const payload = await createRes.json();
    if (!projectRegistry.find((p) => p.id === payload.id)) {
      projectRegistry.push({
        id: payload.id,
        name: payload.name,
        settings: { ...DEFAULT_PROJECT_SETTINGS },
      });
    }
    return await loadServerProject(payload.id);
  } catch (err) {
    console.warn('CineGen: failed to duplicate bundled project', err);
    updateSaveStatus('error', 'Failed to duplicate project');
    return null;
  }
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
    // Stored in the `.cinereferenceimages` document for `.cine` packages.
    // For local projects, this is simply part of the saved snapshot.
    referenceImages: {
      moodBoards: structuredClone(moodBoards),
      activeMoodBoardId: activeMoodBoardId,
    },
    styleGuide: {
      ...styleGuide,
      colorPalette: colorState.getPalette(),
    },
    projectFeatures: structuredClone(getProjectFeaturesConfig()),
    scratchPad: structuredClone(projectScratchPad),
    generationQueue: structuredClone(generationQueue),
    reviewQueue: [],
    agentLog: [],
  };
}

/* ── Dirty tracking + autosave (P0 foundation, server-resident projects only) ── */
const DIRTY_DOCS = new Set<string>();
let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

export function markProjectDirty(documentTypes: string[]): void {
  if (!documentTypes?.length) return;
  documentTypes.forEach((t) => DIRTY_DOCS.add(t));
  scheduleAutosave();
}

function scheduleAutosave(delayMs = 1200): void {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => { void flushDirtyDocuments(); }, delayMs);
}

export async function flushDirtyDocuments(): Promise<void> {
  if (!DIRTY_DOCS.size || !activeProjectId) return;

  const entry = projectRegistry.find((p) => p.id === activeProjectId);
  if (entry?.file) {
    // Bundled samples are read-only — clear and ignore
    DIRTY_DOCS.clear();
    return;
  }

  updateSaveStatus('saving');

  try {
    const snapshot = captureRuntimeProjectSnapshot();
    const dirtyDocTypes = Array.from(DIRTY_DOCS);
    const { documents } = serializeAppliedProject(
      snapshot,
      activeProjectId,
      String(entry?.name || (projectData as any)?.name || 'Untitled'),
      dirtyDocTypes
    );

    const res = await fetch(`/api/projects/${encodeURIComponent(activeProjectId)}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documents }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Server responded ${res.status}: ${errText}`);
    }

    DIRTY_DOCS.clear();
    updateSaveStatus('saved');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('CineGen autosave failed:', msg);
    updateSaveStatus('error', msg);
  }
}

/** Public trigger for explicit Save (toolbar, keybinding, or wizard completion). */
export async function triggerProjectSave(): Promise<void> {
  // Force all docs dirty for a full flush
  [
    'screenplay', 'storyboard', 'scenes', 'breakdown', 'characters', 'locations', 'treatment',
    'shotLibrary', 'cameraPresets', 'spatialAnnotations',
    'generationQueue', 'reviewQueue', 'costTracking', 'agentLog',
    'features',
  ].forEach((d) => DIRTY_DOCS.add(d));
  await flushDirtyDocuments();
}

/** Persist the full runtime snapshot for local projects. */
export function persistActiveProjectSnapshot(projectId = activeProjectId): void {
  if (!projectId) return;
  const entry = projectRegistry.find((p) => p.id === projectId);
  if (!entry || entry.file) return; // bundled `.cine` packages are read-only
  const record = readPersistedLocalProjects().find((item) => item.id === projectId);
  if (!record) return;
  persistLocalProject({
    ...record,
    name: entry.name,
    settings: { ...(entry.settings || {}) },
    snapshot: captureRuntimeProjectSnapshot(),
    updatedAt: new Date().toISOString(),
  });
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

/* ── Project export (download .cine.zip) ──────────────────────────────────── */

export async function exportProject(projectId = activeProjectId): Promise<void> {
  if (!projectId) return;
  const entry = projectRegistry.find((p) => p.id === projectId);
  if (!entry) return;

  // Flush dirty state before export
  await triggerProjectSave();

  // Fetch the zip
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/export`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Export failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${(entry.name || 'project').replace(/[^a-zA-Z0-9_-]/g, '_')}.cine.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function fetchExportManifest(
  projectId = activeProjectId,
): Promise<Record<string, unknown> | null> {
  if (!projectId) return null;
  try {
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/export/manifest`);
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/* ── Project import (upload .cine.zip) ─────────────────────────────────────── */

export interface ImportResult {
  ok: boolean;
  project?: { id: string; name: string; writable: boolean; lastModified: string };
  error?: string;
  missing?: string[];
}

export async function importProject(file: File): Promise<ImportResult> {
  const buffer = await file.arrayBuffer();
  const res = await fetch('/api/projects/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: buffer,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error: data.error || `HTTP ${res.status}`,
      missing: data.missing,
    };
  }
  return { ok: true, project: data };
}

