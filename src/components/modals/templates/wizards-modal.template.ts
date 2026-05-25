import { html } from 'lit';

export const wizardsModalTemplate = html`
<div id="wizards-modal" class="settings-modal" hidden aria-hidden="true">
    <div class="settings-modal-backdrop" data-cg-close="wizards-modal" aria-hidden="true"></div>
    <div class="settings-modal-dialog bevel-raised" role="dialog" aria-modal="true" aria-labelledby="wizards-modal-title">
      <div class="settings-modal-header panel-header">
        <span id="wizards-modal-title"><i class="fa-solid fa-wand-magic-sparkles"></i> Wizards</span>
        <button type="button" class="toolbar-btn settings-modal-close" data-cg-close="wizards-modal" aria-label="Close Wizards">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="settings-modal-body panel-content">
        <p class="settings-modal-lead">Choose a guided workflow to start or enrich your project.</p>
        <cg-modal-tile-grid id="wizards-modal-grid" class="settings-modal-grid"></cg-modal-tile-grid>
      </div>
      <div class="settings-modal-footer bevel-sunken">
        <button type="button" class="toolbar-btn" data-cg-close="wizards-modal">Close</button>
      </div>
    </div>
  </div>
`;
