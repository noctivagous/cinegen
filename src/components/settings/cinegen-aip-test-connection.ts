import { Task } from '@lit/task';
import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import {
  apiScopeForModality,
  fetchProviderModels,
  type ProviderFetchResult,
  type RoutingModalityKey,
} from '@/services/provider-fetch';
import { applyVendorCatalogFetchResult } from '@/services/provider-model-catalog';
import { escHtml } from '@/utils/html';

type ApiKeysVendor = {
  id: string;
  providerId: string;
  apiKey?: string;
};

type TestTaskArgs = {
  vendor: ApiKeysVendor;
  modality: RoutingModalityKey;
  key: string;
  baseUrl: string;
};

@customElement('cinegen-aip-test-connection')
export class CinegenAipTestConnection extends CgLightElement {
  @state() private _modality: RoutingModalityKey = 'llm';
  @state() private _validationError: string | null = null;

  private readonly _testTask = new Task<TestTaskArgs[], ProviderFetchResult>(this, {
    task: async ([args], { signal }) =>
      fetchProviderModels(
        args.vendor.providerId,
        args.key,
        args.baseUrl,
        args.modality,
        signal
      ),
    autoRun: false,
  });

  /** Back-compat for `window.aipTestSelectedProvider`. */
  runTest(): void {
    void this._runTest();
  }

  private _readVendor(): ApiKeysVendor | null {
    const draft =
      typeof window.getDraft === 'function'
        ? (window.getDraft() as { selectedVendorId?: string; vendors?: ApiKeysVendor[] })
        : null;
    if (!draft?.vendors?.length) return null;
    return draft.vendors.find((v) => v.id === draft.selectedVendorId) ?? null;
  }

  private async _runTest(): Promise<void> {
    this._validationError = null;
    const vendor = this._readVendor();
    if (!vendor) {
      this._validationError = 'No provider selected. Add and select a provider first.';
      return;
    }

    if (typeof window.syncDetailInputsToDraft === 'function') {
      window.syncDetailInputsToDraft();
    }

    const scopeKey = apiScopeForModality(this._modality);
    const key =
      typeof window.readVendorKey === 'function'
        ? window.readVendorKey(vendor, scopeKey)
        : String(vendor.apiKey ?? '').trim();

    if (!key) {
      this._validationError =
        'No API key saved for this provider. Paste a key and save first (or enter one in the key field above).';
      return;
    }

    const baseUrl =
      (document.getElementById(`ai-api-baseurl-${this._modality}`) as HTMLInputElement | null)?.value?.trim() ??
      '';

    try {
      await this._testTask.run([{ vendor, modality: this._modality, key, baseUrl }]);
      const result = this._testTask.value;
      if (result !== undefined) {
        this._applySuccess(vendor, this._modality, result);
      }
    } catch {
      /* Task renders error state */
    }
  }

  private _applySuccess(
    vendor: ApiKeysVendor,
    modality: RoutingModalityKey,
    result: ProviderFetchResult
  ): void {
    if (!result.ok && !result.rateLimit) return;

    applyVendorCatalogFetchResult(vendor.id, vendor.providerId, modality, result);

    if (
      typeof window.refreshModalityModelOptions === 'function' &&
      typeof window.loadAiApiSettings === 'function'
    ) {
      const ai = window.loadAiApiSettings() as {
        modalities?: Record<string, { vendorId?: string }>;
      };
      if (ai.modalities?.[modality]?.vendorId === vendor.id) {
        window.refreshModalityModelOptions(modality, ai);
      }
    }
    if (typeof window.renderVendorList === 'function') window.renderVendorList();
  }

  private _onModalityChange(e: Event): void {
    const sel = e.target as HTMLSelectElement;
    const value = sel.value as RoutingModalityKey;
    if (value === 'llm' || value === 'image' || value === 'video' || value === 'audio') {
      this._modality = value;
      this._validationError = null;
    }
  }

