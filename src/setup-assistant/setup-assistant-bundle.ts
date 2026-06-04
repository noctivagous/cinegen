// @ts-nocheck — legacy port from setupAssistant.js (Wave E).
/**
 * Ported from source/js/setupAssistant.js
 */
/**
 * setupAssistant.js — First-run App Setup Wizard
 *
 * Walks the user through:
 *   Step 0  Welcome
 *   Step 1  Service providers & API keys
 *   Step 2  Modality coverage (assign provider per task)
 *   Step 3  Default models (per assigned modality)
 *   Step 4  Summary & Done
 *
 * Data is written into cinegen.apiKeys and cinegen.aiApiSettings
 * (same keys as Settings → API Keys & Service Providers / Models & Modalities).
 *
 * ── NOTE ──
 * Wizard progress (current step, vendor selections) is cached via server-backed
 * storageService so progress syncs across browser instances using the same server.
 * API keys themselves are persisted server-side via saveApiKeys() →
 * POST /api/settings/keys. Do NOT add browser-local persistence APIs here.
 * ─────────
 *
 * Call openSetupAssistant()  to launch it at any time.
 * checkFirstLaunchSetup()  is called from App.init() to trigger
 * automatically on first run.
 */

import { configureSaWizardApi, refreshSaStepHost } from '@/setup-assistant/sa-wizard-bridge';
import { REQUIRED_ROUTING_MODALITIES, ROUTING_MODALITIES, MODALITY_META } from '@/setup-assistant/sa-wizard-constants';
import { SETUP_COMPLETE_STORAGE_KEY, SETUP_PROGRESS_STORAGE_KEY } from '@/constants/storage-keys';
import { generateId } from '@/utils/ids';
import { escHtml } from '@/utils/html';
import { closeModal, closeAllModalsExcept, openModalAsync, registerModal } from '@/services/modal-manager';
import { ensureModalReady } from '@/components/modals/modal-loader';
import { storageService } from '@/services/persistence';
import {
  PROVIDERS_BY_MODALITY,
  SA_PROVIDER_CATALOG,
  getSaProviderSlots,
} from '@/data/provider-catalog';
import {
  saFetchModels,
  saGetCatalogModels,
  saMergeModels,
  saModelCaps,
  saResolveModelLabel,
  saStatusHtml,
} from '@/setup-assistant/connection-test';
import { injectSetupStyles } from '@/setup-assistant/setup-styles';
import {
  applySavedProgress,
  inferSetupCompleteFromServerState,
  isSetupComplete as saIsSetupComplete,
  loadSetupProgress,
  markSetupComplete as saMarkSetupComplete,
  resetSetupComplete as saResetSetupComplete,
  saveSetupProgress,
} from '@/setup-assistant/setup-assistant-persistence';
import {
  saCoverageSatisfied,
  saDefaultState,
  saFindVendorForSlot,
  saIsSlotActive,
  saManualVendors,
  saModalityIsRequired,
  saNormalizeVendorsToSlots,
  saRequiredModelsAssigned,
  saSyncModalityProviderFromVendor,
  saVendorById,
  saVendorHasKey,
  saVendorsWithKeys,
} from '@/setup-assistant/setup-assistant-state';
import {
  runConnectionTest as saRunConnectionTest,
  testVendorAllModalities as saTestVendorAllModalities,
} from '@/setup-assistant/setup-assistant-routing-tests';
import {
  renderBody as saRenderBody,
  renderFooter as saRenderFooter,
  renderRail as saRenderRail,
  renderSetupStep as saRenderSetupStep,
} from '@/setup-assistant/setup-assistant-render';
import {
  tmplWelcome,
  tmplProviders,
  tmplCoverage,
  tmplModels,
  tmplDone,
  modalityChipLabel,
  providerKeyPlaceholder,
  needsProviderApiUrl,
  normalizeApiUrl,
  validateApiUrl,
  providerLogoHtml,
  applyVendorApiUrl,
  saWizardOnAddProviderTypeChange,
  catalogChipsForVendor,
  vendorHasAnyModalityCatalog,
  providerRowStatus,
  saWizardProviderOptions,
  type TemplateDeps,
} from '@/setup-assistant/setup-assistant-templates';
import {
  bindStepControls,
  ensureModelId as eventEnsureModelId,
  refreshModelSelect as eventRefreshModelSelect,
  refreshCoverageModelSelect as eventRefreshCoverageModelSelect,
  saveStepData as eventSaveStepData,
  saveAllSetupData,
  keyFromInput,
  setTestStatus,
  saOnProviderChange,
  saToggleKeyReveal,
  saTestProxy,
  saTestConnection,
  saWizardAddProvider,
  saWizardRemoveProvider,
  saWizardSaveProviderSlot,
  saWizardSaveManualProvider,
  saWizardToggleProviderSlot,
  saWizardClearProviderSlot,
  saWizardReloadProviderSlot,
  saWizardTestProvider,
  isMaskedKeyDisplay,
  providerLabel,
  type EventDeps,
} from '@/setup-assistant/setup-assistant-events';

