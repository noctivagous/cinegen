import { html } from 'lit';
import { renderModalShell } from '../modal-shell';

const WIZARD_MODALS = [
  { id: 'script-wizard-modal', title: 'Start from Script', icon: 'fa-solid fa-scroll' },
  { id: 'visual-wizard-modal', title: 'Visual-First Entry', icon: 'fa-solid fa-image' },
  { id: 'concept-wizard-modal', title: 'Concept / Mood First', icon: 'fa-solid fa-palette' },
  { id: 'asset-wizard-modal', title: 'Asset Library Import', icon: 'fa-solid fa-boxes-stacked' },
  { id: 'storyboard-wizard-modal', title: 'Storyboard Sketch Mode', icon: 'fa-solid fa-pen-ruler' },
] as const;

/** 5 entry-point wizard shells — migrated to renderModalShell. */
export const renderEntryWizardModals = () => html`
  ${WIZARD_MODALS.map(
    (m) => {
      const body = html`<cinegen-entry-wizard-body id="${m.id}-body"></cinegen-entry-wizard-body>`;
      const footer = html`
        <button type="button" class="toolbar-btn" id="${m.id}-prev">
          <i class="fa-solid fa-chevron-left"></i> Previous
        </button>
        <span id="${m.id}-progress" class="guide-modal-progress entry-wizard-progress"></span>
        <button type="button" class="toolbar-btn" id="${m.id}-next">
          Next <i class="fa-solid fa-chevron-right"></i>
        </button>
        <button type="button" class="toolbar-btn" data-cg-close="${m.id}">Close</button>
      `;
      return renderModalShell({
        id: m.id,
        title: m.title,
        titleIcon: m.icon,
        body,
        footer,
      });
    }
  )}
`;
