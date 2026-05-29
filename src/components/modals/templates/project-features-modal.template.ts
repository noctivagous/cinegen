import { html } from 'lit';

export const projectFeaturesModalTemplate = html`
  <cg-modal-shell
    id="project-features-modal"
    modal-id="project-features-modal"
    title="Project Features"
    title-icon="fa-solid fa-sliders"
    size="narrow"
    hidden
    aria-hidden="true"
  >
    <p slot="body" class="project-features-modal-lead">
      Enable departments and tools for this project, drag to reorder, and show or hide areas without
      deleting your data.
    </p>
    <cinegen-project-features-modal slot="body"></cinegen-project-features-modal>
    <div slot="footer" class="project-features-modal-footer">
      <button type="button" class="toolbar-btn" data-cg-close="project-features-modal">Done</button>
    </div>
  </cg-modal-shell>
`;
