import { generateId } from '@/utils/ids';
import { getDefaultProviderList, getSaProviderSlots, SEED_VENDOR_DEFINITIONS } from '@/data/provider-catalog';
import {
  apiScopeForModality as mapApiScopeForModality,
  ROUTING_MODALITIES,
} from '@/services/routing-modalities';
import {
  sortVendorsForMasterList,
  vendorCatalogHasLiveModels,
  getVendorModalityChips,
} from '@/services/provider-model-catalog';

declare global {
  function populateAiApiSettingsForm(): void;
}

function _el(id: string): any {
  return document.getElementById(id);
}

/* ── ID helpers ──────────────────────────────────────────────────────────── */

function newVendorId(suffix?: any) {
  return generateId('v', { randomLength: 7, suffix });
}

/* ── Seed providers ──────────────────────────────────────────────────────── */

function createResearchBackedSeedVendors() {
  return SEED_VENDOR_DEFINITIONS.map(({ name, providerId }, i) => {
    const v = emptyVendor(name, providerId);
    v.id = newVendorId(`seed${i}`);
    return normalizeVendor(v);
  });
}

/* ── Normalization ───────────────────────────────────────────────────────── */

function defaultProviderList() {
  return getDefaultProviderList();
}

function emptyVendor(name?: any, providerId?: any) {
  return {
    id: newVendorId(),
    name: name || 'New provider',
    providerId: providerId || 'openai-compatible',
    baseUrl: '',
    slotId: '',
    apiKey: ''
  };
}

function normalizeVendor(v: any) {
  if (!v || typeof v !== 'object') return null;
  const allowed   = new Set(defaultProviderList().map((p) => p.id));
  const id        = typeof v.id === 'string' && v.id ? v.id : newVendorId();
  const name      = typeof v.name === 'string' && v.name.trim() ? v.name.trim() : 'Provider';
  let providerId  = typeof v.providerId === 'string' ? v.providerId : 'openai-compatible';
  if (!allowed.has(providerId)) providerId = 'openai-compatible';
  const slot = getSaProviderSlots().find((s) => {
    if (typeof v.slotId === 'string' && v.slotId && s.slotId === v.slotId) return true;
    const names = [s.name, ...(s.matchNames || [])].map((x) => x.trim().toLowerCase());
    return names.includes(name.toLowerCase()) && s.providerId === providerId;
  });
  const baseUrl   = typeof v.baseUrl === 'string' && v.baseUrl ? v.baseUrl : (slot?.baseUrl || '');
  const slotId    = typeof v.slotId === 'string' && v.slotId ? v.slotId : (slot?.slotId || '');
  const apiKey    = typeof v.apiKey === 'string' ? v.apiKey : '';
  const maskedKey = /^•+$/.test(apiKey.trim());
  const hasServerKey = Boolean(v.hasServerKey) || maskedKey;
  return { id, name, providerId, baseUrl, slotId, apiKey, hasServerKey };
}

/* ── Storage merge ───────────────────────────────────────────────────────── */

function hadExplicitEmptyVendorList(raw: any) {
  return (
    raw && typeof raw === 'object' &&
    Object.prototype.hasOwnProperty.call(raw, 'vendors') &&
    Array.isArray(raw.vendors) && raw.vendors.length === 0
  );
}

function migrateToVendors(raw: any) {
  const proxyBaseUrl = typeof raw?.proxyBaseUrl === 'string' ? raw.proxyBaseUrl : '';
  if (raw && Array.isArray(raw.vendors)) {
    const vendors = raw.vendors.map(normalizeVendor).filter(Boolean);
    let selectedVendorId = typeof raw.selectedVendorId === 'string' ? raw.selectedVendorId : '';
    if (!vendors.some((x: any) => x.id === selectedVendorId)) selectedVendorId = vendors[0]?.id || '';
    return { proxyBaseUrl, selectedVendorId, vendors };
  }
  return { proxyBaseUrl, selectedVendorId: '', vendors: [] };
}

function mergeApiKeysState(raw: any) {
  const explicitEmpty = hadExplicitEmptyVendorList(raw);
  const m = migrateToVendors(raw);
  if (!m.vendors.length && !explicitEmpty) {
    m.vendors = createResearchBackedSeedVendors();
    m.selectedVendorId = m.vendors[0]?.id || '';
  }
  if (!m.vendors.length) m.selectedVendorId = '';
  else if (!m.vendors.some((x: any) => x.id === m.selectedVendorId)) m.selectedVendorId = m.vendors[0].id;
  return m;
}

