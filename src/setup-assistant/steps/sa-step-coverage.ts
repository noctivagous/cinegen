import { classMap } from 'lit/directives/class-map.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import { MODALITY_META, ROUTING_MODALITIES } from '@/setup-assistant/sa-wizard-constants';
import { getSaWizardApi, getSaWizardState, type AudioCapability } from '@/setup-assistant/sa-wizard-bridge';
import { escHtml } from '@/utils/html';

/** Audio sub-modality configuration */
const AUDIO_SUB_MODALITIES: { key: AudioCapability; label: string; required: boolean }[] = [
  { key: 'tts', label: 'Text-to-Speech (TTS)', required: false },
  { key: 'sfx', label: 'Sound Effects (SFX)', required: false },
  { key: 'music', label: 'Music Generation', required: false },
];

@customElement('sa-step-coverage')
export class SaStepCoverage extends CgLightElement {
  @state() private _autoSelected = false;

  firstUpdated(): void {
    if (this._autoSelected) return;
    this._syncExistingVendorStatus(); // Sync vendor test status to assigned modalities
    this._autoSelectProviders();
    this._autoSelected = true;
  }

  /**
   * Sync vendor test status to modalities that already have vendors assigned.
   * This ensures that when coming from the Providers page, the test status carries over.
   */
  private _syncExistingVendorStatus(): void {
    const state = getSaWizardState();
    if (!state) return;
    const api = getSaWizardApi();

    let changed = false;

    ROUTING_MODALITIES.forEach((mod) => {
      const m = state[mod];
      if (!m.vendorId || m.skip) return;
      if (m.status && m.status !== 'testing') return;
      changed = this._syncModalityStatus(m, m.vendorId, mod) || changed;
    });

    // Also sync audio sub-modalities independently
    AUDIO_SUB_MODALITIES.forEach((sub) => {
      const subState = (state as any)[`audio_${sub.key}`];
      if (!subState || !subState.vendorId) return;
      if (subState.status && subState.status !== 'testing') return;
      changed = this._syncModalityStatus(subState, subState.vendorId, 'audio') || changed;
    });

    if (changed) {
      this.requestUpdate();
    }
  }

  private _syncModalityStatus(target: any, vendorId: string, mod: string): boolean {
    const api = getSaWizardApi();
    const catalogStatus = api.cachedModalityStatus(vendorId, mod);
    if (catalogStatus && catalogStatus.status) {
      target.status = catalogStatus.status;
      target.statusMsg = catalogStatus.message;
      if (catalogStatus.models && catalogStatus.models.length > 0) {
        target.listedModels = catalogStatus.models.map((model: any) => ({
          id: model.id,
          label: model.label || model.id
        }));
      }
      if (catalogStatus.fetchedAt) {
        target.fetchedAt = catalogStatus.fetchedAt;
      }
      return true;
    }
    return false;
  }

  private _onVendorChange(mod: string, e: Event): void {
    const sel = e.target as HTMLSelectElement;
    const state = getSaWizardState();
    if (!state) return;
    const api = getSaWizardApi();
    const m = state[mod as keyof typeof state] as typeof state.llm;
    const vendor = api.vendorById(sel.value);
    m.vendorId = sel.value;
    m.providerId = vendor ? vendor.providerId : '';
    m.baseUrl = '';
    m.modelId = '';
    // Sync status and models from cached catalog instead of clearing to "Not tested"
    const catalogStatus = api.cachedModalityStatus(sel.value, mod);
    if (catalogStatus && catalogStatus.status) {
      m.status = catalogStatus.status;
      m.statusMsg = catalogStatus.message;
      m.listedModels = catalogStatus.models.map((model: any) => ({
        id: model.id,
        label: model.label || model.id
      }));
      if (catalogStatus.fetchedAt) {
        (m as any).fetchedAt = catalogStatus.fetchedAt;
      }
    } else {
      m.status = null;
      m.statusMsg = '';
      m.listedModels = [];
    }
    api.saveStepData(mod);
    if (typeof (window as any).updateModelStatusIndicators === 'function') (window as any).updateModelStatusIndicators();
    this.requestUpdate();
  }

