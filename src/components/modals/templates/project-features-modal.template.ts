import { html } from 'lit';
import { renderModalShell } from '../modal-shell';

/** Migrated to renderModalShell — body = lead + project features, footer = Done. */
export const renderProjectFeaturesModal = () => {
  const body = html`
    <p class="project-features-modal-lead">
      Enable departments and tools for this project, drag to reorder, and show or hide areas without
      deleting your data.
    </p>
    <cinegen-project-features-modal></cinegen-project-features-modal>
  `;
  const footer = html`
    <button type="button" class="toolbar-btn" data-cg-close="project-features-modal">Done</button>
  `;
  return renderModalShell({
    id: 'project-features-modal',
    title: 'Project Features',
    titleIcon: 'fa-solid fa-sliders',
    size: 'narrow',
    body,
    footer,
  });
};
