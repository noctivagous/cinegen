import type { ModalityKey } from '@/types/globals';
import { escHtml } from '@/utils/html';
import {
  loadAiApiSettings,
  saveAiApiSettings,
  openAiProvidersModal,
} from '@/settings/ai-api-settings-bundle';
import {
  loadApiKeys,
  vendorHasApiKey,
} from '@/settings/api-keys-settings-bundle';
import {
  getCachedAudioModelsByCapability,
  getCachedVoicesForVendorAudioModel,
  modelMatchesAudioCapability,
  mergeRoutingModelOptions,
} from '@/services/provider-model-catalog';
import { AI_API_MODEL_CATALOG } from '@/settings/ai-api-settings-bundle';
import {
  getModelStatusInfo,
  _msbBuildSelectOptions,
  _msbProviderLabel,
  _msbGetVendorsForModality,
  _msbGetAvailableModelsForModality,
  _msbSwitchModelForModality,
  _msbPositionFixedMenu,
  _msbApplyIndicatorDot,
  updateModelStatusIndicators,
  openModelStatusConfig,
  testModelStatusConnection,
  closeAllModelStatusMenus,
  AUDIO_SUB_MODALITIES,
  MSB_AUDIO_SUB_EXCLUDED_MODEL_IDS,
  MODEL_STATUS_MENU_PAD,
} from '@/services/status-bar-service';

// ==================== AUDIO DATA QUERIES ====================

function _msbGetAudioSubTypes(providerId: string, modelId: string): string[] {
  if (!modelId || !providerId) return [];
  const catalog = AI_API_MODEL_CATALOG as Record<string, any>;
  const prov = catalog[providerId];
  if (!prov) return [];
  const list = prov.audio || [];
  const entry = list.find((m: any) => m.id === modelId);
  const types = (entry as any)?.caps?.types;
  if (!Array.isArray(types)) return [];
  return types;
}

export function _msbBuildAudioSubmodalitySection(info: ReturnType<typeof getModelStatusInfo>): string {
  if (info.modality !== 'audio') return '';
  const subTypes = _msbGetAudioSubTypes(info.providerId, info.modelId);
  const hasModel = info.isConfigured && !!info.modelId;
  const rows = [
    { key: 'tts', label: 'TTS' },
    { key: 'music', label: 'Music' },
    { key: 'sfx', label: 'SFX' },
  ];
  const rowHtml = rows
    .map((r) => {
      const available = hasModel && subTypes.includes(r.key);
      const dotClass = available
        ? 'sa-msb-submodality-dot--available'
        : 'sa-msb-submodality-dot--unavailable';
      const value = available ? 'Available' : 'Not supported';
      return `
      <div class="sa-msb-submodality-row">
        <span class="sa-msb-submodality-dot ${dotClass}"></span>
        <span class="sa-msb-submodality-label">${escHtml(r.label)}</span>
        <span class="sa-msb-submodality-value">${escHtml(value)}</span>
      </div>`;
    })
    .join('');
  return `
    <div class="toolbar-split-menu-sep"></div>
    <div class="sa-msb-menu-section">
      <div class="sa-msb-menu-heading">Sub-modalities</div>
      ${rowHtml}
    </div>`;
}

function _msbGetAudioModelsForSubCapability(
  providerId: string,
  vendorId: string,
  subType: string
): Array<{ id: string; label: string }> {
  if (vendorId) {
    const cached = getCachedAudioModelsByCapability(vendorId, subType);
    if (cached.length) {
      return cached.filter((m: { id: string }) => !MSB_AUDIO_SUB_EXCLUDED_MODEL_IDS.has(m.id));
    }
  }

  const catalog = AI_API_MODEL_CATALOG as Record<string, any>;
  const catalogAudio = catalog?.[providerId]?.audio as
    | Array<{ id: string; label?: string; caps?: { types?: string[] } }>
    | undefined;

  const all = _msbGetAvailableModelsForModality(providerId, 'audio', vendorId);
  const seen = new Set<string>();
  const out: Array<{ id: string; label: string }> = [];

  for (const m of all) {
    if (!m?.id || seen.has(m.id) || MSB_AUDIO_SUB_EXCLUDED_MODEL_IDS.has(m.id)) continue;
    const entry = catalogAudio?.find((c) => c.id === m.id);
    if (entry?.caps?.types?.length) {
      if (!entry.caps.types.includes(subType)) continue;
    } else if (!modelMatchesAudioCapability({ id: m.id, label: m.label }, subType, providerId)) {
      continue;
    }
    seen.add(m.id);
    out.push({ id: m.id, label: m.label || entry?.label || m.id });
  }

  return out;
}