  render() {
    if (this._validationError) {
      return this._renderShell(
        html`<div id="aip-test-status" class="aip-test-status aip-test-status--err" aria-live="polite">
          <i class="fa-solid fa-circle-xmark" aria-hidden="true"></i> ${this._validationError}
        </div>`,
        false,
        false
      );
    }

    return this._testTask.render({
      initial: () => this._renderShell(this._idleStatus(), false, false),
      pending: () => this._renderShell(this._pendingStatus(), true, true),
      complete: (result) => this._renderShell(this._completeStatus(result), false, false, result),
      error: (e) => {
        if (e instanceof DOMException && e.name === 'AbortError') {
          return this._renderShell(this._idleStatus(), false, false);
        }
        const message = e instanceof Error ? e.message : 'Connection failed.';
        return this._renderShell(
          html`<div id="aip-test-status" class="aip-test-status aip-test-status--err" aria-live="polite">
            <i class="fa-solid fa-circle-xmark" aria-hidden="true"></i> ${escHtml(message)}
          </div>`,
          false,
          false
        );
      },
    });
  }

  private _renderShell(
    status: ReturnType<typeof html>,
    pending: boolean,
    disableSelect: boolean,
    result?: ProviderFetchResult
  ) {
    const models = result?.models ?? [];
    const showModels = Boolean(result && (result.ok || result.rateLimit) && models.length);

    return html`
      <div class="asset-form-section">
        <div class="asset-form-section-title">Test Connection</div>
        <div class="aip-test-row">
          <div class="aip-test-modality-row">
            <label class="aip-test-label" for="aip-test-modality-sel">Modality to test</label>
            <div class="cg-nspopup-wrap">
              <select
                id="aip-test-modality-sel"
                class="cg-nspopup"
                .value=${this._modality}
                ?disabled=${disableSelect}
                @change=${this._onModalityChange}
              >
                <option value="llm">Language / LLM</option>
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="audio">Audio</option>
              </select>
            </div>
          </div>
          <button
            type="button"
            class="toolbar-btn toolbar-btn--shape-soft btn-ai"
            id="aip-test-btn"
            ?disabled=${pending}
            @click=${() => void this._runTest()}
          >
            ${pending
              ? html`<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Testing…`
              : html`<i class="fa-solid fa-plug-circle-check" aria-hidden="true"></i> Test &amp; List Models`}
          </button>
        </div>
        ${status}
        <div id="aip-test-models-wrap" class="aip-test-models-wrap" ?hidden=${!showModels}>
          <label for="aip-test-model-list" class="aip-test-label">Models returned by API</label>
          <select id="aip-test-model-list" class="cg-nspopup aip-test-model-list" size="6" aria-label="Models returned by the API">
            ${models.map((m) => html`<option value=${m.id}>${m.label || m.id}</option>`)}
          </select>
        </div>
      </div>
    `;
  }

  private _idleStatus() {
    return html`<div id="aip-test-status" class="aip-test-status" aria-live="polite">
      <i class="fa-solid fa-circle-info" aria-hidden="true"></i> Select a modality and click Test to verify your key and list available models.
    </div>`;
  }

  private _pendingStatus() {
    return html`<div id="aip-test-status" class="aip-test-status aip-test-status--testing" aria-live="polite">
      <i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Connecting…
    </div>`;
  }

  private _completeStatus(result: ProviderFetchResult) {
    if (result.ok || result.rateLimit) {
      const models = result.models ?? [];
      const countPart = models.length
        ? ` ${models.length} model(s) listed.`
        : ' Key valid — provider does not expose a model listing endpoint.';
      return html`<div id="aip-test-status" class="aip-test-status aip-test-status--ok" aria-live="polite">
        <i class="fa-solid fa-circle-check" aria-hidden="true"></i> Connected.${countPart}
      </div>`;
    }
    return html`<div id="aip-test-status" class="aip-test-status aip-test-status--err" aria-live="polite">
      <i class="fa-solid fa-circle-xmark" aria-hidden="true"></i> ${escHtml(result.message || 'Connection failed.')}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cinegen-aip-test-connection': CinegenAipTestConnection;
  }
}
