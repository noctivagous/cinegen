import { classMap } from 'lit/directives/class-map.js';
import { html, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { CgLightElement } from '@/components/lit-base';
import { MODALITY_META, ROUTING_MODALITIES } from '@/setup-assistant/sa-wizard-constants';
import { getSaWizardApi, getSaWizardState } from '@/setup-assistant/sa-wizard-bridge';
import { escHtml } from '@/utils/html';

@customElement('sa-step-models')
export class SaStepModels extends CgLightElement {
  render() {
    const state = getSaWizardState();
    if (!state) return nothing;
    const api = getSaWizardApi();

    const blocks = [];
    for (const mod of ROUTING_MODALITIES) {
      const m = state[mod];
      if (m.skip || !m.vendorId) continue;
      const meta = MODALITY_META[mod];
      const vendor = api.vendorById(m.vendorId);
      const catalogModels = api.catalogModels(m.providerId ?? '', mod);
      const allModels = api.mergeModels(m.listedModels ?? [], catalogModels);
      const needsBaseUrl = ['openai-compatible', 'generic-rest'].includes(m.providerId ?? '');
      const statusClass = m.status ? `sa-test-status--${m.status}` : '';

      blocks.push(html`
        <div class="sa-models-block" data-mod=${mod}>
          <h4 class="sa-models-block-title">${escHtml(meta.label)}</h4>
          <p class="sa-step-desc">
            Provider: <strong>${escHtml(vendor?.name || api.providerLabel(m.providerId ?? ''))}</strong>
          </p>
          <div class="sa-test-row">
            <button type="button" class="toolbar-btn toolbar-btn--shape-soft btn-ai" id="sa-test-btn-${mod}">
              <i class="fa-solid fa-plug-circle-check" aria-hidden="true"></i> Test &amp; list models
            </button>
            <div id="sa-test-status-${mod}" class="sa-test-status ${statusClass}">
              ${unsafeHTML(api.statusMessageHtml(m))}
            </div>
          </div>
          <div
            id="sa-baseurl-row-${mod}"
            class=${classMap({ 'cg-accordion-row': true, hidden: !needsBaseUrl })}
          >
            <label for="sa-baseurl-${mod}">Base URL <small>(optional)</small></label>
            <input id="sa-baseurl-${mod}" class="cg-field" type="url" .value=${m.baseUrl ?? ''} />
          </div>
          <div class="cg-accordion-row">
            <label for="sa-model-${mod}">Default model</label>
            <div class="cg-nspopup-wrap">
              <select id="sa-model-${mod}" class="cg-nspopup">
                ${allModels.map(
                  (model) => html`
                    <option value=${model.id} ?selected=${model.id === m.modelId}>
                      ${escHtml(model.label)}
                    </option>
                  `
                )}
              </select>
            </div>
          </div>
          <p id="sa-model-caps-${mod}" class="sa-model-caps">
            ${api.modelCapsText(m.providerId ?? '', mod, m.modelId ?? '')}
          </p>
        </div>
      `);
    }

    return html`
      <div class="sa-step-section">
        <h3 class="sa-step-title">
          <i class="fa-solid fa-sliders" aria-hidden="true"></i> Default models
        </h3>
        <p class="sa-step-desc">Test each assignment and choose the default model for that task.</p>
        ${blocks.length
          ? blocks
          : html`<p class="sa-wiz-muted">No modalities assigned — go back to the coverage step.</p>`}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sa-step-models': SaStepModels;
  }
}
