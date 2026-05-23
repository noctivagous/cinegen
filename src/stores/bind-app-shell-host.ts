import type { ReactiveElement } from 'lit';
import { appShellStore, type AppShellStore } from '@/stores/app-shell-store';

/** Subscribe a Lit host to shell store updates (returns unsubscribe). */
export function bindAppShellToHost(
  host: ReactiveElement,
  getStore: () => AppShellStore | undefined = () => appShellStore
): () => void {
  const store = getStore();
  if (!store) return () => {};
  return store.subscribe(() => host.requestUpdate());
}
