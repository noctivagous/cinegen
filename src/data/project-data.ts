import {
  buildRegistryFromCineFiles,
  ensureCinePackagesLoaded,
  listCineProjectFiles,
  loadAndApplyCineFile,
  loadCineProjectByFile,
} from '@/data/cine-project-loader';
import type { AppliedCineProject } from '@/data/cine-project-loader';
import type { ProjectRegistryEntry } from '@/data/cine-project-types';
import { isAppShellInitialized, patchAppShellState } from '@/stores/app-shell-state';
import type {
  SceneReferenceOverrides,
  StoryboardReferenceBank,
  StoryboardReferenceGenerationStatus,
} from '@/storyboard/storyboard-types';
import { loadMoodBoardsOverlay, persistMoodBoardsAutosave } from '@/moodboards/moodboard-persistence';
import { syncProjectShotFrameLinks } from '@/workspace/shot-frame-bridge';
import { normalizeAppliedCineProject } from '@/data/project-snapshot-normalize';

/** Screenplay storage — plain Fountain text plus format tag for future rich/structured exports */
export type ProjectScreenplay = {
  format: 'fountain';
  text: string;
};

export type PrevisSelectionState = {
  sceneId: string | null;
  shotId: number | null;
  frameId: number | null;
  scriptRange: { start: number; end: number } | null;
  timelineItemId: string | null;
};

const DEFAULT_CINE_FILE = 'ascension-stream.cine';

export let projectScreenplay: ProjectScreenplay = { format: 'fountain', text: '' };

export function getProjectFountainText(): string {
  return projectScreenplay?.text ?? '';
}

export function setProjectFountainText(text: string): void {
  projectScreenplay = { format: 'fountain', text: text ?? '' };
}

/** Annotation mark persisted in the sidecar document. */
export interface AnnotationMark {
  from: number;
  to: number;
  category: string;
  note?: string;
}

/** Sidecar document shape stored in `annotations.cineannotations`. */
export interface CineAnnotationsDoc {
  format: 'cine-annotations';
  version: 1;
  marks: AnnotationMark[];
}

/** Script annotation sidecar — breakdown highlights persisted per project. */
export let projectAnnotations: CineAnnotationsDoc = { format: 'cine-annotations', version: 1, marks: [] };

export function getProjectAnnotations(): CineAnnotationsDoc {
  return projectAnnotations;
}

export function setProjectAnnotations(doc: CineAnnotationsDoc): void {
  projectAnnotations = doc;
}

/** Project registry and active project — entries map to `.cine` package dirs in `project-files/`. */
export let projectRegistry: ProjectRegistryEntry[] = [];
export let activeProjectId = '';

export function setActiveProjectId(projectId: string): void {
  activeProjectId = projectId;
}

export const DEFAULT_PROJECT_SETTINGS = {
  aspectRatio: '2.39:1',
  frameRate: '24',
  timecodeMode: 'ndf',
  defaultResolution: '1024x428',
  colorSpace: 'Rec.709',
};

export const PROJECT_ASPECT_RATIOS_ALLOWED = new Set([
  '16:9',
  '9:16',
  '1:1',
  '21:9',
  '2.39:1',
  '2.00:1',
  '1.85:1',
  '4:3',
  '1.37:1',
]);

export function normalizeProjectAspectRatio(value: string | null | undefined) {
  const v = value == null ? '' : String(value).trim();
  if (PROJECT_ASPECT_RATIOS_ALLOWED.has(v)) return v;
  return '16:9';
}

