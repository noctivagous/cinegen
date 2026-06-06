import { patchAppShellState } from '@/stores/app-shell-state';
import { PREFERENCES_STORAGE_KEY } from '@/constants/storage-keys';
import { storageService } from '@/services/persistence';

export const PREFS_KEY = PREFERENCES_STORAGE_KEY;

export interface CineGenPreferences {
  scriptEditorChipsEnabled: boolean;
  scriptEditorAnchorsEnabled: boolean;
  scriptEditorBoxOutlinesEnabled: boolean;
  scriptEditorStoryboardFramesEnabled: boolean;
  scriptEditorFontSizePx: number;
  scriptEditorInsertBarVisible: boolean;
  inspectorVisible: boolean;
  projectSidebarVisible: boolean;
  inspectorWidthPx: number;
  projectSidebarWidthPx: number;
  preprodSplitPercent: number;
  previsTimelineDockVisible: boolean;
  previsDrawerHeightPx: number;
  previsPaneSplitPercent: number;
  activeProjectId: string;
  statusBarScale: number;
  storyboardViewMode: 'shots' | 'sequence';
  storyboardThumbnailScale: number;
  projectHierarchyViewMode: 'tree' | 'grid' | 'grid-plus';
  cameraThumbnailScale: number;
  cameraChipsShowThumbnails: boolean;
  cameraChipsShowDescriptions: boolean;
  moodBoardImageProvider: string;
  moodBoardVideoProvider: string;
  moodBoardAudioProvider: string;
  moodBoardLLMProvider: string;
  projectTreeSelectedByProjectId?: Record<string, string>;
  uiMagnificationLevel: number;
}

export const DEFAULT_PREFERENCES: CineGenPreferences = {
  scriptEditorChipsEnabled: true,
  scriptEditorAnchorsEnabled: false,
  scriptEditorBoxOutlinesEnabled: true,
  scriptEditorStoryboardFramesEnabled: false,
  scriptEditorFontSizePx: 15,
  scriptEditorInsertBarVisible: false,
  inspectorVisible: true,
  projectSidebarVisible: true,
  inspectorWidthPx: 288,
  projectSidebarWidthPx: 280,
  preprodSplitPercent: 50,
  previsTimelineDockVisible: false,
  previsDrawerHeightPx: 0,
  previsPaneSplitPercent: 44,
  activeProjectId: 'proj-001',
  statusBarScale: 1.1,
  storyboardViewMode: 'shots',
  storyboardThumbnailScale: 1,
  cameraThumbnailScale: 1,
  cameraChipsShowThumbnails: true,
  cameraChipsShowDescriptions: true,
  projectHierarchyViewMode: 'tree',
  moodBoardImageProvider: '',
  moodBoardVideoProvider: '',
  moodBoardAudioProvider: '',
  moodBoardLLMProvider: '',
  uiMagnificationLevel: 1, // Medium (1.25x) is default
};

export function loadPreferences(): CineGenPreferences {
  try {
    const raw = storageService.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const parsed = JSON.parse(raw) as Partial<CineGenPreferences>;
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_PREFERENCES };
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch (error) {
    console.warn('CineGen: failed to read preferences, using defaults.', error);
    return { ...DEFAULT_PREFERENCES };
  }
}

export function savePreferences(
  nextPreferences: Partial<CineGenPreferences> | null | undefined
): CineGenPreferences {
  const current = window.CineGen?.preferences ?? loadPreferences();
  const merged = { ...DEFAULT_PREFERENCES, ...current, ...(nextPreferences || {}) };
  try {
    storageService.setItem(PREFS_KEY, JSON.stringify(merged));
  } catch (error) {
    console.warn('CineGen: failed to persist preferences.', error);
  }
  if (window.CineGen) {
    window.CineGen.preferences = merged;
  }
  const shellPatch: { preferences: CineGenPreferences; activeProjectId?: string } = {
    preferences: merged,
  };
  if (nextPreferences && Object.prototype.hasOwnProperty.call(nextPreferences, 'activeProjectId')) {
    shellPatch.activeProjectId = merged.activeProjectId;
  }
  patchAppShellState(shellPatch);
  return merged;
}

export function initCineGenPreferences(): void {
  window.CineGen = window.CineGen || {};
  window.CineGen.preferences = loadPreferences();
  window.CineGen.savePreferences = savePreferences;
  window.CineGen.preferenceKey = PREFS_KEY;
  window.CineGen.loaderVersion = '2.0-lit';
  const prefs = window.CineGen.preferences;
  document.documentElement.style.setProperty('--cl-thumb-scale', String(prefs.cameraThumbnailScale ?? 1));
  
  // Apply UI magnification on load
  if (typeof prefs.uiMagnificationLevel === 'number') {
    import('@/services/magnification').then(m => m.applyMagnification(prefs.uiMagnificationLevel));
  }
}
