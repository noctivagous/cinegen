interface InferSetupCompleteArgs {
  requiredRoutingModalities: string[];
  markSetupComplete: () => void;
  vendorIsConfigured?: (vendor: any) => boolean;
  loadAiApiSettings?: () => any;
  loadApiKeys?: () => any;
}

interface SaveProgressArgs {
  storageService: { setItem: (key: string, value: string) => void };
  setupProgressStorageKey: string;
  currentStep: number;
  maxReachableStep: number;
  state: any;
  routingModalities: string[];
  vendorById: (vendorId: string) => any;
  resolveModelLabel: (modalityState: any, modality: string) => string;
  loadAiApiSettings?: () => any;
  saveAiApiSettings?: (settings: any) => void;
}

export function isSetupComplete(
  storageService: { getItem: (key: string) => string | null },
  setupCompleteStorageKey: string
): boolean {
  try {
    const raw = storageService.getItem(setupCompleteStorageKey);
    if (raw == null) return false;
    const normalized = String(raw).trim().toLowerCase();
    return normalized === '1' || normalized === 'true';
  } catch {
    return true;
  }
}

export function markSetupComplete(
  storageService: { setItem: (key: string, value: string) => void },
  setupCompleteStorageKey: string
): void {
  try {
    storageService.setItem(setupCompleteStorageKey, '1');
  } catch {
    // noop
  }
}

export function resetSetupComplete(
  storageService: { removeItem: (key: string) => void },
  setupCompleteStorageKey: string
): void {
  try {
    storageService.removeItem(setupCompleteStorageKey);
  } catch {
    // noop
  }
}

function vendorConfigured(vendor: any, vendorIsConfigured?: (vendor: any) => boolean): boolean {
  if (!vendor || typeof vendor !== 'object') return false;
  if (typeof vendorIsConfigured === 'function') return Boolean(vendorIsConfigured(vendor));
  if (vendor.hasServerKey) return true;
  const key = String(vendor.apiKey || '').trim();
  return Boolean(key) && !/^•+$/.test(key);
}

function routingLooksComplete(routing: any, requiredRoutingModalities: string[]): boolean {
  const modalities = routing?.modalities || {};
  return requiredRoutingModalities.every((mod) => {
    const cfg = modalities[mod] || {};
    return Boolean(
      String(cfg.provider || '').trim() &&
        String(cfg.model || '').trim()
    );
  });
}

function routingVendorIds(routing: any, requiredRoutingModalities: string[]): Set<string> {
  const ids = new Set<string>();
  const modalities = routing?.modalities || {};
  requiredRoutingModalities.forEach((mod) => {
    const vendorId = String(modalities?.[mod]?.vendorId || '').trim();
    if (vendorId) ids.add(vendorId);
  });
  return ids;
}

function keysCoverRoutingVendors(
  keysState: any,
  vendorIds: Set<string>,
  vendorIsConfigured?: (vendor: any) => boolean
): boolean {
  if (!keysState || !vendorIds || !vendorIds.size) return false;
  const configured = new Set(
    (keysState.vendors || [])
      .filter((v: any) => vendorConfigured(v, vendorIsConfigured))
      .map((v: any) => String(v.id || '').trim())
      .filter(Boolean)
  );
  return [...vendorIds].every((id) => configured.has(id));
}

function keysCoverRoutingProviders(
  keysState: any,
  routing: any,
  requiredRoutingModalities: string[],
  vendorIsConfigured?: (vendor: any) => boolean
): boolean {
  if (!keysState || !routing) return false;
  const requiredProviders = new Set(
    requiredRoutingModalities
      .map((mod) => String(routing?.modalities?.[mod]?.provider || '').trim())
      .filter(Boolean)
  );
  if (!requiredProviders.size) return false;

  const configuredProviders = new Set(
    (keysState.vendors || [])
      .filter((v: any) => vendorConfigured(v, vendorIsConfigured))
      .map((v: any) => String(v.providerId || '').trim())
      .filter(Boolean)
  );

  return [...requiredProviders].every((providerId) => configuredProviders.has(providerId));
}