/** Optgroups for Project Settings → default resolution (WxH). Active: 480p + 720p only. */
export function getProjectResolutionOptionGroups(aspectRatio: string) {
  const G = 'Rendering resolution';
  const key = normalizeProjectAspectRatio(aspectRatio);

  const oneGroup = (opt480: any, opt720: any) => [{ groupLabel: G, options: [opt480, opt720] }];

  const LANDSCAPE_16_9 = oneGroup(
    { value: '854x480', label: '854 × 480 (480p)' },
    { value: '1280x720', label: '1280 × 720 (720p)' }
  );

  const PORTRAIT_9_16 = oneGroup(
    { value: '480x854', label: '480 × 854 (480p)' },
    { value: '720x1280', label: '720 × 1280 (720p)' }
  );

  const SQUARE_1_1 = oneGroup(
    { value: '480x480', label: '480 × 480 (480p)' },
    { value: '720x720', label: '720 × 720 (720p)' }
  );

  const ULTRAWIDE_21_9 = oneGroup(
    { value: '1280x549', label: '1280 × 549 (480p-class UW)' },
    { value: '1680x720', label: '1680 × 720 (720p-class UW)' }
  );

  const SCOPE_239 = oneGroup(
    { value: '1024x428', label: '1024 × 428 (480p-class scope)' },
    { value: '1920x804', label: '1920 × 804 (720p-class scope)' }
  );

  const RATIO_2_1 = oneGroup(
    { value: '960x480', label: '960 × 480 (480p-class 2:1)' },
    { value: '1920x960', label: '1920 × 960 (720p-class 2:1)' }
  );

  const FLAT_185 = oneGroup(
    { value: '854x462', label: '854 × 462 (480p-class flat)' },
    { value: '1280x692', label: '1280 × 692 (720p-class flat)' }
  );

  const TV_4_3 = oneGroup(
    { value: '640x480', label: '640 × 480 (480p 4:3)' },
    { value: '960x720', label: '960 × 720 (720p-class 4:3)' }
  );

  const ACADEMY_137 = oneGroup(
    { value: '720x526', label: '720 × 526 (480p-class academy)' },
    { value: '1280x934', label: '1280 × 934 (720p-class academy)' }
  );

  const map: Record<string, any[]> = {
    '16:9': LANDSCAPE_16_9,
    '9:16': PORTRAIT_9_16,
    '1:1': SQUARE_1_1,
    '21:9': ULTRAWIDE_21_9,
    '2.39:1': SCOPE_239,
    '2.00:1': RATIO_2_1,
    '1.85:1': FLAT_185,
    '4:3': TV_4_3,
    '1.37:1': ACADEMY_137,
  };

  return map[key] || LANDSCAPE_16_9;
}

export function normalizeProjectResolutionForAspect(aspectRatio: string, resolution: string | null | undefined) {
  const groups = getProjectResolutionOptionGroups(aspectRatio);
  const want = resolution == null ? '' : String(resolution).trim();
  const flat: string[] = [];
  groups.forEach((g: any) => {
    g.options.forEach((o: any) => flat.push(o.value));
  });
  if (want && flat.includes(want)) return want;
  return groups[0]?.options?.[0]?.value || DEFAULT_PROJECT_SETTINGS.defaultResolution;
}

export function mergeDefaultProjectSettings(raw: any) {
  const base = { ...DEFAULT_PROJECT_SETTINGS };
  if (!raw || typeof raw !== 'object') return base;
  const merged = { ...base, ...raw };
  merged.aspectRatio = normalizeProjectAspectRatio(merged.aspectRatio);
  merged.defaultResolution = normalizeProjectResolutionForAspect(
    merged.aspectRatio,
    merged.defaultResolution
  );
  return merged;
}

export function ensureProjectSettingsRecord(project: any) {
  if (!project) return null;
  project.settings = mergeDefaultProjectSettings(project.settings);
  return project.settings;
}

export function getActiveProjectRegistryEntry(): ProjectRegistryEntry | undefined {
  if (!activeProjectId) return undefined;
  return projectRegistry.find((p) => p.id === activeProjectId);
}

export function getActiveProjectSettings() {
  const project = getActiveProjectRegistryEntry();
  if (!project) return { ...DEFAULT_PROJECT_SETTINGS };
  return { ...ensureProjectSettingsRecord(project) };
}

