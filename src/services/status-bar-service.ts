import type { ModalityKey } from '@/types/globals';
import { escHtml } from '@/utils/html';
import type { CgToolbarSplit } from '@/components/primitives/cg-toolbar-split';
import { storageService } from '@/services/persistence';
import { SETUP_COMPLETE_STORAGE_KEY, SETUP_PROGRESS_STORAGE_KEY } from '@/constants/storage-keys';
import {
  listProvidersWithKeyForModality,
  mergeRoutingModelOptions,
} from '@/services/provider-model-catalog';
import { AI_API_PROVIDERS } from '@/data/provider-catalog';
import {
  AI_API_MODEL_CATALOG,
  formatCapsText,
  getAiApiModelDisplayLabel,
  loadAiApiSettings,
  openAiProvidersModal,
  saveAiApiSettings,
} from '@/settings/ai-api-settings-bundle';
import {
  apiKeysListCredentialCandidates,
  apiScopeForModality,
  getApiKey,
  loadApiKeys,
  vendorHasApiKey,
  vendorHasKeyForScope,
} from '@/settings/api-keys-settings-bundle';
import { isSetupComplete as readSetupCompleteFlag } from '@/setup-assistant/setup-assistant-persistence';
import {
  _msbBuildAudioSubmodalitySection,
  _msbGetAudioVoicesForSelection,
  buildAudioSubmodalityMenu,
  positionAudioSubmodalityMenu,
  closeAudioSubmodalityMenu,
  updateAudioSubmodalityIndicators,
} from '@/services/status-bar-audio';

/** Not shown in audio sub-modality (TTS/SFX/Music) quick-pick menus. */
export const MSB_AUDIO_SUB_EXCLUDED_MODEL_IDS = new Set(['gpt-4o-audio-preview']);

const MODEL_STATUS_MODALITIES: Array<{ key: ModalityKey; label: string }> = [
  { key: 'llm', label: 'Text' },
  { key: 'video', label: 'Video' },
  { key: 'image', label: 'Image' },
  { key: 'audio', label: 'Audio' },
];

export const AUDIO_SUB_MODALITIES: Array<{ key: string; label: string }> = [
  { key: 'tts', label: 'TTS' },
  { key: 'sfx', label: 'SFX' },
  { key: 'music', label: 'Music' },
];

const SA_ACTIVITY_BLINK_MS = 2000;
export const MODEL_STATUS_MENU_PAD = 8;

/** Position a fixed popup menu below (or above) an anchor; left edges aligned by default. */
export function _msbPositionFixedMenu(anchorRect: DOMRect, menu: HTMLElement, pad = MODEL_STATUS_MENU_PAD): void {
  menu.style.position = 'fixed';
  menu.style.visibility = 'hidden';
  menu.style.pointerEvents = 'none';

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxH = vh - pad * 2;
  menu.style.maxHeight = `${maxH}px`;

  const menuRect = menu.getBoundingClientRect();
  const menuW = menuRect.width || menu.offsetWidth || 240;
  const menuH = Math.min(menuRect.height || menu.offsetHeight || 0, maxH);

  let top = anchorRect.bottom + 2;
  let left = anchorRect.left;

  if (top + menuH > vh - pad) top = anchorRect.top - menuH - 2;
  if (left + menuW > vw - pad) left = vw - pad - menuW;
  if (left < pad) left = pad;
  if (top < pad) top = pad;
  if (top + menuH > vh - pad) top = vh - pad - menuH;

  menu.style.top = `${Math.round(top)}px`;
  menu.style.left = `${Math.round(left)}px`;
  menu.style.visibility = '';
  menu.style.pointerEvents = '';
}

function _msbStatusMenuAnchor(modality: ModalityKey): DOMRect | null {
  const split = document.getElementById(`${modality}-status-split`);
  if (!split) return null;
  const btn = split.querySelector<HTMLElement>('.toolbar-split-unified, .toolbar-split-main');
  return (btn ?? split).getBoundingClientRect();
}
const _msbActivityTimers: Partial<Record<ModalityKey, ReturnType<typeof setTimeout>>> = {};
let _msbListenersBound = false;
let _msbInitAttempts = 0;

