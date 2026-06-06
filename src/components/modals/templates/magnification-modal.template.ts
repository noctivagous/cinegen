import { html } from 'lit';

export const magnificationModalTemplate = html`
<div id="magnification-modal" class="project-settings-modal" hidden aria-hidden="true">
  <div class="project-settings-modal-backdrop" aria-hidden="true"></div>
  <div class="project-settings-modal-dialog bevel-raised" role="dialog" aria-modal="true" aria-labelledby="magnification-modal-title">
    <div class="project-settings-modal-header panel-header">
      <span id="magnification-modal-title"><i class="fa-solid fa-expand" aria-hidden="true"></i> UI Magnification</span>
      <button type="button" class="toolbar-btn project-settings-modal-close" data-cg-close="magnification-modal" aria-label="Close">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <div class="project-settings-modal-body panel-content">
      <p class="project-settings-lead">Adjust text and control size for the interface.</p>
      <div class="cg-segmented cg-segmented--matte magnification-selector" role="radiogroup" aria-label="Magnification level">
        <button type="button" class="cg-segmented-segment" data-mag-level="0">Small (0.8x)</button>
        <button type="button" class="cg-segmented-segment" data-mag-level="1">Medium (1x)</button>
        <button type="button" class="cg-segmented-segment" data-mag-level="2">Large (1.25x)</button>
        <button type="button" class="cg-segmented-segment" data-mag-level="3">X-Large (1.5x)</button>
      </div>
    </div>
    <div class="project-settings-modal-footer bevel-sunken">
      <button type="button" class="toolbar-btn toolbar-btn--shape-soft" data-cg-close="magnification-modal">Close</button>
    </div>
  </div>
</div>
`;