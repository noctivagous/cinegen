// @ts-nocheck — legacy port from setupAssistant.js (Wave E).
import { escHtml } from '@/utils/html';
import { ROUTING_MODALITIES, MODALITY_META } from '@/setup-assistant/sa-wizard-constants';
import { saVendorHasKey, saVendorById, saVendorsWithKeys, saManualVendors, saIsSlotActive, saFindVendorForSlot, saNormalizeVendorsToSlots, saModalityIsRequired, saCoverageSatisfied, saRequiredModelsAssigned } from '@/setup-assistant/setup-assistant-state';
import { saGetCatalogModels, saMergeModels, saStatusHtml, saResolveModelLabel, saModelCaps } from '@/setup-assistant/connection-test';
import { PROVIDERS_BY_MODALITY, SA_PROVIDER_CATALOG, getSaProviderSlots } from '@/data/provider-catalog';

export interface TemplateDeps {
  state: any;
  activeProviderSlots: Set<string>;
  findVendorForSlot: (slot: string) => any;
  isSlotActive: (slotId: string) => boolean;
  manualVendors: () => any[];
  normalizeVendorsToSlots: () => void;
  vendorById: (vendorId: string) => any;
  vendorsWithKeys: () => any[];
  modalityIsRequired: (mod: string) => boolean;
  requiredModelsAssigned: () => boolean;
  coverageSatisfied: () => boolean;
  loadProviderModelCatalog: () => any;
  modelMatchesAudioCapability: (m: any, capability: string, providerId: string) => boolean;
  providerLabel: (id: string) => string;
  catalogChipsForVendor: (vendor: any) => string;
  vendorHasAnyModalityCatalog: (vendor: any) => boolean;
  modalityChipLabel: (mod: string) => string;
  providerKeyPlaceholder: (v: any) => string;
  applyVendorApiUrl: (vendor: any, input: any, label: string) => boolean;
  needsProviderApiUrl: (id: string) => boolean;
}