export function getModelStatusInfo(modality: ModalityKey) {
  let providerId = '';
  let vendorId = '';
  let modelId = '';
  let modelLabel = '';
  let baseUrl = '';
  let voice = '';
  let isConfigured = false;

  // Primary source: aiApiSettings (persistent routing config)
  try {
    const settings = loadAiApiSettings() as {
      modalities?: Record<
        string,
        { provider?: string; model?: string; modelLabel?: string; baseUrl?: string; vendorId?: string }
      >;
    };
    const m = settings?.modalities?.[modality];
    if (m) {
      if (m.provider) providerId = m.provider;
      if (m.vendorId) vendorId = m.vendorId;
      if (m.model) modelId = m.model;
      if (m.modelLabel) modelLabel = m.modelLabel;
      if (m.baseUrl) baseUrl = m.baseUrl;
      if (modality === 'audio' && typeof (m as any).voice === 'string') voice = (m as any).voice;
    }
  } catch {
    /* noop */
  }

  // Secondary source: SA progress (legacy). Only backfill missing fields.
  try {
    const raw = storageService.getItem(SETUP_PROGRESS_STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      const st = p.state?.[modality];
      if (st) {
        if (!providerId && st.providerId) providerId = st.providerId;
        if (!vendorId && st.vendorId) vendorId = st.vendorId;
        if (!modelId && st.modelId) modelId = st.modelId;
        if (!modelLabel && st.modelLabel) modelLabel = st.modelLabel;
      }
    }
  } catch {
    /* noop */
  }

  const scopeKey = modality === 'llm' ? 'language' : modality;

  // Prefer getApiKey — handles server-masked keys and empty vendorId + provider match
  try {
    const key = getApiKey(scopeKey);
    isConfigured = Boolean(key && String(key).trim().length > 4);
  } catch {
    /* noop */
  }

  if (!isConfigured) {
    try {
      const keys = loadApiKeys();
      if (keys?.vendors?.length) {
        const routingVendorId = (loadAiApiSettings() as { modalities?: Record<string, { vendorId?: string }> })
          ?.modalities?.[modality]?.vendorId;
        const vendor = keys.vendors.find(
          (v: { id?: string; providerId?: string }) =>
            (routingVendorId && v.id === routingVendorId) ||
            (providerId && v.providerId === providerId)
        );
        if (vendor) {
          isConfigured = vendorHasApiKey(vendor);
        }
      }
    } catch {
      /* noop */
    }
  }

  // Fallback: check SA progress for vendors when apiKeys cache is empty
  if (!isConfigured) {
    try {
      const raw = storageService.getItem(SETUP_PROGRESS_STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (Array.isArray(p.vendors)) {
          const vendor = p.vendors.find(
            (v: { id?: string; providerId?: string; apiKey?: string }) =>
              (vendorId && v.id === vendorId) || (providerId && v.providerId === providerId)
          );
          if (vendor) {
            const key = String(vendor.apiKey || '').trim();
            isConfigured = Boolean(key.length > 4 && !/^•+$/.test(key));
          }
        }
      }
    } catch {
      /* noop */
    }
  }

  const hasModelAssignment = Boolean(modelId || modelLabel);

  const providerLabel = _msbProviderLabel(providerId);
  const resolvedModelLabel = _msbModelLabel(providerId, modality, modelId, modelLabel);
  const caps = _msbModelCaps(providerId, modality, modelId);

  // Override provider label with actual vendor name when available
  let resolvedProviderLabel = providerLabel;
  try {
    const raw = storageService.getItem(SETUP_PROGRESS_STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (Array.isArray(p.vendors)) {
        const v = vendorId
          ? p.vendors.find((x: any) => x.id === vendorId)
          : (() => {
              const matches = p.vendors.filter((x: any) => x.providerId === providerId);
              return matches.length === 1 ? matches[0] : null;
            })();
        if (v?.name) resolvedProviderLabel = v.name;
      }
    }
  } catch {
    /* noop */
  }

  return {
    modality,
    providerId,
    vendorId,
    providerLabel: resolvedProviderLabel,
    modelId,
    modelLabel: resolvedModelLabel,
    baseUrl,
    voice,
    caps,
    isConfigured,
    hasModelAssignment,
    isOnline: isConfigured && _msbIsProviderLikelyOnline(providerId),
  };
}

