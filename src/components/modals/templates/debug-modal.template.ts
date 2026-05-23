import { html } from 'lit';

export const debugModalTemplate = html`
<div id="debug-modal" class="debug-modal" hidden aria-hidden="true">
    <div class="debug-modal-backdrop" data-cg-close="debug-modal" aria-hidden="true"></div>
    <div class="debug-modal-dialog bevel-raised" role="dialog" aria-modal="true" aria-labelledby="debug-modal-title" style="max-height:90vh;display:flex;flex-direction:column">
      <div class="debug-modal-header panel-header">
        <span id="debug-modal-title"><i class="fa-solid fa-bug"></i> AI Generation Debug</span>
        <button type="button" class="toolbar-btn debug-modal-close" data-cg-close="debug-modal" aria-label="Close debug modal">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <cinegen-debug-modal-body style="flex:1;min-height:0;overflow:hidden"></cinegen-debug-modal-body>
      <div class="debug-modal-footer bevel-sunken">
        <button type="button" class="toolbar-btn" data-cg-close="debug-modal">Close</button>
      </div>
    </div>
  </div>
`;
