import { storageService } from '@/services/persistence';
import { loadProviderModelCatalog } from '@/services/provider-model-catalog';
import type { AiVendorRoute } from '@/services/ai/types';
import { AI_API_SETTINGS_STORAGE_KEY } from '@/constants/storage-keys';

export type ModalityVendorKey = 'llm' | 'image' | 'video' | 'audio';

export interface ModalityVendorRoute {
  vendor: AiVendorRoute;
  model: string;
}

/** Resolve configured vendor + model for a modality (matches debug modal routing). */
export function resolveModalityVendorRoute(modality: ModalityVendorKey): ModalityVendorRoute | null {
  try {
    const fromWindow =
      typeof window.loadAiApiSettings === 'function' ? window.loadAiApiSettings() : null;
    const raw = storageService.getItem(AI_API_SETTINGS_STORAGE_KEY);
    const settings = fromWindow ?? (raw ? JSON.parse(raw) : null);
    const cfg = settings?.modalities?.[modality] as
      | { provider?: string; vendorId?: string; model?: string; baseUrl?: string }
      | undefined;
    if (!cfg?.model) return null;

    const catalog = loadProviderModelCatalog();
    const vendors = catalog.vendors || {};
    const keyCache = new Map<string, { name?: string; slotId?: string; baseUrl?: string }>();

    if (typeof window.loadApiKeys === 'function') {
      const keys = window.loadApiKeys() as { vendors?: Array<{ id?: string; name?: string; slotId?: string; baseUrl?: string }> };
      for (const v of keys?.vendors || []) {
        if (v.id) keyCache.set(v.id, v);
      }
    }

    const w = window as Window & { vendorIsConfigured?: (v: unknown) => boolean };
    const keysState =
      typeof window.loadApiKeys === 'function'
        ? (window.loadApiKeys() as {
            vendors?: Array<{ id?: string; providerId?: string; hasServerKey?: boolean; apiKey?: string }>;
          })
        : null;
    const configuredVendors = (keysState?.vendors || []).filter((v) => {
      if (typeof w.vendorIsConfigured === 'function') return w.vendorIsConfigured(v);
      return Boolean(String(v.apiKey || '').trim());
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

    const vendor: AiVendorRoute = {
      id: vendorId,
      name: keyRec?.name || rec.providerId || vendorId,
      providerId: rec.providerId,
      slotId: keyRec?.slotId || '',
      baseUrl: keyRec?.baseUrl || cfg.baseUrl || '',
    };

    return { vendor, model: cfg.model };
  } catch {
    return null;
  }
}
