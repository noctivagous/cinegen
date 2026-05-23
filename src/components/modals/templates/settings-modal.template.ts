import { html } from 'lit';

/** Modal markup (IDs preserved for services). */
export const settingsModalTemplate = html`
<div id="settings-modal" class="settings-modal" hidden aria-hidden="true">
    <div class="settings-modal-backdrop" data-cg-close="settings-modal" aria-hidden="true"></div>
    <div class="settings-modal-dialog bevel-raised" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
      <div class="settings-modal-header panel-header">
        <span id="settings-modal-title"><i class="fa-solid fa-gear"></i> Settings</span>
        <button type="button" class="toolbar-btn settings-modal-close" data-cg-close="settings-modal" aria-label="Close settings">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="settings-modal-body panel-content">
        <p class="settings-modal-lead">Click a tile to open that settings area.</p>
        <cg-modal-tile-grid id="settings-modal-grid" class="settings-modal-grid"></cg-modal-tile-grid>
      </div>
      <div class="settings-modal-footer bevel-sunken">
        <button type="button" class="toolbar-btn" data-cg-close="settings-modal">Close</button>
      </div>
    </div>
  </div>
`;
