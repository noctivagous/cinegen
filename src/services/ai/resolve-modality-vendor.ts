import { storageService } from '@/services/persistence';
import { loadProviderModelCatalog, mergeRoutingModelOptions } from '@/services/provider-model-catalog';
import type { AiVendorRoute } from '@/services/ai/types';
import { AI_API_SETTINGS_STORAGE_KEY } from '@/constants/storage-keys';
import { loadAiApiSettings } from '@/settings/ai-api-settings-bundle';
import { loadApiKeys, vendorIsConfigured } from '@/settings/api-keys-settings-bundle';

export type ModalityVendorKey = 'llm' | 'image' | 'video' | 'audio';

export interface ModalityVendorRoute {
  vendor: AiVendorRoute;
  model: string;
}

/** Resolve configured vendor + model for a modality (matches debug modal routing). */
export function resolveModalityVendorRoute(modality: ModalityVendorKey): ModalityVendorRoute | null {
  try {
    const fromWindow = loadAiApiSettings();
    const raw = storageService.getItem(AI_API_SETTINGS_STORAGE_KEY);
    const settings = fromWindow ?? (raw ? JSON.parse(raw) : null);
    const cfg = settings?.modalities?.[modality] as
      | { provider?: string; vendorId?: string; model?: string; baseUrl?: string }
      | undefined;
    if (!cfg) return null;

    const catalog = loadProviderModelCatalog();
    const vendors = catalog.vendors || {};
    const keyCache = new Map<string, { name?: string; slotId?: string; baseUrl?: string }>();

    const keys = loadApiKeys() as {
      vendors?: Array<{ id?: string; name?: string; slotId?: string; baseUrl?: string }>;
    };
    for (const v of keys?.vendors || []) {
      if (v.id) keyCache.set(v.id, v);
    }

    const keysState =
      loadApiKeys() as {
        vendors?: Array<{ id?: string; providerId?: string; hasServerKey?: boolean; apiKey?: string }>;
      };
    const configuredVendors = (keysState?.vendors || []).filter((v) => {
      return vendorIsConfigured(v);
    });

    let vendorId = cfg.vendorId || '';
    if (!vendorId && cfg.provider) {
      const matches = configuredVendors.filter((v) => v.providerId === cfg.provider);
      vendorId = (matches[0]?.id || Object.keys(vendors).find((vid) => vendors[vid]?.providerId === cfg.provider)) || '';
    }
    if (!vendorId && configuredVendors.length) vendorId = configuredVendors[0].id || '';
    if (!vendorId) vendorId = Object.keys(vendors)[0] || '';
    if (!vendorId) return null;

    const rec = vendors[vendorId];
    if (!rec) return null;
    const keyRec = keyCache.get(vendorId);

    /* Resolve model — prefer live models for the selected vendor */
    let model = cfg.model || '';
    const vendorModels = mergeRoutingModelOptions(cfg.provider || rec.providerId, modality, vendorId);
    const modelIsAvailable = vendorModels.some((m: any) => m?.id === model);
    if (!model || !modelIsAvailable) {
      const pick = vendorModels.find((m: any) => m?.id);
      if (pick) {
        model = pick.id;
      } else if (rec.modalities?.[modality]?.models?.length) {
        const direct = rec.modalities[modality].models.find((m: any) => m?.id);
        if (direct) model = direct.id;
      }
    }
    if (!model) return null;

    const vendor: AiVendorRoute = {
      id: vendorId,
      name: keyRec?.name || rec.providerId || vendorId,
      providerId: rec.providerId,
      slotId: keyRec?.slotId || '',
      baseUrl: keyRec?.baseUrl || cfg.baseUrl || '',
    };

    return { vendor, model };
  } catch {
    return null;
  }
}
