import { html } from 'lit';

/** Storyboard Frame Editor — large modal covering most of the viewport. */
export const storyboardFrameEditorTemplate = html`
<div id="storyboard-frame-editor" class="storyboard-frame-editor" hidden aria-hidden="true">
  <div class="storyboard-frame-editor-backdrop" data-cg-close="storyboard-frame-editor" aria-hidden="true"></div>
  <div class="storyboard-frame-editor-dialog bevel-raised" role="dialog" aria-modal="true" aria-labelledby="sfe-title">
    <div class="storyboard-frame-editor-header panel-header">
      <span id="sfe-title"><i class="fa-solid fa-image"></i> Storyboard Frame Editor</span>
      <button type="button" class="toolbar-btn storyboard-frame-editor-close" data-cg-close="storyboard-frame-editor" aria-label="Close editor">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <div class="storyboard-frame-editor-body panel-content">
      <div class="sfe-layout">
        <div class="sfe-preview">
          <div class="sfe-preview-placeholder">
            <i class="fa-solid fa-video"></i>
            <span>Frame preview</span>
          </div>
        </div>
        <div class="sfe-fields">
          <label class="sfe-field">
            <span class="sfe-field-label">Label</span>
            <input type="text" class="sfe-input sfe-input-label bevel-sunken" placeholder="Frame label" />
          </label>
          <label class="sfe-field">
            <span class="sfe-field-label">Scene</span>
            <input type="text" class="sfe-input sfe-input-scene bevel-sunken" placeholder="Scene number" />
          </label>
          <label class="sfe-field">
            <span class="sfe-field-label">Script Anchor</span>
            <input type="text" class="sfe-input sfe-input-anchor bevel-sunken" placeholder="Linked script text" />
          </label>
          <label class="sfe-field sfe-field-notes">
            <span class="sfe-field-label">Notes</span>
            <textarea class="sfe-input sfe-input-notes bevel-sunken" rows="4" placeholder="Frame notes"></textarea>
          </label>
          <div class="sfe-prompt-section">
            <div class="sfe-prompt-header">
              <span class="sfe-field-label">AI Generation Prompt</span>
              <span class="sfe-prompt-badge sfe-prompt-badge--auto">Auto</span>
              <span class="sfe-prompt-badge sfe-prompt-badge--override hidden">Override</span>
            </div>
            <div class="sfe-prompt-display bevel-sunken">
              <pre class="sfe-prompt-text"></pre>
            </div>
            <label class="sfe-field sfe-field-override">
              <span class="sfe-field-label">User Prompt Override <small>(leave blank to use auto)</small></span>
              <textarea class="sfe-input sfe-input-override bevel-sunken" rows="3" placeholder="Type a custom prompt here to override the auto-generated one..."></textarea>
            </label>
          </div>
        </div>
      </div>
    </div>
    <div class="storyboard-frame-editor-footer bevel-sunken">
      <button type="button" class="toolbar-btn btn-ai sfe-regenerate-btn">
        <i class="fa-solid fa-arrows-rotate"></i> Regenerate Thumbnail
      </button>
      <button type="button" class="toolbar-btn" data-cg-close="storyboard-frame-editor">Close</button>
    </div>
  </div>
</div>
`;