function _msbResolveVendorForAudioProvider(providerId: string, preferredVendorId = ''): string {
  const keys = loadApiKeys() as { vendors?: Array<{ id: string; providerId?: string; apiKey?: string }> };
  const vendors = (keys.vendors || []).filter((v) => v.providerId === providerId);
  if (preferredVendorId && vendors.some((v) => v.id === preferredVendorId)) {
    return preferredVendorId;
  }
  const withKey = vendors.find((v) => vendorHasApiKey(v));
  return withKey?.id || vendors[0]?.id || '';
}

type AudioVendorOption = {
  vendorId: string;
  providerId: string;
  label: string;
};

function _msbGetAudioVendorsForSubCapability(subType: string): AudioVendorOption[] {
  const keys = loadApiKeys() as {
    vendors?: Array<{ id: string; name?: string; providerId?: string; apiKey?: string }>;
  };
  const out: AudioVendorOption[] = [];
  const seen = new Set<string>();

  for (const v of keys.vendors || []) {
    if (!v?.id || seen.has(v.id)) continue;
    if (!vendorHasApiKey(v)) continue;

    const providerId = v.providerId || 'openai-compatible';
    const models = _msbGetAudioModelsForSubCapability(providerId, v.id, subType);
    if (!models.length) continue;

    seen.add(v.id);
    const name = typeof v.name === 'string' && v.name.trim() ? v.name.trim() : _msbProviderLabel(providerId);
    out.push({ vendorId: v.id, providerId, label: name });
  }

  return out;
}

// ==================== AUDIO MUTATION ====================

function _msbSwitchAudioVendorForSub(
  providerId: string,
  vendorId: string,
  subType: string
): void {
  const settings = loadAiApiSettings();
  if (!settings?.modalities?.audio) return;

  const mcfg = settings.modalities.audio;
  const models = _msbGetAudioModelsForSubCapability(providerId, vendorId, subType);
  const vendorChanged = mcfg.vendorId !== vendorId;
  const keepCurrent =
    !vendorChanged && !!mcfg.model && models.some((m) => m.id === mcfg.model);
  const pick = keepCurrent ? models.find((m) => m.id === mcfg.model)! : models[0];

  mcfg.provider = providerId;
  mcfg.vendorId = vendorId;
  mcfg.model = pick?.id || '';
  mcfg.modelLabel = pick?.label || pick?.id || '';
  const voices = _msbGetAudioVoicesForSelection(vendorId, mcfg.model || '');
  if (!voices.includes(mcfg.voice || '')) mcfg.voice = voices[0] || '';
  if (mcfg.fallbackModel === mcfg.model) mcfg.fallbackModel = '';

  saveAiApiSettings(settings);
  updateModelStatusIndicators();
  updateAudioSubmodalityIndicators();
}

