import { html } from 'lit';

const WIZARD_MODALS = [
  {
    id: 'script-wizard-modal',
    title: 'Start from Script',
    icon: 'fa-solid fa-scroll',
  },
  {
    id: 'visual-wizard-modal',
    title: 'Visual-First Entry',
    icon: 'fa-solid fa-image',
  },
  {
    id: 'concept-wizard-modal',
    title: 'Concept / Mood First',
    icon: 'fa-solid fa-palette',
  },
  {
    id: 'asset-wizard-modal',
    title: 'Asset Library Import',
    icon: 'fa-solid fa-boxes-stacked',
  },
  {
    id: 'storyboard-wizard-modal',
    title: 'Storyboard Sketch Mode',
    icon: 'fa-solid fa-pen-ruler',
  },
] as const;

/** 5 entry-point wizard shells rendered inside cg-modal-shell. */
export const entryWizardModalsTemplate = html`
  ${WIZARD_MODALS.map(
    (m) => html`
      <cg-modal-shell
        id="${m.id}"
        modal-id="${m.id}"
        title="${m.title}"
        title-icon="${m.icon}"
        hidden
        aria-hidden="true"
      >
        <cinegen-entry-wizard-body
          slot="body"
          .id="${m.id}-body"
        ></cinegen-entry-wizard-body>
        <div slot="footer" class="guide-modal-footer entry-wizard-footer">
          <button type="button" class="toolbar-btn" .id="${m.id}-prev">
            <i class="fa-solid fa-chevron-left"></i> Previous
          </button>
          <span .id="${m.id}-progress" class="guide-modal-progress entry-wizard-progress"></span>
          <button type="button" class="toolbar-btn" .id="${m.id}-next">
            Next <i class="fa-solid fa-chevron-right"></i>
          </button>
          <button type="button" class="toolbar-btn" data-cg-close="${m.id}">Close</button>
        </div>
      </cg-modal-shell>
    `
  )}
`;