/* ── In-memory API key cache (server is source of truth) ─────────────────── */
let _apiKeysCache: any = null;

/* ── Server key API ──────────────────────────────────────────────────────── */

async function serverGetKeys() {
  try {
    const res = await fetch('/api/settings/keys');
    if (res.ok) return await res.json();
  } catch {}
  return null;
}

async function serverSaveKeys(data: any) {
  try {
    const clean = JSON.parse(JSON.stringify(data));
    if (Array.isArray(clean.vendors)) {
      clean.vendors = clean.vendors.map((v: any) => {
        const k = String(v.apiKey || '');
        const isMasked = /^•+$/.test(k) || k === '••••••••';
        return isMasked ? { ...v, apiKey: '' } : v;
      });
    }
    await fetch('/api/settings/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clean),
    });
  } catch {}
}

async function serverDeleteKey(vendorId: string) {
  try {
    await fetch(`/api/settings/keys/${vendorId}`, { method: 'DELETE' });
  } catch {}
}

async function serverClearAllKeys() {
  try {
    await fetch('/api/settings/keys', { method: 'DELETE' });
  } catch {}
}

/** One-time init: sync server keys into in-memory cache. Call at boot. */
export async function initServerKeyStore() {
  const serverData = await serverGetKeys();
  if (serverData && Array.isArray(serverData.vendors)) {
    _apiKeysCache = mergeApiKeysState(serverData);
  } else {
    // No server data: use default merged state (seed vendors)
    _apiKeysCache = mergeApiKeysState(null);
  }
}

/* ── Storage ─────────────────────────────────────────────────────────────── */

function loadApiKeys() {
  if (_apiKeysCache) return _apiKeysCache;
  return mergeApiKeysState(null);
}

function _reassignModalitiesForRemovedVendors(next: any) {
  if (typeof (window as any).loadAiApiSettings !== 'function' || typeof (window as any).saveAiApiSettings !== 'function') return;
  const old = loadApiKeys();
  const oldIds = new Set(old.vendors.map((v: any) => v.id));
  const newIds = new Set((next?.vendors || []).map((v: any) => v.id));
  const removedIds = [...oldIds].filter((id) => !newIds.has(id));
  if (!removedIds.length) return;

  const settings = (window as any).loadAiApiSettings();
  const modalities = settings?.modalities;
  if (!modalities) return;

  const remainingVendors = (next?.vendors || []).filter((v: any) => vendorHasApiKey(v));
  if (!remainingVendors.length) return;

  let changed = false;

  removedIds.forEach((removedId) => {
    ROUTING_MODALITIES.forEach((mod) => {
      const mcfg = modalities[mod];
      if (!mcfg || mcfg.vendorId !== removedId) return;

      // Try to find a replacement vendor with the same provider first
      const sameProvider = remainingVendors.find((v: any) => v.providerId === mcfg.provider);
      let replacement = sameProvider || remainingVendors[0];
      if (!replacement) return;

      mcfg.provider = replacement.providerId;
      mcfg.vendorId = replacement.id;

      // Pick first available model for the new vendor/provider
      if (typeof (window as any).mergeRoutingModelOptions === 'function') {
        const models = (window as any).mergeRoutingModelOptions(mcfg.provider, mod, mcfg.vendorId) || [];
        if (models.length) {
          mcfg.model = models[0].id;
          mcfg.modelLabel = models[0].label || models[0].id;
        } else {
          mcfg.model = '';
          mcfg.modelLabel = '';
        }
      }
      mcfg.fallbackModel = '';
      changed = true;
    });
  });

  if (changed) {
    (window as any).saveAiApiSettings(settings);
  }
}

function _syncApiKeysToSaProgress(_draft: any) {
  // No-op: API keys are server-side only.
  // `saveApiKeys()` handles server persistence via POST /api/settings/keys.
}

function saveApiKeys(next: any) {
  _reassignModalitiesForRemovedVendors(next);
  const merged = mergeApiKeysState(next);
  // Update in-memory cache
  _apiKeysCache = merged;
  // Persist to server (fire-and-forget, keys stored server-side)
  serverSaveKeys(merged);
  return merged;
}

