import type { CineGenPreferences } from '@/services/preferences';

export interface AppShellState {
  preferences: CineGenPreferences;
  activeProjectId: string;
  /** Workspace view id (e.g. `preprod-workspace`, `scene-detail`). */
  currentView: string;
  /** Human-readable label for the status bar / workspace chrome. */
  currentViewLabel: string;
}

type AppShellListener = () => void;

let state: AppShellState | null = null;
const listeners = new Set<AppShellListener>();

export function initAppShellState(initial: AppShellState): void {
  state = {
    preferences: { ...initial.preferences },
    activeProjectId: initial.activeProjectId,
    currentView: initial.currentView,
    currentViewLabel: initial.currentViewLabel,
  };
  notify();
}

export function isAppShellInitialized(): boolean {
  return state !== null;
}

export function getAppShellState(): AppShellState {
  if (!state) {
    throw new Error('CineGen: app shell state not initialized');
  }
  return {
    preferences: { ...state.preferences },
    activeProjectId: state.activeProjectId,
    currentView: state.currentView,
    currentViewLabel: state.currentViewLabel,
  };
}

export function subscribeAppShell(listener: AppShellListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function patchAppShellState(patch: Partial<AppShellState>): void {
  if (!state) return;

  let changed = false;
  const next = { ...state };

  if (patch.preferences) {
    next.preferences = { ...patch.preferences };
    changed = true;
  }
  if (patch.activeProjectId !== undefined && patch.activeProjectId !== state.activeProjectId) {
    next.activeProjectId = patch.activeProjectId;
    changed = true;
  }
  if (patch.currentView !== undefined && patch.currentView !== state.currentView) {
    next.currentView = patch.currentView;
    changed = true;
  }
  if (
    patch.currentViewLabel !== undefined &&
    patch.currentViewLabel !== state.currentViewLabel
  ) {
    next.currentViewLabel = patch.currentViewLabel;
    changed = true;
  }

  if (changed) {
    state = next;
    notify();
  }
}
