/**
 * Load persisted preferences and apply shell panel widths before layout
 * custom elements upgrade (avoids sidebar/inspector width flash).
 */
import { preloadServerPersistence } from '@/services/persistence';
import { applyLayoutChromeFromPreferences } from '@/services/layout-service';
import { initCineGenPreferences } from '@/services/preferences';
import {
  PREFERENCES_STORAGE_KEY,
  SETUP_COMPLETE_STORAGE_KEY,
  SETUP_PROGRESS_STORAGE_KEY,
  AI_API_SETTINGS_STORAGE_KEY,
  API_KEYS_STORAGE_KEY,
  PROVIDER_MODEL_CATALOG_STORAGE_KEY,
  LOCAL_PROJECTS_STORAGE_KEY,
  MOOD_BOARDS_STORAGE_KEY,
  SCRIPT_PREVIS_MARGIN_COLLAPSED_KEY,
} from '@/constants/storage-keys';

const SERVER_PRELOAD_KEYS = [
  PREFERENCES_STORAGE_KEY,
  SETUP_COMPLETE_STORAGE_KEY,
  SETUP_PROGRESS_STORAGE_KEY,
  AI_API_SETTINGS_STORAGE_KEY,
  API_KEYS_STORAGE_KEY,
  PROVIDER_MODEL_CATALOG_STORAGE_KEY,
  LOCAL_PROJECTS_STORAGE_KEY,
  MOOD_BOARDS_STORAGE_KEY,
  SCRIPT_PREVIS_MARGIN_COLLAPSED_KEY,
];

function revealLayoutChrome(): void {
  document.getElementById('main-shell-row')?.classList.remove('layout-chrome-pending');
}

export async function runLayoutEarlyInit(): Promise<void> {
  try {
    await preloadServerPersistence(SERVER_PRELOAD_KEYS);
    initCineGenPreferences();
    applyLayoutChromeFromPreferences();
  } finally {
    revealLayoutChrome();
  }
}
