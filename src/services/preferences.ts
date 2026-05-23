/**
 * ── NOTE: Preferences use the persistence abstraction layer ──
 * 
 * In local mode (default), preferences are stored via localStorage.
 * In collaborative deployments, the ServerPersistence back-end stores
 * them server-side. Do NOT add localStorage-only fallbacks here.
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
  scriptEditorFontSizePx: number;
  scriptEditorInsertBarVisible: boolean;
  inspectorVisible: boolean;
  projectSidebarVisible: boolean;
  inspectorWidthPx: number;
  projectSidebarWidthPx: number;
  preprodSplitPercent: number;
  activeProjectId: string;
  statusBarScale: number;
}

export const DEFAULT_PREFERENCES: CineGenPreferences = {
  scriptEditorChipsEnabled: true,
  scriptEditorAnchorsEnabled: false,
  scriptEditorFontSizePx: 15,
  scriptEditorInsertBarVisible: false,
  inspectorVisible: true,
  projectSidebarVisible: true,
  inspectorWidthPx: 288,
  projectSidebarWidthPx: 280,
  preprodSplitPercent: 50,
  activeProjectId: 'proj-001',
  statusBarScale: 1.1,
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
  const merged = { ...DEFAULT_PREFERENCES, ...(nextPreferences || {}) };
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