/* ── Constants ────────────────────────────────────────────────────────────── */

const SETUP_STEPS = [
  { idx: 0, id: 'welcome',   label: 'Welcome',             icon: 'fa-solid fa-clapperboard',  required: true  },
  { idx: 1, id: 'providers', label: 'Providers',           icon: 'fa-solid fa-key',           required: true  },
  { idx: 2, id: 'coverage',  label: 'Modalities & Models', icon: 'fa-solid fa-table-columns', required: true  },
  { idx: 3, id: 'done',      label: 'Done',                icon: 'fa-solid fa-circle-check',  required: true  },
];

/** 128×128 PNGs in source/img/service-provider-logos/{slotId}.png */
const SA_PROVIDER_LOGO_DIR = 'img/service-provider-logos';

/* ── Wizard state ─────────────────────────────────────────────────────────── */

let _saCurrentStep = 0;
let _saMaxReachableStep = 0;
let _saState       = null;
let _saTestAborts  = {};
const _saVendorTestAborts = {};
let _saFirstLaunchCheckScheduled = false;
let _saActiveProviderSlots = new Set();
let _saProviderStepListenerBound = false;

function _saNewWizardVendorId() {
  return generateId('sa_wiz', { randomLength: 5 });
}

function _saVendorById(vendorId) {
  return saVendorById(_saState, vendorId);
}

function _saVendorsWithKeys() {
  return saVendorsWithKeys(_saState);
}

function _saSyncModalityProviderFromVendor(mod) {
  saSyncModalityProviderFromVendor(_saState, mod);
}

function _saFindVendorForSlot(slot) {
  return saFindVendorForSlot(_saState, slot);
}

function _saManualVendors() {
  return saManualVendors(_saState, getSaProviderSlots);
}

function _saNormalizeVendorsToSlots() {
  saNormalizeVendorsToSlots(_saState, getSaProviderSlots);
}

function _saIsSlotActive(slotId) {
  return saIsSlotActive(slotId, _saState, _saActiveProviderSlots, getSaProviderSlots);
}

function _saModalityIsRequired(mod) {
  return saModalityIsRequired(mod, REQUIRED_ROUTING_MODALITIES);
}

function _saRequiredModelsAssigned() {
  return saRequiredModelsAssigned(_saState, REQUIRED_ROUTING_MODALITIES);
}

function _saCoverageSatisfied() {
  return saCoverageSatisfied(_saState, ROUTING_MODALITIES, REQUIRED_ROUTING_MODALITIES);
}

/* ── Setup complete flag ─────────────────────────────────────────────────── */

function isSetupComplete() {
  return saIsSetupComplete(storageService, SETUP_COMPLETE_STORAGE_KEY);
}

function markSetupComplete() {
  saMarkSetupComplete(storageService, SETUP_COMPLETE_STORAGE_KEY);
}

function resetSetupComplete() {
  saResetSetupComplete(storageService, SETUP_COMPLETE_STORAGE_KEY);
}

async function _saInferSetupCompleteFromServerState() {
  return inferSetupCompleteFromServerState({
    requiredRoutingModalities: REQUIRED_ROUTING_MODALITIES,
    markSetupComplete,
    vendorIsConfigured: typeof vendorIsConfigured === 'function' ? vendorIsConfigured : undefined,
    loadAiApiSettings: typeof loadAiApiSettings === 'function' ? loadAiApiSettings : undefined,
    loadApiKeys: typeof loadApiKeys === 'function' ? loadApiKeys : undefined,
  });
}