  private _onAudioSubVendorChange(subKey: string, e: Event): void {
    const sel = e.target as HTMLSelectElement;
    const state = getSaWizardState();
    if (!state) return;
    const api = getSaWizardApi();
    const subStateKey = `audio_${subKey}` as keyof typeof state;
    let subState = (state as any)[subStateKey];
    if (!subState) {
      subState = { vendorId: '', providerId: '', status: null, statusMsg: '', modelId: '', listedModels: [] };
      (state as any)[subStateKey] = subState;
    }
    const vendor = api.vendorById(sel.value);
    subState.vendorId = sel.value;
    subState.providerId = vendor ? vendor.providerId : '';
    subState.status = null;
    subState.statusMsg = '';
    subState.modelId = '';
    // Sync status from cached catalog
    const catalogStatus = api.cachedModalityStatus(sel.value, 'audio');
    if (catalogStatus && catalogStatus.status) {
      subState.status = catalogStatus.status;
      subState.statusMsg = catalogStatus.message;
      if (catalogStatus.fetchedAt) {
        (subState as any).fetchedAt = catalogStatus.fetchedAt;
      }
    }
    api.saveStepData(subStateKey as string);
    if (typeof (window as any).updateModelStatusIndicators === 'function') (window as any).updateModelStatusIndicators();
    this.requestUpdate();
  }

  private _onModelChange(mod: string, e: Event): void {
    const sel = e.target as HTMLSelectElement;
    const state = getSaWizardState();
    if (!state) return;
    const api = getSaWizardApi();
    const m = state[mod as keyof typeof state] as typeof state.llm;
    m.modelId = sel.value;
    const opt = sel.options[sel.selectedIndex];
    m.modelLabel = opt?.textContent?.trim() || '';
    api.saveStepData(mod);
    if (typeof (window as any).updateModelStatusIndicators === 'function') (window as any).updateModelStatusIndicators();
    this.requestUpdate();
  }

  private async _onRefreshClick(mod: string): Promise<void> {
    const w = window as any;
    if (typeof w.saTestConnection === 'function') {
      await w.saTestConnection(mod);
    }
    this.requestUpdate();
  }

  /** Refresh models for an audio sub-modality by temporarily delegating to the audio test endpoint */
  private async _onAudioSubRefreshClick(subKey: string): Promise<void> {
    const w = window as any;
    if (typeof w.saTestConnection !== 'function') return;
    const state = getSaWizardState();
    if (!state) return;
    const subState = (state as any)[`audio_${subKey}`];
    if (!subState || !subState.vendorId) return;
    // Temporarily set the audio main vendor to match the sub-modality's vendor
    const saved = state.audio.vendorId;
    state.audio.vendorId = subState.vendorId;
    state.audio.providerId = subState.providerId;
    try {
      await w.saTestConnection('audio');
    } finally {
      state.audio.vendorId = saved;
      state.audio.providerId = '';
      if (saved) {
        const sv = w._saVendorById ? w._saVendorById(saved) : null;
        if (sv) state.audio.providerId = sv.providerId;
      }
    }
    this.requestUpdate();
  }

  private _goToProvidersPage(): void {
    const host = document.getElementById('sa-body') as any;
    if (host && typeof host.showStep === 'function') {
      host.showStep('providers');
    } else {
      // Fallback: try to find and click the providers tab
      const providersTab = document.querySelector('[role="tab"], .sa-nav-item, .sa-step-nav-item')?.closest('button, [role="tab"]');
      if (providersTab) {
        (providersTab as HTMLElement).click();
      }
    }
  }

