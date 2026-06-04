// @ts-nocheck — legacy port from setupAssistant.js (Wave E).
import { escHtml } from '@/utils/html';
import { ROUTING_MODALITIES } from '@/setup-assistant/sa-wizard-constants';
import { saGetCatalogModels, saMergeModels, saStatusHtml, saResolveModelLabel, saModelCaps, saFetchModels } from '@/setup-assistant/connection-test';
import { saVendorHasKey, saVendorById, saSyncModalityProviderFromVendor } from '@/setup-assistant/setup-assistant-state';
import { getSaProviderSlots } from '@/data/provider-catalog';
import { testVendorAllModalities as runAllModalityTests, runConnectionTest } from '@/setup-assistant/setup-assistant-routing-tests';

export interface EventDeps {
  state: any;
  currentStep: number;
  testAborts: Record<string, AbortController>;
  vendorTestAborts: Record<string, AbortController>;
  activeProviderSlots: Set<string>;
  providerStepListenerBound: boolean;
  setProviderStepListenerBound: (v: boolean) => void;
  saveProgress: () => void;
  renderSetupStep: (idx: number) => void;
  ensureModelId: (mod: string) => void;
  refreshModelSelect: (mod: string) => void;
  refreshCoverageModelSelect: (mod: string) => void;
  saveStepData: (mod: string) => void;
  syncModalityProviderFromVendor: (mod: string) => void;
  setTestStatus: (mod: string, statusType: string, message: string, rawHtml?: boolean) => void;
  keyFromInput: (mod: string) => string;
  routingTestDeps: () => any;
  openAlert: (opts: { title: string; message: string; tone?: string }) => void;
}

export function saWizardUpsertVendor(vendor: any, apiKey: string, deps: EventDeps): void {
  const key = String(apiKey || '').trim();
  if (key.length >= 4) {
    vendor.apiKey = key;
    vendor.hasServerKey = false;
  }
  vendor.status = null;
  vendor.statusMsg = '';
}

export function saWizardSaveProviderSlot(slotId: string, deps: EventDeps): void {
  const slot = getSaProviderSlots().find((s: any) => s.slotId === slotId);
  if (!slot) return;
  const keyEl = document.getElementById(`sa-prov-key-${slotId}`) as HTMLInputElement | null;
  const typed = (keyEl?.value || '').trim();
  let vendor = deps.state.vendors?.find((v: any) => v.slotId === slotId);
  if (!typed && typed.length < 4) {
    if (!vendor || !saVendorHasKey(vendor)) {
      deps.openAlert({ title: 'API key required', message: 'Paste a valid API key before saving.' });
      return;
    }
    if (vendor && needsProviderUrl(slot.providerId)) {
      const urlEl = document.getElementById(`sa-prov-url-${slotId}`) as HTMLInputElement | null;
      if (!applyVendorApiUrlHelper(vendor, urlEl, slot.name)) return;
    }
    const localKey = String(vendor?.apiKey || '').trim();
    if (localKey.length > 4) {
      vendor.status = 'testing';
      deps.renderSetupStep(deps.currentStep);
      deps.saveProgress();
      testVendorAllModalities(vendor, deps);
    }
    return;
  }
  if (!vendor) {
    vendor = newVendor(slot, deps);
    deps.state.vendors.push(vendor);
  } else {
    vendor.slotId = slot.slotId;
    vendor.name = slot.name;
    vendor.providerId = slot.providerId;
    if (slot.baseUrl && !needsProviderUrl(slot.providerId)) vendor.baseUrl = slot.baseUrl;
  }
  if (needsProviderUrl(slot.providerId)) {
    const urlEl = document.getElementById(`sa-prov-url-${slotId}`) as HTMLInputElement | null;
    if (!applyVendorApiUrlHelper(vendor, urlEl, slot.name)) return;
  } else if (slot.baseUrl) {
    vendor.baseUrl = slot.baseUrl;
  }
  saWizardUpsertVendor(vendor, typed, deps);
  if (keyEl) keyEl.value = '';
  vendor.status = 'testing';
  deps.renderSetupStep(deps.currentStep);
  deps.saveProgress();
  testVendorAllModalities(vendor, deps);
}