/* ── Wizard progress (resume after refresh) ──────────────────────────────── */

function _saSaveProgress() {
  saveSetupProgress({
    storageService,
    setupProgressStorageKey: SETUP_PROGRESS_STORAGE_KEY,
    currentStep: _saCurrentStep,
    maxReachableStep: _saMaxReachableStep,
    state: _saState,
    routingModalities: ROUTING_MODALITIES,
    vendorById: _saVendorById,
    resolveModelLabel: saResolveModelLabel,
    loadAiApiSettings: typeof loadAiApiSettings === 'function' ? loadAiApiSettings : undefined,
    saveAiApiSettings: typeof saveAiApiSettings === 'function' ? saveAiApiSettings : undefined,
  });
}

/* ── Event deps builder ──────────────────────────────────────────────────── */

function _saEventDeps(): EventDeps {
  return {
    state: _saState,
    currentStep: _saCurrentStep,
    testAborts: _saTestAborts,
    vendorTestAborts: _saVendorTestAborts,
    activeProviderSlots: _saActiveProviderSlots,
    providerStepListenerBound: _saProviderStepListenerBound,
    setProviderStepListenerBound: (v) => { _saProviderStepListenerBound = v; },
    saveProgress: _saSaveProgress,
    renderSetupStep: _renderSetupStep,
    ensureModelId: _saEnsureModelId,
    refreshModelSelect: _saRefreshModelSelect,
    refreshCoverageModelSelect: _saRefreshCoverageModelSelect,
    saveStepData: _saSaveStepData,
    syncModalityProviderFromVendor: _saSyncModalityProviderFromVendor,
    setTestStatus: _saSetTestStatus,
    keyFromInput: _saKeyFromInput,
    routingTestDeps: _saRoutingTestDeps,
    openAlert: openSetupAssistantAlert,
  };
}

/* ── Template deps builder ────────────────────────────────────────────────── */

function _saTmplDeps(): TemplateDeps {
  return {
    state: _saState,
    activeProviderSlots: _saActiveProviderSlots,
    findVendorForSlot: _saFindVendorForSlot,
    isSlotActive: _saIsSlotActive,
    manualVendors: _saManualVendors,
    normalizeVendorsToSlots: _saNormalizeVendorsToSlots,
    vendorById: _saVendorById,
    vendorsWithKeys: _saVendorsWithKeys,
    modalityIsRequired: _saModalityIsRequired,
    requiredModelsAssigned: _saRequiredModelsAssigned,
    coverageSatisfied: _saCoverageSatisfied,
    loadProviderModelCatalog: () => (window as any).loadProviderModelCatalog?.(),
    modelMatchesAudioCapability: (m, c, p) => typeof (window as any).modelMatchesAudioCapability === 'function'
      ? (window as any).modelMatchesAudioCapability(m, c, p) : false,
    providerLabel: (id) => providerLabel(id),
    catalogChipsForVendor: (v) => catalogChipsForVendor(v, _saTmplDeps()),
    vendorHasAnyModalityCatalog: (v) => vendorHasAnyModalityCatalog(v),
    modalityChipLabel: (m) => modalityChipLabel(m),
    providerKeyPlaceholder: (v) => providerKeyPlaceholder(v),
    applyVendorApiUrl: (v, i, l) => applyVendorApiUrl(v, i, l),
    needsProviderApiUrl: (id) => needsProviderApiUrl(id),
  };
}

/* ── Open / Close ─────────────────────────────────────────────────────────── */