export function _msbProviderLabel(providerId: string): string {
  const found = AI_API_PROVIDERS.find((p) => p.id === providerId);
  if (found) return found.label.split(' (')[0];
  return providerId || 'Unknown';
}

export function _msbModelLabel(
  providerId: string,
  modality: ModalityKey,
  modelId: string,
  storedLabel: string
): string {
  const label = getAiApiModelDisplayLabel(providerId, modality, modelId, storedLabel);
  if (label) return label;
  return modelId || '';
}

export function _msbModelCaps(providerId: string, modality: ModalityKey, modelId: string): string {
  if (!modelId) return '';
  const catalog = AI_API_MODEL_CATALOG as Record<string, any>;
  const prov = catalog[providerId];
  if (!prov) return '';
  const list = (prov[modality] || []) as Array<{ id: string; caps?: unknown }>;
  const entry = list.find((m) => m.id === modelId);
  if (!entry?.caps) return '';
  return formatCapsText(entry.caps);
}

function _msbIsProviderLikelyOnline(providerId: string): boolean {
  return ['fal-ai', 'runway-api', 'luma-api', 'replicate-api', 'generic-rest'].includes(
    providerId
  );
}

function _msbGetAvailableProvidersForModality(modality: ModalityKey) {
  const filtered = listProvidersWithKeyForModality(modality);
  if (filtered.length) return filtered;
  return AI_API_PROVIDERS;
}

type ModalityVendorOption = {
  vendorId: string;
  providerId: string;
  label: string;
};

/** Configured API-key vendors with models for a modality (xAI, Together AI, …). */
export function _msbGetVendorsForModality(modality: ModalityKey): ModalityVendorOption[] {
  const keys = loadApiKeys() as {
    vendors?: Array<{ id: string; name?: string; providerId?: string; apiKey?: string }>;
  };
  const scope = apiScopeForModality(modality);
  const out: ModalityVendorOption[] = [];
  const seen = new Set<string>();
  const seenLabelProvider = new Set<string>();

  for (const v of keys.vendors || []) {
    if (!v?.id || seen.has(v.id)) continue;
    if (!vendorHasKeyForScope(v, scope)) {
      continue;
    }
    if (!vendorHasApiKey(v)) continue;

    const providerId = v.providerId || 'openai-compatible';
    const models = _msbGetAvailableModelsForModality(providerId, modality, v.id).filter(
      (m) => m?.id && !/^custom(-|$)/i.test(m.id)
    );
    if (!models.length) continue;

    seen.add(v.id);
    const name = typeof v.name === 'string' && v.name.trim() ? v.name.trim() : _msbProviderLabel(providerId);
    const labelProviderKey = `${providerId}::${name.toLowerCase()}`;
    if (seenLabelProvider.has(labelProviderKey)) continue;
    seenLabelProvider.add(labelProviderKey);
    out.push({ vendorId: v.id, providerId, label: name });
  }

  return out;
}

export function _msbGetAvailableModelsForModality(providerId: string, modality: ModalityKey, vendorId: string) {
  return mergeRoutingModelOptions(providerId, modality, vendorId) as Array<{ id: string; label: string }>;
}

