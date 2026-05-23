import { html, nothing } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import {
  MODALITY_META,
  REQUIRED_ROUTING_MODALITIES,
  ROUTING_MODALITIES,
} from '@/setup-assistant/sa-wizard-constants';
import { getSaWizardApi, getSaWizardState, type AudioCapability } from '@/setup-assistant/sa-wizard-bridge';
import { escHtml } from '@/utils/html';

@customElement('sa-step-done')
export class SaStepDone extends CgLightElement {
  render() {
    const state = getSaWizardState();
    if (!state) return nothing;
    const api = getSaWizardApi();

    // Helper to get submodality chips for audio
    const getAudioSubChips = (vendorId: string | undefined) => {
      if (!vendorId) return '';
      const capabilities: AudioCapability[] = ['tts', 'sfx', 'music'];
      const chips = capabilities.map((cap) => {
        const models = api.cachedAudioModelsByCapability(vendorId, cap);
        const count = models.length;
        return `<span class="sa-done-subchip sa-done-subchip--${cap}${count > 0 ? ' sa-done-subchip--has' : ''}">${cap.toUpperCase()} (${count})</span>`;
      }).join('');
      return chips;
    };

    const rows = ROUTING_MODALITIES.map((mod) => {
      const meta = MODALITY_META[mod];
      const m = state[mod];
      const vendor = m.vendorId ? api.vendorById(m.vendorId) : null;
      let icon = 'fa-solid fa-circle-minus';
      let cls = 'sa-done-empty';
      let label = 'Not assigned';
      if (m.skip) {
        icon = 'fa-solid fa-forward';
        cls = 'sa-done-skipped';
        label = 'Skipped';
      } else if (vendor && m.modelId) {
        icon = 'fa-solid fa-circle-check';
        cls = 'sa-done-ok';
        label = `${vendor.name || api.providerLabel(vendor.providerId)} · ${m.modelLabel || m.modelId}`;
      } else if (vendor) {
        icon = 'fa-solid fa-circle-exclamation';
        cls = 'sa-done-empty';
        label = `${vendor.name || api.providerLabel(vendor.providerId)} (no model)`;
      }

      // Add submodality chips for audio
      const subChips = mod === 'audio' && vendor ? getAudioSubChips(vendor.id) : '';

      return html`
        <div class="sa-done-row ${cls}">
          <i class="${icon}" aria-hidden="true"></i>
          <div>
            <span class="sa-badge ${meta.badgeClass}">${meta.badge}</span>
            <strong>${escHtml(meta.label)}</strong>
            ${subChips ? html`<span class="sa-done-subchips">${unsafeHTML(subChips)}</span>` : nothing}
            <span class="sa-done-label">${escHtml(label)}</span>
          </div>
        </div>
      `;
    });

    const hasRequired =
      api.coverageSatisfied() &&
      REQUIRED_ROUTING_MODALITIES.every((mod) => Boolean(state[mod].modelId));

    return html`
      <div class="sa-step-section sa-done-section">
        <h3 class="sa-step-title">
          <i class="fa-solid fa-check-circle" aria-hidden="true"></i> Setup Summary
        </h3>
        ${!hasRequired
          ? html`
              <div class="sa-done-warning">
                <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
                <div>
                  <strong>Setup incomplete.</strong>
                  <p>
                    Text, Video, and Image / Storyboards need a provider, key, and default model.
                    Finish in Settings or run this wizard again.
                  </p>
                </div>
              </div>
            `
          : nothing}
        <div class="sa-done-list">${rows}</div>
        <div class="sa-done-actions">
          <button
            type="button"
            class="toolbar-btn toolbar-btn--shape-soft"
            @click=${() => {
              window.closeSetupAssistant?.();
              window.openAiProvidersModal?.('providers');
            }}
          >
            <i class="fa-solid fa-key" aria-hidden="true"></i> Review API keys &amp; providers
          </button>
        </div>
        <p class="sa-done-note">
          Click <strong>Start CineGen</strong> to save and begin. You can return to this wizard anytime
          via <strong>AI Assist → App Setup Assistant</strong>.
        </p>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sa-step-done': SaStepDone;
  }
}