function needsProviderUrl(providerId: string): boolean {
  return providerId === 'generic-rest';
}

function normalizeUrl(url: string): string {
  return String(url || '').trim().replace(/\/+$/, '');
}

function validateUrl(url: string): boolean {
  const u = normalizeUrl(url);
  if (!u) return false;
  try { const p = new URL(u); return p.protocol === 'http:' || p.protocol === 'https:'; } catch { return false; }
}

function applyVendorApiUrlHelper(vendor: any, urlInput: HTMLInputElement | null, label: string): boolean {
  if (!needsProviderUrl(vendor.providerId)) return true;
  let url = normalizeUrl(urlInput?.value || '');
  if (!url && vendor.baseUrl) url = normalizeUrl(vendor.baseUrl);
  if (!validateUrl(url)) {
    alert(`Enter a valid API URL (https://…) for ${label || vendor.name || 'this provider'}.`);
    return false;
  }
  vendor.baseUrl = url;
  return true;
}

function newVendor(slot: any, deps: EventDeps): any {
  const id = `sa_wiz_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    slotId: slot.slotId,
    name: slot.name,
    providerId: slot.providerId,
    baseUrl: slot.baseUrl || '',
    apiKey: '',
    status: null,
    statusMsg: '',
  };
}

export function saWizardToggleProviderSlot(slotId: string, deps: EventDeps): void {
  if (deps.activeProviderSlots.has(slotId)) {
    deps.activeProviderSlots.delete(slotId);
    deps.renderSetupStep(deps.currentStep);
    deps.saveProgress();
    return;
  }
  deps.activeProviderSlots.add(slotId);
  const slot = getSaProviderSlots().find((s: any) => s.slotId === slotId);
  const vendor = slot ? deps.state.vendors?.find((v: any) => v.slotId === slot.slotId) : null;
  if (vendor && saVendorHasKey(vendor) && vendor.status !== 'testing') {
    vendor.status = 'testing';
    deps.renderSetupStep(deps.currentStep);
    deps.saveProgress();
    testVendorAllModalities(vendor, deps);
  } else {
    deps.renderSetupStep(deps.currentStep);
    deps.saveProgress();
  }
}

export function saWizardClearProviderSlot(slotId: string, deps: EventDeps): void {
  const slot = getSaProviderSlots().find((s: any) => s.slotId === slotId);
  if (!slot) return;
  const vendor = deps.state.vendors?.find((v: any) => v.slotId === slot.slotId);
  if (!vendor) return;
  vendor.apiKey = '';
  vendor.hasServerKey = false;
  vendor.status = null;
  vendor.statusMsg = '';
  if (typeof (window as any).writeVendorKey === 'function') {
    (window as any).writeVendorKey(vendor, '');
  }
  deps.renderSetupStep(deps.currentStep);
  deps.saveProgress();
}

export function saWizardReloadProviderSlot(slotId: string, deps: EventDeps): void {
  const slot = getSaProviderSlots().find((s: any) => s.slotId === slotId);
  if (!slot) return;
  const vendor = deps.state.vendors?.find((v: any) => v.slotId === slot.slotId);
  if (!vendor) return;
  const localKey = String(vendor.apiKey || '').trim();
  if (!localKey && !vendor.hasServerKey) {
    deps.openAlert({ title: 'No key', message: 'This provider has no API key to test.' });
    return;
  }
  vendor.status = 'testing';
  deps.renderSetupStep(deps.currentStep);
  deps.saveProgress();
  testVendorAllModalities(vendor, deps);
}

export function saWizardSaveManualProvider(vendorId: string, deps: EventDeps): void {
  const vendor = saVendorById(deps.state, vendorId);
  if (!vendor) return;
  const keyEl = document.getElementById(`sa-manual-key-${vendorId}`) as HTMLInputElement | null;
  const typed = (keyEl?.value || '').trim();
  const hasExisting = saVendorHasKey(vendor);
  if (!typed || typed.length < 4) {
    if (!hasExisting) {
      deps.openAlert({ title: 'API key required', message: 'Paste a valid API key before saving.' });
      return;
    }
    if (!applyVendorApiUrlHelper(vendor, document.getElementById(`sa-manual-url-${vendorId}`) as HTMLInputElement | null, vendor.name)) return;
    deps.renderSetupStep(deps.currentStep);
    deps.saveProgress();
    return;
  }
  if (!applyVendorApiUrlHelper(vendor, document.getElementById(`sa-manual-url-${vendorId}`) as HTMLInputElement | null, vendor.name)) return;
  saWizardUpsertVendor(vendor, typed, deps);
  if (keyEl) keyEl.value = '';
  vendor.status = 'testing';
  deps.renderSetupStep(deps.currentStep);
  deps.saveProgress();
  testVendorAllModalities(vendor, deps);
}

export function saWizardAddProvider(deps: EventDeps): void {
  const nameEl = document.getElementById('sa-add-name') as HTMLInputElement | null;
  const typeEl = document.getElementById('sa-add-provider') as HTMLSelectElement | null;
  const keyEl  = document.getElementById('sa-add-key') as HTMLInputElement | null;
  const urlEl  = document.getElementById('sa-add-baseurl') as HTMLInputElement | null;
  const name   = (nameEl?.value || '').trim();
  const providerId = typeEl?.value || 'openai-compatible';
  const apiKey = (keyEl?.value || '').trim();
  if (!name && apiKey.length < 4) {
    deps.openAlert({
      title: 'Name required',
      message: 'Enter a display name for this provider (you can paste the API key and click Save on its row).',
    });
    return;
  }
  const vendor = {
    id: `sa_wiz_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name: name || providerLabel(providerId),
    providerId,
    baseUrl: '',
    slotId: '',
    apiKey: '',
    status: null,
    statusMsg: '',
  };
  if (!applyVendorApiUrlHelper(vendor, urlEl, vendor.name)) return;
  if (apiKey.length >= 4) saWizardUpsertVendor(vendor, apiKey, deps);
  deps.state.vendors.push(vendor);
  if (nameEl) nameEl.value = '';
  if (keyEl) keyEl.value = '';
  if (urlEl) urlEl.value = '';
  if (apiKey.length >= 4) {
    vendor.status = 'testing';
    deps.renderSetupStep(deps.currentStep);
    deps.saveProgress();
    testVendorAllModalities(vendor, deps);
  } else {
    deps.renderSetupStep(deps.currentStep);
    deps.saveProgress();
  }
}