export let projectData: Record<string, unknown> = { name: 'Project', type: 'project', children: [] };
export let projectTreatment: Record<string, unknown> = {};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let currentSceneData: Record<string, any> = {};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let storyboardFrames: any[] = [];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let deletedStoryboardFrames: any[] = [];
export let selectedStoryboardFrameId: string | number | null = null;
export const storyboardVisibility = { scene: true, frame: true, notes: true };
export let storyboardReferenceBank: StoryboardReferenceBank = {
  characters: [],
  locations: [],
  interiors: [],
  exteriors: [],
};
export let sceneReferenceOverrides: SceneReferenceOverrides = {};
export let referenceGenerationStatus: StoryboardReferenceGenerationStatus = 'idle';
export let previsSelectionState: PrevisSelectionState = {
  sceneId: null,
  shotId: null,
  frameId: null,
  scriptRange: null,
  timelineItemId: null,
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let timelineClips: any[] = [];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let locationLibrary: any[] = [];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let assetLibrary: any = {
  characters: [],
  locations: [],
  props: [],
  vehicles: [],
  wardrobe: [],
  effects: [],
  audio: [],
  production: [],
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let breakdownData: any[] = [];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let assetDetailData: any = {};

export type StyleGuide = {
  colorPalette: string[];
  lightingMood: string;
  lensStyle: string;
  visualTone: string;
  styleReference: string;
};

export let styleGuide: StyleGuide = {
  colorPalette: [],
  lightingMood: '',
  lensStyle: '',
  visualTone: '',
  styleReference: '',
};

export type MoodBoardItemType = 'video' | 'image' | 'sound' | 'text';

export interface MoodBoardItem {
  id: string;
  type: MoodBoardItemType;
  label: string;
  source: string;
  active: boolean;
  notes: string;
  order: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>;
}

export interface MoodBoard {
  id: string;
  name: string;
  items: MoodBoardItem[];
  viewMode: 'grid' | 'kanban';
  createdAt: number;
  updatedAt: number;
}

export let moodBoards: MoodBoard[] = [];
export let activeMoodBoardId: string | null = null;

export function normalizeMoodBoards(raw: unknown): MoodBoard[] {
  if (!Array.isArray(raw)) return [];
  const boards: MoodBoard[] = [];
  for (const b of raw) {
    if (!b || typeof b !== 'object') continue;
    const board = b as Partial<MoodBoard> & Record<string, unknown>;
    const id = typeof board.id === 'string' ? board.id : '';
    const name = typeof board.name === 'string' ? board.name : '';
    if (!id || !name) continue;
    boards.push({
      id,
      name,
      items: Array.isArray(board.items) ? (board.items as MoodBoardItem[]) : [],
      viewMode: board.viewMode === 'kanban' ? 'kanban' : 'grid',
      createdAt: typeof board.createdAt === 'number' ? board.createdAt : Date.now(),
      updatedAt: typeof board.updatedAt === 'number' ? board.updatedAt : Date.now(),
    });
  }
  return boards;
}

/** Autosave mood boards after any mutation (bundled `.cine` overlay or local project snapshot). */
export function autosaveMoodBoards(): void {
  if (!activeProjectId) return;
  const entry = projectRegistry.find((p) => p.id === activeProjectId);
  persistMoodBoardsAutosave({
    projectId: activeProjectId,
    moodBoards,
    activeMoodBoardId,
    isBundledCine: Boolean(entry?.file),
  });
  void import('@/services/project-service').then(({ markProjectDirty }) => {
    markProjectDirty(['referenceImages']);
  });
  if (typeof window.refreshProjectTree === 'function') {
    window.refreshProjectTree();
  }
}

function applyMoodBoardsOverlayForProject(projectId: string, hasCineFile: boolean): void {
  if (!hasCineFile || !projectId) return;
  const overlay = loadMoodBoardsOverlay(projectId);
  if (!overlay) return;
  moodBoards = normalizeMoodBoards(overlay.moodBoards);
  activeMoodBoardId = overlay.activeMoodBoardId;
  if (typeof window.refreshProjectTree === 'function') {
    window.refreshProjectTree();
  }
}

export function addMoodBoard(name: string): MoodBoard {
  const board: MoodBoard = {
    id: `mb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    items: [],
    viewMode: 'grid',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  moodBoards.push(board);
  autosaveMoodBoards();
  return board;
}

export function removeMoodBoard(id: string): void {
  moodBoards = moodBoards.filter((b) => b.id !== id);
  if (activeMoodBoardId === id) activeMoodBoardId = null;
  autosaveMoodBoards();
}

export function getMoodBoard(id: string): MoodBoard | undefined {
  return moodBoards.find((b) => b.id === id);
}

export function setActiveMoodBoard(id: string | null): void {
  activeMoodBoardId = id;
  autosaveMoodBoards();
}

export function addMoodBoardItem(boardId: string, item: Omit<MoodBoardItem, 'id'>): MoodBoardItem | null {
  const board = getMoodBoard(boardId);
  if (!board) return null;
  const full: MoodBoardItem = { ...item, id: `mbi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
  board.items.push(full);
  board.updatedAt = Date.now();
  autosaveMoodBoards();
  return full;
}

export function removeMoodBoardItem(boardId: string, itemId: string): void {
  const board = getMoodBoard(boardId);
  if (!board) return;
  board.items = board.items.filter((i) => i.id !== itemId);
  board.updatedAt = Date.now();
  autosaveMoodBoards();
}

export function updateMoodBoardItem(boardId: string, itemId: string, partial: Partial<MoodBoardItem>): void {
  const board = getMoodBoard(boardId);
  if (!board) return;
  const idx = board.items.findIndex((i) => i.id === itemId);
  if (idx === -1) return;
  board.items[idx] = { ...board.items[idx], ...partial };
  board.updatedAt = Date.now();
  autosaveMoodBoards();
}

export function toggleMoodBoardItemActive(boardId: string, itemId: string): void {
  const board = getMoodBoard(boardId);
  if (!board) return;
  const item = board.items.find((i) => i.id === itemId);
  if (item) item.active = !item.active;
  autosaveMoodBoards();
}

function resolveInitialCineFile(): string | null {
  const available = listCineProjectFiles();
  if (available.includes(DEFAULT_CINE_FILE)) return DEFAULT_CINE_FILE;
  return available[0] ?? null;
}

/** Notify Lit storyboard panel and status bar after frames change. */
export function notifyStoryboardFramesChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('storyboard-frames-changed'));
  }
}

export function notifyStoryboardReferencesChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('storyboard-references-changed'));
  }
}

export function setPrevisSelectionState(
  next: Partial<PrevisSelectionState>,
  opts?: { emit?: boolean }
): void {
  previsSelectionState = { ...previsSelectionState, ...next };
  if (opts?.emit === false) return;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('previs-selection-changed', { detail: previsSelectionState }));
  }
}

function normalizeAssetLibrary(raw: unknown): Record<string, unknown> {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
  return {
    characters: asArray(source.characters),
    locations: asArray(source.locations),
    props: asArray(source.props),
    vehicles: asArray(source.vehicles),
    wardrobe: asArray(source.wardrobe),
    effects: asArray(source.effects),
    audio: asArray(source.audio),
    production: asArray(source.production),
    media:
      source.media && typeof source.media === 'object'
        ? (source.media as Record<string, unknown[]>)
        : {},
  };
}

function applyMutableProjectState(applied: AppliedCineProject): void {
  applied = normalizeAppliedCineProject(applied);
  projectScreenplay = applied.projectScreenplay;
  projectData = applied.projectData;
  projectTreatment = applied.projectTreatment;
  currentSceneData = applied.currentSceneData;
  storyboardFrames = applied.storyboardFrames;
  deletedStoryboardFrames = applied.deletedStoryboardFrames;
  selectedStoryboardFrameId = applied.selectedStoryboardFrameId;
  Object.assign(storyboardVisibility, applied.storyboardVisibility);
  storyboardReferenceBank = (applied.storyboardReferenceBank || {
    characters: [],
    locations: [],
    interiors: [],
    exteriors: [],
  }) as StoryboardReferenceBank;
  sceneReferenceOverrides = (applied.sceneReferenceOverrides || {}) as SceneReferenceOverrides;
  referenceGenerationStatus = (applied.referenceGenerationStatus as StoryboardReferenceGenerationStatus) || 'idle';
  previsSelectionState = applied.previsSelectionState ?? {
    sceneId: null,
    shotId: null,
    frameId: null,
    scriptRange: null,
    timelineItemId: null,
  };
  timelineClips = applied.timelineClips;
  assetLibrary = normalizeAssetLibrary(applied.assetLibrary);
  locationLibrary = Array.isArray(applied.locationLibrary)
    ? applied.locationLibrary
    : (assetLibrary.locations as any[]);
  breakdownData = applied.breakdownData;
  assetDetailData = applied.assetDetailData;
  projectAnnotations = applied.projectAnnotations && typeof applied.projectAnnotations === 'object'
    ? (applied.projectAnnotations as CineAnnotationsDoc)
    : { format: 'cine-annotations', version: 1, marks: [] };

  // Mood boards are stored in `.cinereferenceimages` for `.cine` packages,
  // and included in local-project snapshots via the same field.
  const ref = applied.referenceImages && typeof applied.referenceImages === 'object' ? applied.referenceImages : {};
  const rawMoodBoards = (ref as Record<string, unknown>).moodBoards;
  moodBoards = normalizeMoodBoards(rawMoodBoards);
  activeMoodBoardId =
    typeof (ref as Record<string, unknown>).activeMoodBoardId === 'string'
      ? String((ref as Record<string, unknown>).activeMoodBoardId)
      : null;

  // Style guide
  const rawStyleGuide = applied.styleGuide;
  if (rawStyleGuide && typeof rawStyleGuide === 'object') {
    const sg = rawStyleGuide as Record<string, unknown>;
    styleGuide = {
      colorPalette: Array.isArray(sg.colorPalette) ? (sg.colorPalette as string[]) : [],
      lightingMood: typeof sg.lightingMood === 'string' ? sg.lightingMood : '',
      lensStyle: typeof sg.lensStyle === 'string' ? sg.lensStyle : '',
      visualTone: typeof sg.visualTone === 'string' ? sg.visualTone : '',
      styleReference: typeof sg.styleReference === 'string' ? sg.styleReference : '',
    };
  } else {
    styleGuide = { colorPalette: [], lightingMood: '', lensStyle: '', visualTone: '', styleReference: '' };
  }

  // Sync loaded color palette into the live color state
  if (typeof window !== 'undefined') {
    import('@/color/color-state').then(({ colorState }) => {
      colorState.setPalette(styleGuide.colorPalette);
    }).catch(() => { /* ignore */ });
  }

  syncProjectShotFrameLinks({ migrateOrphans: false });
  notifyStoryboardFramesChanged();
  notifyStoryboardReferencesChanged();

  void import('@/services/project-features-service').then((svc) => {
    svc.resetProjectFeaturesConfigCache();
    svc.setProjectFeaturesConfig(svc.normalizeConfigForProject(applied), { persist: false });
    if (typeof window.refreshProjectTree === 'function') {
      window.refreshProjectTree();
    }
  });
}

