import { activeProjectId, setActiveProjectId as setProjectActiveId } from '@/data/project-data';
import {
  loadPreferences,
  savePreferences,
  type CineGenPreferences,
} from '@/services/preferences';
import {
  getAppShellState,
  initAppShellState,
  isAppShellInitialized,
  patchAppShellState,
  subscribeAppShell,
  type AppShellState,
} from '@/stores/app-shell-state';
import { broadcastStateChange, subscribeStateSync } from '@/services/state-sync';

export type { AppShellState } from '@/stores/app-shell-state';

let _stateSyncUnsubscribe: (() => void) | null = null;
let _saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

/** Typed shell store: preferences, active project, workspace view. */
export class AppShellStore {
  /** Latest shell snapshot (immutable copy). */
  get state(): AppShellState {
    return getAppShellState();
  }

  get preferences(): Readonly<CineGenPreferences> {
    if (isAppShellInitialized()) return this.state.preferences;
    return window.CineGen?.preferences ?? loadPreferences();
  }

  get activeProjectId(): string {
    if (isAppShellInitialized()) return this.state.activeProjectId;
    return activeProjectId || this.preferences.activeProjectId;
  }

  get currentView(): string {
    if (isAppShellInitialized()) return this.state.currentView;
    return 'default';
  }

  get currentViewLabel(): string {
    if (isAppShellInitialized()) return this.state.currentViewLabel;
    return 'Script & Storyboard';
  }

  subscribe(listener: () => void): () => void {
    return subscribeAppShell(listener);
  }

  init(): void {
    if (isAppShellInitialized()) return;
    initAppShellState(this.buildInitialState());
  }

  /** Re-read `window.CineGen.preferences` and module `activeProjectId` after legacy writes. */
  syncFromSources(): void {
    const preferences = { ...(window.CineGen?.preferences ?? loadPreferences()) };
    patchAppShellState({
      preferences,
      activeProjectId: activeProjectId || preferences.activeProjectId,
    });
  }

  /** Called when legacy code sets `window.activeProjectId` directly. */
  syncActiveProjectFromModule(projectId?: string): void {
    const id = projectId ?? activeProjectId;
    if (!id) return;
    patchAppShellState({ activeProjectId: id });
  }

  setActiveProjectId(projectId: string, options: { persist?: boolean } = {}): void {
    if (!projectId || projectId === this.activeProjectId) return;

    setProjectActiveId(projectId);
    patchAppShellState({ activeProjectId: projectId });

    if (options.persist !== false) {
      savePreferences({ activeProjectId: projectId });
    }
    this._debouncedSaveToServer();
  }

  setCurrentView(viewName: string, label?: string): void {
    patchAppShellState({
      currentView: viewName,
      currentViewLabel: label ?? viewName,
    });
    this._debouncedSaveToServer();
  }

  patchPreferences(partial: Partial<CineGenPreferences>): CineGenPreferences {
    const result = savePreferences(partial);
    this._debouncedSaveToServer();
    return result;
  }

  /** Merge server-fetched state into the local shell (used on boot in server mode). */
  patchServerState(serverState: Record<string, unknown>): void {
    if (!isAppShellInitialized()) return;
    const patch: Partial<AppShellState> = {};
    if (serverState.preferences) {
      patch.preferences = { ...this.state.preferences, ...(serverState.preferences as CineGenPreferences) };
    }
    if (typeof serverState.activeProjectId === 'string') {
      patch.activeProjectId = serverState.activeProjectId;
    }
    if (typeof serverState.currentView === 'string') {
      patch.currentView = serverState.currentView;
    }
    if (typeof serverState.currentViewLabel === 'string') {
      patch.currentViewLabel = serverState.currentViewLabel;
    }
    patchAppShellState(patch);
  }

  /** Start listening to remote WebSocket state updates. */
  startServerSync(): void {
    if (_stateSyncUnsubscribe) return;
    _stateSyncUnsubscribe = subscribeStateSync((domain, payload) => {
      if (domain === 'app-shell' && payload && typeof payload === 'object') {
        this.patchServerState(payload as Record<string, unknown>);
      }
    });
  }

  private _debouncedSaveToServer(): void {
    const mode = (import.meta.env.VITE_PROJECT_PERSISTENCE_MODE as string) || 'local';
    if (mode !== 'server') return;
    if (_saveDebounceTimer) clearTimeout(_saveDebounceTimer);
    _saveDebounceTimer = setTimeout(() => {
      _saveDebounceTimer = null;
      if (!isAppShellInitialized()) return;
      const s = this.state;
      broadcastStateChange('app-shell', {
        preferences: s.preferences,
        activeProjectId: s.activeProjectId,
        currentView: s.currentView,
        currentViewLabel: s.currentViewLabel,
      });
    }, 200);
  }

  private buildInitialState(): AppShellState {
    const preferences = { ...(window.CineGen?.preferences ?? loadPreferences()) };
    return {
      preferences,
      activeProjectId: activeProjectId || preferences.activeProjectId,
      currentView: 'default',
      currentViewLabel: 'Script & Storyboard',
    };
  }
}

export const appShellStore = new AppShellStore();

export function getAppShellStore(): AppShellStore {
  return appShellStore;
}