export function saWizardRemoveProvider(vendorId: string, deps: EventDeps): void {
  deps.state.vendors = (deps.state.vendors || []).filter((v: any) => v.id !== vendorId);
  ROUTING_MODALITIES.forEach((mod) => {
    if (deps.state[mod].vendorId === vendorId) {
      deps.state[mod].vendorId = '';
      deps.state[mod].providerId = '';
    }
  });
  deps.renderSetupStep(deps.currentStep);
  deps.saveProgress();
}

export function bindStepControls(stepId: string, deps: EventDeps): void {
  if (stepId === 'providers') {
    if (!deps.providerStepListenerBound) {
      deps.setProviderStepListenerBound(true);
      document.addEventListener('click', (e: Event) => {
        const target = e.target as Element;
        const card = target.closest('.sa-prov-card[data-sa-slot]');
        const details = target.closest('.sa-prov-card-details[data-sa-slot]');
        const toggleTarget = card || details;
        if (toggleTarget) {
          const slotId = (toggleTarget as HTMLElement).getAttribute('data-sa-slot');
          if (!target.closest('.sa-prov-card-controls')) {
            e.preventDefault();
            saWizardToggleProviderSlot(slotId!, deps);
          }
        }
        const saveBtn = target.closest('.sa-prov-save-btn[data-sa-slot]');
        if (saveBtn) { e.stopPropagation(); saWizardSaveProviderSlot((saveBtn as HTMLElement).getAttribute('data-sa-slot')!, deps); }
        const cancelBtn = target.closest('.sa-prov-cancel-btn[data-sa-slot]');
        if (cancelBtn) { e.stopPropagation(); saWizardToggleProviderSlot((cancelBtn as HTMLElement).getAttribute('data-sa-slot')!, deps); }
        const clearBtn = target.closest('.sa-prov-clear-btn[data-sa-slot]');
        if (clearBtn) { e.stopPropagation(); saWizardClearProviderSlot((clearBtn as HTMLElement).getAttribute('data-sa-slot')!, deps); }
        const reloadBtn = target.closest('.sa-prov-reload-btn[data-sa-slot]');
        if (reloadBtn) { e.stopPropagation(); saWizardReloadProviderSlot((reloadBtn as HTMLElement).getAttribute('data-sa-slot')!, deps); }
      });
      document.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === 'Return') {
          const input = e.target as HTMLInputElement;
          if (input?.classList.contains('sa-prov-key-input')) {
            e.preventDefault();
            const details = input.closest('.sa-prov-card-details[data-sa-slot]');
            if (details) saWizardSaveProviderSlot(details.getAttribute('data-sa-slot')!, deps);
          }
        }
      });
    }
    const addTypeEl = document.getElementById('sa-add-provider') as HTMLSelectElement | null;
    if (addTypeEl) {
      const handler = () => {
        const row = document.getElementById('sa-add-url-row');
        const t = document.getElementById('sa-add-provider') as HTMLSelectElement | null;
        if (row && t) row.classList.toggle('hidden', t.value !== 'generic-rest');
      };
      addTypeEl.addEventListener('change', handler);
      handler();
    }
    autoTestUntestedVendors(deps);
  }
}