  private _autoSelectProviders(): void {
    const state = getSaWizardState();
    if (!state) return;
    const api = getSaWizardApi();
    const vendors = api.vendorsWithKeys();
    if (!vendors.length) return;

    let changed = false;

    // Auto-select for each modality and sync status from catalog
    ROUTING_MODALITIES.forEach((mod) => {
      const m = state[mod];
      if (m.vendorId || m.skip) return; // Already selected or skipped

      const providers = api.providersByModality(mod);
      const eligible = providers.length
        ? vendors.filter((v) => providers.some((p) => p.id === v.providerId))
        : vendors;

      if (eligible.length) {
        const first = eligible[0];
        m.vendorId = first.id;
        m.providerId = first.providerId;

        // Sync status from catalog if available
        const catalogStatus = api.cachedModalityStatus(first.id, mod);
        if (catalogStatus) {
          m.status = catalogStatus.status;
          m.statusMsg = catalogStatus.message;
          m.listedModels = catalogStatus.models.map((model) => ({
            id: model.id,
            label: model.label || model.id
          }));
          if (catalogStatus.fetchedAt) {
            (m as any).fetchedAt = catalogStatus.fetchedAt;
          }
        }
        changed = true;
      }
    });

    // Handle audio sub-modalities — each selects independently based on capability
    AUDIO_SUB_MODALITIES.forEach((sub) => {
      const subKey = `audio_${sub.key}`;
      if ((state as any)[subKey]) return; // Already initialized

      // Find vendors that have cached models for this specific capability
      const capVendors = vendors.filter((v) =>
        api.cachedAudioModelsByCapability(v.id, sub.key).length > 0
      );
      if (!capVendors.length) return;

      const first = capVendors[0];
      const subState = {
        vendorId: first.id,
        providerId: first.providerId,
        status: null as string | null,
        statusMsg: '',
        modelId: '',
        listedModels: [] as Array<{ id: string; label: string }>,
      };
      // Sync status from catalog
      const catalogStatus = api.cachedModalityStatus(first.id, 'audio');
      if (catalogStatus) {
        subState.status = catalogStatus.status;
        subState.statusMsg = catalogStatus.message;
        if (catalogStatus.fetchedAt) {
          (subState as any).fetchedAt = catalogStatus.fetchedAt;
        }
      }
      (state as any)[subKey] = subState;
      changed = true;
    });

    if (changed) {
      this.requestUpdate();
    }
  }

