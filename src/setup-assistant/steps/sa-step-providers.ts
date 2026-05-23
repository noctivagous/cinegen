import { html, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { CgLightElement } from '@/components/lit-base';
import { getSaWizardApi } from '@/setup-assistant/sa-wizard-bridge';

/**
 * Providers step — markup still built in setup-assistant-bundle (catalog helpers);
 * rendered here so the host owns the step boundary.
 */
@customElement('sa-step-providers')
export class SaStepProviders extends CgLightElement {
  render() {
    const markup = getSaWizardApi().renderProvidersMarkup?.() ?? '';
    if (!markup) return nothing;
    return html`${unsafeHTML(markup)}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sa-step-providers': SaStepProviders;
  }
}
