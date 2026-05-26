export function saDefaultModality() {
  return {
    vendorId: '',
    skip: false,
    providerId: '',
    baseUrl: '',
    modelId: '',
    modelLabel: '',
    status: null,
    statusMsg: '',
    listedModels: [],
  };
}

export function saDefaultState() {
  return {
    vendors: [],
    llm: saDefaultModality(),
    video: saDefaultModality(),
    image: saDefaultModality(),
    audio: saDefaultModality(),
  };
}

export function saVendorById(state: any, vendorId: string) {
  if (!vendorId || !state?.vendors) return null;
  return state.vendors.find((v: any) => v.id === vendorId) || null;
}

export function saVendorHasKey(v: any): boolean {
  return Boolean(v?.hasServerKey) || String(v?.apiKey || '').trim().length > 4;
}

export function saVendorsWithKeys(state: any): any[] {
  return (state?.vendors || []).filter((v: any) => saVendorHasKey(v));
}

export function saSyncModalityProviderFromVendor(state: any, mod: string): void {
  const m = state?.[mod];
  if (!m) return;
  const v = saVendorById(state, m.vendorId);
  m.providerId = v ? v.providerId : '';
}

export function saSlotMatchesVendor(slot: any, vendor: any): boolean {
  if (!slot || !vendor) return false;
  if (vendor.slotId && vendor.slotId === slot.slotId) return true;
  const names = [slot.name, ...(slot.matchNames || [])].map((n) => String(n).trim().toLowerCase());
  const vName = String(vendor.name || '').trim().toLowerCase();
  if (names.includes(vName)) return true;
  if (slot.providerId === vendor.providerId && slot.baseUrl && vendor.baseUrl) {
    return String(slot.baseUrl).trim() === String(vendor.baseUrl).trim();
  }
  return false;
}

export function saFindVendorForSlot(state: any, slot: any) {
  if (!slot || !state?.vendors) return null;
  return state.vendors.find((v: any) => saSlotMatchesVendor(slot, v)) || null;
}

export function saIsCatalogVendor(getSaProviderSlots: () => any[], vendor: any): boolean {
  return getSaProviderSlots().some((slot) => saSlotMatchesVendor(slot, vendor));
}

export function saManualVendors(state: any, getSaProviderSlots: () => any[]): any[] {
  return (state?.vendors || []).filter((v: any) => !saIsCatalogVendor(getSaProviderSlots, v));
}

export function saNormalizeVendorsToSlots(state: any, getSaProviderSlots: () => any[]): void {
  if (!state?.vendors) return;
  const claimed = new Set();
  getSaProviderSlots().forEach((slot) => {
    const match = state.vendors.find(
      (v: any) => !claimed.has(v.id) && saSlotMatchesVendor(slot, v)
    );
    if (!match) return;
    claimed.add(match.id);
    match.slotId = slot.slotId;
    if (!match.name || match.name === 'Provider' || match.name === 'New provider') match.name = slot.name;
    if (slot.baseUrl && !match.baseUrl) match.baseUrl = slot.baseUrl;
    if (match.providerId === 'openai-compatible' || !match.providerId) match.providerId = slot.providerId;
  });
}

export function saIsSlotActive(
  slotId: string,
  state: any,
  activeProviderSlots: Set<string>,
  getSaProviderSlots: () => any[]
): boolean {
  const slot = getSaProviderSlots().find((s) => s.slotId === slotId);
  if (!slot) return activeProviderSlots.has(slotId);
  const v = saFindVendorForSlot(state, slot);
  const hasKey = v && saVendorHasKey(v);
  return Boolean(hasKey) || activeProviderSlots.has(slotId);
}

export function saModalityIsRequired(mod: string, requiredRoutingModalities: string[]): boolean {
  return requiredRoutingModalities.includes(mod);
}

export function saRequiredModelsAssigned(state: any, requiredRoutingModalities: string[]): boolean {
  return requiredRoutingModalities.every((mod) => Boolean(state?.[mod]?.modelId));
}

export function saCoverageSatisfied(
  state: any,
  routingModalities: string[],
  requiredRoutingModalities: string[]
): boolean {
  return routingModalities.every((mod) => {
    const m = state?.[mod];
    if (!m) return !requiredRoutingModalities.includes(mod);
    if (m.skip) return !requiredRoutingModalities.includes(mod);
    if (!m.vendorId) return !requiredRoutingModalities.includes(mod);
    const v = saVendorById(state, m.vendorId);
    return Boolean(v && saVendorHasKey(v));
  });
}
