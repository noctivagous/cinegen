import {
  AI_API_SETTINGS_STORAGE_KEY,
  API_KEYS_STORAGE_KEY,
  CONSOLE_HISTORY_STORAGE_KEY,
  PROVIDER_MODEL_CATALOG_STORAGE_KEY,
  SECTION_VISIBILITY_STORAGE_KEY,
  SETUP_COMPLETE_STORAGE_KEY,
  SETUP_PROGRESS_STORAGE_KEY,
  STORYBOARD_GENERATION_MODE_STORAGE_KEY,
  STORYBOARD_REFERENCE_STORAGE_KEY,
} from '@/constants/storage-keys';
import { closeAllModals, closeAllModalsExcept, closeModal, openModal } from '@/services/modal-manager';
import { PREFS_KEY } from '@/services/preferences';
import { storageService } from '@/services/persistence';
import { updateSetupIncompleteStatus } from '@/services/status-bar-service';
import { closeAllToolbarSplitMenus } from '@/services/toolbar-split-service';
import { clearAiApiRouting, closeAiProvidersModal } from '@/settings/ai-api-settings-bundle';
import { _apiKeysDraftReset, clearApiKeys } from '@/settings/api-keys-settings-bundle';
import { alertCG } from '@/utils/alert-cg';

const DEBUG_SETTINGS_STORAGE_KEYS = [
  PREFS_KEY,
  SETUP_COMPLETE_STORAGE_KEY,
  SETUP_PROGRESS_STORAGE_KEY,
  AI_API_SETTINGS_STORAGE_KEY,
  API_KEYS_STORAGE_KEY,
  PROVIDER_MODEL_CATALOG_STORAGE_KEY,
  STORYBOARD_GENERATION_MODE_STORAGE_KEY,
  STORYBOARD_REFERENCE_STORAGE_KEY,
  SECTION_VISIBILITY_STORAGE_KEY,
  CONSOLE_HISTORY_STORAGE_KEY,
];

export function openDebugModal(): void {
  closeAllToolbarSplitMenus();
  closeAllModalsExcept('debug-modal');
  openModal('debug-modal');
}

export function closeDebugModal(): void {
  closeModal('debug-modal');
}

export function openSetupAssistantForDebug(): void {
  closeAllToolbarSplitMenus();
  closeAllModals();
  closeAiProvidersModal();
  void window.openSetupAssistant?.();
}

export function openDebugGenerationForDebug(): void {
  openDebugModal();
}

export function resetSetupAssistantProgressForDebug(): void {
  const shouldReset = window.confirm(
    'Reset Setup Assistant progress and completion state?\n\nThis does not remove provider keys or modality routing settings.'
  );
  if (!shouldReset) return;

  storageService.removeItem(SETUP_COMPLETE_STORAGE_KEY);
  storageService.removeItem(SETUP_PROGRESS_STORAGE_KEY);
  updateSetupIncompleteStatus();
  alertCG('Setup Assistant progress reset.\n\nOpening App Setup Assistant.');
  openSetupAssistantForDebug();
}

export async function resetAppSettingsForDebug(): Promise<void> {
  const shouldReset = window.confirm(
    'Reset all stored app settings?\n\nThis clears Preferences, Setup Assistant progress, provider credentials, modality routing, and provider model cache.\n\nLocal projects are not removed.'
  );
  if (!shouldReset) return;

  _apiKeysDraftReset();
  try {
    await Promise.allSettled([
      clearApiKeys(),
      clearAiApiRouting(),
    ]);
  } catch {
    // Continue with local reset even if server reset endpoints are unavailable.
  }
  DEBUG_SETTINGS_STORAGE_KEYS.forEach((key) => storageService.removeItem(key));
  updateSetupIncompleteStatus();
  alertCG('App settings reset.\n\nThe page will now reload.');
  window.location.reload();
}

export function clearProviderModelCacheForDebug(): void {
  storageService.removeItem(PROVIDER_MODEL_CATALOG_STORAGE_KEY);
  alertCG('Provider model cache cleared.');
}

export function logSettingsStorageForDebug(): void {
  const snapshot = Object.fromEntries(
    DEBUG_SETTINGS_STORAGE_KEYS.map((key) => [key, storageService.getItem(key)])
  );
  console.group('CineGen debug settings snapshot');
  console.table(snapshot);
  console.groupEnd();
  alertCG('Stored settings snapshot logged to the browser console.');
}

export function reloadAppForDebug(): void {
  window.location.reload();
}
