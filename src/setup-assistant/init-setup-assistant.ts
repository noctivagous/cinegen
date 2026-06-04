import '@/setup-assistant/cinegen-sa-step-host';
import {
  installSetupAssistantBundleGlobals,
  initSetupAssistantChromeOnce,
  registerSetupAssistantModal,
} from '@/setup-assistant/setup-assistant-bundle';
import { wireSetupAssistantModal } from '@/setup-assistant/wire-setup-assistant-modal';

export function initSetupAssistant(): void {
  registerSetupAssistantModal();
  installSetupAssistantBundleGlobals();
  wireSetupAssistantModal();
  initSetupAssistantChromeOnce();
  // Ensure first-launch auto-open still runs even if app-init lifecycle changes.
  window.checkFirstLaunchSetup?.();
}