/** Clear all API keys (in-memory + server-side). Called by resetAppSettingsForDebug(). */
async function clearApiKeys() {
  _apiKeysCache = mergeApiKeysState(null); // reset to seed state with no keys
  await serverClearAllKeys();
  await serverSaveKeys({ vendors: [] });
  return _apiKeysCache;
}

/* ── Key utilities ───────────────────────────────────────────────────────── */

function apiScopeForModality(modalityKey: any) {
  return mapApiScopeForModality(modalityKey as any);
}

/** True when a vendor can call APIs (browser key, masked server key, or backends/.env slot). */
export function vendorIsConfigured(v: any): boolean {
  if (!v) return false;
  if (v.hasServerKey) return true;
  const k = String(v?.apiKey || '').trim();
  if (!k) return false;
  if (/^•+$/.test(k)) return true;
  return true;
}

function vendorHasApiKey(v: any) {
  return vendorIsConfigured(v);
}

/** @deprecated scope ignored — one key per provider */
function vendorHasKeyForScope(v: any, _scopeKey: any) {
  return vendorHasApiKey(v);
}

function readVendorKey(v: any, _scopeKey: any) {
  const k = String(v?.apiKey || '').trim();
  if (k && !/^•+$/.test(k)) return k;
  if (vendorIsConfigured(v)) return '••••••••';
  return '';
}

function hasAnyVendorKeyForScope(_scopeKey: any) {
  return loadApiKeys().vendors.some((v: any) => vendorHasApiKey(v));
}

function hasAnyVendorKeyForModality(modalityKey: any) {
  return hasAnyVendorKeyForScope(apiScopeForModality(modalityKey));
}

function apiKeysListVendorsForProvider(providerId: any) {
  return loadApiKeys().vendors
    .filter((v: any) => v.providerId === providerId)
    .map((v: any) => ({ id: v.id, name: v.name }));
}

export function apiKeysListCredentialCandidates(providerId: any, modalityKey: any) {
  return loadApiKeys().vendors
    .filter((v: any) => v.providerId === providerId && vendorHasApiKey(v))
    .map((v: any) => ({ id: v.id, name: v.name }));
}

function getApiKey(scopeKey: any) {
  // Keys are server-side; this function now only checks if a key exists
  const modality = scopeKey === 'language' ? 'llm' : scopeKey;
  const ai: any = typeof window.loadAiApiSettings === 'function' ? window.loadAiApiSettings() : null;
  if (!ai?.modalities?.[modality]) return '';
  const prov     = ai.modalities[modality].provider;
  const vendorId = typeof ai.modalities[modality].vendorId === 'string' ? ai.modalities[modality].vendorId : '';
  const s        = loadApiKeys();
  if (vendorId) {
    const v = s.vendors.find((x: any) => x.id === vendorId);
    if (v && v.providerId === prov && vendorHasApiKey(v)) return '••••••••';
  }
  const list = s.vendors.filter((x: any) => x.providerId === prov && vendorHasApiKey(x));
  if (list.length >= 1) return '••••••••';
  return '';
}

function maskKeyHint(value: any, hasServerKey?: boolean) {
  if (hasServerKey && (!value || !String(value).trim() || /^•+$/.test(String(value).trim()))) {
    return 'Configured in backends/.env';
  }
  if (!value || !String(value).trim()) return 'Not set';
  const t = String(value).trim();
  if (/^•+$/.test(t)) return 'Configured on server';
  if (t.length <= 4) return 'Saved (hidden)';
  return `Saved (…${t.slice(-4)})`;
}

/* ── Draft management ────────────────────────────────────────────────────── */

let _apiKeysDraft: any = null;

export function getDraft() {
  if (!_apiKeysDraft) {
    const disk = loadApiKeys();
    _apiKeysDraft = JSON.parse(JSON.stringify(disk));
  }
  return _apiKeysDraft;
}

function syncDetailInputsToDraft() {
  const d   = getDraft();
  const vid = d.selectedVendorId;
  const v   = d.vendors.find((x: any) => x.id === vid);
  if (!v) return;

  const nameEl = _el('api-keys-detail-name');
  const provEl = _el('api-keys-detail-provider');
  if (nameEl) v.name = String(nameEl.value || '').trim() || v.name;
  if (provEl) {
    const allowed = new Set(defaultProviderList().map((p: any) => p.id));
    const p = provEl.value;
    if (allowed.has(p)) v.providerId = p;
  }

  const input = _el('api-keys-detail-input');
  const raw   = input ? String(input.value || '').trim() : '';
  if (raw) v.apiKey = raw;
}

