import { html } from 'lit';

export const setupAssistantModalTemplate = html`
<div id="setup-assistant-modal" class="setup-assistant-modal" hidden aria-hidden="true">
  <div class="setup-assistant-backdrop" aria-hidden="true"></div>
  <div class="setup-assistant-dialog bevel-raised" role="dialog" aria-modal="true" aria-labelledby="sa-title">
    <div class="setup-assistant-header panel-header">
      <span id="sa-title"><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> App Setup Assistant</span>
      <button type="button" class="toolbar-btn setup-assistant-close" aria-label="Close Setup Assistant">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <div id="sa-rail" class="sa-rail" role="tablist" aria-label="Setup steps"></div>
    <cinegen-sa-step-host id="sa-body" class="sa-body panel-content"></cinegen-sa-step-host>
    <div class="sa-footer bevel-sunken">
      <span id="sa-footer-hint" class="sa-footer-hint"></span>
      <div class="sa-footer-actions">
        <button type="button" class="toolbar-btn toolbar-btn--shape-soft" id="sa-btn-skip" hidden>Skip</button>
        <button type="button" class="toolbar-btn toolbar-btn--shape-soft" id="sa-btn-back" hidden>
          <i class="fa-solid fa-caret-left" aria-hidden="true"></i> Back
        </button>
        <button type="button" class="toolbar-btn toolbar-btn--shape-soft btn-ai" id="sa-btn-next">
          Next <i class="fa-solid fa-caret-right" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  </div>
  <div id="sa-alert-modal" class="sa-alert-modal" hidden aria-hidden="true">
    <div class="sa-alert-modal-layer" role="alertdialog" aria-modal="true" aria-labelledby="sa-alert-title-text" aria-describedby="sa-alert-message">
      <div class="sa-alert-dialog bevel-raised">
        <div class="sa-alert-header panel-header">
          <span id="sa-alert-title"><i id="sa-alert-icon" class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> <span id="sa-alert-title-text">Connection test failed</span></span>
        </div>
        <div id="sa-alert-message" class="sa-alert-body panel-content"></div>
        <div class="sa-alert-footer bevel-sunken">
          <button type="button" id="sa-alert-ok" class="toolbar-btn toolbar-btn--shape-soft btn-ai">OK</button>
        </div>
      </div>
    </div>
  </div>
</div>
`;
