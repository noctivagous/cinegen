/** Typed wrapper for live provider model-list / ping fetches. */

import { saFetchModels } from '@/setup-assistant/connection-test';
import {
  apiScopeForModality,
  type RoutingModalityKey,
} from '@/services/routing-modalities';

export { apiScopeForModality, ROUTING_MODALITIES } from '@/services/routing-modalities';
export type { RoutingModalityKey } from '@/services/routing-modalities';

export type ProviderModelEntry = {
  id: string;
  label?: string;
  type?: string;
};

export type ProviderFetchResult = {
  ok: boolean;
  rateLimit?: boolean;
  message?: string;
  models: ProviderModelEntry[];
  /** All modalities from one /v1/models response (Together AI, OpenAI-compatible, …). */
  _categorized?: Partial<Record<RoutingModalityKey, ProviderModelEntry[]>>;
};

function mapProviderModelRow(m: Record<string, unknown>): ProviderModelEntry | null {
  const id = String(m.id ?? '');
  if (!id) return null;
  return {
    id,
    label: typeof m.label === 'string' ? m.label : undefined,
    type: typeof m.type === 'string' ? m.type : undefined,
  };
}

export async function fetchProviderModels(
  providerId: string,
  key: string,
  baseUrl: string,
  modalityKey: RoutingModalityKey,
  signal?: AbortSignal
): Promise<ProviderFetchResult> {
  const raw = await saFetchModels(providerId, key, baseUrl, modalityKey, signal);
  return normalizeProviderFetchResult(raw);
}

export function normalizeProviderFetchResult(raw: unknown): ProviderFetchResult {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const models = Array.isArray(r.models)
    ? r.models
        .filter((m): m is Record<string, unknown> => Boolean(m && typeof m === 'object'))
        .map(mapProviderModelRow)
        .filter((m): m is ProviderModelEntry => m !== null)
    : [];

  let _categorized: ProviderFetchResult['_categorized'];
  const rawCat = r._categorized;
  if (rawCat && typeof rawCat === 'object' && !Array.isArray(rawCat)) {
    _categorized = {};
    for (const [key, list] of Object.entries(rawCat)) {
      if (!Array.isArray(list)) continue;
      const mapped = list
        .filter((m): m is Record<string, unknown> => Boolean(m && typeof m === 'object'))
        .map(mapProviderModelRow)
        .filter((m): m is ProviderModelEntry => m !== null);
      if (mapped.length) {
        _categorized[key as RoutingModalityKey] = mapped;
      }
    }
    if (!Object.keys(_categorized).length) _categorized = undefined;
  }

  return {
    ok: Boolean(r.ok),
    rateLimit: Boolean(r.rateLimit),
    message: typeof r.message === 'string' ? r.message : '',
    models,
    _categorized,
  };
}
