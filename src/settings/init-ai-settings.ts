import '@/components/settings/index';
import {
  initAiProvidersModalOnce,
  installAiApiSettingsBundleGlobals,
  registerAiProvidersModal,
} from '@/settings/ai-api-settings-bundle';
import { installApiKeysSettingsBundleGlobals, initServerKeyStore } from '@/settings/api-keys-settings-bundle';
import {
  updateAudioSubmodalityIndicators,
  updateModelStatusIndicators,
} from '@/services/status-bar-service';
import { refreshAllProviderCatalogsOnLoad } from '@/services/provider-catalog-refresh';
import { wireAiProvidersModal } from '@/settings/wire-ai-providers-modal';

export function initAiSettings(): void {
  registerAiProvidersModal();
  installAiApiSettingsBundleGlobals();
  installApiKeysSettingsBundleGlobals();
  wireAiProvidersModal();
  initAiProvidersModalOnce();
  // Sync server-side keys, then refresh status bar (keys load after first paint)
  void initServerKeyStore().then(() => {
    void refreshAllProviderCatalogsOnLoad();
    updateModelStatusIndicators();
    updateAudioSubmodalityIndicators();
  });
}