async function openSetupAssistant(startStep) {
  _injectSetupStyles();
  await ensureModalReady('setup-assistant-modal');
  await customElements.whenDefined('cinegen-setup-assistant-modal');
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  _initSetupAssistantChromeOnce();
  _saState = saDefaultState();

  const progress = loadSetupProgress(storageService, SETUP_PROGRESS_STORAGE_KEY, SETUP_STEPS.length);
  if (progress) applySavedProgress(progress, _saState, ROUTING_MODALITIES);

  _saPrePopulateFromExistingData();
  _saPopulateAudioFromCatalog();

  if (typeof startStep === 'number' && startStep >= 0 && startStep < SETUP_STEPS.length) {
    _saCurrentStep = startStep;
  } else {
    _saCurrentStep = 0;
  }
  _saMaxReachableStep = _saCurrentStep;
  _saActiveProviderSlots = new Set();

  openModalAsync({ modalId: 'setup-assistant-modal' });
  _renderSetupStep(_saCurrentStep);
  _saSaveProgress();
}

function closeSetupAssistant() {
  closeModal('setup-assistant-modal');
  _saState = null;
}

/* ── Data pre-population ──────────────────────────────────────────────────── */

function _saPrePopulateFromExistingData() {
  if (typeof loadApiKeys === 'function') {
    try {
      const existing = loadApiKeys();
      if (existing?.vendors?.length) {
        for (const ek of existing.vendors) {
          const slot = getSaProviderSlots().find((s) => s.slotId === ek.slotId);
          if (slot) {
            const found = _saFindVendorForSlot(slot);
            if (!found) {
              _saState.vendors.push({
                id: ek.id,
                slotId: ek.slotId,
                name: ek.name || slot.name,
                providerId: ek.providerId || slot.providerId,
                baseUrl: ek.baseUrl || slot.baseUrl || '',
                apiKey: ek.apiKey || '',
                hasServerKey: ek.hasServerKey || false,
                status: ek.status || null,
                statusMsg: ek.statusMsg || '',
              });
            }
          } else {
            const existingManual = _saManualVendors().find((mv) => mv.id === ek.id);
            if (!existingManual) {
              _saState.vendors.push({
                id: ek.id,
                slotId: '',
                name: ek.name || 'Custom',
                providerId: ek.providerId || 'openai-compatible',
                baseUrl: ek.baseUrl || '',
                apiKey: ek.apiKey || '',
                hasServerKey: ek.hasServerKey || false,
                status: ek.status || null,
                statusMsg: ek.statusMsg || '',
              });
            }
          }
        }
      }
    } catch { /* ignore */ }
  }

  if (typeof loadAiApiSettings === 'function') {
    try {
      const routing = loadAiApiSettings();
      if (routing?.modalities) {
        for (const mod of ROUTING_MODALITIES) {
          const m = routing.modalities[mod];
          if (m?.provider && _saState[mod]) {
            _saState[mod].providerId = m.provider;
            _saState[mod].modelId = m.model || '';
            _saState[mod].modelLabel = m.modelLabel || '';
            _saState[mod].baseUrl = m.baseUrl || '';
            _saState[mod].vendorId = m.vendorId || '';
          }
        }
      }
    } catch { /* ignore */ }
  }
}

function _saPopulateAudioFromCatalog() {
  ['tts', 'sfx', 'music'].forEach((sub) => {
    if (!_saState[sub]) {
      _saState[sub] = {
        status: null, statusMsg: '', listedModels: [], fetchedAt: 0,
        modelId: '', modelLabel: '', providerId: '', vendorId: '', baseUrl: '',
      };
    }
    const existing = _saState[sub];
    const parentVendor = _saVendorById(_saState.audio?.vendorId);
    if (parentVendor && existing.providerId !== _saState.audio.providerId) {
      existing.providerId = _saState.audio.providerId;
      existing.vendorId = _saState.audio.vendorId;
      existing.baseUrl = _saState.audio.baseUrl;
    }
  });
}

/* ── Step navigation ──────────────────────────────────────────────────────── */

function _saCollectCurrentStep(idx) {
  const hosts = document.querySelectorAll('sa-step-providers, sa-step-coverage');
  hosts.forEach((host) => {
    if (typeof host.collectFormData === 'function') {
      try { host.collectFormData(_saState); } catch { /* ignore */ }
    }
  });
}

function goSetupStep(nextIdx) {
  if (nextIdx < 0 || nextIdx >= SETUP_STEPS.length) return;
  _saCollectCurrentStep(_saCurrentStep);
  _saCurrentStep = nextIdx;
  if (nextIdx > _saMaxReachableStep) _saMaxReachableStep = nextIdx;
  _renderSetupStep(_saCurrentStep);
  _saSaveProgress();
}