export function saOnProviderChange(mod: string, deps: EventDeps): void {
  const pSel = document.getElementById(`sa-provider-${mod}`) as HTMLSelectElement | null;
  if (!pSel) return;
  deps.state[mod].providerId = pSel.value;
  deps.state[mod].status = null;
  deps.state[mod].statusMsg = '';
  deps.state[mod].listedModels = [];
  const baseUrlRow = document.getElementById(`sa-baseurl-row-${mod}`);
  if (baseUrlRow) baseUrlRow.classList.toggle('hidden', !['openai-compatible', 'generic-rest'].includes(pSel.value));
  const urlInput = document.getElementById(`sa-baseurl-${mod}`) as HTMLInputElement | null;
  if (urlInput) {
    const provider = (window as any).AI_API_PROVIDERS?.find((p: any) => p.id === pSel.value);
    urlInput.value = provider?.baseUrl || '';
    deps.state[mod].baseUrl = urlInput.value;
  }
  deps.refreshModelSelect(mod);
  const statusEl = document.getElementById(`sa-test-status-${mod}`);
  if (statusEl) {
    statusEl.className = 'sa-test-status';
    statusEl.innerHTML = '<i class="fa-solid fa-circle-info"></i> Provider changed — test connection to refresh.';
  }
}

export function ensureModelId(mod: string, deps: EventDeps): void {
  const s = deps.state[mod];
  if (!s.modelId && Array.isArray(s.listedModels) && s.listedModels.length) {
    s.modelId = s.listedModels[0].id;
    s.modelLabel = s.listedModels[0].label || '';
  }
}

export function refreshModelSelect(mod: string, deps: EventDeps): void {
  const mSel = document.getElementById(`sa-model-${mod}`) as HTMLSelectElement | null;
  if (!mSel) return;
  const s = deps.state[mod];
  deps.ensureModelId(mod);
  const catalogMods = saGetCatalogModels(s.providerId, mod);
  const allModels = saMergeModels(s.listedModels, catalogMods);
  mSel.replaceChildren();
  allModels.forEach((m: any) => {
    const o = document.createElement('option');
    o.value = m.id;
    o.textContent = m.label;
    o.selected = m.id === s.modelId;
    mSel.appendChild(o);
  });
  if (s.modelId) mSel.value = s.modelId;
  const capsEl = document.getElementById(`sa-model-caps-${mod}`);
  if (capsEl) capsEl.textContent = saModelCaps(s.providerId, mod, s.modelId);
}