/** Models valid for one audio sub-capability (tts / sfx / music), not the full audio list. */
function _msbRefreshModalityMenuModels(modality: ModalityKey, vendorId: string): void {
  const vendors = _msbGetVendorsForModality(modality);
  const vendor = vendors.find((v) => v.vendorId === vendorId);
  if (!vendor) return;
  const models = _msbGetAvailableModelsForModality(vendor.providerId, modality, vendorId);
  const modelSel = document.getElementById(`${modality}-status-menu-model`) as HTMLSelectElement | null;
  if (!modelSel) return;
  const info = getModelStatusInfo(modality);
  const selected =
    models.some((m) => m.id === info.modelId) ? info.modelId : models[0]?.id || '';
  modelSel.innerHTML = _msbBuildSelectOptions(
    models,
    selected,
    models.length === 0,
    'No models available'
  );
  modelSel.disabled = !models.length;
}

function _msbSwitchVendorForModality(modality: ModalityKey, vendorId: string): void {
  const vendors = _msbGetVendorsForModality(modality);
  const pick = vendors.find((v) => v.vendorId === vendorId);
  if (!pick) return;

  const settings = loadAiApiSettings();
  if (!settings?.modalities?.[modality]) return;

  const mcfg = settings.modalities[modality];
  const models = _msbGetAvailableModelsForModality(pick.providerId, modality, vendorId);
  const vendorChanged = mcfg.vendorId !== vendorId;
  const keepCurrent =
    !vendorChanged && !!mcfg.model && models.some((m) => m.id === mcfg.model);
  const modelPick = keepCurrent ? models.find((m) => m.id === mcfg.model)! : models[0];

  mcfg.provider = pick.providerId;
  mcfg.vendorId = vendorId;
  mcfg.model = modelPick?.id || '';
  mcfg.modelLabel = modelPick?.label || modelPick?.id || '';
  if (mcfg.fallbackModel === mcfg.model) mcfg.fallbackModel = '';

  saveAiApiSettings(settings);
  updateModelStatusIndicators();
  _msbRefreshModalityMenuModels(modality, vendorId);
}

export function _msbBuildSelectOptions(items: Array<{ id: string; label: string }>, selectedId: string, includeEmpty?: boolean, emptyLabel?: string) {
  let html = '';
  if (includeEmpty) {
    html += `<option value="">${escHtml(emptyLabel || 'None')}</option>`;
  }
  items.forEach((item) => {
    const sel = item.id === selectedId ? ' selected' : '';
    html += `<option value="${escHtml(item.id)}"${sel}>${escHtml(item.label)}</option>`;
  });
  return html;
}

function _msbSwitchProviderForModality(modality: ModalityKey, newProviderId: string) {
  const settings = loadAiApiSettings();
  if (!settings?.modalities?.[modality]) return;

  const mcfg = settings.modalities[modality];
  const oldProvider = mcfg.provider;
  const oldVendorId = mcfg.vendorId || '';

  if (oldProvider === newProviderId && oldVendorId) return;

  // Find available vendors for the new provider
  let newVendorId = '';
  const candidates = apiKeysListCredentialCandidates(newProviderId, modality) || [];
  newVendorId = candidates[0]?.id || '';
  if (!newVendorId) {
    const keys = loadApiKeys();
    const match = keys?.vendors?.find((v: any) => v.providerId === newProviderId && (v.apiKey || '').length > 4);
    if (match) newVendorId = match.id;
  }

  // Pick first model for the new provider
  const models = _msbGetAvailableModelsForModality(newProviderId, modality, newVendorId);
  const newModel = models[0]?.id || '';
  const newModelLabel = models[0]?.label || '';

  mcfg.provider = newProviderId;
  mcfg.vendorId = newVendorId;
  mcfg.model = newModel;
  mcfg.modelLabel = newModelLabel;
  mcfg.fallbackModel = '';

  saveAiApiSettings(settings);
  updateModelStatusIndicators();
  buildModelStatusMenu(modality);
  requestAnimationFrame(() => positionModelStatusMenu(modality));
}