export function tmplWelcome(): string {
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

export function saWizardProviderOptions(selectedId: string): string {
  const opts = typeof (window as any).AI_API_PROVIDERS !== 'undefined'
    ? (window as any).AI_API_PROVIDERS.map((p: any) => ({ id: p.id, label: p.label }))
    : [{ id: 'openai-compatible', label: 'OpenAI-compatible' }];
  return opts.map((p: any) =>
    `<option value="${escHtml(p.id)}"${p.id === selectedId ? ' selected' : ''}>${escHtml(p.label)}</option>`
  ).join('');
}

export function providerRowStatus(v: any, deps: TemplateDeps): string {
  const hasKey = saVendorHasKey(v);
  if (v?.status === 'testing') {
    return '<span class="sa-prov-status sa-prov-status--testing"><i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Testing…</span>';
  }
  const chips = deps.catalogChipsForVendor(v);
  if (chips) return chips;
  if (v?.status === 'err') {
    const msg = (v.statusMsg || 'Test failed').slice(0, 50);
    return `<span class="sa-prov-status sa-prov-status--err" title="${escHtml(v.statusMsg || 'Test failed')}">${escHtml(msg)}</span>`;
  }
  if (v?.status === 'ok' || v?.status === 'ratelimit') return '<span class="sa-prov-status sa-prov-status--ok">Connected</span>';
  if (hasKey) return '<span class="sa-prov-status sa-prov-status--pending">Saved — not tested</span>';
  return '';
}

export function modalityChipLabel(mod: string): string {
  return { llm: 'Text', video: 'Video', image: 'Image', audio: 'Audio' }[mod] || mod;
}

export function catalogChipsForVendor(vendor: any, deps: TemplateDeps): string {
  if (!vendor?.id || typeof (window as any).loadProviderModelCatalog !== 'function') return '';
  const catalog = (window as any).loadProviderModelCatalog();
  const vc = catalog?.vendors?.[vendor.id];
  if (!vc?.modalities) return '';
  const countAudioCapability = (capability: string) => {
    const audioMod = vc.modalities?.audio;
    if (!audioMod?.models?.length) return 0;
    if (audioMod.status !== 'ok' && audioMod.status !== 'ratelimit') return 0;
    const providerId = vc.providerId || '';
    const matchFn = typeof (window as any).modelMatchesAudioCapability === 'function'
      ? (m: any) => (window as any).modelMatchesAudioCapability(m, capability, providerId)
      : (m: any) => {
          const text = `${m.label || ''} ${m.id || ''}`.toLowerCase();
          const kw: Record<string, string[]> = { tts: ['tts', 'speech', 'voice'], sfx: ['sfx', 'sound', 'effect'], music: ['music', 'song'] };
          return (kw[capability] || []).some((k) => text.includes(k));
        };
    return audioMod.models.filter(matchFn).length;
  };
  const chips = ROUTING_MODALITIES
    .filter((mod) => {
      const mc = vc.modalities[mod];
      return mc && (mc.status === 'ok' || mc.status === 'ratelimit') && mc.models?.length > 0;
    })
    .map((mod) => {
      if (mod === 'audio') {
        const ttsCount = countAudioCapability('tts');
        const sfxCount = countAudioCapability('sfx');
        const musicCount = countAudioCapability('music');
        const subChips = [
          ttsCount > 0 ? `<span class="sa-prov-mod-subchip sa-prov-mod-subchip--tts">TTS (${ttsCount})</span>` : '',
          sfxCount > 0 ? `<span class="sa-prov-mod-subchip sa-prov-mod-subchip--sfx">SFX (${sfxCount})</span>` : '',
          musicCount > 0 ? `<span class="sa-prov-mod-subchip sa-prov-mod-subchip--music">Music (${musicCount})</span>` : ''
        ].join('');
        return `<span class="sa-prov-mod-chip sa-prov-mod-chip--${mod}">${escHtml(deps.modalityChipLabel(mod))}${subChips}</span>`;
      }
      return `<span class="sa-prov-mod-chip sa-prov-mod-chip--${mod}">${escHtml(deps.modalityChipLabel(mod))}</span>`;
    })
    .join('');
  return chips ? `<span class="sa-prov-mod-chips">${chips}</span>` : '';
}

export function vendorHasAnyModalityCatalog(vendor: any): boolean {
  if (!vendor?.id || typeof (window as any).loadProviderModelCatalog !== 'function') return false;
  const catalog = (window as any).loadProviderModelCatalog();
  const vc = catalog?.vendors?.[vendor.id];
  if (!vc?.modalities) return false;
  return ROUTING_MODALITIES.some((mod) => {
    const mc = vc.modalities[mod];
    return mc && (mc.status === 'ok' || mc.status === 'ratelimit') && mc.models?.length > 0;
  });
}

export function tmplProviderModalityChipBar(deps: TemplateDeps): string {
  const catalog = typeof (window as any).loadProviderModelCatalog === 'function' ? (window as any).loadProviderModelCatalog() : null;
  const vendors = deps.state?.vendors || [];
  const countAudioCapability = (capability: string) => {
    return vendors.filter((v: any) => {
      const audioMod = catalog?.vendors?.[v.id]?.modalities?.audio;
      if (!audioMod || !audioMod.models?.length) return false;
      if (audioMod.status !== 'ok' && audioMod.status !== 'ratelimit') return false;
      const providerId = catalog?.vendors?.[v.id]?.providerId || '';
      const matchFn = typeof (window as any).modelMatchesAudioCapability === 'function'
        ? (m: any) => (window as any).modelMatchesAudioCapability(m, capability, providerId)
        : (m: any) => {
            const text = `${m.label || ''} ${m.id || ''}`.toLowerCase();
            const kw: Record<string, string[]> = { tts: ['tts', 'speech', 'voice'], sfx: ['sfx', 'sound', 'effect'], music: ['music', 'song'] };
            return (kw[capability] || []).some((k) => text.includes(k));
          };
      return audioMod.models.some(matchFn);
    }).length;
  };
  const chips = ROUTING_MODALITIES.map((mod) => {
    const meta = MODALITY_META[mod];
    const coveredVendors = vendors.filter((v: any) => {
      const mc = catalog?.vendors?.[v.id]?.modalities?.[mod];
      return mc && (mc.status === 'ok' || mc.status === 'ratelimit') && mc.models?.length > 0;
    });
    const covered = coveredVendors.length > 0;
    const count = coveredVendors.length;
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
      const mainLabel = `${escHtml(deps.modalityChipLabel(mod))} (${count})`;
      return `<span class="${cls}" title="${escHtml(meta.label)} (${count})">${icon}${mainLabel}${subChips}</span>`;
    }
    const cls = `sa-prov-top-chip sa-prov-top-chip--${mod}${covered ? ' sa-prov-top-chip--covered' : ''}`;
    const icon = covered ? '<i class="fa-solid fa-circle-check" aria-hidden="true"></i> ' : '';
    const countLabel = ` (${count})`;
    return `<span class="${cls}" title="${escHtml(meta.label)}${countLabel}">${icon}${escHtml(deps.modalityChipLabel(mod))}${countLabel}</span>`;
  }).join('');
  return `<div class="sa-prov-chip-bar" aria-label="Modality coverage"><span class="sa-prov-chip-bar-label">Providers:</span>${chips}</div>`;
}