function saRailGoToStep(stepIdx) {
  const idx = parseInt(stepIdx, 10);
  if (isNaN(idx)) return;
  goSetupStep(idx);
}

async function setupNext() {
  _saCollectCurrentStep(_saCurrentStep);
  const stepId = SETUP_STEPS[_saCurrentStep]?.id;

  if (stepId === 'providers') {
    const hasRequired = _saCoverageSatisfied();
    if (!hasRequired) {
      const vendorsWithKey = _saVendorsWithKeys();
      if (!vendorsWithKey.length) {
        openSetupAssistantAlert({
          title: 'Provider &amp; key needed',
          message: 'At least one provider with a valid API key is required to continue. Add one above.',
        });
        return;
      }
      const uncovered = REQUIRED_ROUTING_MODALITIES.filter((m) => {
        const v = _saVendorById(_saState[m]?.vendorId);
        return !v || !_saState[m]?.modelId;
      });
      if (uncovered.length) {
        const names = uncovered.map((m) => MODALITY_META[m]?.label || m).join(', ');
        openSetupAssistantAlert({
          title: 'Missing default models',
          message: `Assign models for: ${names}. Test and select a model for each required modality.`,
        });
        return;
      }
    }
  }

  const nextIdx = _saCurrentStep + 1;
  _saCurrentStep = nextIdx;
  if (nextIdx > _saMaxReachableStep) _saMaxReachableStep = nextIdx;
  _renderSetupStep(_saCurrentStep);
  _saSaveProgress();
}

function setupBack() {
  if (_saCurrentStep <= 0) return;
  _saCollectCurrentStep(_saCurrentStep);
  _saCurrentStep -= 1;
  _renderSetupStep(_saCurrentStep);
  _saSaveProgress();
}

function setupFinish() {
  _saCollectCurrentStep(_saCurrentStep);
  _saveAllSetupData();
  markSetupComplete();
  closeSetupAssistant();
  if (typeof refreshAiProvidersVendorList === 'function') refreshAiProvidersVendorList();
}

/* ── Render wrappers ──────────────────────────────────────────────────────── */

function _renderSetupStep(idx) {
  const tmplDeps = _saTmplDeps();
  saRenderSetupStep(
    idx,
    {
      setupSteps: SETUP_STEPS,
      maxReachableStep: _saMaxReachableStep,
      renderBody: _renderBody,
      bindStepControls: _bindStepControls,
      escHtml,
    },
    {
      setFooterHint: _saFooterHintForStep,
      onLastStep: idx === SETUP_STEPS.length - 1,
    }
  );
}

function _renderRail(currentIdx) {
  saRenderRail(currentIdx, {
    setupSteps: SETUP_STEPS,
    maxReachableStep: _saMaxReachableStep,
    renderBody: _renderBody,
    bindStepControls: _bindStepControls,
    escHtml,
  });
}

function _renderBody(idx) {
  const tmplDeps = _saTmplDeps();
  const step = SETUP_STEPS[idx];
  if (!step) return;

  const host = document.getElementById('sa-body');
  if (!host) return;

  if (step.id === 'providers') host.innerHTML = tmplProviders(tmplDeps);
  else if (step.id === 'coverage') host.innerHTML = tmplCoverage(tmplDeps);
  else if (step.id === 'done') host.innerHTML = tmplDone(tmplDeps);
  else saRenderBody(idx, {
    setupSteps: SETUP_STEPS,
    maxReachableStep: _saMaxReachableStep,
    renderBody: _renderBody,
    bindStepControls: _bindStepControls,
    escHtml,
  });
}

function _renderFooter(idx) {
  saRenderFooter(
    idx,
    {
      setupSteps: SETUP_STEPS,
      maxReachableStep: _saMaxReachableStep,
      renderBody: _renderBody,
      bindStepControls: _bindStepControls,
      escHtml,
    },
    {
      setFooterHint: _saFooterHintForStep,
      onLastStep: idx === SETUP_STEPS.length - 1,
    }
  );
}

