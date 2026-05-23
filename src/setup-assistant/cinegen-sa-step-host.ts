import { html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import type { SaStepId } from '@/setup-assistant/sa-step-ids';
import './steps/index';

/** Setup assistant body — switches step subcomponents (Lit render owner). */
@customElement('cinegen-sa-step-host')
export class CinegenSaStepHost extends CgLightElement {
  @state() private _stepId: SaStepId | '' = '';

  showWelcome(): void {
    this._stepId = 'welcome';
    this.requestUpdate();
  }

  showStep(stepId: SaStepId): void {
    this._stepId = stepId;
    this.requestUpdate();
  }

  get stepId(): SaStepId | '' {
    return this._stepId;
  }

  render() {
    switch (this._stepId) {
      case 'welcome':
        return html`<sa-step-welcome></sa-step-welcome>`;
      case 'providers':
        return html`<sa-step-providers></sa-step-providers>`;
      case 'coverage':
        return html`<sa-step-coverage></sa-step-coverage>`;
      case 'models':
        return html`<sa-step-models></sa-step-models>`;
      case 'done':
        return html`<sa-step-done></sa-step-done>`;
      default:
        return nothing;
    }
  }
}

export function getSaStepHost(): CinegenSaStepHost | null {
  return document.querySelector<CinegenSaStepHost>('cinegen-sa-step-host#sa-body');
}

declare global {
  interface HTMLElementTagNameMap {
    'cinegen-sa-step-host': CinegenSaStepHost;
  }
}