export function providerKeyPlaceholder(v: any): string {
  const key = String(v?.apiKey || '').trim();
  if (key.length > 4) return `Saved (…${key.slice(-4)})`;
  if (v?.hasServerKey) return 'Key saved on server';
  return 'Paste API key';
}

export function needsProviderApiUrl(providerId: string): boolean {
  return providerId === 'generic-rest';
}

export function normalizeApiUrl(url: string): string {
  return String(url || '').trim().replace(/\/+$/, '');
}

export function validateApiUrl(url: string): boolean {
  const u = normalizeApiUrl(url);
  if (!u) return false;
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function tmplProviderApiUrlInput(inputId: string, value: string, providerLabel: string): string {
  return `<input id="${inputId}" class="cg-field sa-prov-url-input" type="url" inputmode="url"
    value="${escHtml(value || '')}" placeholder="https://api.example.com/v1"
    autocomplete="off" spellcheck="false" aria-label="${escHtml(providerLabel)} API URL">`;
}

export function applyVendorApiUrl(vendor: any, urlInput: HTMLInputElement | null, providerLabel: string): boolean {
  if (!needsProviderApiUrl(vendor.providerId)) return true;
  let url = normalizeApiUrl(urlInput?.value || '');
  if (!url && vendor.baseUrl) url = normalizeApiUrl(vendor.baseUrl);
  if (!validateApiUrl(url)) {
    alert(`Enter a valid API URL (https://…) for ${providerLabel || vendor.name || 'this provider'}.`);
    return false;
  }
  vendor.baseUrl = url;
  return true;
}

export function saWizardOnAddProviderTypeChange(): void {
  const row = document.getElementById('sa-add-url-row');
  const typeEl = document.getElementById('sa-add-provider') as HTMLSelectElement | null;
  if (!row || !typeEl) return;
  row.classList.toggle('hidden', !needsProviderApiUrl(typeEl.value));
}

export function providerLogoHtml(slotId: string, name: string): string {
  const id = escHtml(slotId);
  const alt = escHtml(name || slotId);
  const SA_PROVIDER_LOGO_DIR = 'img/service-provider-logos';
  return `<div class="sa-prov-logo-frame"><img class="sa-prov-logo" src="${SA_PROVIDER_LOGO_DIR}/${id}.png" alt="${alt}" loading="lazy" decoding="async"></div>`;
}

export function tmplProviderSlotRow(slot: any, deps: TemplateDeps): string {
  const v = deps.findVendorForSlot(slot);
  const slotId = escHtml(slot.slotId);
  const blurb = slot.blurb ? `<span class="sa-prov-blurb">${escHtml(slot.blurb)}</span>` : '';
  const needsUrl = deps.needsProviderApiUrl(slot.providerId);
  const isActive = deps.isSlotActive(slot.slotId);
  const activeClass = isActive ? ' sa-prov-card--active' : '';
  const detailsHidden = isActive ? '' : ' hidden';
  const urlField = needsUrl
    ? tmplProviderApiUrlInput(`sa-prov-url-${slotId}`, v?.baseUrl || '', slot.name)
    : '';
  const cancelBtn = isActive
    ? `<button type="button" class="toolbar-btn toolbar-btn--shape-soft sa-prov-cancel-btn" data-sa-slot="${slotId}">Cancel</button>`
    : '';
  const hasExistingKey = v && saVendorHasKey(v);
  const clearBtn = hasExistingKey
    ? `<button type="button" class="toolbar-btn toolbar-btn--shape-soft sa-prov-clear-btn" data-sa-slot="${slotId}">Clear</button>`
    : '';
  const catalogLoaded = deps.vendorHasAnyModalityCatalog(v);
  const catalogLoadedClass = catalogLoaded ? ' sa-prov-card--catalog-loaded' : '';
  return `
    <div class="sa-prov-card-wrapper" data-sa-slot="${slotId}">
      <div class="sa-prov-card${activeClass}${catalogLoadedClass}${needsUrl ? ' sa-prov-card--needs-url' : ''}" data-slot-id="${slotId}" data-sa-slot="${slotId}">
        <button type="button" class="sa-prov-toggle" data-sa-slot="${slotId}" aria-pressed="${isActive ? 'true' : 'false'}">
          ${providerLogoHtml(slot.slotId, slot.name)}
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
                 autocomplete="off" spellcheck="false" placeholder="${escHtml(deps.providerKeyPlaceholder(v))}"
                 aria-label="${escHtml(slot.name)} API key">
          ${cancelBtn}
          ${clearBtn}
          <button type="button" class="toolbar-btn toolbar-btn--shape-soft sa-prov-save-btn" data-sa-slot="${slotId}">Save</button>
          ${hasExistingKey ? `<button type="button" class="toolbar-btn toolbar-btn--shape-soft sa-prov-reload-btn" data-sa-slot="${slotId}"><i class="fa-solid fa-rotate" aria-hidden="true"></i> Reload</button>` : ''}
          ${deps.catalogChipsForVendor(v)}
        </div>
      </div>
    </div>`;
}

export function tmplProviderCatalogSection(section: any, deps: TemplateDeps): string {
  const head = `
    <section class="sa-prov-section" aria-labelledby="sa-prov-sec-${escHtml(section.num)}">
      <h4 id="sa-prov-sec-${escHtml(section.num)}" class="sa-prov-section-title">${escHtml(section.num)}. ${escHtml(section.title)}</h4>
      ${section.desc ? `<p class="sa-prov-section-desc">${escHtml(section.desc)}</p>` : ''}`;
  let body = '';
  if (section.rows) {
    body = `<div class="sa-prov-rows sa-prov-matrix">${section.rows.map((r: any) => tmplProviderSlotRow(r, deps)).join('')}</div>`;
  } else if (section.groups) {
    body = section.groups.map((g: any) => `
      <p class="sa-prov-subsection-label">${escHtml(g.label)}</p>
      <div class="sa-prov-rows sa-prov-matrix">${g.rows.map((r: any) => tmplProviderSlotRow(r, deps)).join('')}</div>
    `).join('');
  }
  return `${head}${body}</section>`;
}

export function tmplManualProviderRow(v: any, deps: TemplateDeps): string {
  const vid = escHtml(v.id);
  const hasKey = saVendorHasKey(v);
  const needsUrl = deps.needsProviderApiUrl(v.providerId);
  const urlField = needsUrl
    ? tmplProviderApiUrlInput(`sa-manual-url-${vid}`, v.baseUrl || '', v.name || 'Provider')
    : '';
  return `
    <div class="sa-prov-row sa-prov-row--manual${needsUrl ? ' sa-prov-row--needs-url' : ''}" data-vendor-id="${vid}">
      <div class="sa-prov-row-main">
        <span class="sa-prov-name">${escHtml(v.name || 'Unnamed')}</span>
        <span class="sa-prov-blurb">${escHtml(deps.providerLabel(v.providerId))}</span>
      </div>
      <div class="sa-prov-row-controls">
        ${urlField}
        <input id="sa-manual-key-${vid}" class="cg-field api-keys-secret-input sa-prov-key-input" type="password"
               autocomplete="off" spellcheck="false" placeholder="${escHtml(deps.providerKeyPlaceholder(v))}"
               aria-label="${escHtml(v.name || 'Provider')} API key">
        ${urlField}
        <button type="button" class="toolbar-btn toolbar-btn--shape-soft" onclick="saWizardSaveManualProvider('${vid}')">Save</button>
        <button type="button" class="toolbar-btn toolbar-btn--shape-soft" onclick="saWizardRemoveProvider('${vid}')">Remove</button>
        ${deps.catalogChipsForVendor(v)}
      </div>
    </div>`;
}

export function tmplProviders(deps: TemplateDeps): string {
  deps.normalizeVendorsToSlots();
  const catalogHtml = SA_PROVIDER_CATALOG.map((s: any) => tmplProviderCatalogSection(s, deps)).join('');
  const manual = deps.manualVendors();
  const manualRows = manual.length
    ? manual.map((v: any) => tmplManualProviderRow(v, deps)).join('')
    : '<p class="sa-wiz-muted sa-prov-manual-empty">No custom providers yet.</p>';
  return `
    <div class="sa-step-section sa-prov-step">
      <h3 class="sa-step-title"><i class="fa-solid fa-key" aria-hidden="true"></i> Providers &amp; API keys</h3>
      <p class="sa-step-desc">Add keys for the services you plan to use. Saving a key tests the connection and discovers which modalities that provider offers.</p>
      ${tmplProviderModalityChipBar(deps)}
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
              <select id="sa-add-provider" class="cg-nspopup">${saWizardProviderOptions('openai-compatible')}</select>
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

export function tmplCoverage(deps: TemplateDeps): string {
  const vendors = deps.vendorsWithKeys();
  const vendorOpts = (selectedId: string, mod: string) => {
    const eligible = vendors.filter((v: any) => {
      const list = PROVIDERS_BY_MODALITY[mod];
      return !list || list.some((p: any) => p.id === v.providerId);
    });
    const opts = eligible.length ? eligible : vendors;
    return `<option value="">— Select provider —</option>` + opts.map((v: any) =>
      `<option value="${escHtml(v.id)}"${v.id === selectedId ? ' selected' : ''}>${escHtml(v.name || deps.providerLabel(v.providerId))}</option>`
    ).join('');
  };
  const modelOpts = (s: any, mod: string) => {
    const catalogModels = saGetCatalogModels(s.providerId, mod);
    const allModels = saMergeModels(s.listedModels, catalogModels);
    if (!allModels.length) return '<option value="">— No models. Add provider. —</option>';
    return allModels.map((m: any) =>
      `<option value="${escHtml(m.id)}"${m.id === s.modelId ? ' selected' : ''}>${escHtml(m.label)}</option>`
    ).join('');
  };
  const rows = ROUTING_MODALITIES.map((mod) => {
    const meta = MODALITY_META[mod];
    const s    = deps.state[mod];
    const req  = deps.modalityIsRequired(mod);
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
            <div id="sa-coverage-test-status-${mod}" class="sa-test-status${s.status ? ' sa-test-status--' + s.status : ''}">${saStatusHtml(s)}</div>
          </div>
          <div class="cg-nspopup-wrap">
            <select id="sa-coverage-model-${mod}" class="cg-nspopup sa-coverage-model-select">${modelOpts(s, mod)}</select>
          </div>
          <div class="sa-coverage-baseurl-row${needsBaseUrl ? '' : ' hidden'}" id="sa-coverage-baseurl-row-${mod}">
            <input id="sa-coverage-baseurl-${mod}" class="cg-field" type="url" placeholder="Base URL (optional)" value="${escHtml(s.baseUrl || '')}">
          </div>
          <p id="sa-coverage-model-caps-${mod}" class="sa-model-caps">${saModelCaps(s.providerId, mod, s.modelId)}</p>
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

export function tmplModels(deps: TemplateDeps): string {
  const sections = ROUTING_MODALITIES.map((mod) => {
    const s = deps.state[mod];
    if (s.skip || !s.vendorId) return '';
    const meta = MODALITY_META[mod];
    const vendor = deps.vendorById(s.vendorId);
    const catalogModels = saGetCatalogModels(s.providerId, mod);
    const allModels = saMergeModels(s.listedModels, catalogModels);
    const needsBaseUrl = ['openai-compatible', 'generic-rest'].includes(s.providerId);
    return `
      <div class="sa-models-block" data-mod="${mod}">
        <h4 class="sa-models-block-title">${escHtml(meta.label)}</h4>
        <p class="sa-step-desc">Provider: <strong>${escHtml(vendor?.name || deps.providerLabel(s.providerId))}</strong></p>
        <div class="sa-test-row">
          <button type="button" class="toolbar-btn toolbar-btn--shape-soft btn-ai" id="sa-test-btn-${mod}">
            <i class="fa-solid fa-plug-circle-check" aria-hidden="true"></i> Test &amp; list models
          </button>
          <div id="sa-test-status-${mod}" class="sa-test-status${s.status ? ' sa-test-status--' + s.status : ''}">${saStatusHtml(s)}</div>
        </div>
        <div class="cg-accordion-row${needsBaseUrl ? '' : ' hidden'}" id="sa-baseurl-row-${mod}">
          <label for="sa-baseurl-${mod}">Base URL <small>(optional)</small></label>
          <input id="sa-baseurl-${mod}" class="cg-field" type="url" value="${escHtml(s.baseUrl || '')}">
        </div>
        <div class="cg-accordion-row">
          <label for="sa-model-${mod}">Default model</label>
          <div class="cg-nspopup-wrap">
            <select id="sa-model-${mod}" class="cg-nspopup">
              ${allModels.map((m: any) =>
                `<option value="${escHtml(m.id)}"${m.id === s.modelId ? ' selected' : ''}>${escHtml(m.label)}</option>`
              ).join('')}
            </select>
          </div>
        </div>
        <p id="sa-model-caps-${mod}" class="sa-model-caps">${saModelCaps(s.providerId, mod, s.modelId)}</p>
      </div>`;
  }).filter(Boolean).join('');
  return `
    <div class="sa-step-section">
      <h3 class="sa-step-title"><i class="fa-solid fa-sliders" aria-hidden="true"></i> Default models</h3>
      <p class="sa-step-desc">Test each assignment and choose the default model for that task.</p>
      ${sections || '<p class="sa-wiz-muted">No modalities assigned — go back to the coverage step.</p>'}
    </div>`;
}

export function tmplModality(mod: string, stepIds: any[], deps: TemplateDeps): string {
  const meta = MODALITY_META[mod];
  const s = deps.state[mod];
  const providers = PROVIDERS_BY_MODALITY[mod];
  const catalogModels = saGetCatalogModels(s.providerId, mod);
  const allModels = saMergeModels(s.listedModels, catalogModels);
  const needsBaseUrl = ['openai-compatible', 'generic-rest'].includes(s.providerId);
  const stepInfo = stepIds.find((st: any) => st.id === mod);
  const isOptional = !stepInfo?.required;
  return `
    <div class="sa-step-section">
      <h3 class="sa-step-title">
        <i class="${stepInfo?.icon || 'fa-solid fa-gear'}" aria-hidden="true"></i>
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
                  ${providers.map((p: any) =>
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
                ${saStatusHtml(s)}
              </div>
            </div>
            <div class="cg-accordion-row">
              <label for="sa-model-${mod}">Default model</label>
              <div class="cg-nspopup-wrap">
                <select id="sa-model-${mod}" class="cg-nspopup">
                  ${allModels.map((m: any) =>
                    `<option value="${escHtml(m.id)}"${m.id === s.modelId ? ' selected' : ''}>${escHtml(m.label)}</option>`
                  ).join('')}
                </select>
              </div>
            </div>
            <p id="sa-model-caps-${mod}" class="sa-model-caps">${saModelCaps(s.providerId, mod, s.modelId)}</p>
          </div>
        </details>
      </div>
    </div>`;
}

export function tmplDone(deps: TemplateDeps): string {
  const rows = ROUTING_MODALITIES.map((mod) => {
    const meta = MODALITY_META[mod];
    const s    = deps.state[mod];
    const vendor = deps.vendorById(s.vendorId);
    let icon, cls, label;
    if (s.skip) {
      icon = 'fa-solid fa-forward'; cls = 'sa-done-skipped'; label = 'Skipped';
    } else if (vendor && s.modelId) {
      icon = 'fa-solid fa-circle-check'; cls = 'sa-done-ok';
      label = `${vendor.name || deps.providerLabel(vendor.providerId)} · ${s.modelLabel || s.modelId}`;
    } else if (vendor) {
      icon = 'fa-solid fa-circle-exclamation'; cls = 'sa-done-empty';
      if (mod === 'audio') {
        const subs = ['tts', 'sfx', 'music'].map((sub) => {
          const st = deps.state[`audio_${sub}`];
          if (!st) return null;
          const cat: Record<string, string> = { tts: 'TTS', sfx: 'SFX', music: 'Music' };
          return st.vendorId ? `${cat[sub]}: ${st.statusMsg}` : null;
        }).filter(Boolean);
        label = vendor.name ? `${vendor.name} · ${subs.join(', ') || 'available'}` : `${deps.providerLabel(vendor.providerId)} · ${subs.join(', ') || 'available'}`;
      } else {
        label = `${vendor.name || deps.providerLabel(vendor.providerId)} (no model)`;
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
  const hasRequired = deps.coverageSatisfied() && deps.requiredModelsAssigned();
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
