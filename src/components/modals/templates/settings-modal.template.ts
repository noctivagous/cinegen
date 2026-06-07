import { html } from 'lit';
import { renderModalShell } from '../modal-shell';

/** Migrated to renderModalShell — body = tile grid, footer = close. */
export const renderSettingsModal = () => {
  const body = html`
    <p class="settings-modal-lead">Click a tile to open that settings area.</p>
    <cg-modal-tile-grid id="settings-modal-grid" class="settings-modal-grid"></cg-modal-tile-grid>
  `;

  const footer = html`
    <button type="button" class="toolbar-btn" data-cg-close="settings-modal">Close</button>
  `;

  return renderModalShell({
    id: 'settings-modal',
    title: 'Settings',
    titleIcon: 'fa-solid fa-gear',
    body,
    footer,
    dialogClass: 'bevel-raised',
  });
};
