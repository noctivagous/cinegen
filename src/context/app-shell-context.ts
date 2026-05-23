import { createContext } from '@lit/context';
import type { AppShellStore } from '@/stores/app-shell-store';

/** Shell store API (preferences, active project, workspace view). */
export const appShellStoreContext = createContext<AppShellStore>('cinegen.app-shell-store');
