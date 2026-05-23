import { appShellStore, getAppShellStore, type AppShellState } from '@/stores/app-shell-store';
import { getAppShellState, patchAppShellState, subscribeAppShell } from '@/stores/app-shell-state';

export type { AppShellState } from '@/stores/app-shell-state';
export { appShellStore, getAppShellStore };
export { getAppShellState, patchAppShellState, subscribeAppShell };

export function initAppShellStore(): void {
  appShellStore.init();
}

export function syncAppShellFromSources(): void {
  appShellStore.syncFromSources();
}

export function setAppShellActiveProjectId(
  projectId: string,
  options?: { persist?: boolean }
): void {
  appShellStore.setActiveProjectId(projectId, options);
}

export function setAppShellCurrentView(viewName: string, label?: string): void {
  appShellStore.setCurrentView(viewName, label);
}

export function patchAppShellPreferences(
  partial: Parameters<typeof appShellStore.patchPreferences>[0]
): ReturnType<typeof appShellStore.patchPreferences> {
  return appShellStore.patchPreferences(partial);
}