function upsertRegistryEntry(
  entry: Pick<ProjectRegistryEntry, 'id' | 'name' | 'file'> & { settings?: Record<string, unknown> }
): ProjectRegistryEntry {
  const existing = projectRegistry.find((project) => project.id === entry.id);
  if (existing) {
    existing.name = entry.name;
    existing.file = entry.file;
    existing.settings = mergeDefaultProjectSettings(entry.settings ?? existing.settings);
    return existing;
  }

  const created: ProjectRegistryEntry = {
    id: entry.id,
    name: entry.name,
    settings: mergeDefaultProjectSettings(entry.settings),
    file: entry.file,
  };
  projectRegistry.push(created);
  return created;
}

/**
 * Apply a project snapshot to runtime state, then mark it active.
 * Used by local and future backend project persistence implementations.
 */
export function applyProjectSnapshot(
  applied: AppliedCineProject,
  meta: Pick<ProjectRegistryEntry, 'id' | 'name' | 'file'> & { settings?: Record<string, unknown> }
): void {
  applyMutableProjectState(applied);
  const entry = upsertRegistryEntry(meta);
  activeProjectId = entry.id;
  if (isAppShellInitialized()) {
    patchAppShellState({ activeProjectId: entry.id });
  }
  applyMoodBoardsOverlayForProject(entry.id, Boolean(meta.file));
}

/** Reload mutable project state from a `.cine` package in `project-files/`. */
export function loadProjectFromCineFile(filename: string): void {
  const applied = loadAndApplyCineFile(filename);
  const doc = loadCineProjectByFile(filename);
  applyProjectSnapshot(applied, {
    id: doc.id,
    name: doc.name,
    file: filename,
    settings: doc.settings as Record<string, unknown> | undefined,
  });
}

/** Load bundled `.cine` samples and apply the default project (called during boot). */
export async function initProjectData(): Promise<void> {
  await ensureCinePackagesLoaded();
  projectRegistry = buildRegistryFromCineFiles();
  const initialFile = resolveInitialCineFile();
  if (!initialFile) {
    activeProjectId = '';
    for (const p of projectRegistry) ensureProjectSettingsRecord(p);
    const { hydrateProjectSettingsFromPersistence } = await import('@/services/project-service');
    hydrateProjectSettingsFromPersistence();
    return;
  }

  const initial = loadAndApplyCineFile(initialFile);
  applyMutableProjectState(initial);
  activeProjectId = loadCineProjectByFile(initialFile).id;
  for (const p of projectRegistry) ensureProjectSettingsRecord(p);
  const { hydrateProjectSettingsFromPersistence } = await import('@/services/project-service');
  hydrateProjectSettingsFromPersistence();
  const activeEntry = projectRegistry.find((p) => p.id === activeProjectId);
  if (activeEntry?.name) projectData.name = activeEntry.name;
  if (activeProjectId && activeEntry?.file) {
    applyMoodBoardsOverlayForProject(activeProjectId, true);
  }
}