function _saFooterHintForStep(stepId) {
  if (stepId === 'welcome') return 'Keys never leave this machine except to the AI APIs you call.';
  if (stepId === 'providers') return 'Save keys for the services you use — you only need one provider to continue. Assign them to tasks on the next step.';
  if (stepId === 'coverage') return 'Text, Video, and Image / Storyboards are required. Sound can be skipped for now.';
  if (stepId === 'models') return 'Test each assignment and pick a default model. You can change these anytime in Settings.';
  return '';
}

/* ── Routing test deps adapter ────────────────────────────────────────────── */

function _saRoutingTestDeps() {
  return {
    routingModalities: ROUTING_MODALITIES,
    setupSteps: SETUP_STEPS,
    getCurrentStep: () => _saCurrentStep,
    getState: () => _saState,
    getTestAborts: () => _saTestAborts,
    setTestAbort: (mod, controller) => {
      if (controller) _saTestAborts[mod] = controller;
      else delete _saTestAborts[mod];
    },
    getVendorTestAborts: () => _saVendorTestAborts,
    collectCurrentStep: _saCollectCurrentStep,
    saveProgress: _saSaveProgress,
    renderSetupStep: _renderSetupStep,
    fetchModels: saFetchModels,
    modalityChipLabel: (mod) => modalityChipLabel(mod),
    applyVendorCatalogFetchResult:
      typeof applyVendorCatalogFetchResult === 'function' ? applyVendorCatalogFetchResult : undefined,
    setVendorModalityCatalog:
      typeof setVendorModalityCatalog === 'function' ? setVendorModalityCatalog : undefined,
    ensureModelId: (mod) => _saEnsureModelId(mod),
    refreshModelSelect: (mod) => _saRefreshModelSelect(mod),
    saveStepData: (mod) => _saSaveStepData(mod),
    triggerModelActivityBlink:
      typeof triggerModelActivityBlink === 'function' ? triggerModelActivityBlink : undefined,
    syncModalityProviderFromVendor: _saSyncModalityProviderFromVendor,
    vendorById: _saVendorById,
    keyFromInput: (mod) => _saKeyFromInput(mod),
    setTestStatus: _saSetTestStatus,
    afterSuccessfulTest: (mod, listedModels, fetchedAt, s) => {
      if (mod !== 'audio') return;
      const checkSub = (key) => {
        const matchFn =
          typeof window.modelMatchesAudioCapability === 'function'
            ? (m) => window.modelMatchesAudioCapability(m, key, s.providerId || '')
            : (m) => {
                const text = `${m.id} ${m.label || ''}`.toLowerCase();
                const kw = { tts: ['tts', 'speech', 'voice'], sfx: ['sfx', 'sound', 'effect'], music: ['music', 'song'] }[key] || [];
                return kw.some((k) => text.includes(k));
              };
        const hits = listedModels.filter(matchFn);
        if (!_saState[key]) {
          _saState[key] = {
            status: null, statusMsg: '', listedModels: [], fetchedAt: 0,
            modelId: '', providerId: '', vendorId: '', baseUrl: '',
          };
        }
        if (hits.length > 0) {
          _saState[key].status = _saState.audio.status;
          _saState[key].statusMsg = _saState.audio.statusMsg;
          _saState[key].listedModels = hits;
          _saState[key].fetchedAt = fetchedAt;
          _saState[key].providerId = _saState.audio.providerId;
          _saState[key].vendorId = _saState.audio.vendorId;
          _saState[key].baseUrl = _saState.audio.baseUrl;
          if (_saState[key].listedModels.length && !_saState[key].modelId) {
            _saState[key].modelId = _saState[key].listedModels[0].id;
          }
        }
      };
      checkSub('tts');
      checkSub('sfx');
      checkSub('music');
    },
  };
}

async function _saTestVendorAllModalities(vendor) {
  await saTestVendorAllModalities(vendor, _saRoutingTestDeps());
}

/* ── Event wiring wrappers ────────────────────────────────────────────────── */

function _bindStepControls(stepId) {
  bindStepControls(stepId, _saEventDeps());
}

function _saEnsureModelId(mod) {
  eventEnsureModelId(mod, _saEventDeps());
}

