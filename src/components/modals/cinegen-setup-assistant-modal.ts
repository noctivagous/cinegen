import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import { setupAssistantModalTemplate } from '@/components/modals/templates/setup-assistant-modal.template';

/** First-launch setup wizard (markup only; logic in setup-assistant-bundle). */
@customElement('cinegen-setup-assistant-modal')
export class CinegenSetupAssistantModal extends CgLightElement {
  render() {
    return html`${setupAssistantModalTemplate}`;
  }
}