/* ── Vendor list render ──────────────────────────────────────────────────── */

function renderVendorList() {
  const d    = getDraft();
  const host = _el('api-keys-vendor-list');
  if (!host) return;
  host.replaceChildren();
  const sorted = typeof sortVendorsForMasterList === 'function'
    ? sortVendorsForMasterList(d.vendors)
    : d.vendors;
  sorted.forEach((v: any) => {
    const hasKey  = vendorHasApiKey(v);
    const tested  = typeof vendorCatalogHasLiveModels === 'function' && vendorCatalogHasLiveModels(v.id);
    const item = document.createElement('div');
    item.className = `aip-provider-item${v.id === d.selectedVendorId ? ' selected' : ''}${hasKey ? ' has-key' : ''}${tested ? ' has-catalog' : ''}`;
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', v.id === d.selectedVendorId ? 'true' : 'false');
    item.setAttribute('tabindex', '0');
    item.dataset.vendorId = v.id;
    item.onclick = () => apiKeysSelectVendor(v.id);
    item.onkeydown = (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); apiKeysSelectVendor(v.id); } };
    const dot = document.createElement('span');
    dot.className = 'aip-provider-dot';
    dot.setAttribute('aria-hidden', 'true');
    const body = document.createElement('div');
    body.className = 'aip-provider-item-body';
    const name = document.createElement('span');
    name.className = 'aip-provider-name';
    name.textContent = v.name || 'Provider';
    body.appendChild(name);
    const chips = typeof getVendorModalityChips === 'function' ? getVendorModalityChips(v) : [];
    if (chips.length) {
      const chipRow = document.createElement('span');
      chipRow.className = 'aip-provider-chips';
      chipRow.setAttribute('aria-label', 'Modalities');
      chips.forEach(({ key, label }: { key: string; label: string }) => {
        const chip = document.createElement('span');
        chip.className = `aip-mod-chip aip-mod-chip--${key}`;
        chip.textContent = label;
        chipRow.appendChild(chip);
      });
      body.appendChild(chipRow);
    }
    item.appendChild(dot);
    item.appendChild(body);
    host.appendChild(item);
  });
}

/* ── Detail pane render ──────────────────────────────────────────────────── */

function applyDetailFromDraft() {
  const d     = getDraft();
  const empty = _el('api-keys-detail-empty');
  const form  = _el('api-keys-detail-form');
  const v     = d.vendors.find((x: any) => x.id === d.selectedVendorId);

  if (!d.vendors.length || !v) {
    if (empty) empty.hidden = false;
    if (form)  form.hidden  = true;
    return;
  }
  if (empty) empty.hidden = true;
  if (form)  form.hidden  = false;

  const nameEl = _el('api-keys-detail-name');
  const provEl = _el('api-keys-detail-provider');
  if (nameEl) nameEl.value = v.name;
  if (provEl) {
    provEl.replaceChildren();
    defaultProviderList().forEach((p) => {
      const o = document.createElement('option');
      o.value = p.id; o.textContent = p.label;
      provEl.appendChild(o);
    });
    provEl.value = v.providerId;
  }

  const keyVal = String(v.apiKey || '').trim();
  const input  = _el('api-keys-detail-input');
  const meta   = _el('api-keys-detail-meta');
  if (input) {
    input.value = '';
    input.type  = 'password';
    input.placeholder = v.hasServerKey
      ? 'Optional: paste to override backends/.env for this provider'
      : keyVal
        ? 'Leave blank to keep · enter new to replace'
        : 'Paste key (optional if set in backends/.env)';
  }
  if (meta) {
    meta.textContent = maskKeyHint(keyVal, Boolean(v.hasServerKey));
    meta.classList.toggle('is-set', vendorIsConfigured(v));
  }
  const reveal = input?.closest('.api-keys-input-row')?.querySelector('.api-keys-reveal-btn');
  if (reveal) reveal.textContent = 'Show';
}