function bindWindowData<K extends string>(
  key: K,
  get: () => unknown,
  set?: (v: unknown) => void
): void {
  Object.defineProperty(window, key, {
    configurable: true,
    enumerable: true,
    get: () => get(),
    set: set ? (v) => set(v) : undefined,
  });
}

/** Expose project state on window for bundles still using declare globals. */
export function installProjectDataGlobals(): void {
  bindWindowData('projectRegistry', () => projectRegistry, (v) => {
    projectRegistry = v as typeof projectRegistry;
  });
  bindWindowData('activeProjectId', () => activeProjectId, (v) => {
    const id = String(v);
    activeProjectId = id;
    if (isAppShellInitialized()) {
      patchAppShellState({ activeProjectId: id });
    }
  });
  bindWindowData('projectTreatment', () => projectTreatment, (v) => {
    projectTreatment = v as typeof projectTreatment;
  });
  bindWindowData('currentSceneData', () => currentSceneData, (v) => {
    currentSceneData = v as typeof currentSceneData;
  });
  bindWindowData('storyboardFrames', () => storyboardFrames, (v) => {
    storyboardFrames = v as typeof storyboardFrames;
  });
  bindWindowData('deletedStoryboardFrames', () => deletedStoryboardFrames, (v) => {
    deletedStoryboardFrames = v as typeof deletedStoryboardFrames;
  });
  bindWindowData('selectedStoryboardFrameId', () => selectedStoryboardFrameId, (v) => {
    selectedStoryboardFrameId = v as typeof selectedStoryboardFrameId;
  });
  bindWindowData('timelineClips', () => timelineClips, (v) => {
    timelineClips = v as typeof timelineClips;
  });
  bindWindowData('previsSelectionState', () => previsSelectionState, (v) => {
    previsSelectionState = v as typeof previsSelectionState;
  });
  bindWindowData('storyboardReferenceBank', () => storyboardReferenceBank, (v) => {
    storyboardReferenceBank = v as typeof storyboardReferenceBank;
  });
  bindWindowData('sceneReferenceOverrides', () => sceneReferenceOverrides, (v) => {
    sceneReferenceOverrides = v as typeof sceneReferenceOverrides;
  });
  bindWindowData('referenceGenerationStatus', () => referenceGenerationStatus, (v) => {
    referenceGenerationStatus = v as typeof referenceGenerationStatus;
  });
  bindWindowData('locationLibrary', () => locationLibrary, (v) => {
    locationLibrary = v as typeof locationLibrary;
  });
  bindWindowData('assetLibrary', () => assetLibrary, (v) => {
    assetLibrary = v as typeof assetLibrary;
  });
  bindWindowData('breakdownData', () => breakdownData, (v) => {
    breakdownData = v as typeof breakdownData;
  });
  bindWindowData('projectData', () => projectData, (v) => {
    projectData = v as typeof projectData;
  });
  bindWindowData('projectScreenplay', () => projectScreenplay, (v) => {
    projectScreenplay = v as ProjectScreenplay;
  });
  bindWindowData('assetDetailData', () => assetDetailData, (v) => {
    assetDetailData = v as typeof assetDetailData;
  });
  bindWindowData('storyboardVisibility', () => storyboardVisibility);
  bindWindowData('moodBoards', () => moodBoards, (v) => { moodBoards = v as typeof moodBoards; });
  bindWindowData('activeMoodBoardId', () => activeMoodBoardId, (v) => { activeMoodBoardId = v as string | null; });

  const w = window as unknown as Record<string, unknown>;
  w.getProjectFountainText = getProjectFountainText;
  w.setProjectFountainText = setProjectFountainText;
  w.normalizeProjectAspectRatio = normalizeProjectAspectRatio;
  w.normalizeProjectResolutionForAspect = normalizeProjectResolutionForAspect;
  w.getProjectResolutionOptionGroups = getProjectResolutionOptionGroups;
  w.getActiveProjectSettings = getActiveProjectSettings;
  w.ensureProjectSettingsRecord = ensureProjectSettingsRecord;
  w.loadProjectFromCineFile = loadProjectFromCineFile;
  w.setPrevisSelectionState = setPrevisSelectionState;
}