export function _msbSwitchModelForModality(
  modality: ModalityKey,
  newModelId: string,
  context?: { providerId?: string; vendorId?: string }
) {
  const settings = loadAiApiSettings();
  if (!settings?.modalities?.[modality]) return;

  const mcfg = settings.modalities[modality];
  const providerId = context?.providerId || mcfg.provider;
  const vendorId = context?.vendorId || mcfg.vendorId || '';
  const models = _msbGetAvailableModelsForModality(providerId, modality, vendorId);
  const modelEntry = models.find((m) => m.id === newModelId);

  mcfg.provider = providerId;
  mcfg.vendorId = vendorId;
  mcfg.model = newModelId;
  mcfg.modelLabel = modelEntry?.label || newModelId;
  if (modality === 'audio') {
    const voices = _msbGetAudioVoicesForSelection(vendorId, newModelId);
    if (!voices.includes(mcfg.voice || '')) mcfg.voice = voices[0] || '';
  }

  if (mcfg.fallbackModel === newModelId) mcfg.fallbackModel = '';

  saveAiApiSettings(settings);
  updateModelStatusIndicators();
}

export function buildModelStatusMenu(modality: ModalityKey): void {
  const menu = document.getElementById(`${modality}-status-menu`);
  if (!menu) return;
  const info = getModelStatusInfo(modality);
  const modMeta: Record<ModalityKey, { label: string }> = {
    llm: { label: 'Text AI' },
    video: { label: 'Video Generation' },
    image: { label: 'Image / Storyboards' },
    audio: { label: 'Audio (TTS · Music · SFX categories)' },
  };
  const meta = modMeta[modality];

  const statusIcon = info.isOnline
    ? '<i class="fa-solid fa-circle" style="color:#5fcf5f;font-size:8px"></i>'
    : '<i class="fa-solid fa-circle" style="color:#555;font-size:8px"></i>';
  const statusLabel = info.isOnline ? 'Online' : 'Offline';
  const statusClass = info.isOnline ? 'sa-msb-status--online' : 'sa-msb-status--offline';

  // Dropdown selects when credentials exist
  let dropdownSection = '';
  const vendorsForMod = _msbGetVendorsForModality(modality);
  const useVendorPicker = vendorsForMod.length > 0;
  if (info.isConfigured || useVendorPicker) {
    let selectedVendorId = info.vendorId || '';
    let selectedProviderId = info.providerId;
    let models: Array<{ id: string; label: string }> = [];
    let providerSelectItems: Array<{ id: string; label: string }> = [];
    let selectedModelId = info.modelId;
    let providerLabel = 'Provider';

    if (useVendorPicker) {
      const selected =
        vendorsForMod.find((v) => v.vendorId && v.vendorId === info.vendorId) ||
        vendorsForMod.find((v) => v.providerId === info.providerId) ||
        vendorsForMod[0];
      selectedVendorId = selected.vendorId;
      selectedProviderId = selected.providerId;
      models = _msbGetAvailableModelsForModality(selectedProviderId, modality, selectedVendorId);
      selectedModelId = models.some((m) => m.id === info.modelId) ? info.modelId : models[0]?.id || '';
      providerSelectItems = vendorsForMod.map((v) => ({ id: v.vendorId, label: v.label }));
      providerLabel = 'Service provider';
    } else {
      const providers = _msbGetAvailableProvidersForModality(modality);
      models = _msbGetAvailableModelsForModality(info.providerId, modality, info.vendorId);
      const selId = info.vendorId || info.providerId;
      providerSelectItems = providers.map((p) => ({
        id: p.id,
        label: p.id === info.providerId || p.id === selId ? info.providerLabel : p.label.split(' (')[0],
      }));
      selectedVendorId = selId;
      selectedModelId = models.some((m) => m.id === info.modelId) ? info.modelId : models[0]?.id || '';
    }

    dropdownSection = `
      <div class="toolbar-split-menu-sep"></div>
      <div class="sa-msb-menu-section" style="padding:4px 10px;">
        <div style="display:flex;flex-direction:column;gap:6px;">
          <div style="display:flex;flex-direction:column;gap:2px;">
            <label style="font-size:9px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;">${escHtml(providerLabel)}</label>
            <select id="${modality}-status-menu-provider"
                    class="cg-select cg-select--small"
                    data-vendor-picker=${useVendorPicker ? 'true' : 'false'}
                    style="width:100%;font-size:11px;padding:3px 6px;background:#1e1e1e;color:var(--text-main);border:1px solid rgba(255,255,255,0.1);border-radius:4px;"
                    ${providerSelectItems.length ? '' : 'disabled'}>
              ${_msbBuildSelectOptions(providerSelectItems, selectedVendorId)}
            </select>
          </div>
          <div style="display:flex;flex-direction:column;gap:2px;">
            <label style="font-size:9px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;">Model</label>
            <select id="${modality}-status-menu-model"
                    class="cg-select cg-select--small"
                    style="width:100%;font-size:11px;padding:3px 6px;background:#1e1e1e;color:var(--text-main);border:1px solid rgba(255,255,255,0.1);border-radius:4px;"
                    ${models.length ? '' : 'disabled'}>
              ${_msbBuildSelectOptions(models, selectedModelId, models.length === 0, 'No models available')}
            </select>
          </div>
        </div>
      </div>`;
  }

  const audioSubSection = _msbBuildAudioSubmodalitySection(info);

  menu.innerHTML = `
    <div class="sa-msb-menu-section">
      <div class="sa-msb-menu-heading">${escHtml(meta.label)}</div>
    </div>
    <div class="sa-msb-menu-section">
      <div class="sa-msb-status-row ${statusClass}">
        ${statusIcon}
        <span>${statusLabel}</span>
      </div>
    </div>
    ${dropdownSection}
    ${audioSubSection}
    <div class="toolbar-split-menu-sep"></div>
    <button type="button" class="toolbar-split-menu-item" data-msb-action="configure">
      <i class="fa-solid fa-gear" aria-hidden="true"></i> Configure ${escHtml(meta.label)}…
    </button>
    ${
      info.isConfigured
        ? `<button type="button" class="toolbar-split-menu-item" data-msb-action="test-connection">
      <i class="fa-solid fa-plug-circle-check" aria-hidden="true"></i> Test Connection…
    </button>`
        : ''
    }
  `;

  // Attach dropdown listeners
  const provSel = document.getElementById(`${modality}-status-menu-provider`) as HTMLSelectElement | null;
  const modelSel = document.getElementById(`${modality}-status-menu-model`) as HTMLSelectElement | null;
  if (provSel) {
    const vendorPicker = provSel.dataset.vendorPicker === 'true';
    provSel.addEventListener('change', () => {
      if (!provSel.value) return;
      if (vendorPicker) {
        _msbSwitchVendorForModality(modality, provSel.value);
      } else {
        _msbSwitchProviderForModality(modality, provSel.value);
        buildModelStatusMenu(modality);
        requestAnimationFrame(() => positionModelStatusMenu(modality));
      }
    });
  }
  modelSel?.addEventListener('change', () => {
    const providerValue = provSel?.value || '';
    const vendorPicker = provSel?.dataset.vendorPicker === 'true';
    if (vendorPicker) {
      const vendors = _msbGetVendorsForModality(modality);
      const selectedVendor = vendors.find((v) => v.vendorId === providerValue);
      _msbSwitchModelForModality(modality, modelSel.value, {
        providerId: selectedVendor?.providerId,
        vendorId: selectedVendor?.vendorId,
      });
      return;
    }
    _msbSwitchModelForModality(modality, modelSel.value, {
      providerId: providerValue || undefined,
      vendorId: providerValue || undefined,
    });
  });

  const configureBtn = menu.querySelector<HTMLButtonElement>('[data-msb-action="configure"]');
  configureBtn?.addEventListener('click', () => {
    openModelStatusConfig(modality);
    closeAllModelStatusMenus();
  });

  const testBtn = menu.querySelector<HTMLButtonElement>('[data-msb-action="test-connection"]');
  testBtn?.addEventListener('click', () => {
    testModelStatusConnection(modality);
    closeAllModelStatusMenus();
  });
}

