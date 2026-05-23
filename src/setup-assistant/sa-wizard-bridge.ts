import type { SaStepId } from '@/setup-assistant/sa-step-ids';
import { getSaStepHost } from '@/setup-assistant/cinegen-sa-step-host';

/** Wizard modality assignment slice (mirrors setup-assistant-bundle `_saState`). */
export type SaModalityState = {
  skip?: boolean;
  vendorId?: string;
  providerId?: string;
  modelId?: string;
  modelLabel?: string;
  baseUrl?: string;
  status?: string | null;
  statusMsg?: string;
  listedModels?: Array<{ id: string; label: string }>;
};

export type SaWizardState = {
  vendors?: Array<Record<string, unknown>>;
  llm: SaModalityState;
  video: SaModalityState;
  image: SaModalityState;
  audio: SaModalityState;
};

export type SaVendorSummary = {
  id: string;
  name?: string;
  providerId: string;
};

/** Audio model capability types */
export type AudioCapability = 'tts' | 'sfx' | 'music' | 'stt';

export type SaWizardApi = {
  getState: () => SaWizardState | null;
  vendorsWithKeys: () => SaVendorSummary[];
  vendorById: (vendorId: string) => SaVendorSummary | null;
  providerLabel: (providerId: string) => string;
  modalityRequired: (mod: string) => boolean;
  coverageSatisfied: () => boolean;
  statusMessageHtml: (modState: SaModalityState) => string;
  modelCapsText: (providerId: string, mod: string, modelId: string) => string;
  catalogModels: (providerId: string, mod: string) => Array<{ id: string; label: string }>;
  /** Get cached models from live provider catalog (populated after successful test). */
  cachedVendorModels: (vendorId: string, mod: string) => Array<{ id: string; label: string }>;
  /** Get cached audio models filtered by capability (tts, sfx, music). */
  cachedAudioModelsByCapability: (vendorId: string, capability: AudioCapability) => Array<{ id: string; label: string }>;
  /** Get cached modality status from catalog (includes status, message, models, fetchedAt). */
  cachedModalityStatus: (vendorId: string, mod: string) => { status: string; message: string; models: Array<{id: string; label: string}>; fetchedAt: number } | null;
  mergeModels: (
    listed: Array<{ id: string; label: string }>,
    catalog: Array<{ id: string; label: string }>
  ) => Array<{ id: string; label: string }>;
  providersByModality: (mod: string) => Array<{ id: string; label: string }>;
  /** Persist modality state to aiApiSettings and refresh status bar. */
  saveStepData: (mod: string) => void;
  /** Providers step still uses bundle HTML until fully ported. */
  renderProvidersMarkup?: () => string;
  renderModelsMarkup?: () => string;
};

let _api: SaWizardApi = {
  getState: () => null,
  vendorsWithKeys: () => [],
  vendorById: () => null,
  providerLabel: (id) => id,
  modalityRequired: () => true,
  coverageSatisfied: () => false,
  statusMessageHtml: () => '',
  modelCapsText: () => '',
  catalogModels: () => [],
  cachedVendorModels: () => [],
  cachedAudioModelsByCapability: () => [],
  cachedModalityStatus: () => null,
  mergeModels: (_listed, catalog) => catalog,
  providersByModality: () => [],
  saveStepData: () => {},
};

export function configureSaWizardApi(api: Partial<SaWizardApi>): void {
  _api = { ..._api, ...api };
}

export function getSaWizardApi(): SaWizardApi {
  // Check for window-exposed API (set by bundle for cross-module access)
  const win = typeof window !== 'undefined' ? (window as any)._saWizardApi : undefined;
  if (win && typeof win.getState === 'function') {
    return win as SaWizardApi;
  }
  return _api;
}

export function getSaWizardState(): SaWizardState | null {
  return getSaWizardApi().getState();
}

/** Re-render the active setup step (after bundle mutates `_saState`). */
export function refreshSaStepHost(): void {
  const host = getSaStepHost();
  if (!host) return;
  const stepId = host.stepId;
  if (!stepId) return;
  if (stepId === 'welcome') host.showWelcome();
  else host.showStep(stepId);
}