export async function inferSetupCompleteFromServerState({
  requiredRoutingModalities,
  markSetupComplete,
  vendorIsConfigured,
  loadAiApiSettings,
  loadApiKeys,
}: InferSetupCompleteArgs): Promise<boolean> {
  try {
    let routing: any = null;
    let keys: any = null;

    try {
      const [routingRes, keysRes] = await Promise.all([
        fetch('/api/settings/routing'),
        fetch('/api/settings/keys'),
      ]);
      if (routingRes.ok) routing = await routingRes.json();
      if (keysRes.ok) keys = await keysRes.json();
    } catch {
      // fall back to globals/cache below
    }

    if (!routing && typeof loadAiApiSettings === 'function') {
      try {
        routing = loadAiApiSettings();
      } catch {
        // noop
      }
    }
    if (!keys && typeof loadApiKeys === 'function') {
      try {
        keys = loadApiKeys();
      } catch {
        // noop
      }
    }

    if (!routingLooksComplete(routing, requiredRoutingModalities)) return false;
    const requiredVendorIds = routingVendorIds(routing, requiredRoutingModalities);
    const keysCover =
      requiredVendorIds.size > 0
        ? keysCoverRoutingVendors(keys, requiredVendorIds, vendorIsConfigured)
        : keysCoverRoutingProviders(keys, routing, requiredRoutingModalities, vendorIsConfigured);
    if (!keysCover) return false;

    markSetupComplete();
    return true;
  } catch {
    return false;
  }
}

export function saveSetupProgress({
  storageService,
  setupProgressStorageKey,
  currentStep,
  maxReachableStep,
  state,
  routingModalities,
  vendorById,
  resolveModelLabel,
  loadAiApiSettings,
  saveAiApiSettings,
}: SaveProgressArgs): void {
  if (!state) return;
  try {
    storageService.setItem(
      setupProgressStorageKey,
      JSON.stringify({
        step: currentStep,
        maxReachableStep,
        vendors: state.vendors.map((v: any) => ({
          id: v.id,
          name: v.name,
          providerId: v.providerId,
          slotId: v.slotId,
          baseUrl: v.baseUrl,
          apiKey: v.apiKey || '',
          hasServerKey: Boolean(v.hasServerKey),
          status: v.status || null,
          statusMsg: v.statusMsg || '',
        })),
        state: {
          llm: { ...state.llm },
          video: { ...state.video },
          image: { ...state.image },
          audio: { ...state.audio },
        },
      })
    );

    if (typeof loadAiApiSettings === 'function' && typeof saveAiApiSettings === 'function') {
      const routing = loadAiApiSettings();
      routingModalities.forEach((mod) => {
        const s = state[mod];
        if (!s.vendorId) return;
        const vendor = vendorById(s.vendorId);
        routing.modalities[mod] = {
          ...routing.modalities[mod],
          provider: s.providerId || vendor?.providerId || '',
          model: s.modelId || '',
          modelLabel: resolveModelLabel(s, mod),
          baseUrl: s.baseUrl || vendor?.baseUrl || '',
          vendorId: s.vendorId,
        };
      });
      saveAiApiSettings(routing);
    }
  } catch (e) {
    console.warn('CineGen: could not save setup progress.', e);
  }
}

export function loadSetupProgress(
  storageService: { getItem: (key: string) => string | null },
  setupProgressStorageKey: string,
  stepCount: number
): any | null {
  try {
    const raw = storageService.getItem(setupProgressStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const step = typeof parsed.step === 'number' ? parsed.step : 0;
    if (step < 0 || step >= stepCount) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSetupProgress(
  storageService: { removeItem: (key: string) => void },
  setupProgressStorageKey: string
): void {
  try {
    storageService.removeItem(setupProgressStorageKey);
  } catch {
    // noop
  }
}

export function applySavedProgress(progress: any, state: any, routingModalities: string[]): void {
  if (!progress || !state) return;
  if (Array.isArray(progress.vendors)) {
    state.vendors = progress.vendors.map((v: any) => ({
      id: v.id,
      name: v.name || '',
      providerId: v.providerId || '',
      slotId: v.slotId || '',
      baseUrl: v.baseUrl || '',
      apiKey: v.apiKey || '',
      hasServerKey: Boolean(v.hasServerKey),
      status: v.status || null,
      statusMsg: v.statusMsg || '',
    }));
  }
  const st = progress.state;
  if (!st) return;
  routingModalities.forEach((mod) => {
    if (st[mod] && typeof st[mod] === 'object') {
      state[mod] = { ...state[mod], ...st[mod] };
    }
  });
}
