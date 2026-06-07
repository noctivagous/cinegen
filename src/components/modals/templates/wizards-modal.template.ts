import { html } from 'lit';
import { renderModalShell } from '../modal-shell';

/** Migrated to renderModalShell — body = tile grid, footer = close. */
export const renderWizardsModal = () => {
  const body = html`
    <p class="settings-modal-lead">Choose a guided workflow to start or enrich your project.</p>
    <cg-modal-tile-grid id="wizards-modal-grid" class="settings-modal-grid"></cg-modal-tile-grid>
  `;

  const footer = html`
    <button type="button" class="toolbar-btn" data-cg-close="wizards-modal">Close</button>
  `;

  return renderModalShell({
    id: 'wizards-modal',
    title: 'Wizards',
    titleIcon: 'fa-solid fa-wand-magic-sparkles',
    body,
    footer,
    dialogClass: 'bevel-raised',
  });
};