export function openModelStatusConfig(modality: ModalityKey): void {
  void openAiProvidersModal(modality);
}

export function testModelStatusConnection(modality: ModalityKey): void {
  openModelStatusConfig(modality);
}

function getStatusSplit(modality: ModalityKey): CgToolbarSplit | null {
  return document.getElementById(`${modality}-status-split`) as CgToolbarSplit | null;
}

export function openModelStatusMenu(modality: ModalityKey): void {
  closeAllModelStatusMenus();
  buildModelStatusMenu(modality);
  const split = getStatusSplit(modality);
  split?.openMenu();
  requestAnimationFrame(() => positionModelStatusMenu(modality));
}

export function closeModelStatusMenu(modality: ModalityKey): void {
  getStatusSplit(modality)?.closeMenu();
}

export function closeAllModelStatusMenus(): void {
  MODEL_STATUS_MODALITIES.forEach((mod) => closeModelStatusMenu(mod.key));
  AUDIO_SUB_MODALITIES.forEach((sub) => closeAudioSubmodalityMenu(sub.key));
}

export function toggleModelStatusMenu(modality: ModalityKey): void {
  const split = getStatusSplit(modality);
  if (!split) return;
  if (split.isOpen) closeModelStatusMenu(modality);
  else openModelStatusMenu(modality);
}