function _saRefreshModelSelect(mod) {
  eventRefreshModelSelect(mod, _saEventDeps());
}

function _saRefreshCoverageModelSelect(mod) {
  eventRefreshCoverageModelSelect(mod, _saEventDeps());
}

function _saSaveStepData(mod) {
  eventSaveStepData(mod, _saEventDeps());
}

function _saKeyFromInput(mod) {
  return keyFromInput(mod, _saEventDeps());
}

function _saSetTestStatus(mod, statusType, message, rawHtml) {
  setTestStatus(mod, statusType, message, rawHtml);
}

function _saveAllSetupData() {
  saveAllSetupData(_saEventDeps());
}

/* ── Alert dialog (wizard-scoped) ──────────────────────────────────────────── */

function openSetupAssistantAlert({ title, message, tone }) {
  const layer = document.getElementById('sa-alert-modal');
  if (!layer) return;
  const titleEl   = document.getElementById('sa-alert-title-text');
  const messageEl = document.getElementById('sa-alert-message');
  const iconEl    = document.getElementById('sa-alert-icon');
  if (titleEl)   titleEl.textContent   = title || 'Notice';
  if (messageEl) messageEl.textContent = message || '';
  if (iconEl) {
    iconEl.className = tone !== 'info'
      ? 'fa-solid fa-triangle-exclamation'
      : 'fa-solid fa-circle-info';
  }
  layer.hidden = false;
  layer.setAttribute('aria-hidden', 'false');
  document.getElementById('sa-alert-ok')?.focus();
}

function closeSetupAssistantAlert() {
  const layer = document.getElementById('sa-alert-modal');
  if (!layer || layer.hidden) return;
  layer.hidden = true;
  layer.setAttribute('aria-hidden', 'true');
}

/* ── First-launch detection ──────────────────────────────────────────────── */

async function checkFirstLaunchSetup() {
  if (_saFirstLaunchCheckScheduled) return;
  if (isSetupComplete()) return;
  _saFirstLaunchCheckScheduled = true;
  if (await _saInferSetupCompleteFromServerState()) return;
  let attempts = 0;
  const maxAttempts = 5;
  const tryOpen = () => {
    if (document.querySelector('cinegen-setup-assistant-modal')) {
      void openSetupAssistant();
      return;
    }
    attempts += 1;
    if (attempts >= maxAttempts) return;
    setTimeout(tryOpen, 250);
  };
  setTimeout(tryOpen, 300);
}

/* ── AI Providers modal: Test Connection ───────────────────────────────────── */

async function aipTestSelectedProvider() {
  const host = document.querySelector('cinegen-aip-test-connection');
  if (host && typeof host.runTest === 'function') {
    host.runTest();
  }
}

/* ── Init ─────────────────────────────────────────────────────────────────── */

function _initSetupAssistantChromeOnce() {
  const modal = document.getElementById('setup-assistant-modal');
  if (!modal || modal.dataset.saChromeInit === '1') return;
  modal.dataset.saChromeInit = '1';

  const nextBtn = document.getElementById('sa-btn-next');
  if (nextBtn) {
    nextBtn.removeAttribute('onclick');
    nextBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (_saCurrentStep >= SETUP_STEPS.length - 1) setupFinish();
      else setupNext();
    });
  }

  const alertOk = document.getElementById('sa-alert-ok');
  if (alertOk) {
    alertOk.addEventListener('click', (e) => {
      e.stopPropagation();
      closeSetupAssistantAlert();
    });
  }

  const alertLayer = document.getElementById('sa-alert-modal');
  if (alertLayer) {
    alertLayer.addEventListener('click', (e) => {
      if (e.target === alertLayer) closeSetupAssistantAlert();
    });
  }

  const rail = document.getElementById('sa-rail');
  if (rail) {
    rail.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-step-idx]');
      if (!tab || !rail.contains(tab)) return;
      e.stopPropagation();
      saRailGoToStep(tab.getAttribute('data-step-idx'));
    });
  }
}

function _injectSetupStyles() {
  injectSetupStyles();
}

export function registerSetupAssistantModal(): void {
  registerModal({
    id: 'setup-assistant-modal',
    bodyOverflow: true,
  });
}