export function populateApiKeysForm() {
  _apiKeysDraft = null;
  getDraft();
  renderVendorList();
  applyDetailFromDraft();
}

/* ── Reveal / Clear ──────────────────────────────────────────────────────── */

export function toggleApiKeyReveal() {
  const input = _el('api-keys-detail-input');
  if (!input) return;
  const next = input.type === 'password' ? 'text' : 'password';
  input.type = next;
  const btn  = input.closest('.api-keys-input-row')?.querySelector('.api-keys-reveal-btn');
  if (btn) btn.textContent = next === 'password' ? 'Show' : 'Hide';
}

/* ── Save (internal — called by saveAiProvidersModal) ───────────────────── */

export function saveApiKeysModalInternal() {
  syncDetailInputsToDraft();
  const d = getDraft();
  saveApiKeys(d);
  _syncApiKeysToSaProgress(d);
  _apiKeysDraft = null;
  populateApiKeysForm();
  const hint = _el('ai-providers-save-hint');
  if (hint) hint.textContent = 'Saved.';
  if (typeof window.sanitizeAiApiVendorIdsInStoredSettings === 'function') window.sanitizeAiApiVendorIdsInStoredSettings();
  if (typeof window.populateAiApiCredentialSelects === 'function') window.populateAiApiCredentialSelects();
  refreshAiApiModalityGating();
  const saved = loadApiKeys();
  const vendor = saved.vendors.find((x: any) => x.id === saved.selectedVendorId);
  if (vendor) {
    import('@/components/settings/cinegen-provider-catalog-sync')
      .then(({ refreshSelectedVendorCatalog }) => refreshSelectedVendorCatalog(vendor))
      .then(() => {
        if (typeof populateAiApiSettingsForm === 'function') populateAiApiSettingsForm();
        renderVendorList();
      });
  }
}

export function clearApiKey() {
  syncDetailInputsToDraft();
  const d = getDraft();
  const v = d.vendors.find((x: any) => x.id === d.selectedVendorId);
  if (v) {
    v.apiKey = '';
    serverDeleteKey(v.id);
  }
  saveApiKeys(d);
  _syncApiKeysToSaProgress(d);
  _apiKeysDraft = null;
  populateApiKeysForm();
  if (typeof window.sanitizeAiApiVendorIdsInStoredSettings === 'function') window.sanitizeAiApiVendorIdsInStoredSettings();
  if (typeof window.populateAiApiCredentialSelects === 'function') window.populateAiApiCredentialSelects();
  refreshAiApiModalityGating();
}

/* ── Vendor CRUD ─────────────────────────────────────────────────────────── */

export function aiProvidersAddVendor() { apiKeysAddVendor(); }

export function aiProvidersRemoveSelected() {
  const d = getDraft();
  if (d.selectedVendorId) apiKeysRemoveVendor(d.selectedVendorId);
}

function apiKeysAddVendor() {
  syncDetailInputsToDraft();
  const d = getDraft();
  const v = emptyVendor('New provider', 'openai-compatible');
  d.vendors.push(v);
  d.selectedVendorId = v.id;
  renderVendorList();
  applyDetailFromDraft();
  const hint = _el('ai-providers-save-hint');
  if (hint) hint.textContent = 'Add a key and click Save.';
  _el('api-keys-detail-name')?.focus?.();
}

function apiKeysSelectVendor(id: any) {
  syncDetailInputsToDraft();
  const d = getDraft();
  if (!d.vendors.some((x: any) => x.id === id)) return;
  d.selectedVendorId = id;
  renderVendorList();
  applyDetailFromDraft();
}

function apiKeysRemoveVendor(id: any) {
  syncDetailInputsToDraft();
  const d   = getDraft();
  const idx = d.vendors.findIndex((x: any) => x.id === id);
  if (idx < 0) return;
  d.vendors.splice(idx, 1);
  if (d.selectedVendorId === id) d.selectedVendorId = d.vendors[0]?.id || '';
  renderVendorList();
  applyDetailFromDraft();
  const hint = _el('ai-providers-save-hint');
  if (hint) hint.textContent = 'Removed (not saved until you click Save).';
}

/* ── Modality gating ─────────────────────────────────────────────────────── */

