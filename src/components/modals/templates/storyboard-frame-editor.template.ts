import { html } from 'lit';

export const storyboardFrameEditorTemplate = html`
<div id="storyboard-frame-editor" class="storyboard-frame-editor" hidden aria-hidden="true">
  <div class="storyboard-frame-editor-backdrop" data-cg-close="storyboard-frame-editor" aria-hidden="true"></div>
  <div class="storyboard-frame-editor-dialog bevel-raised" role="dialog" aria-modal="true" aria-labelledby="sfe-title">
    <div class="storyboard-frame-editor-header panel-header">
      <span id="sfe-title"><i class="fa-solid fa-pen-ruler"></i> Shot Designer</span>
      <button type="button" class="toolbar-btn storyboard-frame-editor-close" data-cg-close="storyboard-frame-editor" aria-label="Close">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <div class="storyboard-frame-editor-body panel-content" style="display:flex;flex-direction:column;overflow:hidden;padding:0">
      <cinegen-shot-designer id="shot-designer-modal" style="flex:1;min-height:0"></cinegen-shot-designer>
    </div>
    <div class="storyboard-frame-editor-footer bevel-sunken">
      <button type="button" class="toolbar-btn" data-cg-close="storyboard-frame-editor">Close</button>
    </div>
  </div>
</div>
`;
