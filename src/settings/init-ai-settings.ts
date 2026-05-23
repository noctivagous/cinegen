import '@/components/settings/index';
import {
  installAiApiSettingsBundleGlobals,
  registerAiProvidersModal,
} from '@/settings/ai-api-settings-bundle';
import { installApiKeysSettingsBundleGlobals, initServerKeyStore } from '@/settings/api-keys-settings-bundle';
import { wireAiProvidersModal } from '@/settings/wire-ai-providers-modal';

export function initAiSettings(): void {
  registerAiProvidersModal();
  installAiApiSettingsBundleGlobals();
  installApiKeysSettingsBundleGlobals();
  wireAiProvidersModal();
  if (typeof window.initAiProvidersModalOnce === 'function') {
    window.initAiProvidersModalOnce();
  }
  // Sync server-side keys, then refresh status bar (keys load after first paint)
  void initServerKeyStore().then(() => {
    window.updateModelStatusIndicators?.();
    (window as Window & { updateAudioSubmodalityIndicators?: () => void }).updateAudioSubmodalityIndicators?.();
  });
}