export function installSetupAssistantBundleGlobals(): void {
  const api = {
    getState: () => _saState,
    vendorsWithKeys: () => _saVendorsWithKeys(),
    vendorById: (id: string) => _saVendorById(id),
    providerLabel: (id: string) => providerLabel(id),
    modalityRequired: (mod: string) => _saModalityIsRequired(mod),
    coverageSatisfied: () => _saCoverageSatisfied(),
    statusMessageHtml: (s: any) => saStatusHtml(s),
    modelCapsText: (providerId: string, mod: string, modelId: string) => saModelCaps(providerId, mod, modelId),
    catalogModels: (providerId: string, mod: string) => saGetCatalogModels(providerId, mod),
    cachedVendorModels: (vendorId: string, mod: string) => typeof getCachedModelsForVendorModality === 'function'
      ? getCachedModelsForVendorModality(vendorId, mod) : [],
    cachedAudioModelsByCapability: (vendorId: string, capability: string) => typeof getCachedAudioModelsByCapability === 'function'
      ? getCachedAudioModelsByCapability(vendorId, capability) : [],
    cachedModalityStatus: (vendorId: string, mod: string) => typeof getCachedModalityStatus === 'function'
      ? getCachedModalityStatus(vendorId, mod) : null,
    mergeModels: (listed: any[], catalog: any[]) => saMergeModels(listed, catalog),
    providersByModality: (mod: string) => PROVIDERS_BY_MODALITY[mod] || [],
    saveStepData: (mod: string) => _saSaveStepData(mod),
    renderProvidersMarkup: () => {
      const deps = _saTmplDeps();
      return tmplProviders(deps);
    },
  };
  configureSaWizardApi(api);
  (window as any)._saWizardApi = api;

  const w = window as unknown as Record<string, unknown>;
  w.openSetupAssistant = openSetupAssistant;
  w.closeSetupAssistant = closeSetupAssistant;
  w.isSetupComplete = isSetupComplete;
  w.markSetupComplete = markSetupComplete;
  w.resetSetupComplete = resetSetupComplete;
  w.checkFirstLaunchSetup = checkFirstLaunchSetup;
  w.setupBack = setupBack;
  w.setupFinish = setupFinish;
  w.setupNext = setupNext;
  w.aipTestSelectedProvider = aipTestSelectedProvider;
  w.saOnProviderChange = (mod) => saOnProviderChange(mod, _saEventDeps());
  w.saTestProxy = saTestProxy;
  w.saToggleKeyReveal = (mod) => saToggleKeyReveal(mod);
  w.saTestConnection = (mod) => saTestConnection(mod, _saEventDeps());
  w.saWizardAddProvider = () => saWizardAddProvider(_saEventDeps());
  w.saWizardOnAddProviderTypeChange = saWizardOnAddProviderTypeChange;
  w.saWizardSaveProviderSlot = (slotId) => saWizardSaveProviderSlot(slotId, _saEventDeps());
  w.saWizardClearProviderSlot = (slotId) => saWizardClearProviderSlot(slotId, _saEventDeps());
  w.saWizardReloadProviderSlot = (slotId) => saWizardReloadProviderSlot(slotId, _saEventDeps());
  w.saWizardSaveManualProvider = (vendorId) => saWizardSaveManualProvider(vendorId, _saEventDeps());
  w.saWizardRemoveProvider = (vendorId) => saWizardRemoveProvider(vendorId, _saEventDeps());
  w.saWizardTestProvider = (vendorId) => saWizardTestProvider(vendorId, _saEventDeps());
  w.saWizardToggleProviderSlot = (slotId) => saWizardToggleProviderSlot(slotId, _saEventDeps());
  w._saActiveProviderSlots = _saActiveProviderSlots;
  w._saCurrentStep = _saCurrentStep;
  w._saIsSlotActive = (slotId) => _saIsSlotActive(slotId);
  w._renderSetupStep = _renderSetupStep;
  w.fetchProviderModelsForModality = saFetchModels;
}

export function initSetupAssistantChromeOnce(): void {
  _initSetupAssistantChromeOnce();
}
