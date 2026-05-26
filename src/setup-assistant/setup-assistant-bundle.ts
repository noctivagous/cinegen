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
import { REQUIRED_ROUTING_MODALITIES, ROUTING_MODALITIES } from '@/setup-assistant/sa-wizard-constants';
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
  saCombineSignals,
  saFetchModels,
  saGetCatalogModels,
  saMergeModels,
  saModelCaps,
  saResolveModelLabel,
  saStatusHtml,
} from '@/setup-assistant/connection-test';
import { injectSetupStyles } from '@/setup-assistant/setup-styles';

/* ── Constants ────────────────────────────────────────────────────────────── */

const SETUP_STEPS = [
  { idx: 0, id: 'welcome',   label: 'Welcome',             icon: 'fa-solid fa-clapperboard',  required: true  },
  { idx: 1, id: 'providers', label: 'Providers',           icon: 'fa-solid fa-key',           required: true  },
  { idx: 2, id: 'coverage',  label: 'Modalities & Models', icon: 'fa-solid fa-table-columns', required: true  },
  { idx: 3, id: 'done',      label: 'Done',                icon: 'fa-solid fa-circle-check',  required: true  },
];

/* ROUTING_MODALITIES, PROVIDERS_BY_MODALITY, SA_PROVIDER_CATALOG, and
   getSaProviderSlots() are now imported from @/setup-assistant/sa-wizard-constants
   and @/data/provider-catalog. */

/** 128×128 PNGs in source/img/service-provider-logos/{slotId}.png */
const SA_PROVIDER_LOGO_DIR = 'img/service-provider-logos';

const MODALITY_META = {
  llm: {
    label: 'Language / Text AI',
    badge: 'REQUIRED',
    badgeClass: 'sa-badge--required',
    scopeKey: 'language',
    desc: 'Powers AI assistants, script writing, dialogue suggestions, and all in-app text generation.',
    tip: 'Recommended: OpenAI GPT-4.1 mini (cost-effective) or Anthropic Claude Sonnet.',
  },
  video: {
    label: 'Video Generation',
    badge: 'REQUIRED',
    badgeClass: 'sa-badge--required',
    scopeKey: 'video',
    desc: 'Generates shots, takes, and coverage clips from your script scenes.',
    tip: 'Recommended: Google Veo 3.1 (best quality + native audio), Kling 2.6 via fal.ai, or Runway Gen-4.5.',
  },
  image: {
    label: 'Image / Storyboards',
    badge: 'REQUIRED',
    badgeClass: 'sa-badge--required',
    scopeKey: 'image',
    desc: 'Creates storyboard frames, reference images, and character / location visuals.',
    tip: 'Recommended: FLUX 1.1 Pro via fal.ai or GPT Image 2 via OpenAI.',
  },
  audio: {
    label: 'Audio — TTS · SFX · Music',
    badge: 'OPTIONAL',
    badgeClass: 'sa-badge--optional',
    scopeKey: 'audio',
    desc: 'Voice acting, sound effects, and music generation for your scenes.',
    tip: 'Recommended: ElevenLabs (best voice cloning + SFX). Suno/Udio for music (via custom endpoint).',
  },
};

/* ── Wizard state ─────────────────────────────────────────────────────────── */

let _saCurrentStep = 0;
/** Furthest step index unlocked via Next (and reachable via Back / rail). */
let _saMaxReachableStep = 0;
let _saState       = null;
let _saTestAborts  = {};     /* AbortController per modality test in flight */
const _saVendorTestAborts = {};  /* AbortController per vendor all-modality connection test */
let _saFirstLaunchCheckScheduled = false;
let _saActiveProviderSlots = new Set();
let _saProviderStepListenerBound = false;

function _saDefaultState() {
  return {
    vendors:     [],
    llm:   _saDefaultModality(),
    video: _saDefaultModality(),
    image: _saDefaultModality(),
    audio: _saDefaultModality(),
  };
}

function _saDefaultModality() {
  return {
    vendorId:     '',
    skip:         false,
    providerId:   '',
    baseUrl:      '',
    modelId:      '',
    modelLabel:   '',
    status:       null,
    statusMsg:    '',
    listedModels: [],
  };
}

function _saNewWizardVendorId() {
  return generateId('sa_wiz', { randomLength: 5 });
}

function _saVendorById(vendorId) {
  if (!vendorId || !_saState?.vendors) return null;
  return _saState.vendors.find((v) => v.id === vendorId) || null;
}

function _saVendorHasKey(v) {
  return Boolean(v?.hasServerKey) || String(v?.apiKey || '').trim().length > 4;
}

function _saVendorsWithKeys() {
  return (_saState?.vendors || []).filter((v) => _saVendorHasKey(v));
}

function _saSyncModalityProviderFromVendor(mod) {
  const m = _saState[mod];
  const v = _saVendorById(m.vendorId);
  m.providerId = v ? v.providerId : '';
  // Do NOT copy the vendor's baseUrl here — it may be stale from a previous
  // session (e.g. Together AI's URL when xAI is selected).  The base URL
  // should only come from the user's explicit input on the coverage step.
}

