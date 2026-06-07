import { html } from 'lit';
import { renderModalShell } from '../modal-shell';

/** Migrated to renderModalShell — body = lead + section settings, default footer. */
export const renderSectionSettingsModal = () => {
  const body = html`
    <p class="section-settings-modal-lead">
      Enable or disable sub-sections for the current project area.
    </p>
    <cinegen-section-settings-modal></cinegen-section-settings-modal>
  `;
  return renderModalShell({
    id: 'section-settings-modal',
    title: 'Section Settings',
    titleIcon: 'fa-solid fa-gear',
    size: 'narrow',
    body,
  });
};
