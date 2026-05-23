import { html } from 'lit';

export const sectionSettingsModalTemplate = html`
  <cg-modal-shell
    id="section-settings-modal"
    modal-id="section-settings-modal"
    title="Section Settings"
    title-icon="fa-solid fa-gear"
    size="narrow"
    hidden
    aria-hidden="true"
  >
    <p slot="body" class="section-settings-modal-lead">
      Enable or disable sub-sections for the current project area.
    </p>
    <cinegen-section-settings-modal slot="body"></cinegen-section-settings-modal>
  </cg-modal-shell>
`;