export function repositionOpenModelStatusMenus(): void {
  MODEL_STATUS_MODALITIES.forEach((mod) => {
    const menu = document.getElementById(`${mod.key}-status-menu`);
    if (menu && !menu.hidden) positionModelStatusMenu(mod.key);
  });
  AUDIO_SUB_MODALITIES.forEach((sub) => {
    const menu = document.getElementById(`audio-${sub.key}-menu`);
    if (menu && !menu.hidden) positionAudioSubmodalityMenu(sub.key);
  });
}

export function positionModelStatusMenu(modality: ModalityKey): void {
  const menu = document.getElementById(`${modality}-status-menu`);
  const anchorRect = _msbStatusMenuAnchor(modality);
  if (!menu || !anchorRect) return;
  _msbPositionFixedMenu(anchorRect, menu);
}

export function _msbApplyIndicatorDot(
  dot: HTMLElement | null,
  hasModel: boolean,
  options: { active?: boolean } = {}
): void {
  if (!dot) return;
  dot.classList.remove(
    'sa-status-indicator--offline',
    'sa-status-indicator--online',
    'sa-status-indicator--error',
    'sa-status-indicator--active'
  );
  if (options.active) {
    dot.classList.add('sa-status-indicator--active');
    return;
  }
  if (hasModel) {
    dot.classList.add('sa-status-indicator--online');
  } else {
    dot.classList.add('sa-status-indicator--error');
  }
}

export function updateModelStatusIndicators(): void {
  MODEL_STATUS_MODALITIES.forEach((mod) => {
    const info = getModelStatusInfo(mod.key);
    const dot = document.getElementById(`${mod.key}-status-indicator`);
    const modalityEl = document.getElementById(`${mod.key}-status-modality`);
    const modelEl = document.getElementById(`${mod.key}-status-model`);
    const split = document.getElementById(`${mod.key}-status-split`);
    const mainBtn = split?.querySelector<HTMLElement>(
      '.toolbar-split-unified, .toolbar-split-main'
    );

    _msbApplyIndicatorDot(dot, info.hasModelAssignment);

    if (modalityEl) modalityEl.textContent = mod.label;

    if (modelEl) {
      if (info.modelLabel) modelEl.textContent = info.modelLabel;
      else if (info.modelId) modelEl.textContent = info.modelId;
      else modelEl.textContent = 'Not set';
    }

    if (mainBtn) {
      const modelPart = info.modelLabel || info.modelId || 'not set';
      mainBtn.title = info.hasModelAssignment
        ? `${mod.label}: ${info.providerLabel} — ${modelPart}`
        : `${mod.label}: no model set`;
    }
  });
}

