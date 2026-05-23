import { html } from 'lit';

export const aiProviderInfoModalTemplate = html`
  <cg-modal-shell
    id="ai-provider-info-modal"
    modal-id="ai-provider-info-modal"
    title="AI Provider Information"
    title-icon="fa-solid fa-database"
    size="wide"
    hidden
    aria-hidden="true"
  >
    <cinegen-ai-provider-info slot="body"></cinegen-ai-provider-info>
  </cg-modal-shell>
`;
