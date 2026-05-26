import {
  fetchProviderModels,
} from '@/services/provider-fetch';
import {
  apiScopeForModality,
  ROUTING_MODALITIES,
} from '@/services/routing-modalities';
import {
  applyVendorCatalogFetchResult,
  ensureRoutingModelDefaults,
} from '@/services/provider-model-catalog';
import { storageService } from '@/services/persistence';
import { AI_API_SETTINGS_STORAGE_KEY } from '@/constants/storage-keys';
import { loadApiKeys, renderVendorList } from '@/settings/api-keys-settings-bundle';
import { populateAiApiSettingsForm } from '@/settings/ai-api-settings-bundle';
import { updateModelStatusIndicators } from '@/services/status-bar-service';

export type ApiKeysVendor = {
  id: string;
  name?: string;
  providerId?: string;
  apiKey?: string;
  baseUrl?: string;
};

type ApiKeysVendorNormalized = ApiKeysVendor & { providerId: string };

function normalizeVendor(v: ApiKeysVendor): ApiKeysVendorNormalized | null {
  const providerId = typeof v.providerId === 'string' ? v.providerId : '';
  if (!v.id || !providerId) return null;
  return { ...v, providerId };
}

function vendorHasKeyForScope(vendor: ApiKeysVendor, scopeKey: string): boolean {
  void scopeKey;
  const key = String(vendor.apiKey ?? '').trim();
  if (!key) return Boolean((vendor as { hasServerKey?: boolean }).hasServerKey);
  if (/^•+$/.test(key)) return true;
  return key.length >= 4;
}

function readVendorKey(vendor: ApiKeysVendor, scopeKey: string): string {
  void scopeKey;
  return String(vendor.apiKey ?? '').trim();
}

/** Always use the vendor's own endpoint — not another vendor's routing row with the same providerId. */
function resolveVendorBaseUrl(vendor: ApiKeysVendorNormalized): string {
  const fromVendor = String(vendor.baseUrl ?? '').trim();
  if (fromVendor) return fromVendor;

  try {
    const raw = storageService.getItem(AI_API_SETTINGS_STORAGE_KEY);
    const ai = raw
      ? (JSON.parse(raw) as { modalities?: Record<string, { vendorId?: string; baseUrl?: string }> })
      : null;
    if (ai?.modalities) {
      for (const m of Object.values(ai.modalities)) {
        if (m?.vendorId === vendor.id && m.baseUrl) {
          return String(m.baseUrl).trim();
        }
      }
    }
  } catch {
    // noop
  }
  return '';
}

/** Refresh cached live model lists for one vendor (all modalities with keys). */
export async function refreshVendorCatalog(
  vendor: ApiKeysVendor,
  options?: { timeoutMs?: number }
): Promise<void> {
  const normalized = normalizeVendor(vendor);
  if (!normalized) return;
  const timeoutMs = options?.timeoutMs ?? 12000;
  const baseUrl = resolveVendorBaseUrl(normalized);

  for (const modalityKey of ROUTING_MODALITIES) {
    const scopeKey = apiScopeForModality(modalityKey);
    if (!vendorHasKeyForScope(normalized, scopeKey)) continue;

    // Key is stored server-side; the proxy will use it. Don't bail if readVendorKey returns empty.
    const key = readVendorKey(normalized, scopeKey);
    const hasServerKey = !key || key.length < 4;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const result = await fetchProviderModels(
        normalized.providerId,
        hasServerKey ? '••••••••' : key,
        baseUrl,
        modalityKey,
        controller.signal
      );
      applyVendorCatalogFetchResult(normalized.id, normalized.providerId, modalityKey, result);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Fetch failed';
      applyVendorCatalogFetchResult(normalized.id, normalized.providerId, modalityKey, {
        ok: false,
        rateLimit: false,
        message,
        models: [],
      });
    } finally {
      clearTimeout(timer);
    }
  }
}

/** App-load refresh for every vendor that has at least one saved key. */
export async function refreshAllProviderCatalogsOnLoad(): Promise<void> {
  const { vendors } = loadApiKeys();
  const withKeys = (vendors ?? []).filter((v: ApiKeysVendor) =>
    ['language', 'image', 'video', 'audio'].some((scope) => vendorHasKeyForScope(v, scope))
  );

  for (const raw of withKeys) {
    const vendor = normalizeVendor(raw);
    if (vendor) await refreshVendorCatalog(vendor, { timeoutMs: 10000 });
  }

  ensureRoutingModelDefaults(true);

  renderVendorList();
  const modal = document.getElementById('ai-providers-modal');
  if (modal && !modal.hidden) populateAiApiSettingsForm();
  updateModelStatusIndicators();
}
