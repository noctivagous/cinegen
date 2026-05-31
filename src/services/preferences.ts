/**
 * ── NOTE: Preferences use server-backed persistence ──
 *
 * Preferences are stored via the ServerPersistence back-end so state can be
 * shared across browser instances connected to the same server URL.
 *
 * This file stores UI preferences only (font size, sidebar widths, etc.).
 * It does NOT store API keys or auth tokens.
 * ─────────────────────────────────────────────────────────────────────
 */

import { patchAppShellState } from '@/stores/app-shell-state';
import { PREFERENCES_STORAGE_KEY } from '@/constants/storage-keys';
import { storageService } from '@/services/persistence';

export const PREFS_KEY = PREFERENCES_STORAGE_KEY;

export interface CineGenPreferences {
  scriptEditorChipsEnabled: boolean;
  scriptEditorAnchorsEnabled: boolean;
  scriptEditorBoxOutlinesEnabled: boolean;
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
  /** Storyboard pane: group by shot vs. flat sequence grid. */
  storyboardViewMode: 'shots' | 'sequence';
  /** Storyboard thumbnail scale (0.5–2). */
  storyboardThumbnailScale: number;
  /** Project hierarchy sidebar: tree, top-level grid, or grid with nested child buttons. */
  projectHierarchyViewMode: 'tree' | 'grid' | 'grid-plus';
  /** Mood board quick generation provider keys */
  moodBoardImageProvider: string;
  moodBoardVideoProvider: string;
  moodBoardAudioProvider: string;
  moodBoardLLMProvider: string;
  /** Last selected project hierarchy node name, keyed by project id. */
  projectTreeSelectedByProjectId?: Record<string, string>;
}

export const DEFAULT_PREFERENCES: CineGenPreferences = {
  scriptEditorChipsEnabled: true,
  scriptEditorAnchorsEnabled: false,
  scriptEditorBoxOutlinesEnabled: true,
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
  projectHierarchyViewMode: 'tree',
  moodBoardImageProvider: '',
  moodBoardVideoProvider: '',
  moodBoardAudioProvider: '',
  moodBoardLLMProvider: '',
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
  patchAppShellState({
    preferences: merged,
    activeProjectId: merged.activeProjectId,
  });
  return merged;
}

export function initCineGenPreferences(): void {
  window.CineGen = window.CineGen || {};
  window.CineGen.preferences = loadPreferences();
  window.CineGen.savePreferences = savePreferences;
  window.CineGen.preferenceKey = PREFS_KEY;
  window.CineGen.loaderVersion = '2.0-lit';
}