  render() {
    const state = getSaWizardState();
    if (!state) return nothing;
    const api = getSaWizardApi();
    const vendors = api.vendorsWithKeys();

    const hasProviders = (mod: string) => {
      const list = api.providersByModality(mod);
      const eligible = vendors.filter((v) => !list.length || list.some((p) => p.id === v.providerId));
      return eligible.length > 0 || vendors.length > 0;
    };

    const vendorOptions = (selectedId: string, mod: string) => {
      const list = api.providersByModality(mod);
      const eligible = vendors.filter((v) => !list.length || list.some((p) => p.id === v.providerId));
      const opts = eligible.length ? eligible : vendors;
      // No placeholder - first item auto-selected via firstUpdated()
      return html`${opts.map(
        (v) => html`
          <option value=${v.id} ?selected=${v.id === selectedId}>
            ${escHtml(v.name || api.providerLabel(v.providerId))}
          </option>
        `
      )}`;
    };

    const addProviderButton = (mod: string, isSubModality = false) => html`
      <button
        type="button"
        class="toolbar-btn toolbar-btn--shape-soft btn-ai"
        @click=${() => this._goToProvidersPage()}
      >
        <i class="fa-solid fa-plus" aria-hidden="true"></i>
        Add ${isSubModality ? 'Submodality' : 'Modality'} Provider
      </button>
    `;

    const hasAudioSubProviders = (capability: AudioCapability) => {
      return vendors.some((v) => api.cachedAudioModelsByCapability(v.id, capability).length > 0);
    };

    const vendorOptionsByCapability = (selectedId: string, capability: AudioCapability) => {
      const eligible = vendors.filter((v) => api.cachedAudioModelsByCapability(v.id, capability).length > 0);
      if (!eligible.length) return nothing;
      return html`${eligible.map(
        (v) => html`
          <option value=${v.id} ?selected=${v.id === selectedId}>
            ${escHtml(v.name || api.providerLabel(v.providerId))}
          </option>
        `
      )}`;
    };

    const modelOptions = (m: typeof state.llm, mod: string) => {
      // Use cached live models from provider catalog (populated after successful test on providers step)
      const cachedModels = m.vendorId ? api.cachedVendorModels(m.vendorId, mod) : [];
      // Merge listed models (from current session tests) with cached models
      const allModels = api.mergeModels(m.listedModels ?? [], cachedModels);
      if (!allModels.length) {
        return html`<option value="">— Select model —</option>`;
      }
      return html`${allModels.map(
        (model) => html`
          <option value=${model.id} ?selected=${model.id === m.modelId}>
            ${escHtml(model.label)}
          </option>
        `
      )}`;
    };

    const modelOptionsByCapability = (vendorId: string, capability: AudioCapability, selectedId: string) => {
      const models = vendorId ? api.cachedAudioModelsByCapability(vendorId, capability) : [];
      if (!models.length) {
        return html`<option value="">— Select model —</option>`;
      }
      return html`${models.map(
        (model) => html`
          <option value=${model.id} ?selected=${model.id === selectedId}>
            ${escHtml(model.label)}
          </option>
        `
      )}`;
    };

    return html`
      <div class="sa-step-section">
        <h3 class="sa-step-title">
          <i class="fa-solid fa-table-columns" aria-hidden="true"></i> Modality coverage
        </h3>
        <p class="sa-step-desc">
          Assign a saved provider and model to each task. Text, Video, and Image / Storyboards are required.
        </p>
        <table class="sa-coverage-table" aria-label="Modality coverage">
          <thead>
            <tr>
              <th>Task</th>
              <th>Requirement</th>
              <th>Assigned provider</th>
            </tr>
          </thead>
          <tbody>
            ${ROUTING_MODALITIES.map((mod) => {
              const meta = MODALITY_META[mod];
              const m = state[mod];
              const required = api.modalityRequired(mod);
              const needsBaseUrl = ['openai-compatible', 'generic-rest'].includes(m.providerId ?? '');
              const showModelSection = !m.skip;

              // Special handling for Audio modality — no main provider, just TTS/SFX/Music sub-modalities
              if (mod === 'audio') {
                return html`
                  <tr>
                    <td>
                      <strong>${escHtml(meta.label)}</strong>
                      <div class="sa-audio-sub-hint">TTS · SFX · Music</div>
                    </td>
                    <td><span class="sa-badge ${meta.badgeClass}">${meta.badge}</span> ${required ? 'Required' : 'Optional'}</td>
                    <td>
                      <table class="sa-audio-sub-table" aria-label="Audio capabilities">
                        <tbody>
                          ${AUDIO_SUB_MODALITIES.map((sub) => {
                            const subStateKey = `audio_${sub.key}`;
                            const audioSubState = (state as any)[subStateKey];
                            const subVendorId = audioSubState?.vendorId || '';
                            const subModelId = audioSubState?.modelId || '';
                            const subStatus = audioSubState?.status || null;
                            const subProviderId = audioSubState?.providerId || '';
                            const capVendors = vendors.filter((v) => api.cachedAudioModelsByCapability(v.id, sub.key).length > 0);
                            const hasCapProviders = capVendors.length > 0;
                            return html`
                              <tr>
                                <td class="sa-audio-sub-label">${sub.label}</td>
                                <td class="sa-audio-sub-select">
                                  ${hasCapProviders
                                    ? html`
                                        <div class="sa-coverage-provider-row">
                                          <label class="sa-coverage-field-label">Provider:</label>
                                          <div class="cg-nspopup-wrap">
                                            <select id="sa-coverage-vendor-${mod}-${sub.key}" class="cg-nspopup" @change=${(e: Event) => this._onAudioSubVendorChange(sub.key, e)}>
                                              ${vendorOptionsByCapability(subVendorId, sub.key)}
                                            </select>
                                          </div>
                                        </div>
                                        <div class="sa-test-row">
                                          <button
                                            type="button"
                                            class="toolbar-btn toolbar-btn--shape-soft btn-ai"
                                            id="sa-coverage-test-btn-${mod}-${sub.key}"
                                            @click=${() => this._onAudioSubRefreshClick(sub.key)}
                                          >
                                            <i class="fa-solid fa-rotate" aria-hidden="true"></i> Refresh
                                          </button>
                                          <div
                                            id="sa-coverage-test-status-${mod}-${sub.key}"
                                            class=${classMap({
                                              'sa-test-status': true,
                                              [`sa-test-status--${subStatus}`]: Boolean(subStatus),
                                            })}
                                          >
                                            ${unsafeHTML(api.statusMessageHtml(audioSubState ?? { status: null, statusMsg: '' }))}
                                          </div>
                                        </div>
                                        <div class="sa-coverage-model-row">
                                          <label class="sa-coverage-field-label">Model:</label>
                                          <div class="cg-nspopup-wrap">
                                            <select id="sa-coverage-model-${mod}-${sub.key}" class="cg-nspopup sa-coverage-model-select">
                                              ${modelOptionsByCapability(subVendorId, sub.key, subModelId)}
                                            </select>
                                          </div>
                                        </div>
                                      `
                                    : addProviderButton(mod, true)}
                                </td>
                              </tr>
                            `;
                          })}
                        </tbody>
                      </table>
                      <p class="sa-audio-sub-note">Add providers with audio capabilities on the Providers step.</p>
                    </td>
                  </tr>
                `;
              }

              // Standard rendering for llm, video, image
              return html`
                <tr>
                  <td>
                    <strong>${escHtml(meta.label)}</strong>
                  </td>
                  <td><span class="sa-badge ${meta.badgeClass}">${meta.badge}</span> ${required ? 'Required' : 'Optional'}</td>
                  <td>
                    <div
                      id="sa-coverage-vendor-wrap-${mod}"
                      class=${classMap({ 'sa-coverage-provider-row': true, hidden: Boolean(m.skip) })}
                    >
                      <label class="sa-coverage-field-label">Provider:</label>
                      ${hasProviders(mod)
                      ? html`
                          <div class="cg-nspopup-wrap">
                            <select id="sa-coverage-vendor-${mod}" class="cg-nspopup" @change=${(e: Event) => this._onVendorChange(mod, e)}>
                              ${vendorOptions(m.vendorId ?? '', mod)}
                            </select>
                          </div>
                        </div>
                        <div class="sa-test-row">
                          <button
                            type="button"
                            class="toolbar-btn toolbar-btn--shape-soft btn-ai"
                            id="sa-coverage-test-btn-${mod}"
                            @click=${() => this._onRefreshClick(mod)}
                          >
                            <i class="fa-solid fa-rotate" aria-hidden="true"></i> Refresh Model List
                          </button>
                        `
                      : html`
                          </div>
                          <div class="sa-test-row">
                            ${addProviderButton(mod, false)}
                          `}
                      <div
                        id="sa-coverage-test-status-${mod}"
                        class=${classMap({
                          'sa-test-status': true,
                          [`sa-test-status--${m.status}`]: Boolean(m.status),
                        })}
                      >
                        ${unsafeHTML(api.statusMessageHtml(m))}
                      </div>
                    </div>
                    <div
                      id="sa-coverage-model-section-${mod}"
                      class=${classMap({ 'sa-coverage-model-wrap': true, hidden: !showModelSection })}
                    >
                      <div class="sa-coverage-model-row">
                        <label class="sa-coverage-field-label">Model:</label>
                        <div class="cg-nspopup-wrap">
                          <select id="sa-coverage-model-${mod}" class="cg-nspopup sa-coverage-model-select" @change=${(e: Event) => this._onModelChange(mod, e)}>
                            ${modelOptions(m, mod)}
                          </select>
                        </div>
                      </div>
                      </div>
                      <p id="sa-coverage-model-caps-${mod}" class="sa-model-caps">
                        ${api.modelCapsText(m.providerId ?? '', mod, m.modelId ?? '')}
                      </p>
                    </div>
                  </td>
                </tr>
              `;
            })}
          </tbody>
        </table>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sa-step-coverage': SaStepCoverage;
  }
}