export function refreshAiApiModalityGating() {
  const defs = [
    { modality: 'llm',   fieldsetId: 'ai-api-fieldset-llm',   gateId: 'ai-api-gate-llm' },
    { modality: 'image', fieldsetId: 'ai-api-fieldset-image', gateId: 'ai-api-gate-image' },
    { modality: 'video', fieldsetId: 'ai-api-fieldset-video', gateId: 'ai-api-gate-video' },
    { modality: 'audio', fieldsetId: 'ai-api-fieldset-audio', gateId: 'ai-api-gate-audio' }
  ];
  const anyConfigured = loadApiKeys().vendors.some((v: any) => vendorIsConfigured(v));
  defs.forEach(({ modality, fieldsetId, gateId }) => {
    const fs   = _el(fieldsetId);
    const gate = _el(gateId);
    const ok   = anyConfigured;
    if (fs)   fs.disabled   = !ok;
    if (gate) {
      gate.hidden = ok;
      if (!ok) {
        gate.innerHTML =
          'Add a provider with a key in <strong>backends/.env</strong> or paste a key on the <strong>API Keys</strong> tab, then assign models here.';
      }
    }
  });
}

/* ── Modal aliases ───────────────────────────────────────────────────────── */

function openApiKeysSettingsModal() {
  if (typeof window.openAiProvidersModal === 'function') window.openAiProvidersModal();
}

function closeApiKeysSettingsModal() {
  if (typeof window.closeAiProvidersModal === 'function') window.closeAiProvidersModal();
}

function saveApiKeysModal() { saveApiKeysModalInternal(); }

export function _apiKeysDraftReset() { _apiKeysDraft = null; }

export function installApiKeysSettingsBundleGlobals(): void {
  const w = window as unknown as Record<string, unknown>;
  w.newVendorId = newVendorId;
  w.createResearchBackedSeedVendors = createResearchBackedSeedVendors;
  w.defaultProviderList = defaultProviderList;
  w.emptyVendor = emptyVendor;
  w.normalizeVendor = normalizeVendor;
  w.hadExplicitEmptyVendorList = hadExplicitEmptyVendorList;
  w.migrateToVendors = migrateToVendors;
  w.mergeApiKeysState = mergeApiKeysState;
  w.loadApiKeys = loadApiKeys;
  w.saveApiKeys = saveApiKeys;
  w.apiScopeForModality = apiScopeForModality;
  w.vendorIsConfigured = vendorIsConfigured;
  w.vendorHasApiKey = vendorHasApiKey;
  w.vendorHasKeyForScope = vendorHasKeyForScope;
  w.readVendorKey = readVendorKey;
  w.hasAnyVendorKeyForScope = hasAnyVendorKeyForScope;
  w.hasAnyVendorKeyForModality = hasAnyVendorKeyForModality;
  w.apiKeysListVendorsForProvider = apiKeysListVendorsForProvider;
  w.apiKeysListCredentialCandidates = apiKeysListCredentialCandidates;
  w.getApiKey = getApiKey;
  w.maskKeyHint = maskKeyHint;
  w.getDraft = getDraft;
  w.syncDetailInputsToDraft = syncDetailInputsToDraft;
  w.renderVendorList = renderVendorList;
  w.applyDetailFromDraft = applyDetailFromDraft;
  w.populateApiKeysForm = populateApiKeysForm;
  w.toggleApiKeyReveal = toggleApiKeyReveal;
  w.saveApiKeysModalInternal = saveApiKeysModalInternal;
  w.clearApiKeys = clearApiKeys;
  w.clearApiKey = clearApiKey;
  w.aiProvidersAddVendor = aiProvidersAddVendor;
  w.aiProvidersRemoveSelected = aiProvidersRemoveSelected;
  w.apiKeysAddVendor = apiKeysAddVendor;
  w.apiKeysSelectVendor = apiKeysSelectVendor;
  w.apiKeysRemoveVendor = apiKeysRemoveVendor;
  w.refreshAiApiModalityGating = refreshAiApiModalityGating;
  w.openApiKeysSettingsModal = openApiKeysSettingsModal;
  w.closeApiKeysSettingsModal = closeApiKeysSettingsModal;
  w.saveApiKeysModal = saveApiKeysModal;
  w._apiKeysDraftReset = _apiKeysDraftReset;
  w.apiKeysListCredentialCandidatesForModality = apiKeysListCredentialCandidates;
  w.refreshAiProvidersVendorList = renderVendorList;
}