function _saSlotMatchesVendor(slot, vendor) {
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

function _saFindVendorForSlot(slot) {
  if (!slot || !_saState?.vendors) return null;
  return _saState.vendors.find((v) => _saSlotMatchesVendor(slot, v)) || null;
}

function _saIsCatalogVendor(vendor) {
  return getSaProviderSlots().some((slot) => _saSlotMatchesVendor(slot, vendor));
}

function _saManualVendors() {
  return (_saState?.vendors || []).filter((v) => !_saIsCatalogVendor(v));
}

function _saNormalizeVendorsToSlots() {
  if (!_saState?.vendors) return;
  const claimed = new Set();
  getSaProviderSlots().forEach((slot) => {
    const match = _saState.vendors.find((v) => !claimed.has(v.id) && _saSlotMatchesVendor(slot, v));
    if (!match) return;
    claimed.add(match.id);
    match.slotId = slot.slotId;
    if (!match.name || match.name === 'Provider' || match.name === 'New provider') match.name = slot.name;
    if (slot.baseUrl && !match.baseUrl) match.baseUrl = slot.baseUrl;
    if (match.providerId === 'openai-compatible' || !match.providerId) match.providerId = slot.providerId;
  });
}

function _saIsSlotActive(slotId) {
  const slot = getSaProviderSlots().find((s) => s.slotId === slotId);
  if (!slot) return _saActiveProviderSlots.has(slotId);
  const v = _saFindVendorForSlot(slot);
  const hasKey = v && _saVendorHasKey(v);
  return hasKey || _saActiveProviderSlots.has(slotId);
}

function _saModalityIsRequired(mod) {
  return REQUIRED_ROUTING_MODALITIES.includes(mod);
}

function _saRequiredModelsAssigned() {
  return REQUIRED_ROUTING_MODALITIES.every((mod) => Boolean(_saState[mod]?.modelId));
}

function _saCoverageSatisfied() {
  return ROUTING_MODALITIES.every((mod) => {
    const m = _saState[mod];
    if (m.skip) return !_saModalityIsRequired(mod);
    if (!m.vendorId) return !_saModalityIsRequired(mod);
    const v = _saVendorById(m.vendorId);
    return Boolean(v && _saVendorHasKey(v));
  });
}

/* ── Setup complete flag ─────────────────────────────────────────────────── */

function isSetupComplete() {
  try {
    const raw = storageService.getItem(SETUP_COMPLETE_STORAGE_KEY);
    if (raw == null) return false;
    const normalized = String(raw).trim().toLowerCase();
    return normalized === '1' || normalized === 'true';
  }
  catch (e) { return true; }
}

function markSetupComplete() {
  try { storageService.setItem(SETUP_COMPLETE_STORAGE_KEY, '1'); }
  catch (e) { /* noop */ }
}

function resetSetupComplete() {
  try { storageService.removeItem(SETUP_COMPLETE_STORAGE_KEY); }
  catch (e) { /* noop */ }
}

function _saVendorConfigured(vendor) {
  if (!vendor || typeof vendor !== 'object') return false;
  if (typeof vendorIsConfigured === 'function') return vendorIsConfigured(vendor);
  if (vendor.hasServerKey) return true;
  const key = String(vendor.apiKey || '').trim();
  return Boolean(key) && !/^•+$/.test(key);
}

function _saRoutingLooksComplete(routing) {
  const modalities = routing?.modalities || {};
  return REQUIRED_ROUTING_MODALITIES.every((mod) => {
    const cfg = modalities[mod] || {};
    return Boolean(
      String(cfg.provider || '').trim() &&
      String(cfg.vendorId || '').trim() &&
      String(cfg.model || '').trim()
    );
  });
}

function _saRoutingVendorIds(routing) {
  const ids = new Set();
  const modalities = routing?.modalities || {};
  REQUIRED_ROUTING_MODALITIES.forEach((mod) => {
    const vendorId = String(modalities?.[mod]?.vendorId || '').trim();
    if (vendorId) ids.add(vendorId);
  });
  return ids;
}

function _saKeysCoverRoutingVendors(keysState, vendorIds) {
  if (!keysState || !vendorIds || !vendorIds.size) return false;
  const configured = new Set(
    (keysState.vendors || [])
      .filter((v) => _saVendorConfigured(v))
      .map((v) => String(v.id || '').trim())
      .filter(Boolean)
  );
  return [...vendorIds].every((id) => configured.has(id));
}

async function _saInferSetupCompleteFromServerState() {
  try {
    let routing = null;
    let keys = null;

    try {
      const [routingRes, keysRes] = await Promise.all([
        fetch('/api/settings/routing'),
        fetch('/api/settings/keys'),
      ]);
      if (routingRes.ok) routing = await routingRes.json();
      if (keysRes.ok) keys = await keysRes.json();
    } catch {
      /* fall back to globals/cache below */
    }

    if (!routing && typeof loadAiApiSettings === 'function') {
      try { routing = loadAiApiSettings(); } catch { /* noop */ }
    }
    if (!keys && typeof loadApiKeys === 'function') {
      try { keys = loadApiKeys(); } catch { /* noop */ }
    }

    if (!_saRoutingLooksComplete(routing)) return false;
    const requiredVendorIds = _saRoutingVendorIds(routing);
    if (!requiredVendorIds.size) return false;
    if (!_saKeysCoverRoutingVendors(keys, requiredVendorIds)) return false;

    markSetupComplete();
    return true;
  } catch {
    return false;
  }
}

/* ── Wizard progress (resume after refresh) ──────────────────────────────── */

function _saSaveProgress() {
  if (!_saState) return;
  try {
    storageService.setItem(SETUP_PROGRESS_STORAGE_KEY, JSON.stringify({
      step: _saCurrentStep,
      maxReachableStep: _saMaxReachableStep,
      vendors: _saState.vendors.map((v) => ({
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
        llm:   { ..._saState.llm },
        video: { ..._saState.video },
        image: { ..._saState.image },
        audio: { ..._saState.audio },
      },
    }));

    // Sync modality routing to aiApiSettings so the status bar and settings modal
    // see the same models the SA configured — eliminates dual-storage confusion.
    if (typeof loadAiApiSettings === 'function' && typeof saveAiApiSettings === 'function') {
      const routing = loadAiApiSettings();
      ROUTING_MODALITIES.forEach((mod) => {
        const s = _saState[mod];
        if (!s.vendorId) return;
        const vendor = _saVendorById(s.vendorId);
        routing.modalities[mod] = {
          ...routing.modalities[mod],
          provider:   s.providerId || vendor?.providerId || '',
          model:      s.modelId || '',
          modelLabel: _saResolveModelLabel(s, mod),
          baseUrl:    s.baseUrl || vendor?.baseUrl || '',
          vendorId:   s.vendorId,
        };
      });
      saveAiApiSettings(routing);
    }
  } catch (e) {
    console.warn('CineGen: could not save setup progress.', e);
  }
}

function _saLoadProgress() {
  try {
    const raw = storageService.getItem(SETUP_PROGRESS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const step = typeof parsed.step === 'number' ? parsed.step : 0;
    if (step < 0 || step >= SETUP_STEPS.length) return null;
    return parsed;
  } catch (e) {
    return null;
  }
}

function _saClearProgress() {
  try { storageService.removeItem(SETUP_PROGRESS_STORAGE_KEY); }
  catch (e) { /* noop */ }
}

function _saApplySavedProgress(progress) {
  if (!progress || !_saState) return;
  if (Array.isArray(progress.vendors)) {
    _saState.vendors = progress.vendors.map((v) => ({
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
  ROUTING_MODALITIES.forEach((mod) => {
    if (st[mod] && typeof st[mod] === 'object') {
      _saState[mod] = { ..._saState[mod], ...st[mod] };
    }
  });
}

/* ── Open / Close ─────────────────────────────────────────────────────────── */

async function openSetupAssistant(startStep) {
  _injectSetupStyles();
  await ensureModalReady('setup-assistant-modal');
  await customElements.whenDefined('cinegen-setup-assistant-modal');
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  _initSetupAssistantChromeOnce();
  _saState = _saDefaultState();

  /* Restore SA progress (has real API keys) first, then merge in server-synced vendors */
  const progress = _saLoadProgress();
  if (progress) _saApplySavedProgress(progress);

  /* Add any server-synced vendors not yet in state (keys left empty — masked server keys are useless) */
  _saPrePopulateFromExistingData();

  /* Populate audio sub-modality state from the provider model catalog.
     Pre-categorized models (stored when other modalities were tested) are
     read into _saState so the Done step and coverage step can reference them. */
  _saPopulateAudioFromCatalog();

  _saCurrentStep = typeof startStep === 'number'
    ? startStep
    : (progress && typeof progress.step === 'number' ? progress.step : 0);
  _saCurrentStep = Math.max(0, Math.min(_saCurrentStep, SETUP_STEPS.length - 1));
  _saMaxReachableStep = _saCurrentStep;
  if (progress && typeof progress.maxReachableStep === 'number') {
    _saMaxReachableStep = Math.max(_saMaxReachableStep, progress.maxReachableStep);
  }
  _saMaxReachableStep = Math.max(0, Math.min(_saMaxReachableStep, SETUP_STEPS.length - 1));

  const modal = document.getElementById('setup-assistant-modal');
  if (!modal) {
    console.warn('CineGen: setup-assistant-modal element not found.');
    return;
  }

  closeAllModalsExcept('setup-assistant-modal');
  await openModalAsync('setup-assistant-modal');

  /* Ensure close button click works */
  const closeBtn = modal.querySelector('.setup-assistant-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeSetupAssistant();
    });
  }

  /* Ensure backdrop click closes modal */
  const backdrop = modal.querySelector('.setup-assistant-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      e.stopPropagation();
      closeSetupAssistant();
    });
  }

  _renderSetupStep(_saCurrentStep);
  _saSaveProgress();
}

function closeSetupAssistant() {
  try {
    _saCollectCurrentStep(_saCurrentStep);
    _saSaveProgress();
    closeSetupAssistantAlert();
    closeModal('setup-assistant-modal');

    /* Cancel any in-flight test requests */
    Object.values(_saTestAborts).forEach((ctrl) => { try { ctrl.abort(); } catch (e) { /* noop */ } });
    _saTestAborts = {};

    /* Refresh status bar indicators and setup-incomplete badge */
    if (typeof updateSetupIncompleteStatus === 'function') updateSetupIncompleteStatus();
    if (typeof updateModelStatusIndicators === 'function') updateModelStatusIndicators();
  } catch (e) {
    console.error('CineGen: error closing setup assistant:', e);
  }
}

function _saPrePopulateFromExistingData() {
  if (!_saState) return;
  try {
    const keys    = typeof loadApiKeys       === 'function' ? loadApiKeys()       : null;
    const routing = typeof loadAiApiSettings === 'function' ? loadAiApiSettings() : null;

    if (!_saState.vendors) _saState.vendors = [];

    /* Merge in server-synced vendors that aren't already in state (from progress) */
    if (keys && Array.isArray(keys.vendors) && keys.vendors.length) {
      const existingIds = new Set(_saState.vendors.map((v) => v.id));
      for (const v of keys.vendors) {
        if (existingIds.has(v.id)) continue;
        const key = v.apiKey || '';
        const isMasked = /^•+$/.test(key);
        _saState.vendors.push({
          id:           v.id,
          name:         v.name || '',
          providerId:   v.providerId || '',
          apiKey:       isMasked ? '' : key,
          hasServerKey: isMasked,
          baseUrl:      typeof v.baseUrl === 'string' ? v.baseUrl : '',
          slotId:       typeof v.slotId === 'string' ? v.slotId : '',
          status:       (isMasked || !key) ? null : 'ok',
          statusMsg:    '',
        });
      }
      _saNormalizeVendorsToSlots();
    }

    ROUTING_MODALITIES.forEach((mod) => {
      if (!routing || !routing.modalities[mod]) return;
      const cfg = routing.modalities[mod];
      _saState[mod].vendorId   = cfg.vendorId || '';
      _saState[mod].providerId = cfg.provider || '';
      _saState[mod].modelId    = cfg.model || '';
      _saState[mod].modelLabel = cfg.modelLabel || '';
      _saState[mod].baseUrl    = cfg.baseUrl || '';
      if (!cfg.vendorId && !cfg.provider && !cfg.model) {
        // Don't auto-skip audio — the provider model catalog may have pre-categorized
        // audio models (populated when other modalities were tested).  The coverage
        // step will check the catalog and populate audio sub-modalities accordingly.
        if (mod !== 'audio') {
          _saState[mod].skip = !_saModalityIsRequired(mod);
        }
      }
      if (_saState[mod].vendorId) {
        // Reset baseUrl so vendor's current endpoint takes precedence over stale saved values
        _saState[mod].baseUrl = '';
        _saSyncModalityProviderFromVendor(mod);
      }
    });
  } catch (e) {
    console.warn('CineGen: could not pre-populate setup state.', e);
  }
}

/**
 * Populate _saState audio sub-modality fields from the provider model catalog.
 * The catalog may have pre-categorized audio data (populated when other modalities
 * were tested via proxiedFetchModels).  This ensures the Done step and coverage
 * step see the available TTS/SFX/Music models without requiring a separate audio test.
 */
function _saPopulateAudioFromCatalog() {
  if (!_saState) return;
  const catalog = typeof loadProviderModelCatalog === 'function' ? loadProviderModelCatalog() : null;
  if (!catalog?.vendors) return;

  const capModels: Record<string, { vendorId: string; providerId: string; count: number }> = { tts: null, sfx: null, music: null };
  const matchFn = typeof window.modelMatchesAudioCapability === 'function'
    ? (m, sub) => window.modelMatchesAudioCapability(m, sub)
    : null;

  for (const [vid, rec] of Object.entries(catalog.vendors) as any) {
    const mod = rec.modalities?.audio;
    if (!mod || !Array.isArray(mod.models) || !mod.models.length) continue;
    if (mod.status !== 'ok' && mod.status !== 'ratelimit') continue;

    // Does this vendor have a matching SA vendor entry?
    const vendor = _saState.vendors?.find((v) => v.id === vid);
    if (!vendor) continue;

    for (const sub of ['tts', 'sfx', 'music'] as const) {
      if (capModels[sub]) continue; // already found a vendor
      const count = matchFn
        ? mod.models.filter((m) => matchFn(m, sub)).length
        : mod.models.length;
      if (count > 0) {
        capModels[sub] = { vendorId: vid, providerId: vendor.providerId, count };
      }
    }

    // Set _saState.audio vendor from first catalog entry
    if (!_saState.audio.vendorId) {
      _saState.audio.vendorId = vid;
      _saState.audio.providerId = vendor.providerId;
      _saState.audio.status = mod.status;
      _saState.audio.statusMsg = mod.message;
      _saState.audio.skip = false;
    }
  }

  // Create sub-modality state entries so Done step can reference them
  for (const [sub, info] of Object.entries(capModels)) {
    if (!info) continue;
    const key = `audio_${sub}`;
    if (!_saState[key]) {
      (_saState as any)[key] = {
        vendorId: info.vendorId,
        providerId: info.providerId,
        status: 'ok',
        statusMsg: `${info.count} model${info.count !== 1 ? 's' : ''}`,
        modelId: '',
        listedModels: [],
      };
    }
  }
}

/* ── Navigation ──────────────────────────────────────────────────────────── */

function _saCollectCurrentStep(idx) {
  const step = SETUP_STEPS[idx];
  if (!step) return;

  if (step.id === 'coverage') {
    ROUTING_MODALITIES.forEach((mod) => {
      const vSel   = document.getElementById(`sa-coverage-vendor-${mod}`);
      const mSel   = document.getElementById(`sa-coverage-model-${mod}`);
      if (vSel) {
        _saState[mod].vendorId = vSel.value;
        const vendor = _saVendorById(vSel.value);
        _saState[mod].providerId = vendor ? vendor.providerId : '';
      }
      if (mSel) {
        _saState[mod].modelId = mSel.value;
        const opt = mSel.options[mSel.selectedIndex];
        _saState[mod].modelLabel = (opt && opt.value === mSel.value) ? opt.textContent.trim() : '';
      }
    });
    return;
  }
}

function goSetupStep(nextIdx) {
  const target = Math.max(0, Math.min(nextIdx, SETUP_STEPS.length - 1));
  _saCollectCurrentStep(_saCurrentStep);
  _saCurrentStep = target;
  if (target > _saMaxReachableStep) _saMaxReachableStep = target;
  _renderSetupStep(_saCurrentStep);
  _saSaveProgress();
}

function saRailGoToStep(stepIdx) {
  const i = Number(stepIdx);
  if (Number.isNaN(i) || i < 0 || i >= SETUP_STEPS.length) return;
  if (i > _saMaxReachableStep) return;
  if (i === _saCurrentStep) return;
  goSetupStep(i);
}

async function setupNext() {
  const step = SETUP_STEPS[_saCurrentStep];
  _saCollectCurrentStep(_saCurrentStep);

  if (step?.id === 'providers') {
    const vendorsWithKeys = _saVendorsWithKeys();
    if (!vendorsWithKeys.length) {
      openSetupAssistantAlert({
        title: 'Add a provider',
        message: 'Add at least one service provider with an API key before continuing.',
      });
      return;
    }
    const stillTesting = vendorsWithKeys.some((v) => v.status === 'testing');
    if (stillTesting) {
      openSetupAssistantAlert({
        title: 'Test in progress',
        message: 'Please wait for the connection test to finish before continuing.',
      });
      return;
    }
    const anyConnected = vendorsWithKeys.some((v) => v.status === 'ok' || v.status === 'ratelimit' || v.hasServerKey);
    if (!anyConnected) {
      openSetupAssistantAlert({
        title: 'No providers connected',
        message: 'At least one API key needs a successful connection test before continuing. Check your key and try again.',
      });
      return;
    }
  }

  if (step?.id === 'coverage') {
    if (!_saCoverageSatisfied()) {
      openSetupAssistantAlert({
        title: 'Coverage incomplete',
        message:
          'Assign a provider with an API key for Text AI, Video AI, and Image / Storyboards (required), or go back to add providers.',
      });
      return;
    }
  }

  if (step?.id === 'models') {
    const missing = ROUTING_MODALITIES.filter((mod) => {
      const s = _saState[mod];
      if (s.skip || !s.vendorId) return false;
      return _saModalityIsRequired(mod) && !s.modelId;
    });
    if (missing.length) {
      openSetupAssistantAlert({
        title: 'Choose models',
        message: `Select a default model for: ${missing.map((m) => MODALITY_META[m].label).join(', ')}.`,
      });
      return;
    }
    const untested = ROUTING_MODALITIES.filter((mod) => {
      const s = _saState[mod];
      return s.vendorId && !s.skip && s.status !== 'ok' && s.status !== 'ratelimit';
    });
    if (untested.length) {
      const nextBtn = document.getElementById('sa-btn-next');
      const prevHtml = nextBtn ? nextBtn.innerHTML : '';
      if (nextBtn) {
        nextBtn.disabled = true;
        nextBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Testing…';
      }
      for (const mod of untested) {
        const result = await _saRunConnectionTest(mod, { updateUi: true });
        if (!result.ok && !result.rateLimit && !result.noKey) {
          if (nextBtn) {
            nextBtn.disabled = false;
            nextBtn.innerHTML = prevHtml || 'Next <i class="fa-solid fa-caret-right" aria-hidden="true"></i>';
          }
          openSetupAssistantAlert({
            title: 'Connection test failed',
            message: result.message || `Could not verify ${MODALITY_META[mod].label}.`,
          });
          return;
        }
      }
      if (nextBtn) {
        nextBtn.disabled = false;
        nextBtn.innerHTML = prevHtml || 'Next <i class="fa-solid fa-caret-right" aria-hidden="true"></i>';
      }
    }
  }

  const max = SETUP_STEPS.length - 1;
  if (_saCurrentStep < max) goSetupStep(_saCurrentStep + 1);
}

function setupBack() {
  if (_saCurrentStep > 0) goSetupStep(_saCurrentStep - 1);
}

function setupFinish() {
  _saCollectCurrentStep(_saCurrentStep);
  _saveAllSetupData();
  markSetupComplete();
  if (typeof updateModelStatusIndicators === 'function') updateModelStatusIndicators();
  closeSetupAssistant();
}

/* ── Rendering ───────────────────────────────────────────────────────────── */

function _renderSetupStep(idx) {
  _renderRail(idx);
  _renderBody(idx);
  _renderFooter(idx);
}

function _renderRail(currentIdx) {
  const rail = document.getElementById('sa-rail');
  if (!rail) return;
  rail.innerHTML = SETUP_STEPS.map((step, i) => {
    let cls = 'sa-rail-step';
    if (i === currentIdx) cls += ' sa-rail-step--active';
    else if (i < currentIdx) cls += ' sa-rail-step--done';
    const reachable = i <= _saMaxReachableStep;
    if (reachable) cls += ' sa-rail-step--clickable';
    else cls += ' sa-rail-step--locked';
    const label = escHtml(step.label);
    const inner = `
      <span class="sa-rail-dot"><i class="${step.icon}" aria-hidden="true"></i></span>
      <span class="sa-rail-label">${label}</span>`;
    if (reachable) {
      const selected = i === currentIdx ? 'true' : 'false';
      return `<button type="button" class="${cls}" data-step-idx="${i}" role="tab" aria-selected="${selected}" aria-label="${label}">${inner}</button>`;
    }
    return `<div class="${cls}" role="presentation" aria-disabled="true" title="Complete earlier steps to unlock">${inner}</div>`;
  }).join('');
}

function _renderBody(idx) {
  const step = SETUP_STEPS[idx];
  if (!step) return;

  const host = document.getElementById('sa-body');
  if (!host) return;

  // Always use the Lit component host; wait for it if not yet upgraded
  if (typeof host.showWelcome !== 'function') {
    // Defer render until custom element is defined
    customElements.whenDefined('cinegen-sa-step-host').then(() => {
      _renderBody(idx);
    });
    return;
  }

  if (step.id === 'welcome') host.showWelcome();
  else host.showStep(step.id);
  /* Force the active step child component to re-render (Lit won't re-render
     a child whose own reactive properties haven't changed). */
  host.updateComplete?.then(() => {
    const child = host.querySelector(`sa-step-${step.id}`);
    if (child && typeof child.requestUpdate === 'function') child.requestUpdate();
  });
  _bindStepControls(step.id);
}

function _renderFooter(idx) {
  const step     = SETUP_STEPS[idx];
  const backBtn  = document.getElementById('sa-btn-back');
  const nextBtn  = document.getElementById('sa-btn-next');
  const skipBtn  = document.getElementById('sa-btn-skip');
  const hintEl   = document.getElementById('sa-footer-hint');

  if (!step) return;
  const isFirst   = idx === 0;
  const isLast    = idx === SETUP_STEPS.length - 1;

  if (backBtn) {
    backBtn.hidden    = isFirst;
    backBtn.disabled  = isFirst;
  }
  if (skipBtn) {
    skipBtn.hidden    = true;
    skipBtn.disabled  = true;
  }
  if (nextBtn) {
    if (isLast) {
      nextBtn.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i> Start CineGen';
    } else {
      nextBtn.innerHTML = 'Next <i class="fa-solid fa-caret-right" aria-hidden="true"></i>';
    }
  }
  if (hintEl) {
    if (step.id === 'welcome') {
      hintEl.textContent = 'Keys never leave this machine except to the AI APIs you call.';
    } else if (step.id === 'providers') {
      hintEl.textContent = 'Save keys for the services you use — you only need one provider to continue. Assign them to tasks on the next step.';
    } else if (step.id === 'coverage') {
      hintEl.textContent = 'Text, Video, and Image / Storyboards are required. Sound can be skipped for now.';
    } else if (step.id === 'models') {
      hintEl.textContent = 'Test each assignment and pick a default model. You can change these anytime in Settings.';
    } else {
      hintEl.textContent = '';
    }
  }
}

/* ── Step templates ──────────────────────────────────────────────────────── */

function _tmplWelcome() {
  return `
    <div class="sa-welcome">
      <div class="sa-welcome-logo" aria-hidden="true">
        <i class="fa-solid fa-film sa-welcome-icon"></i>
      </div>
      <h2 class="sa-welcome-title">Welcome to CineGen</h2>
      <p class="sa-welcome-lead">Let's connect your AI providers so you can start generating shots, writing scripts, and building scenes.</p>
      <div class="sa-modality-overview">
        <div class="sa-modality-row">
          <span class="sa-badge sa-badge--required">REQUIRED</span>
          <i class="fa-solid fa-comments sa-modality-icon" aria-hidden="true"></i>
          <div>
            <strong>Language / Text AI</strong>
            <span class="sa-modality-hint">Script writing, AI assistants, scene suggestions</span>
          </div>
        </div>
        <div class="sa-modality-row">
          <span class="sa-badge sa-badge--required">REQUIRED</span>
          <i class="fa-solid fa-film sa-modality-icon" aria-hidden="true"></i>
          <div>
            <strong>Video Generation</strong>
            <span class="sa-modality-hint">Shots, takes, and coverage clips from your scripts</span>
          </div>
        </div>
        <div class="sa-modality-row">
          <span class="sa-badge sa-badge--required">REQUIRED</span>
          <i class="fa-solid fa-image sa-modality-icon" aria-hidden="true"></i>
          <div>
            <strong>Image / Storyboards</strong>
            <span class="sa-modality-hint">Storyboard frames and reference visuals</span>
          </div>
        </div>
        <div class="sa-modality-row">
          <span class="sa-badge sa-badge--optional">OPTIONAL</span>
          <i class="fa-solid fa-headphones sa-modality-icon" aria-hidden="true"></i>
          <div>
            <strong>Audio — TTS · SFX · Music</strong>
            <span class="sa-modality-hint">Voiceover, sound effects, and music generation</span>
          </div>
        </div>
      </div>
      <p class="sa-welcome-note">About 3 minutes: add providers and keys, assign them to tasks, then pick models. Change anytime under <strong>Settings → API Keys &amp; Service Providers</strong> or <strong>AI Models &amp; Modalities</strong>.</p>
    </div>`;
}

function _saWizardProviderOptions(selectedId) {
  const opts = typeof AI_API_PROVIDERS !== 'undefined'
    ? AI_API_PROVIDERS.map((p) => ({ id: p.id, label: p.label }))
    : [{ id: 'openai-compatible', label: 'OpenAI-compatible' }];
  return opts.map((p) =>
    `<option value="${escHtml(p.id)}"${p.id === selectedId ? ' selected' : ''}>${escHtml(p.label)}</option>`
  ).join('');
}

function _saProviderRowStatus(v) {
  const hasKey = _saVendorHasKey(v);
  if (v?.status === 'testing') {
    return '<span class="sa-prov-status sa-prov-status--testing"><i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Testing…</span>';
  }
  const chips = _saCatalogChipsForVendor(v);
  if (chips) return chips;
  if (v?.status === 'err') {
    const msg = (v.statusMsg || 'Test failed').slice(0, 50);
    return `<span class="sa-prov-status sa-prov-status--err" title="${escHtml(v.statusMsg || 'Test failed')}">${escHtml(msg)}</span>`;
  }
  if (v?.status === 'ok' || v?.status === 'ratelimit') return '<span class="sa-prov-status sa-prov-status--ok">Connected</span>';
  if (hasKey) return '<span class="sa-prov-status sa-prov-status--pending">Saved — not tested</span>';
  return '';
}

function _saModalityChipLabel(mod) {
  return { llm: 'Text', video: 'Video', image: 'Image', audio: 'Audio' }[mod] || mod;
}

/** Returns inline HTML of per-modality chips for a vendor based on live catalog data. */
function _saCatalogChipsForVendor(vendor) {
  if (!vendor?.id || typeof loadProviderModelCatalog !== 'function') return '';
  const catalog = loadProviderModelCatalog();
  const vc = catalog?.vendors?.[vendor.id];
  if (!vc?.modalities) return '';

  // Helper to count audio capabilities for this vendor
  // Uses modelMatchesAudioCapability cascade (type → capabilities → boolean flags → keywords)
  const countAudioCapability = (capability) => {
    const audioMod = vc.modalities?.audio;
    if (!audioMod?.models?.length) return 0;
    if (audioMod.status !== 'ok' && audioMod.status !== 'ratelimit') return 0;
    const providerId = vc.providerId || '';
    const matchFn = typeof window.modelMatchesAudioCapability === 'function'
      ? (m) => window.modelMatchesAudioCapability(m, capability, providerId)
      : (m) => {
          const text = `${m.label || ''} ${m.id || ''}`.toLowerCase();
          const kw = { tts: ['tts', 'speech', 'voice'], sfx: ['sfx', 'sound', 'effect'], music: ['music', 'song'] }[capability] || [];
          return kw.some((k) => text.includes(k));
        };
    return audioMod.models.filter(matchFn).length;
  };

  const chips = ROUTING_MODALITIES
    .filter((mod) => {
      const mc = vc.modalities[mod];
      return mc && (mc.status === 'ok' || mc.status === 'ratelimit') && mc.models?.length > 0;
    })
    .map((mod) => {
      // For audio, include sub-chips inside the chip
      if (mod === 'audio') {
        const ttsCount = countAudioCapability('tts');
        const sfxCount = countAudioCapability('sfx');
        const musicCount = countAudioCapability('music');
        const subChips = [
          ttsCount > 0 ? `<span class="sa-prov-mod-subchip sa-prov-mod-subchip--tts">TTS (${ttsCount})</span>` : '',
          sfxCount > 0 ? `<span class="sa-prov-mod-subchip sa-prov-mod-subchip--sfx">SFX (${sfxCount})</span>` : '',
          musicCount > 0 ? `<span class="sa-prov-mod-subchip sa-prov-mod-subchip--music">Music (${musicCount})</span>` : ''
        ].join('');
        return `<span class="sa-prov-mod-chip sa-prov-mod-chip--${mod}">${escHtml(_saModalityChipLabel(mod))}${subChips}</span>`;
      }
      return `<span class="sa-prov-mod-chip sa-prov-mod-chip--${mod}">${escHtml(_saModalityChipLabel(mod))}</span>`;
    })
    .join('');
  return chips ? `<span class="sa-prov-mod-chips">${chips}</span>` : '';
}

function _saVendorHasAnyModalityCatalog(vendor) {
  if (!vendor?.id || typeof loadProviderModelCatalog !== 'function') return false;
  const catalog = loadProviderModelCatalog();
  const vc = catalog?.vendors?.[vendor.id];
  if (!vc?.modalities) return false;
  // Check if any modality has been loaded successfully
  return ROUTING_MODALITIES.some((mod) => {
    const mc = vc.modalities[mod];
    return mc && (mc.status === 'ok' || mc.status === 'ratelimit') && mc.models?.length > 0;
  });
}

/** Summary chip bar shown at the top of the Providers pane — one chip per modality with provider counts. */
function _tmplProviderModalityChipBar() {
  const catalog = typeof loadProviderModelCatalog === 'function' ? loadProviderModelCatalog() : null;
  const vendors = _saState?.vendors || [];

  // Helper to count vendors with audio capability
  // Uses modelMatchesAudioCapability cascade (type → capabilities → boolean flags → keywords)
  const countAudioCapability = (capability) => {
    return vendors.filter((v) => {
      const audioMod = catalog?.vendors?.[v.id]?.modalities?.audio;
      if (!audioMod || !audioMod.models?.length) return false;
      if (audioMod.status !== 'ok' && audioMod.status !== 'ratelimit') return false;
      const providerId = catalog?.vendors?.[v.id]?.providerId || '';
      const matchFn = typeof window.modelMatchesAudioCapability === 'function'
        ? (m) => window.modelMatchesAudioCapability(m, capability, providerId)
        : (m) => {
            const text = `${m.label || ''} ${m.id || ''}`.toLowerCase();
            const kw = { tts: ['tts', 'speech', 'voice'], sfx: ['sfx', 'sound', 'effect'], music: ['music', 'song'] }[capability] || [];
            return kw.some((k) => text.includes(k));
          };
      return audioMod.models.some(matchFn);
    }).length;
  };

  const chips = ROUTING_MODALITIES.map((mod) => {
    const meta = MODALITY_META[mod];
    const coveredVendors = vendors.filter((v) => {
      const mc = catalog?.vendors?.[v.id]?.modalities?.[mod];
      return mc && (mc.status === 'ok' || mc.status === 'ratelimit') && mc.models?.length > 0;
    });
    const covered = coveredVendors.length > 0;
    const count = coveredVendors.length;

    // For audio, build chip with sub-chips nested inside
    if (mod === 'audio') {
      const ttsCount = countAudioCapability('tts');
      const sfxCount = countAudioCapability('sfx');
      const musicCount = countAudioCapability('music');

      const subChips = [
        `<span class="sa-prov-subchip sa-prov-subchip--tts${ttsCount > 0 ? ' sa-prov-subchip--covered' : ''}" title="Text-to-Speech (${ttsCount})">TTS (${ttsCount})</span>`,
        `<span class="sa-prov-subchip sa-prov-subchip--sfx${sfxCount > 0 ? ' sa-prov-subchip--covered' : ''}" title="Sound Effects (${sfxCount})">SFX (${sfxCount})</span>`,
        `<span class="sa-prov-subchip sa-prov-subchip--music${musicCount > 0 ? ' sa-prov-subchip--covered' : ''}" title="Music Generation (${musicCount})">Music (${musicCount})</span>`
      ].join('');

      const cls = `sa-prov-top-chip sa-prov-top-chip--audio${covered ? ' sa-prov-top-chip--covered' : ''}`;
      const icon = covered ? '<i class="fa-solid fa-circle-check" aria-hidden="true"></i> ' : '';
      const mainLabel = `${escHtml(_saModalityChipLabel(mod))} (${count})`;

      return `<span class="${cls}" title="${escHtml(meta.label)} (${count})">${icon}${mainLabel}${subChips}</span>`;
    }

    // Standard chips for other modalities - always show with count (even 0)
    const cls = `sa-prov-top-chip sa-prov-top-chip--${mod}${covered ? ' sa-prov-top-chip--covered' : ''}`;
    const icon = covered ? '<i class="fa-solid fa-circle-check" aria-hidden="true"></i> ' : '';
    const countLabel = ` (${count})`;
    return `<span class="${cls}" title="${escHtml(meta.label)}${countLabel}">${icon}${escHtml(_saModalityChipLabel(mod))}${countLabel}</span>`;
  }).join('');
  return `<div class="sa-prov-chip-bar" aria-label="Modality coverage"><span class="sa-prov-chip-bar-label">Providers:</span>${chips}</div>`;
}

function _saProviderKeyPlaceholder(v) {
  const key = String(v?.apiKey || '').trim();
  if (key.length > 4) return `Saved (…${key.slice(-4)})`;
  if (v?.hasServerKey) return 'Key saved on server';
  return 'Paste API key';
}

function _saNeedsProviderApiUrl(providerId) {
  return providerId === 'generic-rest';
}

function _saNormalizeApiUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function _saValidateApiUrl(url) {
  const u = _saNormalizeApiUrl(url);
  if (!u) return false;
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

function _tmplProviderApiUrlInput(inputId, value, providerLabel) {
  return `<input id="${inputId}" class="cg-field sa-prov-url-input" type="url" inputmode="url"
    value="${escHtml(value || '')}" placeholder="https://api.example.com/v1"
    autocomplete="off" spellcheck="false" aria-label="${escHtml(providerLabel)} API URL">`;
}

function _saApplyVendorApiUrl(vendor, urlInput, providerLabel) {
  if (!_saNeedsProviderApiUrl(vendor.providerId)) return true;
  let url = _saNormalizeApiUrl(urlInput?.value);
  if (!url && vendor.baseUrl) url = _saNormalizeApiUrl(vendor.baseUrl);
  if (!_saValidateApiUrl(url)) {
    openSetupAssistantAlert({
      title: 'API URL required',
      message: `Enter a valid API URL (https://…) for ${providerLabel || vendor.name || 'this provider'}.`,
    });
    return false;
  }
  vendor.baseUrl = url;
  return true;
}

function saWizardOnAddProviderTypeChange() {
  const row = document.getElementById('sa-add-url-row');
  const typeEl = document.getElementById('sa-add-provider');
  if (!row || !typeEl) return;
  row.classList.toggle('hidden', !_saNeedsProviderApiUrl(typeEl.value));
}

function _saProviderLogoHtml(slotId, name) {
  const id = escHtml(slotId);
  const alt = escHtml(name || slotId);
  return `<div class="sa-prov-logo-frame"><img class="sa-prov-logo" src="${SA_PROVIDER_LOGO_DIR}/${id}.png" alt="${alt}" loading="lazy" decoding="async"></div>`;
}

function _tmplProviderSlotRow(slot) {
  const v = _saFindVendorForSlot(slot);
  const slotId = escHtml(slot.slotId);
  const blurb = slot.blurb ? `<span class="sa-prov-blurb">${escHtml(slot.blurb)}</span>` : '';
  const needsUrl = _saNeedsProviderApiUrl(slot.providerId);
  const isActive = _saIsSlotActive(slot.slotId);
  const activeClass = isActive ? ' sa-prov-card--active' : '';
  const detailsHidden = isActive ? '' : ' hidden';
  const urlField = needsUrl
    ? _tmplProviderApiUrlInput(`sa-prov-url-${slotId}`, v?.baseUrl || '', slot.name)
    : '';
  const cancelBtn = isActive 
    ? `<button type="button" class="toolbar-btn toolbar-btn--shape-soft sa-prov-cancel-btn" data-sa-slot="${slotId}">Cancel</button>` 
    : '';
  // Show Clear button if vendor has an existing key
  const hasExistingKey = v && _saVendorHasKey(v);
  const clearBtn = hasExistingKey
    ? `<button type="button" class="toolbar-btn toolbar-btn--shape-soft sa-prov-clear-btn" data-sa-slot="${slotId}">Clear</button>`
    : '';
  // Check if vendor has loaded a catalog for at least one modality
  const catalogLoaded = _saVendorHasAnyModalityCatalog(v);
  const catalogLoadedClass = catalogLoaded ? ' sa-prov-card--catalog-loaded' : '';
  return `
    <div class="sa-prov-card-wrapper" data-sa-slot="${slotId}">
      <div class="sa-prov-card${activeClass}${catalogLoadedClass}${needsUrl ? ' sa-prov-card--needs-url' : ''}" data-slot-id="${slotId}" data-sa-slot="${slotId}">
        <button type="button" class="sa-prov-toggle" data-sa-slot="${slotId}" aria-pressed="${isActive ? 'true' : 'false'}">
          ${_saProviderLogoHtml(slot.slotId, slot.name)}
          <div class="sa-prov-card-text">
            <span class="sa-prov-name">${escHtml(slot.name)}</span>
            ${blurb}
          </div>
          <span class="sa-prov-toggle-indicator"></span>
        </button>
      </div>
      <div class="sa-prov-card-details${detailsHidden}" data-sa-slot="${slotId}">
        <div class="sa-prov-card-controls">
          ${urlField}
          <input id="sa-prov-key-${slotId}" class="cg-field api-keys-secret-input sa-prov-key-input" type="password"
                 autocomplete="off" spellcheck="false" placeholder="${escHtml(_saProviderKeyPlaceholder(v))}"
                 aria-label="${escHtml(slot.name)} API key">
          ${cancelBtn}
          ${clearBtn}
          <button type="button" class="toolbar-btn toolbar-btn--shape-soft sa-prov-save-btn" data-sa-slot="${slotId}">Save</button>
          ${hasExistingKey ? `<button type="button" class="toolbar-btn toolbar-btn--shape-soft sa-prov-reload-btn" data-sa-slot="${slotId}"><i class="fa-solid fa-rotate" aria-hidden="true"></i> Reload</button>` : ''}
          ${_saProviderRowStatus(v)}
        </div>
      </div>
    </div>`;
}

function _tmplProviderCatalogSection(section) {
  const head = `
    <section class="sa-prov-section" aria-labelledby="sa-prov-sec-${escHtml(section.num)}">
      <h4 id="sa-prov-sec-${escHtml(section.num)}" class="sa-prov-section-title">${escHtml(section.num)}. ${escHtml(section.title)}</h4>
      ${section.desc ? `<p class="sa-prov-section-desc">${escHtml(section.desc)}</p>` : ''}`;

  let body = '';
  if (section.rows) {
    body = `<div class="sa-prov-rows sa-prov-matrix">${section.rows.map(_tmplProviderSlotRow).join('')}</div>`;
  } else if (section.groups) {
    body = section.groups.map((g) => `
      <p class="sa-prov-subsection-label">${escHtml(g.label)}</p>
      <div class="sa-prov-rows sa-prov-matrix">${g.rows.map(_tmplProviderSlotRow).join('')}</div>
    `).join('');
  }

  return `${head}${body}</section>`;
}

function _tmplManualProviderRow(v) {
  const vid = escHtml(v.id);
  const hasKey = _saVendorHasKey(v);
  const needsUrl = _saNeedsProviderApiUrl(v.providerId);
  const urlField = needsUrl
    ? _tmplProviderApiUrlInput(`sa-manual-url-${vid}`, v.baseUrl || '', v.name || 'Provider')
    : '';
  return `
    <div class="sa-prov-row sa-prov-row--manual${needsUrl ? ' sa-prov-row--needs-url' : ''}" data-vendor-id="${vid}">
      <div class="sa-prov-row-main">
        <span class="sa-prov-name">${escHtml(v.name || 'Unnamed')}</span>
        <span class="sa-prov-blurb">${escHtml(_saProviderLabel(v.providerId))}</span>
      </div>
      <div class="sa-prov-row-controls">
        ${urlField}
        <input id="sa-manual-key-${vid}" class="cg-field api-keys-secret-input sa-prov-key-input" type="password"
               autocomplete="off" spellcheck="false" placeholder="${escHtml(_saProviderKeyPlaceholder(v))}"
               aria-label="${escHtml(v.name || 'Provider')} API key">
        ${urlField}
        <button type="button" class="toolbar-btn toolbar-btn--shape-soft" onclick="saWizardSaveManualProvider('${vid}')">Save</button>
        <button type="button" class="toolbar-btn toolbar-btn--shape-soft" onclick="saWizardRemoveProvider('${vid}')">Remove</button>
        ${_saProviderRowStatus(v)}
      </div>
    </div>`;
}

function _tmplProviders() {
  _saNormalizeVendorsToSlots();
  const catalogHtml = SA_PROVIDER_CATALOG.map(_tmplProviderCatalogSection).join('');
  const manual = _saManualVendors();
  const manualRows = manual.length
    ? manual.map(_tmplManualProviderRow).join('')
    : '<p class="sa-wiz-muted sa-prov-manual-empty">No custom providers yet.</p>';

  return `
    <div class="sa-step-section sa-prov-step">
      <h3 class="sa-step-title"><i class="fa-solid fa-key" aria-hidden="true"></i> Providers &amp; API keys</h3>
      <p class="sa-step-desc">Add keys for the services you plan to use. Saving a key tests the connection and discovers which modalities that provider offers.</p>
      ${_tmplProviderModalityChipBar()}
      <div class="sa-prov-catalog">${catalogHtml}</div>
      <section class="sa-prov-section sa-prov-section--manual" aria-labelledby="sa-prov-sec-manual">
        <h4 id="sa-prov-sec-manual" class="sa-prov-section-title">6. Added Manually</h4>
        <div class="sa-prov-rows sa-prov-rows--manual">${manualRows}</div>
        <div class="sa-wiz-add-panel bevel-sunken sa-prov-manual-add">
          <p class="sa-prov-add-label"><i class="fa-solid fa-plus" aria-hidden="true"></i> Add provider</p>
          <div class="cg-accordion-row">
            <label for="sa-add-name">Name</label>
            <input id="sa-add-name" class="cg-field" type="text" maxlength="60" placeholder="e.g. My custom endpoint">
          </div>
          <div class="cg-accordion-row">
            <label for="sa-add-provider">Service type</label>
            <div class="cg-nspopup-wrap">
              <select id="sa-add-provider" class="cg-nspopup">${_saWizardProviderOptions('openai-compatible')}</select>
            </div>
          </div>
          <div class="cg-accordion-row">
            <label for="sa-add-key">API key</label>
            <input id="sa-add-key" class="cg-field api-keys-secret-input" type="password" autocomplete="off" spellcheck="false">
          </div>
          <div class="cg-accordion-row sa-prov-add-url-row hidden" id="sa-add-url-row">
            <label for="sa-add-baseurl">Base URL</label>
            <input id="sa-add-baseurl" class="cg-field" type="url" inputmode="url" placeholder="https://api.example.com/v1" autocomplete="off" spellcheck="false">
          </div>
          <button type="button" class="toolbar-btn toolbar-btn--shape-soft btn-ai" onclick="saWizardAddProvider()">
            <i class="fa-solid fa-plus" aria-hidden="true"></i> Add provider
          </button>
        </div>
      </section>
    </div>`;
}


function _tmplCoverage() {
  const vendors = _saVendorsWithKeys();
  const vendorOpts = (selectedId, mod) => {
    const eligible = vendors.filter((v) => {
      const list = PROVIDERS_BY_MODALITY[mod];
      return !list || list.some((p) => p.id === v.providerId);
    });
    const opts = eligible.length ? eligible : vendors;
    return `<option value="">— Select provider —</option>` + opts.map((v) =>
      `<option value="${escHtml(v.id)}"${v.id === selectedId ? ' selected' : ''}>${escHtml(v.name || _saProviderLabel(v.providerId))}</option>`
    ).join('');
  };

  const modelOpts = (s, mod) => {
    const catalogModels = _getCatalogModels(s.providerId, mod);
    const allModels = _mergeModels(s.listedModels, catalogModels);
    if (!allModels.length) return '<option value="">— No models. Add provider. —</option>';
    return allModels.map((m) =>
      `<option value="${escHtml(m.id)}"${m.id === s.modelId ? ' selected' : ''}>${escHtml(m.label)}</option>`
    ).join('');
  };

  const rows = ROUTING_MODALITIES.map((mod) => {
    const meta = MODALITY_META[mod];
    const s    = _saState[mod];
    const req  = _saModalityIsRequired(mod);
    const needsBaseUrl = s.vendorId && ['openai-compatible', 'generic-rest'].includes(s.providerId);
    return `<tr>
      <td><span class="sa-badge ${meta.badgeClass}">${meta.badge}</span> <strong>${escHtml(meta.label)}</strong></td>
      <td>${req ? 'Required' : 'Optional'}</td>
      <td>
        <div class="cg-nspopup-wrap" id="sa-coverage-vendor-wrap-${mod}">
          <select id="sa-coverage-vendor-${mod}" class="cg-nspopup">${vendorOpts(s.vendorId, mod)}</select>
        </div>
        <div class="sa-coverage-model-wrap${!s.vendorId ? ' hidden' : ''}" id="sa-coverage-model-section-${mod}">
          <div class="sa-test-row">
            <button type="button" class="toolbar-btn toolbar-btn--shape-soft btn-ai" id="sa-coverage-test-btn-${mod}">
              <i class="fa-solid fa-rotate" aria-hidden="true"></i> Refresh Model List
            </button>
            <div id="sa-coverage-test-status-${mod}" class="sa-test-status${s.status ? ' sa-test-status--' + s.status : ''}">${_saStatusHtml(s)}</div>
          </div>
          <div class="cg-nspopup-wrap">
            <select id="sa-coverage-model-${mod}" class="cg-nspopup sa-coverage-model-select">${modelOpts(s, mod)}</select>
          </div>
          <div class="sa-coverage-baseurl-row${needsBaseUrl ? '' : ' hidden'}" id="sa-coverage-baseurl-row-${mod}">
            <input id="sa-coverage-baseurl-${mod}" class="cg-field" type="url" placeholder="Base URL (optional)" value="${escHtml(s.baseUrl || '')}">
          </div>
          <p id="sa-coverage-model-caps-${mod}" class="sa-model-caps">${_saModelCaps(s.providerId, mod, s.modelId)}</p>
        </div>
      </td>
    </tr>`;
  }).join('');

  return `
    <div class="sa-step-section">
      <h3 class="sa-step-title"><i class="fa-solid fa-table-columns" aria-hidden="true"></i> Modality coverage</h3>
      <p class="sa-step-desc">Assign a saved provider to each task. Text, Video, and Image / Storyboards are required.</p>
      <table class="sa-coverage-table" aria-label="Modality coverage">
        <thead><tr><th>Task</th><th>Requirement</th><th>Assigned provider</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function _tmplModels() {
  const sections = ROUTING_MODALITIES.map((mod) => {
    const s = _saState[mod];
    if (s.skip || !s.vendorId) return '';
    const meta = MODALITY_META[mod];
    const vendor = _saVendorById(s.vendorId);
    const catalogModels = _getCatalogModels(s.providerId, mod);
    const allModels = _mergeModels(s.listedModels, catalogModels);
    const needsBaseUrl = ['openai-compatible', 'generic-rest'].includes(s.providerId);
    return `
      <div class="sa-models-block" data-mod="${mod}">
        <h4 class="sa-models-block-title">${escHtml(meta.label)}</h4>
        <p class="sa-step-desc">Provider: <strong>${escHtml(vendor?.name || _saProviderLabel(s.providerId))}</strong></p>
        <div class="sa-test-row">
          <button type="button" class="toolbar-btn toolbar-btn--shape-soft btn-ai" id="sa-test-btn-${mod}">
            <i class="fa-solid fa-plug-circle-check" aria-hidden="true"></i> Test &amp; list models
          </button>
          <div id="sa-test-status-${mod}" class="sa-test-status${s.status ? ' sa-test-status--' + s.status : ''}">${_saStatusHtml(s)}</div>
        </div>
        <div class="cg-accordion-row${needsBaseUrl ? '' : ' hidden'}" id="sa-baseurl-row-${mod}">
          <label for="sa-baseurl-${mod}">Base URL <small>(optional)</small></label>
          <input id="sa-baseurl-${mod}" class="cg-field" type="url" value="${escHtml(s.baseUrl || '')}">
        </div>
        <div class="cg-accordion-row">
          <label for="sa-model-${mod}">Default model</label>
          <div class="cg-nspopup-wrap">
            <select id="sa-model-${mod}" class="cg-nspopup">
              ${allModels.map((m) =>
                `<option value="${escHtml(m.id)}"${m.id === s.modelId ? ' selected' : ''}>${escHtml(m.label)}</option>`
              ).join('')}
            </select>
          </div>
        </div>
        <p id="sa-model-caps-${mod}" class="sa-model-caps">${_saModelCaps(s.providerId, mod, s.modelId)}</p>
      </div>`;
  }).filter(Boolean).join('');

  return `
    <div class="sa-step-section">
      <h3 class="sa-step-title"><i class="fa-solid fa-sliders" aria-hidden="true"></i> Default models</h3>
      <p class="sa-step-desc">Test each assignment and choose the default model for that task.</p>
      ${sections || '<p class="sa-wiz-muted">No modalities assigned — go back to the coverage step.</p>'}
    </div>`;
}

function _tmplModality(mod) {
  const meta      = MODALITY_META[mod];
  const s         = _saState[mod];
  const providers = PROVIDERS_BY_MODALITY[mod];
  const catalogModels = _getCatalogModels(s.providerId, mod);
  const allModels = _mergeModels(s.listedModels, catalogModels);
  const needsBaseUrl = ['openai-compatible', 'generic-rest'].includes(s.providerId);
  const isOptional   = !SETUP_STEPS.find((st) => st.id === mod)?.required;

  return `
    <div class="sa-step-section">
      <h3 class="sa-step-title">
        <i class="${SETUP_STEPS.find((st) => st.id === mod)?.icon || 'fa-solid fa-gear'}" aria-hidden="true"></i>
        ${escHtml(meta.label)}
        <span class="sa-badge ${escHtml(meta.badgeClass)}">${escHtml(meta.badge)}</span>
        ${isOptional ? '<span class="sa-step-skip-note">(you can skip this step)</span>' : ''}
      </h3>
      <p class="sa-step-desc">${escHtml(meta.desc)}</p>
      <p class="sa-step-tip"><i class="fa-solid fa-lightbulb" aria-hidden="true"></i> ${meta.tip}</p>

      <div class="cg-accordion project-settings-accordion">
        <details class="cg-accordion-section" open>
          <summary class="cg-accordion-header">Provider &amp; Key</summary>
          <div class="cg-accordion-body">

            <div class="cg-accordion-row">
              <label for="sa-provider-${mod}">Provider</label>
              <div class="cg-nspopup-wrap">
                <select id="sa-provider-${mod}" class="cg-nspopup" onchange="saOnProviderChange('${mod}')">
                  ${providers.map((p) =>
                    `<option value="${escHtml(p.id)}"${p.id === s.providerId ? ' selected' : ''}>${escHtml(p.label)}</option>`
                  ).join('')}
                </select>
              </div>
            </div>

            <div class="cg-accordion-row">
              <label for="sa-vendor-name-${mod}">Label <small>(optional nickname)</small></label>
              <input id="sa-vendor-name-${mod}" class="cg-field" type="text" maxlength="60"
                     placeholder="e.g. My OpenAI key" value="${escHtml(s.vendorName || '')}">
            </div>

            <div class="cg-accordion-row">
              <label for="sa-key-${mod}">API Key</label>
              <div class="api-keys-input-row">
                <input id="sa-key-${mod}" class="cg-field api-keys-secret-input" type="password"
                       spellcheck="false" autocapitalize="off" autocomplete="off"
                       placeholder="${s.key ? 'Key saved — leave blank to keep or paste to replace' : 'Paste your API key here'}"
                       value="">
                <button type="button" class="toolbar-btn toolbar-btn--shape-soft"
                        onclick="saToggleKeyReveal('${mod}')">Show</button>
              </div>
            </div>

            <div id="sa-baseurl-row-${mod}" class="cg-accordion-row${needsBaseUrl ? '' : ' hidden'}">
              <label for="sa-baseurl-${mod}">Base URL <small>(optional override)</small></label>
              <input id="sa-baseurl-${mod}" class="cg-field" type="url"
                     placeholder="${mod === 'llm' ? 'https://api.openai.com/v1' : mod === 'video' ? 'https://api.together.ai/v1' : 'https://your-endpoint.example'}"
                     value="${escHtml(s.baseUrl || '')}">
            </div>

          </div>
        </details>

        <details class="cg-accordion-section" open>
          <summary class="cg-accordion-header">Test &amp; Model Selection</summary>
          <div class="cg-accordion-body">

            <div class="sa-test-row">
              <button type="button" class="toolbar-btn toolbar-btn--shape-soft btn-ai"
                      id="sa-test-btn-${mod}">
                <i class="fa-solid fa-plug-circle-check" aria-hidden="true"></i> Test Connection &amp; List Models
              </button>
              <div id="sa-test-status-${mod}" class="sa-test-status${s.status ? ' sa-test-status--' + s.status : ''}">
                ${_saStatusHtml(s)}
              </div>
            </div>

            <div class="cg-accordion-row">
              <label for="sa-model-${mod}">Default model</label>
              <div class="cg-nspopup-wrap">
                <select id="sa-model-${mod}" class="cg-nspopup">
                  ${allModels.map((m) =>
                    `<option value="${escHtml(m.id)}"${m.id === s.modelId ? ' selected' : ''}>${escHtml(m.label)}</option>`
                  ).join('')}
                </select>
              </div>
            </div>
            <p id="sa-model-caps-${mod}" class="sa-model-caps">${_saModelCaps(s.providerId, mod, s.modelId)}</p>

          </div>
        </details>
      </div>
    </div>`;
}

function _tmplDone() {
  const rows = ROUTING_MODALITIES.map((mod) => {
    const meta = MODALITY_META[mod];
    const s    = _saState[mod];
    const vendor = _saVendorById(s.vendorId);
    let icon, cls, label;
    if (s.skip) {
      icon = 'fa-solid fa-forward'; cls = 'sa-done-skipped'; label = 'Skipped';
    } else if (vendor && s.modelId) {
      icon = 'fa-solid fa-circle-check'; cls = 'sa-done-ok';
      label = `${vendor.name || _saProviderLabel(vendor.providerId)} · ${s.modelLabel || s.modelId}`;
    } else if (vendor) {
      icon = 'fa-solid fa-circle-exclamation'; cls = 'sa-done-empty';
      // For audio, show sub-modality breakdown
      if (mod === 'audio') {
        const subs = ['tts', 'sfx', 'music'].map((sub) => {
          const st = _saState[`audio_${sub}`];
          if (!st) return null;
          const cat = { tts: 'TTS', sfx: 'SFX', music: 'Music' }[sub];
          return st.vendorId ? `${cat}: ${st.statusMsg}` : null;
        }).filter(Boolean);
        label = vendor.name ? `${vendor.name} · ${subs.join(', ') || 'available'}` : `${_saProviderLabel(vendor.providerId)} · ${subs.join(', ') || 'available'}`;
      } else {
        label = `${vendor.name || _saProviderLabel(vendor.providerId)} (no model)`;
      }
    } else {
      icon = 'fa-solid fa-circle-minus'; cls = 'sa-done-empty'; label = 'Not assigned';
    }
    return `
      <div class="sa-done-row ${cls}">
        <i class="${icon}" aria-hidden="true"></i>
        <div>
          <span class="sa-badge ${meta.badgeClass}">${meta.badge}</span>
          <strong>${escHtml(meta.label)}</strong>
          <span class="sa-done-label">${escHtml(label)}</span>
        </div>
      </div>`;
  }).join('');

  const hasRequired = _saCoverageSatisfied() && _saRequiredModelsAssigned();

  return `
    <div class="sa-step-section sa-done-section">
      <h3 class="sa-step-title"><i class="fa-solid fa-check-circle" aria-hidden="true"></i> Setup Summary</h3>
      ${!hasRequired ? `
        <div class="sa-done-warning">
          <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
          <div>
            <strong>Setup incomplete.</strong>
            <p>Text, Video, and Image / Storyboards need a provider, key, and default model. Finish in Settings or run this wizard again.</p>
          </div>
        </div>` : ''}
      <div class="sa-done-list">
        ${rows}
      </div>
      <div class="sa-done-actions">
        <button type="button" class="toolbar-btn toolbar-btn--shape-soft"
                onclick="closeSetupAssistant();if(typeof openAiProvidersModal==='function')openAiProvidersModal('providers');">
          <i class="fa-solid fa-key" aria-hidden="true"></i> Review API keys &amp; providers
        </button>
      </div>
      <p class="sa-done-note">Click <strong>Start CineGen</strong> to save and begin. You can return to this wizard anytime via <strong>AI Assist → App Setup Assistant</strong>.</p>
    </div>`;
}

/* ── Control binding ─────────────────────────────────────────────────────── */

function _saWizardUpsertVendor(vendor, apiKey) {
  const key = String(apiKey || '').trim();
  if (key.length >= 4) {
    vendor.apiKey = key;
    vendor.hasServerKey = false;
  }
  /* Status left null here — caller sets 'testing' and triggers _saTestVendorAllModalities. */
  vendor.status = null;
  vendor.statusMsg = '';
}

function saWizardSaveProviderSlot(slotId) {
  const slot = getSaProviderSlots().find((s) => s.slotId === slotId);
  if (!slot) return;
  const keyEl = document.getElementById(`sa-prov-key-${slotId}`);
  const typed = (keyEl?.value || '').trim();
  let vendor = _saFindVendorForSlot(slot);
  if (!typed && typed.length < 4) {
    if (!vendor || !_saVendorHasKey(vendor)) {
      openSetupAssistantAlert({ title: 'API key required', message: 'Paste a valid API key before saving.' });
      return;
    }
    if (vendor && _saNeedsProviderApiUrl(slot.providerId)) {
      const urlEl = document.getElementById(`sa-prov-url-${slotId}`);
      if (!_saApplyVendorApiUrl(vendor, urlEl, slot.name)) return;
    }
    const localKey = String(vendor?.apiKey || '').trim();
    if (localKey.length > 4) {
      vendor.status = 'testing';
      _renderSetupStep(_saCurrentStep);
      _saSaveProgress();
      _saTestVendorAllModalities(vendor);
    }
    return;
  }
  if (!vendor) {
    vendor = {
      id: _saNewWizardVendorId(),
      slotId: slot.slotId,
      name: slot.name,
      providerId: slot.providerId,
      baseUrl: slot.baseUrl || '',
      apiKey: '',
      status: null,
      statusMsg: '',
    };
    _saState.vendors.push(vendor);
  } else {
    vendor.slotId = slot.slotId;
    vendor.name = slot.name;
    vendor.providerId = slot.providerId;
    if (slot.baseUrl && !_saNeedsProviderApiUrl(slot.providerId)) vendor.baseUrl = slot.baseUrl;
  }
  if (_saNeedsProviderApiUrl(slot.providerId)) {
    const urlEl = document.getElementById(`sa-prov-url-${slotId}`);
    if (!_saApplyVendorApiUrl(vendor, urlEl, slot.name)) return;
  } else if (slot.baseUrl) {
    vendor.baseUrl = slot.baseUrl;
  }
  _saWizardUpsertVendor(vendor, typed);
  if (keyEl) keyEl.value = '';
  vendor.status = 'testing';
  _renderSetupStep(_saCurrentStep);
  _saSaveProgress();
  _saTestVendorAllModalities(vendor);
}

function saWizardToggleProviderSlot(slotId) {
  if (_saActiveProviderSlots.has(slotId)) {
    _saActiveProviderSlots.delete(slotId);
    _renderSetupStep(_saCurrentStep);
    _saSaveProgress();
    return;
  }
  _saActiveProviderSlots.add(slotId);
  const slot = getSaProviderSlots().find((s) => s.slotId === slotId);
  const vendor = slot ? _saFindVendorForSlot(slot) : null;
  if (vendor && _saVendorHasKey(vendor) && vendor.status !== 'testing') {
    vendor.status = 'testing';
    _renderSetupStep(_saCurrentStep);
    _saSaveProgress();
    _saTestVendorAllModalities(vendor);
  } else {
    _renderSetupStep(_saCurrentStep);
    _saSaveProgress();
  }
}

/**
 * Auto-test vendors that have keys but no status (loaded from storage).
 * This fixes the bug where the Next button is blocked because loaded providers
 * haven't been tested yet.
 */
function _saAutoTestUntestedVendors() {
  const vendors = _saState?.vendors || [];
  const untested = vendors.filter((v) => {
    const hasKey = _saVendorHasKey(v);
    const hasLocalKey = String(v.apiKey || '').trim().length > 4;
    const needsTest = !v.status || v.status === null || v.status === '';
    return hasKey && hasLocalKey && needsTest;
  });
  if (untested.length === 0) return;
  // Test each vendor without blocking the UI
  untested.forEach((vendor) => {
    vendor.status = 'testing';
    _saTestVendorAllModalities(vendor);
  });
  _renderSetupStep(_saCurrentStep);
  _saSaveProgress();
}

function saWizardClearProviderSlot(slotId) {
  const slot = getSaProviderSlots().find((s) => s.slotId === slotId);
  if (!slot) return;
  const vendor = _saFindVendorForSlot(slot);
  if (!vendor) return;
  // Clear the API key
  vendor.apiKey = '';
  vendor.hasServerKey = false;
  vendor.status = null;
  vendor.statusMsg = '';
  // Also clear from the key storage if possible
  if (typeof writeVendorKey === 'function') {
    writeVendorKey(vendor, '');
  }
  _renderSetupStep(_saCurrentStep);
  _saSaveProgress();
}

function saWizardReloadProviderSlot(slotId) {
  const slot = getSaProviderSlots().find((s) => s.slotId === slotId);
  if (!slot) return;
  const vendor = _saFindVendorForSlot(slot);
  if (!vendor) return;
  const localKey = String(vendor.apiKey || '').trim();
  if (!localKey && !vendor.hasServerKey) {
    openSetupAssistantAlert({ title: 'No key', message: 'This provider has no API key to test.' });
    return;
  }
  vendor.status = 'testing';
  _renderSetupStep(_saCurrentStep);
  _saSaveProgress();
  _saTestVendorAllModalities(vendor);
}

function saWizardSaveManualProvider(vendorId) {
  const vendor = _saVendorById(vendorId);
  if (!vendor) return;
  const keyEl = document.getElementById(`sa-manual-key-${vendorId}`);
  const typed = (keyEl?.value || '').trim();
  const hasExisting = _saVendorHasKey(vendor);

  if (!typed || typed.length < 4) {
    if (!hasExisting) {
      openSetupAssistantAlert({ title: 'API key required', message: 'Paste a valid API key before saving.' });
      return;
    }
    if (!_saApplyVendorApiUrl(vendor, document.getElementById(`sa-manual-url-${vendorId}`), vendor.name)) return;
    _renderSetupStep(_saCurrentStep);
    _saSaveProgress();
    return;
  }
  if (!_saApplyVendorApiUrl(vendor, document.getElementById(`sa-manual-url-${vendorId}`), vendor.name)) return;
  _saWizardUpsertVendor(vendor, typed);
  if (keyEl) keyEl.value = '';
  vendor.status = 'testing';
  _renderSetupStep(_saCurrentStep);
  _saSaveProgress();
  _saTestVendorAllModalities(vendor);
}

function saWizardAddProvider() {
  const nameEl = document.getElementById('sa-add-name');
  const typeEl = document.getElementById('sa-add-provider');
  const keyEl  = document.getElementById('sa-add-key');
  const urlEl  = document.getElementById('sa-add-baseurl');
  const name   = (nameEl?.value || '').trim();
  const providerId = typeEl?.value || 'openai-compatible';
  const apiKey = (keyEl?.value || '').trim();
  if (!name && apiKey.length < 4) {
    openSetupAssistantAlert({
      title: 'Name required',
      message: 'Enter a display name for this provider (you can paste the API key and click Save on its row).',
    });
    return;
  }
  const vendor = {
    id: _saNewWizardVendorId(),
    name: name || _saProviderLabel(providerId),
    providerId,
    baseUrl: '',
    slotId: '',
    apiKey: '',
    status: null,
    statusMsg: '',
  };
  if (!_saApplyVendorApiUrl(vendor, urlEl, vendor.name)) return;
  if (apiKey.length >= 4) _saWizardUpsertVendor(vendor, apiKey);
  _saState.vendors.push(vendor);
  if (nameEl) nameEl.value = '';
  if (keyEl) keyEl.value = '';
  if (urlEl) urlEl.value = '';
  if (apiKey.length >= 4) {
    vendor.status = 'testing';
    _renderSetupStep(_saCurrentStep);
    _saSaveProgress();
    _saTestVendorAllModalities(vendor);
  } else {
    _renderSetupStep(_saCurrentStep);
    _saSaveProgress();
  }
}

function saWizardRemoveProvider(vendorId) {
  _saState.vendors = (_saState.vendors || []).filter((v) => v.id !== vendorId);
  ROUTING_MODALITIES.forEach((mod) => {
    if (_saState[mod].vendorId === vendorId) {
      _saState[mod].vendorId = '';
      _saState[mod].providerId = '';
    }
  });
  _renderSetupStep(_saCurrentStep);
  _saSaveProgress();
}

/**
 * Test all four modalities for a vendor concurrently. Called automatically after saving a key.
 * Updates vendor.status and writes catalog data. Re-renders the providers step when done.
 */
async function _saTestVendorAllModalities(vendor) {
  const localKey = String(vendor?.apiKey || '').trim();
  if (!vendor?.id || !localKey) {
    vendor.status = 'err';
    vendor.statusMsg = 'No API key to test.';
    if (SETUP_STEPS[_saCurrentStep]?.id === 'providers') _renderSetupStep(_saCurrentStep);
    return;
  }

  /* Cancel any in-flight test for this vendor. */
  if (_saVendorTestAborts[vendor.id]) {
    try { _saVendorTestAborts[vendor.id].abort(); } catch (e) { /* noop */ }
  }
  const controller = new AbortController();
  _saVendorTestAborts[vendor.id] = controller;

  const key        = String(vendor.apiKey || '').trim();
  const baseUrl    = vendor.baseUrl || '';
  const providerId = vendor.providerId;

  /* Fetch all modalities concurrently; individual errors are caught internally. */
  const fetches = ROUTING_MODALITIES.map((mod) =>
    _saFetchModels(providerId, key, baseUrl, mod, controller.signal)
      .then((result) => ({ mod, result }))
      .catch((e) => ({ mod, error: e }))
  );

  let settled;
  try {
    settled = await Promise.all(fetches);
  } catch (e) {
    /* Promise.all itself only rejects on abort via the signal; individual fetch errors are caught above. */
    delete _saVendorTestAborts[vendor.id];
    if (e.name === 'AbortError') return;
    vendor.status = 'err';
    vendor.statusMsg = e.message || 'Test failed.';
    if (SETUP_STEPS[_saCurrentStep]?.id === 'providers') _renderSetupStep(_saCurrentStep);
    _saSaveProgress();
    return;
  }

  delete _saVendorTestAborts[vendor.id];

  let anyOk = false;
  const firstErrMsg = [];

  for (const { mod, result, error } of settled) {
    if (error) {
      if (error.name === 'AbortError') return;  /* aborted mid-flight */
      firstErrMsg.push(`${_saModalityChipLabel(mod)}: ${error.message}`);
      continue;
    }
    if ((result.ok || result.rateLimit) && result.models?.length > 0) {
      anyOk = true;
      if (typeof applyVendorCatalogFetchResult === 'function') {
        applyVendorCatalogFetchResult(vendor.id, providerId, mod, result);
      } else if (typeof setVendorModalityCatalog === 'function') {
        setVendorModalityCatalog(vendor.id, providerId, mod, result);
      }
    } else if (result.rateLimit) {
      anyOk = true;
      if (typeof applyVendorCatalogFetchResult === 'function') {
        applyVendorCatalogFetchResult(vendor.id, providerId, mod, result);
      } else if (typeof setVendorModalityCatalog === 'function') {
        setVendorModalityCatalog(vendor.id, providerId, mod, result);
      }
    } else if (!result.ok && result.message) {
      firstErrMsg.push(`${_saModalityChipLabel(mod)}: ${result.message}`);
    }
  }

  if (anyOk) {
    vendor.status = 'ok';
    vendor.statusMsg = '';
  } else {
    vendor.status = 'err';
    /* Strip the "ModLabel: " prefix from the first error since it may not be meaningful on its own. */
    vendor.statusMsg = firstErrMsg.length
      ? firstErrMsg[0].replace(/^[^:]+:\s*/, '')
      : 'No models found. Check your API key.';
  }

  if (SETUP_STEPS[_saCurrentStep]?.id === 'providers') _renderSetupStep(_saCurrentStep);
  _saSaveProgress();
}

async function saWizardTestProvider(vendorId) {
  const v = _saVendorById(vendorId);
  if (!v || !String(v.apiKey || '').trim()) {
    openSetupAssistantAlert({ title: 'No key', message: 'This provider has no API key to test.' });
    return;
  }
  v.status = 'testing';
  _renderSetupStep(_saCurrentStep);
  const mod = 'llm';
  try {
    const result = await _saFetchModels(v.providerId, v.apiKey, v.baseUrl || '', mod, undefined);
    v.status = result.ok ? 'ok' : (result.rateLimit ? 'ratelimit' : 'err');
    v.statusMsg = result.message || '';
    if (typeof applyVendorCatalogFetchResult === 'function') {
      applyVendorCatalogFetchResult(v.id, v.providerId, mod, result);
    } else if (typeof setVendorModalityCatalog === 'function') {
      setVendorModalityCatalog(v.id, v.providerId, mod, result);
    }
  } catch (e) {
    v.status = 'err';
    v.statusMsg = e.message || 'Test failed';
  }
  _renderSetupStep(_saCurrentStep);
  _saSaveProgress();
}

function _bindStepControls(stepId) {
  if (stepId === 'providers') {
    if (!_saProviderStepListenerBound) {
      _saProviderStepListenerBound = true;
      document.addEventListener('click', (e) => {
        const card = (e.target as Element).closest('.sa-prov-card[data-sa-slot]');
        const details = (e.target as Element).closest('.sa-prov-card-details[data-sa-slot]');
        const toggleTarget = card || details;
        if (toggleTarget) {
          const slotId = (toggleTarget as HTMLElement).getAttribute('data-sa-slot');
          // Don't toggle if clicking inside controls (save, cancel, inputs)
          if (!(e.target as Element).closest('.sa-prov-card-controls')) {
            e.preventDefault();
            saWizardToggleProviderSlot(slotId);
          }
        }

        const saveBtn = (e.target as Element).closest('.sa-prov-save-btn[data-sa-slot]');
        if (saveBtn) {
          e.stopPropagation();
          const slotId = (saveBtn as HTMLElement).getAttribute('data-sa-slot');
          saWizardSaveProviderSlot(slotId);
        }

        const cancelBtn = (e.target as Element).closest('.sa-prov-cancel-btn[data-sa-slot]');
        if (cancelBtn) {
          e.stopPropagation();
          const slotId = (cancelBtn as HTMLElement).getAttribute('data-sa-slot');
          saWizardToggleProviderSlot(slotId);
        }

        const clearBtn = (e.target as Element).closest('.sa-prov-clear-btn[data-sa-slot]');
        if (clearBtn) {
          e.stopPropagation();
          const slotId = (clearBtn as HTMLElement).getAttribute('data-sa-slot');
          saWizardClearProviderSlot(slotId);
        }

        const reloadBtn = (e.target as Element).closest('.sa-prov-reload-btn[data-sa-slot]');
        if (reloadBtn) {
          e.stopPropagation();
          const slotId = (reloadBtn as HTMLElement).getAttribute('data-sa-slot');
          saWizardReloadProviderSlot(slotId);
        }
      });

      // Handle Return key in provider key inputs
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === 'Return') {
          const input = e.target as HTMLInputElement;
          if (input && input.classList.contains('sa-prov-key-input')) {
            e.preventDefault();
            const details = input.closest('.sa-prov-card-details[data-sa-slot]');
            if (details) {
              const slotId = details.getAttribute('data-sa-slot');
              saWizardSaveProviderSlot(slotId);
            }
          }
        }
      });
    }
    const addTypeEl = document.getElementById('sa-add-provider');
    if (addTypeEl) {
      addTypeEl.addEventListener('change', saWizardOnAddProviderTypeChange);
      saWizardOnAddProviderTypeChange();
    }
    /* Auto-test any vendors with keys but no status (loaded from storage) */
    _saAutoTestUntestedVendors();
    return;
  }

  if (stepId === 'coverage') {
    return;
  }
}

/* ── Provider change handler ─────────────────────────────────────────────── */

function saOnProviderChange(mod) {
  const pSel = document.getElementById(`sa-provider-${mod}`);
  if (!pSel) return;
  _saState[mod].providerId    = pSel.value;
  _saState[mod].status        = null;
  _saState[mod].statusMsg     = '';
  _saState[mod].listedModels  = [];

  /* Show/hide base URL field */
  const baseUrlRow = document.getElementById(`sa-baseurl-row-${mod}`);
  if (baseUrlRow) {
    const needs = ['openai-compatible', 'generic-rest'].includes(pSel.value);
    baseUrlRow.classList.toggle('hidden', !needs);
  }

  /* Update base URL to default for the newly selected provider */
  const urlInput = document.getElementById(`sa-baseurl-${mod}`);
  if (urlInput) {
    const provider = (window as any).AI_API_PROVIDERS?.find((p: any) => p.id === pSel.value);
    urlInput.value = provider?.baseUrl || '';
    _saState[mod].baseUrl = urlInput.value;
  }

  /* Refresh model dropdown to catalog models for new provider */
  _saRefreshModelSelect(mod);

  /* Clear test status */
  const statusEl = document.getElementById(`sa-test-status-${mod}`);
  if (statusEl) {
    statusEl.className = 'sa-test-status';
    statusEl.innerHTML = '<i class="fa-solid fa-circle-info"></i> Provider changed — test connection to refresh.';
  }
}

function _saEnsureModelId(mod) {
  const s = _saState[mod];
  /* Only auto-select from live API results; never inject a catalog model. */
  if (!s.modelId && Array.isArray(s.listedModels) && s.listedModels.length) {
    s.modelId = s.listedModels[0].id;
    s.modelLabel = s.listedModels[0].label || '';
  }
}

function _saRefreshModelSelect(mod) {
  const mSel = document.getElementById(`sa-model-${mod}`);
  if (!mSel) return;
  const s           = _saState[mod];
  _saEnsureModelId(mod);
  const catalogMods = _getCatalogModels(s.providerId, mod);
  const allModels   = _mergeModels(s.listedModels, catalogMods);
  mSel.replaceChildren();
  allModels.forEach((m) => {
    const o = document.createElement('option');
    o.value = m.id;
    o.textContent = m.label;
    o.selected = m.id === s.modelId;
    mSel.appendChild(o);
  });
  if (s.modelId) mSel.value = s.modelId;
  const capsEl = document.getElementById(`sa-model-caps-${mod}`);
  if (capsEl) capsEl.textContent = _saModelCaps(s.providerId, mod, s.modelId);
}

function _saRefreshCoverageModelSelect(mod) {
  const mSel = document.getElementById(`sa-coverage-model-${mod}`);
  if (!mSel) return;
  const s           = _saState[mod];
  _saEnsureModelId(mod);
  const catalogMods = _getCatalogModels(s.providerId, mod);
  const allModels   = _mergeModels(s.listedModels, catalogMods);
  mSel.replaceChildren();
  if (!allModels.length) {
    const o = document.createElement('option');
    o.value = '';
    o.textContent = '— No models. Add provider. —';
    mSel.appendChild(o);
  } else {
    allModels.forEach((m) => {
      const o = document.createElement('option');
      o.value = m.id;
      o.textContent = m.label;
      o.selected = m.id === s.modelId;
      mSel.appendChild(o);
    });
  }
  if (s.modelId) mSel.value = s.modelId;
  const capsEl = document.getElementById(`sa-coverage-model-caps-${mod}`);
  if (capsEl) capsEl.textContent = _saModelCaps(s.providerId, mod, s.modelId);
}

/* ── Save step data (used after test connection succeeds) ──────────────── */

function _saSaveStepData(mod) {
  const s = _saState[mod];
  if (s.skip || !s.vendorId) return;
  _saSyncModalityProviderFromVendor(mod);
  if (typeof loadAiApiSettings === 'function' && typeof saveAiApiSettings === 'function') {
    const current = loadAiApiSettings();
    current.modalities[mod] = {
      ...current.modalities[mod],
      provider:   s.providerId,
      model:      s.modelId || '',
      modelLabel: _saResolveModelLabel(s, mod),
      baseUrl:    s.baseUrl || '',
      vendorId:   s.vendorId,
    };
    saveAiApiSettings(current);
  }
}

/* ── Key reveal toggle ───────────────────────────────────────────────────── */

function saToggleKeyReveal(mod) {
  const input = document.getElementById(`sa-key-${mod}`);
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
}

/* ── Proxy test (legacy no-op) ───────────────────────────────────────────── */

async function saTestProxy() {
  return;
}

/* ── API key input helpers ───────────────────────────────────────────────── */

function _saIsMaskedKeyDisplay(inputValue, storedKey) {
  if (!inputValue || !storedKey) return false;
  const mask = '•'.repeat(Math.min(storedKey.length, 24));
  return inputValue === mask || (/^•+$/.test(inputValue) && inputValue.length <= storedKey.length);
}

/** API key for a modality from its assigned wizard vendor. */
function _saKeyFromInput(mod) {
  const v = _saVendorById(_saState[mod]?.vendorId);
  return String(v?.apiKey || '').trim();
}

/* ── Connection test & model listing ─────────────────────────────────────── */

/**
 * Test provider connection, refresh model list, and persist on success.
 * @returns {{ ok: boolean, rateLimit: boolean, message: string, noKey?: boolean }}
 */
async function _saRunConnectionTest(mod, options) {
  const updateUi = !options || options.updateUi !== false;
  _saCollectCurrentStep(_saCurrentStep);

  const s        = _saState[mod];
  _saSyncModalityProviderFromVendor(mod);
  const statusEl = document.getElementById(`sa-test-status-${mod}`);
  const testBtn  = document.getElementById(`sa-test-btn-${mod}`);
  const key      = _saKeyFromInput(mod);
  const vendor   = _saVendorById(s.vendorId);
  const hasServerKey = Boolean(vendor?.hasServerKey);

  if (!key && !hasServerKey) {
    if (updateUi) _saSetTestStatus(mod, 'err', 'Assign a provider with an API key first.');
    return { ok: false, rateLimit: false, message: 'Assign a provider with an API key first.', noKey: true };
  }

  if (_saTestAborts[mod]) { try { _saTestAborts[mod].abort(); } catch (e) { /* noop */ } }
  const controller   = new AbortController();
  _saTestAborts[mod] = controller;

  _saState[mod].status = 'testing';
  if (updateUi) {
    if (testBtn) { testBtn.disabled = true; testBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Testing…'; }
    _saSetTestStatus(mod, 'testing', 'Connecting…');
  }

  const resetTestBtn = () => {
    if (testBtn) {
      testBtn.disabled = false;
      testBtn.innerHTML = '<i class="fa-solid fa-plug-circle-check" aria-hidden="true"></i> Test Connection &amp; List Models';
    }
  };

  try {
    const result = await saFetchModels(s.providerId || _saVendorById(s.vendorId)?.providerId, key, s.baseUrl || _saVendorById(s.vendorId)?.baseUrl || '', mod, controller.signal);
    if (updateUi) resetTestBtn();

    _saState[mod].status    = result.ok ? 'ok' : (result.rateLimit ? 'ratelimit' : 'err');
    _saState[mod].statusMsg = result.message;

    if (result.ok || result.rateLimit) {
      const listedModels = result.models || [];
      const fetchedAt = Date.now();
      _saState[mod].listedModels = listedModels;
      _saState[mod].fetchedAt = fetchedAt;
      _saEnsureModelId(mod);
      _saRefreshModelSelect(mod);

      // Propagate test result to audio sub-modalities (TTS, SFX, Music)
      // Uses modelMatchesAudioCapability cascade (type → capabilities → boolean flags → keywords)
      if (mod === 'audio') {
        const checkSub = (key) => {
          const matchFn = typeof window.modelMatchesAudioCapability === 'function'
            ? (m) => window.modelMatchesAudioCapability(m, key, s.providerId || '')
            : (m) => {
                const text = (m.id + ' ' + (m.label || '')).toLowerCase();
                const kw = { tts: ['tts', 'speech', 'voice'], sfx: ['sfx', 'sound', 'effect'], music: ['music', 'song'] }[key] || [];
                return kw.some((k) => text.includes(k));
              };
          const hits = listedModels.filter(matchFn);
          if (!_saState[key]) {
            _saState[key] = { status: null, statusMsg: '', listedModels: [], fetchedAt: 0, modelId: '', providerId: '', vendorId: '', baseUrl: '' };
          }
          if (hits.length > 0) {
            _saState[key].status = _saState['audio'].status;
            _saState[key].statusMsg = _saState['audio'].statusMsg;
            _saState[key].listedModels = hits;
            _saState[key].fetchedAt = fetchedAt;
            _saState[key].providerId = _saState['audio'].providerId;
            _saState[key].vendorId = _saState['audio'].vendorId;
            _saState[key].baseUrl = _saState['audio'].baseUrl;
            if (_saState[key].listedModels.length && !_saState[key].modelId) {
              _saState[key].modelId = _saState[key].listedModels[0].id;
            }
          }
        };
        checkSub('tts');
        checkSub('sfx');
        checkSub('music');
      }

      if (typeof applyVendorCatalogFetchResult === 'function' && s.vendorId) {
        applyVendorCatalogFetchResult(s.vendorId, s.providerId, mod, { ...result, fetchedAt });
      } else if (typeof setVendorModalityCatalog === 'function' && s.vendorId) {
        setVendorModalityCatalog(s.vendorId, s.providerId, mod, { ...result, fetchedAt });
      }

      if (typeof triggerModelActivityBlink === 'function') triggerModelActivityBlink(mod);

      if (updateUi) {
        const count = listedModels.length;
        const msg = result.rateLimit
          ? `Rate limited — key is likely valid. <small>(${result.message})</small>`
          : count
            ? `<i class="fa-solid fa-circle-check"></i> Connected — ${count} model${count !== 1 ? 's' : ''} listed.`
            : `<i class="fa-solid fa-circle-check"></i> Connected — no models listed by provider.`;
        _saSetTestStatus(mod, result.rateLimit ? 'ratelimit' : 'ok', msg, true);
      }

      _saSaveStepData(mod);
      _saSaveProgress();
      return { ok: result.ok, rateLimit: result.rateLimit, message: result.message };
    }

    if (updateUi) _saSetTestStatus(mod, 'err', result.message);
    _saSaveProgress();
    return { ok: false, rateLimit: false, message: result.message || 'Connection failed.' };

  } catch (e) {
    if (updateUi) resetTestBtn();
    if (e.name === 'AbortError') return { ok: false, rateLimit: false, message: 'Cancelled.', aborted: true };
    _saState[mod].status    = 'err';
    _saState[mod].statusMsg = e.message;
    if (updateUi) _saSetTestStatus(mod, 'err', `Unexpected error: ${e.message}`);
    _saSaveProgress();
    return { ok: false, rateLimit: false, message: e.message };
  }
}

async function saTestConnection(mod) {
  return _saRunConnectionTest(mod, { updateUi: true });
}

function _saSetTestStatus(mod, statusType, message, rawHtml) {
  // Only update providers step status elements — coverage step is Lit-managed
  const el = document.getElementById(`sa-test-status-${mod}`);
  if (!el) return;
  const icon = statusType === 'ok'        ? 'fa-circle-check'
             : statusType === 'ratelimit' ? 'fa-circle-check'
             : statusType === 'testing'   ? 'fa-circle-notch fa-spin'
             : statusType === 'cors'      ? 'fa-circle-exclamation'
             : 'fa-circle-xmark';
  el.className = `sa-test-status sa-test-status--${statusType}`;
  if (rawHtml) {
    el.innerHTML = message;
  } else {
    el.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i> ${escHtml(message)}`;
  }
}

/* Provider API fetch and model helpers are now in @/setup-assistant/connection-test.ts */
/* Thin backward-compat wrappers for internal callers: */
const _saFetchModels    = saFetchModels;
const _saCombineSignals = saCombineSignals;
const _getCatalogModels = saGetCatalogModels;
const _mergeModels      = saMergeModels;
const _saResolveModelLabel = saResolveModelLabel;
const _saModelCaps      = saModelCaps;
const _saStatusHtml     = saStatusHtml;

/* ── Save setup data to server-backed persistence ────────────────────────── */

function _saveAllSetupData() {
  if (typeof applyServerKeysBadge === 'function') applyServerKeysBadge();

  const existing = typeof loadApiKeys === 'function' ? loadApiKeys() : { selectedVendorId: '', vendors: [] };
  const vendors = (_saState.vendors || []).map((wv) => {
    let v = {
      id: wv.id,
      name: wv.name || _saProviderLabel(wv.providerId),
      providerId: wv.providerId,
      baseUrl: wv.baseUrl || '',
      slotId: wv.slotId || '',
      apiKey: wv.apiKey || '',
    };
    if (typeof normalizeVendor === 'function') v = normalizeVendor(v);
    return v;
  });

  const routingUpdates = {};
  ROUTING_MODALITIES.forEach((mod) => {
    const s = _saState[mod];
    if (s.skip || !s.vendorId) return;
    const vendor = vendors.find((v) => v.id === s.vendorId);
    if (!vendor) return;
    const wv = (_saState.vendors || []).find((x) => x.id === vendor.id);
    routingUpdates[mod] = {
      provider:   vendor.providerId,
      model:      s.modelId || '',
      modelLabel: _saResolveModelLabel(s, mod),
      baseUrl:    s.baseUrl || wv?.baseUrl || '',
      vendorId:   vendor.id,
    };
  });

  const nextApiKeys = {
    ...existing,
    vendors,
    selectedVendorId: vendors[0]?.id || existing.selectedVendorId,
  };
  if (typeof saveApiKeys === 'function') saveApiKeys(nextApiKeys);

  if (typeof loadAiApiSettings === 'function' && typeof saveAiApiSettings === 'function') {
    const current = loadAiApiSettings();
    ROUTING_MODALITIES.forEach((mod) => {
      if (routingUpdates[mod]) {
        current.modalities[mod] = { ...current.modalities[mod], ...routingUpdates[mod] };
      }
    });
    saveAiApiSettings(current);
  }

  if (typeof populateAiApiSettingsForm === 'function') populateAiApiSettingsForm();
  if (typeof refreshAiProvidersVendorList === 'function') refreshAiProvidersVendorList();
}

function _saProviderLabel(providerId) {
  if (typeof AI_API_PROVIDERS !== 'undefined') {
    const found = AI_API_PROVIDERS.find((p) => p.id === providerId);
    if (found) return found.label.split(' (')[0];
  }
  return providerId;
}

function _saFirstCatalogModelId(providerId, mod) {
  /* Never fall back to catalog during wizard flow — only live API results populate model ids. */
  return '';
}

/* ── AI Providers modal: Test Connection ─────────────────────────────────── */

/**
 * aipTestSelectedProvider()
 * Called by the Test & List Models button inside the AI Providers & Models modal.
 * Reads the currently selected vendor + modality, tests the key, and lists models.
 */
async function aipTestSelectedProvider() {
  const host = document.querySelector('cinegen-aip-test-connection');
  if (host && typeof host.runTest === 'function') {
    host.runTest();
    return;
  }
}

/* ── First-launch detection ─────────────────────────────────────────────── */

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

  /* Small delay so shell/layout settles before the wizard appears. */
  setTimeout(tryOpen, 300);
}

/* ── Setup Assistant alert (nested in wizard) ────────────────────────────── */

function openSetupAssistantAlert({ title, message, tone }) {
  const layer = document.getElementById('sa-alert-modal');
  if (!layer) return;
  const titleEl   = document.getElementById('sa-alert-title-text');
  const messageEl = document.getElementById('sa-alert-message');
  const iconEl    = document.getElementById('sa-alert-icon');
  if (titleEl)   titleEl.textContent   = title || 'Notice';
  if (messageEl) messageEl.textContent = message || '';
  if (iconEl) {
    const isErr = tone !== 'info';
    iconEl.className = isErr
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

/* ── Style injection ─────────────────────────────────────────────────────── */

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
    providerLabel: (id: string) => _saProviderLabel(id),
    modalityRequired: (mod: string) => _saModalityIsRequired(mod),
    coverageSatisfied: () => _saCoverageSatisfied(),
    statusMessageHtml: (s: any) => _saStatusHtml(s),
    modelCapsText: (providerId: string, mod: string, modelId: string) => _saModelCaps(providerId, mod, modelId),
    catalogModels: (providerId: string, mod: string) => _getCatalogModels(providerId, mod),
    cachedVendorModels: (vendorId: string, mod: string) => typeof getCachedModelsForVendorModality === 'function'
      ? getCachedModelsForVendorModality(vendorId, mod)
      : [],
    cachedAudioModelsByCapability: (vendorId: string, capability: string) => typeof getCachedAudioModelsByCapability === 'function'
      ? getCachedAudioModelsByCapability(vendorId, capability)
      : [],
    cachedModalityStatus: (vendorId: string, mod: string) => typeof getCachedModalityStatus === 'function'
      ? getCachedModalityStatus(vendorId, mod)
      : null,
    mergeModels: (listed: any[], catalog: any[]) => _mergeModels(listed, catalog),
    providersByModality: (mod: string) => PROVIDERS_BY_MODALITY[mod] || [],
    saveStepData: (mod: string) => _saSaveStepData(mod),
    renderProvidersMarkup: () => _tmplProviders(),
  };
  configureSaWizardApi(api);
  // Expose on window for cross-module access (Lit components import from different module instances)
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
  w.saOnProviderChange = saOnProviderChange;
  w.saTestProxy = saTestProxy;
  w.saToggleKeyReveal = saToggleKeyReveal;
  w.saTestConnection = saTestConnection;
  w.saWizardAddProvider = saWizardAddProvider;
  w.saWizardOnAddProviderTypeChange = saWizardOnAddProviderTypeChange;
  w.saWizardSaveProviderSlot = saWizardSaveProviderSlot;
  w.saWizardClearProviderSlot = saWizardClearProviderSlot;
  w.saWizardReloadProviderSlot = saWizardReloadProviderSlot;
  w.saWizardSaveManualProvider = saWizardSaveManualProvider;
  w.saWizardRemoveProvider = saWizardRemoveProvider;
  w.saWizardTestProvider = saWizardTestProvider;
  w.saWizardToggleProviderSlot = saWizardToggleProviderSlot;
  w._saActiveProviderSlots = _saActiveProviderSlots;
  w._saCurrentStep = _saCurrentStep;
  w._saIsSlotActive = _saIsSlotActive;
  w._renderSetupStep = _renderSetupStep;
  /** @deprecated Prefer `fetchProviderModels` from `@/services/provider-fetch`. */
  w.fetchProviderModelsForModality = _saFetchModels;
}

/** Wire Next / alert / rail (once). */
export function initSetupAssistantChromeOnce(): void {
  _initSetupAssistantChromeOnce();
}