export function triggerModelActivityBlink(modality: ModalityKey): void {
  const dot = document.getElementById(`${modality}-status-indicator`);
  if (!dot) return;

  if (_msbActivityTimers[modality]) {
    clearTimeout(_msbActivityTimers[modality]);
  }

  dot.classList.remove(
    'sa-status-indicator--offline',
    'sa-status-indicator--online',
    'sa-status-indicator--error'
  );
  dot.classList.add('sa-status-indicator--active');

  _msbActivityTimers[modality] = setTimeout(() => {
    const info = getModelStatusInfo(modality);
    _msbApplyIndicatorDot(dot, info.hasModelAssignment);
    _msbActivityTimers[modality] = undefined;
  }, SA_ACTIVITY_BLINK_MS);
}

export function updateSetupIncompleteStatus(): void {
  const container = document.getElementById('setup-status-item');
  if (!container) return;
  const incomplete = !readSetupCompleteFlag(storageService, SETUP_COMPLETE_STORAGE_KEY);
  container.hidden = !incomplete;
}

/* ── Save status indicator (P0 — server-backed autosave) ───────────────────── */
/** Updates the compact save-status badge in the status bar.
 *  States follow the visual language of status-mode-badge / project-status-badge in the styleguide.
 */
export function updateSaveStatus(state: 'idle' | 'saving' | 'saved' | 'error', detail = ''): void {
  const badge = document.getElementById('save-status-badge');
  if (!badge) return;

  badge.className = `save-status-badge save-status-${state}`;
  let html = '';
  if (state === 'saving') {
    html = '<i class="fa-solid fa-spinner fa-spin" style="margin-right:3px"></i>Saving…';
  } else if (state === 'saved') {
    html = '<i class="fa-solid fa-check" style="margin-right:3px"></i>Saved';
  } else if (state === 'error') {
    html = '<i class="fa-solid fa-exclamation-triangle" style="margin-right:3px"></i>Save failed';
  } else {
    html = '';
  }
  badge.innerHTML = html;
  badge.title = detail || (state === 'saved' ? 'All changes written to server-resident project' : state === 'error' ? 'See console for details' : '');
}

export function initModelStatusBar(): void {
  const mainReady = MODEL_STATUS_MODALITIES.every((mod) => {
    return (
      document.getElementById(`${mod.key}-status-split`) &&
      document.getElementById(`${mod.key}-status-model`) &&
      document.getElementById(`${mod.key}-status-indicator`)
    );
  });
  const audioReady =
    document.getElementById('audio-subs-split') &&
    AUDIO_SUB_MODALITIES.every((sub) => Boolean(document.getElementById(`${sub.key}-status-indicator`)));
  const ready = mainReady && audioReady;

  if (!ready) {
    _msbInitAttempts += 1;
    if (_msbInitAttempts <= 20) {
      requestAnimationFrame(() => initModelStatusBar());
    }
    return;
  }

  _msbInitAttempts = 0;
  MODEL_STATUS_MODALITIES.forEach((mod) => buildModelStatusMenu(mod.key));
  AUDIO_SUB_MODALITIES.forEach((sub) => buildAudioSubmodalityMenu(sub.key));

  if (!_msbListenersBound) {
    _msbListenersBound = true;
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const inToolbar = target.closest('cg-toolbar-split.toolbar-split--status-bar');
      const inSegmented = target.closest('cg-segmented-split.cg-segmented-split--status-bar');
      if (!inToolbar && !inSegmented) {
        closeAllModelStatusMenus();
      }
    });

    window.addEventListener('scroll', closeAllModelStatusMenus, { passive: true });
    window.addEventListener('resize', repositionOpenModelStatusMenus);
  }

  updateModelStatusIndicators();
  updateAudioSubmodalityIndicators();
  updateSetupIncompleteStatus();
  updateSaveStatus('idle');
  console.log('CineGen: model status bar initialized');
}

export function installStatusBarGlobals(): void {
  window.CineGen = window.CineGen || {};
  window.CineGen.triggerModelActivityBlink = triggerModelActivityBlink;
}