function _msbRefreshAudioSubMenuModels(subType: string, vendorId: string, providerId: string): void {
  const models = _msbGetAudioModelsForSubCapability(providerId, vendorId, subType);
  const modelSel = document.getElementById(`audio-sub-${subType}-menu-model`) as HTMLSelectElement | null;
  if (!modelSel) return;
  const info = getModelStatusInfo('audio');
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

export function _msbGetAudioVoicesForSelection(vendorId: string, modelId: string): string[] {
  if (!vendorId || !modelId) return [];
  return getCachedVoicesForVendorAudioModel(vendorId, modelId);
}

function _msbRefreshAudioSubMenuVoices(subType: string, vendorId: string): void {
  const modelSel = document.getElementById(`audio-sub-${subType}-menu-model`) as HTMLSelectElement | null;
  const voiceSel = document.getElementById(`audio-sub-${subType}-menu-voice`) as HTMLSelectElement | null;
  if (!modelSel || !voiceSel) return;
  const info = getModelStatusInfo('audio');
  const modelId = modelSel.value || info.modelId || '';
  const voices = _msbGetAudioVoicesForSelection(vendorId, modelId);
  const selected = voices.includes((info as any).voice || '') ? (info as any).voice : (voices[0] || '');
  voiceSel.innerHTML = _msbBuildSelectOptions(
    voices.map((v) => ({ id: v, label: v })),
    selected,
    true,
    voices.length ? 'Auto (provider default)' : 'No fetched voices'
  );
  voiceSel.disabled = voices.length === 0;
}

function _msbSwitchAudioVoice(voice: string): void {
  const settings = loadAiApiSettings();
  if (!settings?.modalities?.audio) return;
  settings.modalities.audio.voice = voice || '';
  saveAiApiSettings(settings);
}

// ==================== AUDIO STATUS ====================

function _msbAudioSubStatus(subType: string): { configured: boolean; available: boolean } {
  const info = getModelStatusInfo('audio');
  if (!info.isConfigured) return { configured: false, available: false };
  const currentSupports = _msbGetAudioSubTypes(info.providerId, info.modelId).includes(subType);
  const anyProviderSupports = _msbGetAudioVendorsForSubCapability(subType).length > 0;
  return { configured: true, available: currentSupports || anyProviderSupports };
}

function _msbAudioSubHasModel(subType: string): boolean {
  const info = getModelStatusInfo('audio');
  if (!info.modelId && !info.modelLabel) return false;
  if (!info.modelId) return true;
  const subTypes = _msbGetAudioSubTypes(info.providerId, info.modelId);
  return subTypes.includes(subType);
}

// ==================== AUDIO MENU BUILDING ====================

export function updateAudioSubmodalityIndicators(): void {
  for (const sub of AUDIO_SUB_MODALITIES) {
    const split = document.getElementById('audio-subs-split') as any;
    if (!split) return;
    const seg = (split as Element).querySelector(`.cg-segmented-split-segment[data-sub-key="${sub.key}"]`) as HTMLElement | null;
    if (!seg) continue;
    const label = seg.querySelector('.cg-segmented-split-segment-label');
    if (label) label.textContent = sub.label;
    const dot = seg.querySelector('.sa-status-indicator') as HTMLElement | null;
    const hasModel = _msbAudioSubHasModel(sub.key);
    _msbApplyIndicatorDot(dot, hasModel);
  }
}

export function buildAudioSubmodalityMenu(subType: string): void {
  const split = document.getElementById('audio-subs-split') as any;
  if (!split) return;
  const menu = split.querySelector(`.cg-segmented-split-menu[data-key="${subType}"]`) as HTMLElement | null;
  if (!menu) return;
  const info = getModelStatusInfo('audio');
  const subMeta: Record<string, { label: string }> = {
    tts: { label: 'Text-to-Speech' },
    sfx: { label: 'Sound Effects' },
    music: { label: 'Music Generation' },
  };
  const meta = subMeta[subType] || { label: subType.toUpperCase() };

  const subStatus = _msbAudioSubStatus(subType);
  const statusIcon = subStatus.available
    ? '<i class="fa-solid fa-circle" style="color:#5fcf5f;font-size:8px"></i>'
    : '<i class="fa-solid fa-circle" style="color:#555;font-size:8px"></i>';
  const statusLabel = subStatus.available ? 'Available' : 'Not supported';
  const statusClass = subStatus.available ? 'sa-msb-status--online' : 'sa-msb-status--offline';

  let dropdownSection = '';
  const vendorsForSub = _msbGetAudioVendorsForSubCapability(subType);
  if (info.isConfigured && vendorsForSub.length > 0) {
    let selectedVendor =
      vendorsForSub.find((v) => v.vendorId && v.vendorId === info.vendorId) ||
      vendorsForSub.find((v) => v.providerId === info.providerId) ||
      vendorsForSub[0];
    const selectedVendorId = selectedVendor.vendorId;
    const models = _msbGetAudioModelsForSubCapability(
      selectedVendor.providerId,
      selectedVendorId,
      subType
    );
    const selectedModelId = models.some((m) => m.id === info.modelId) ? info.modelId : models[0]?.id || '';
    const voices = _msbGetAudioVoicesForSelection(selectedVendorId, selectedModelId);
    const selectedVoice = voices.includes((info as any).voice || '') ? (info as any).voice : (voices[0] || '');
    const vendorSelectItems = vendorsForSub.map((v) => ({ id: v.vendorId, label: v.label }));
    dropdownSection = `
      <div class="toolbar-split-menu-sep"></div>
      <div class="sa-msb-menu-section" style="padding:4px 10px;">
        <div style="display:flex;flex-direction:column;gap:6px;">
          <div style="display:flex;flex-direction:column;gap:2px;">
            <label style="font-size:9px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;">Service provider</label>
            <select id="audio-sub-${subType}-menu-provider"
                    class="cg-select cg-select--small"
                    style="width:100%;font-size:11px;padding:3px 6px;background:#1e1e1e;color:var(--text-main);border:1px solid rgba(255,255,255,0.1);border-radius:4px;"
                    >
              ${_msbBuildSelectOptions(vendorSelectItems, selectedVendorId)}
            </select>
          </div>
          <div style="display:flex;flex-direction:column;gap:2px;">
            <label style="font-size:9px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;">Model</label>
            <select id="audio-sub-${subType}-menu-model"
                    class="cg-select cg-select--small"
                    style="width:100%;font-size:11px;padding:3px 6px;background:#1e1e1e;color:var(--text-main);border:1px solid rgba(255,255,255,0.1);border-radius:4px;"
                    ${models.length ? '' : 'disabled'}>
              ${_msbBuildSelectOptions(models, selectedModelId, models.length === 0, 'No models available')}
            </select>
          </div>
          <div style="display:flex;flex-direction:column;gap:2px;">
            <label style="font-size:9px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;">Voice</label>
            <select id="audio-sub-${subType}-menu-voice"
                    class="cg-select cg-select--small"
                    style="width:100%;font-size:11px;padding:3px 6px;background:#1e1e1e;color:var(--text-main);border:1px solid rgba(255,255,255,0.1);border-radius:4px;"
                    ${voices.length ? '' : 'disabled'}>
              ${_msbBuildSelectOptions(
                voices.map((v) => ({ id: v, label: v })),
                selectedVoice,
                true,
                voices.length ? 'Auto (provider default)' : 'No fetched voices'
              )}
            </select>
          </div>
        </div>
      </div>`;
  } else if (info.isConfigured && vendorsForSub.length === 0) {
    dropdownSection = `
      <div class="toolbar-split-menu-sep"></div>
      <div class="sa-msb-menu-section" style="padding:6px 10px;font-size:11px;color:var(--text-dim);">
        No configured provider offers ${escHtml(meta.label.toLowerCase())}.
        Add one in <strong>Settings \u2192 AI Providers</strong> (e.g. ElevenLabs, Suno).
      </div>`;
  }

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
    <div class="toolbar-split-menu-sep"></div>
    <button type="button" class="toolbar-split-menu-item" data-msb-action="configure-audio">
      <i class="fa-solid fa-gear" aria-hidden="true"></i> Configure Audio\u2026
    </button>
    ${info.isConfigured ? `<button type="button" class="toolbar-split-menu-item" data-msb-action="test-audio-connection">
      <i class="fa-solid fa-plug-circle-check" aria-hidden="true"></i> Test Connection\u2026
    </button>` : ''}
  `;

  const provSel = document.getElementById(`audio-sub-${subType}-menu-provider`) as HTMLSelectElement | null;
  const modelSel = document.getElementById(`audio-sub-${subType}-menu-model`) as HTMLSelectElement | null;
  const voiceSel = document.getElementById(`audio-sub-${subType}-menu-voice`) as HTMLSelectElement | null;
  if (provSel) {
    provSel.addEventListener('change', () => {
      const pick = vendorsForSub.find((v) => v.vendorId === provSel.value);
      if (!pick) return;
      _msbSwitchAudioVendorForSub(pick.providerId, pick.vendorId, subType);
      _msbRefreshAudioSubMenuModels(subType, pick.vendorId, pick.providerId);
      _msbRefreshAudioSubMenuVoices(subType, pick.vendorId);
    });
  }
  modelSel?.addEventListener('change', () => {
    _msbSwitchModelForModality('audio', modelSel.value);
    const vendorId = provSel?.value || info.vendorId || '';
    _msbRefreshAudioSubMenuVoices(subType, vendorId);
    updateAudioSubmodalityIndicators();
  });
  voiceSel?.addEventListener('change', () => {
    _msbSwitchAudioVoice(voiceSel.value);
  });

  const configureBtn = menu.querySelector<HTMLButtonElement>('[data-msb-action="configure-audio"]');
  configureBtn?.addEventListener('click', () => {
    openModelStatusConfig('audio');
    closeAllModelStatusMenus();
  });

  const testBtn = menu.querySelector<HTMLButtonElement>('[data-msb-action="test-audio-connection"]');
  testBtn?.addEventListener('click', () => {
    testModelStatusConnection('audio');
    closeAllModelStatusMenus();
  });
}

export function positionAudioSubmodalityMenu(subType: string): void {
  const split = document.getElementById('audio-subs-split');
  const menu = split?.querySelector(`.cg-segmented-split-menu[data-key="${subType}"]`) as HTMLElement | null;
  if (!split || !menu) return;

  const seg = split.querySelector<HTMLElement>(
    `.cg-segmented-split-segment[data-sub-key="${subType}"]`
  );
  const anchorRect = (seg ?? split).getBoundingClientRect();
  _msbPositionFixedMenu(anchorRect, menu);
}

export function closeAudioSubmodalityMenu(subType: string): void {
  const split = document.getElementById('audio-subs-split') as any;
  if (split && typeof split._closeAllMenus === 'function') {
    split._closeAllMenus();
  }
  const menu = split?.querySelector(`.cg-segmented-split-menu[data-key="${subType}"]`) as HTMLElement | null;
  if (menu) menu.hidden = true;
}
