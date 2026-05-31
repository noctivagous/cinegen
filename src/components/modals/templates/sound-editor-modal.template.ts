import { html } from 'lit';

export const soundEditorModalTemplate = html`
  <cg-modal-shell
    id="sound-editor-modal"
    modal-id="sound-editor-modal"
    title="Sound Editor"
    title-icon="fa-solid fa-wave-square"
    size="wide"
    hidden
    aria-hidden="true"
  >
    <cinegen-sound-editor-modal slot="body"></cinegen-sound-editor-modal>
  </cg-modal-shell>
`;