export function refreshCoverageModelSelect(mod: string, deps: EventDeps): void {
  const mSel = document.getElementById(`sa-coverage-model-${mod}`) as HTMLSelectElement | null;
  if (!mSel) return;
  const s = deps.state[mod];
  deps.ensureModelId(mod);
  const catalogMods = saGetCatalogModels(s.providerId, mod);
  const allModels = saMergeModels(s.listedModels, catalogMods);
  mSel.replaceChildren();
  if (!allModels.length) {
    const o = document.createElement('option');
    o.value = '';
    o.textContent = '— No models. Add provider. —';
    mSel.appendChild(o);
  } else {
    allModels.forEach((m: any) => {
      const o = document.createElement('option');
      o.value = m.id;
      o.textContent = m.label;
      o.selected = m.id === s.modelId;
      mSel.appendChild(o);
    });
  }
  if (s.modelId) mSel.value = s.modelId;
  const capsEl = document.getElementById(`sa-coverage-model-caps-${mod}`);
  if (capsEl) capsEl.textContent = saModelCaps(s.providerId, mod, s.modelId);
}

export function saveStepData(mod: string, deps: EventDeps): void {
  const s = deps.state[mod];
  if (s.skip || !s.vendorId) return;
  deps.syncModalityProviderFromVendor(mod);
  if (typeof (window as any).loadAiApiSettings === 'function' && typeof (window as any).saveAiApiSettings === 'function') {
    const current = (window as any).loadAiApiSettings();
    current.modalities[mod] = {
      ...current.modalities[mod],
      provider:   s.providerId,
      model:      s.modelId || '',
      modelLabel: saResolveModelLabel(s, mod),
      baseUrl:    s.baseUrl || '',
      vendorId:   s.vendorId,
    };
    (window as any).saveAiApiSettings(current);
  }
}

export function saToggleKeyReveal(mod: string): void {
  const input = document.getElementById(`sa-key-${mod}`) as HTMLInputElement | null;
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
}

export function saTestProxy(): void {
  return;
}

export function isMaskedKeyDisplay(inputValue: string, storedKey: string): boolean {
  if (!inputValue || !storedKey) return false;
  const mask = '•'.repeat(Math.min(storedKey.length, 24));
  return inputValue === mask || (/^•+$/.test(inputValue) && inputValue.length <= storedKey.length);
}

export function keyFromInput(mod: string, deps: EventDeps): string {
  const v = deps.state.vendors?.find((x: any) => x.id === deps.state[mod]?.vendorId);
  return String(v?.apiKey || '').trim();
}

export async function saTestConnection(mod: string, deps: EventDeps): Promise<void> {
  await runConnectionTest(mod, { updateUi: true }, deps.routingTestDeps());
}

export function setTestStatus(mod: string, statusType: string, message: string, rawHtml?: boolean): void {
  const el = document.getElementById(`sa-test-status-${mod}`);
  if (!el) return;
  const icon = statusType === 'ok' || statusType === 'ratelimit' ? 'fa-circle-check'
             : statusType === 'testing' ? 'fa-circle-notch fa-spin'
             : statusType === 'cors' ? 'fa-circle-exclamation' : 'fa-circle-xmark';
  el.className = `sa-test-status sa-test-status--${statusType}`;
  if (rawHtml) {
    el.innerHTML = message;
  } else {
    el.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i> ${escHtml(message)}`;
  }
}

export function saveAllSetupData(deps: EventDeps): void {
  if (typeof (window as any).applyServerKeysBadge === 'function') (window as any).applyServerKeysBadge();
  const existing = typeof (window as any).loadApiKeys === 'function' ? (window as any).loadApiKeys() : { selectedVendorId: '', vendors: [] };
  const vendors = (deps.state.vendors || []).map((wv: any) => {
    let v = {
      id: wv.id,
      name: wv.name || providerLabel(wv.providerId),
      providerId: wv.providerId,
      baseUrl: wv.baseUrl || '',
      slotId: wv.slotId || '',
      apiKey: wv.apiKey || '',
    };
    if (typeof (window as any).normalizeVendor === 'function') v = (window as any).normalizeVendor(v);
    return v;
  });
  const routingUpdates: Record<string, any> = {};
  ROUTING_MODALITIES.forEach((mod) => {
    const s = deps.state[mod];
    if (s.skip || !s.vendorId) return;
    const vendor = vendors.find((v: any) => v.id === s.vendorId);
    if (!vendor) return;
    const wv = (deps.state.vendors || []).find((x: any) => x.id === vendor.id);
    routingUpdates[mod] = {
      provider:   vendor.providerId,
      model:      s.modelId || '',
      modelLabel: saResolveModelLabel(s, mod),
      baseUrl:    s.baseUrl || wv?.baseUrl || '',
      vendorId:   vendor.id,
    };
  });
  const nextApiKeys = { ...existing, vendors, selectedVendorId: vendors[0]?.id || existing.selectedVendorId };
  if (typeof (window as any).saveApiKeys === 'function') (window as any).saveApiKeys(nextApiKeys);
  if (typeof (window as any).loadAiApiSettings === 'function' && typeof (window as any).saveAiApiSettings === 'function') {
    const current = (window as any).loadAiApiSettings();
    ROUTING_MODALITIES.forEach((mod) => {
      if (routingUpdates[mod]) current.modalities[mod] = { ...current.modalities[mod], ...routingUpdates[mod] };
    });
    (window as any).saveAiApiSettings(current);
  }
  if (typeof (window as any).populateAiApiSettingsForm === 'function') (window as any).populateAiApiSettingsForm();
  if (typeof (window as any).refreshAiProvidersVendorList === 'function') (window as any).refreshAiProvidersVendorList();
}

export function providerLabel(providerId: string): string {
  if (typeof (window as any).AI_API_PROVIDERS !== 'undefined') {
    const found = (window as any).AI_API_PROVIDERS.find((p: any) => p.id === providerId);
    if (found) return found.label.split(' (')[0];
  }
  return providerId;
}

export function firstCatalogModelId(): string {
  return '';
}

export async function saWizardTestProvider(vendorId: string, deps: EventDeps): Promise<void> {
  const v = deps.state.vendors?.find((x: any) => x.id === vendorId);
  if (!v || !String(v.apiKey || '').trim()) {
    deps.openAlert({ title: 'No key', message: 'This provider has no API key to test.' });
    return;
  }
  v.status = 'testing';
  deps.renderSetupStep(deps.currentStep);
  const mod = 'llm';
  try {
    const result = await saFetchModels(v.providerId, v.apiKey, v.baseUrl || '', mod, undefined);
    v.status = result.ok ? 'ok' : (result.rateLimit ? 'ratelimit' : 'err');
    v.statusMsg = result.message || '';
    if (typeof (window as any).applyVendorCatalogFetchResult === 'function') {
      (window as any).applyVendorCatalogFetchResult(v.id, v.providerId, mod, result);
    } else if (typeof (window as any).setVendorModalityCatalog === 'function') {
      (window as any).setVendorModalityCatalog(v.id, v.providerId, mod, result);
    }
  } catch (e: any) {
    v.status = 'err';
    v.statusMsg = e.message || 'Test failed';
  }
  deps.renderSetupStep(deps.currentStep);
  deps.saveProgress();
}

function autoTestUntestedVendors(deps: EventDeps): void {
  const vendors = deps.state?.vendors || [];
  const untested = vendors.filter((v: any) => {
    const hasKey = saVendorHasKey(v);
    const hasLocalKey = String(v.apiKey || '').trim().length > 4;
    const needsTest = !v.status || v.status === null || v.status === '';
    return hasKey && hasLocalKey && needsTest;
  });
  if (untested.length === 0) return;
  untested.forEach((vendor: any) => {
    vendor.status = 'testing';
    testVendorAllModalities(vendor, deps);
  });
  deps.renderSetupStep(deps.currentStep);
  deps.saveProgress();
}

function testVendorAllModalities(vendor: any, deps: EventDeps): void {
  runAllModalityTests(vendor, deps.routingTestDeps());
}
