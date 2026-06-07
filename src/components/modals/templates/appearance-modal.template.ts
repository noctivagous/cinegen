import { html } from 'lit';

export const appearanceModalTemplate = html`
<div id="appearance-modal" class="project-settings-modal" hidden aria-hidden="true">
  <div class="project-settings-modal-backdrop" aria-hidden="true"></div>
  <div class="project-settings-modal-dialog bevel-raised" role="dialog" aria-modal="true" aria-labelledby="appearance-modal-title">
    <div class="project-settings-modal-header panel-header">
      <span id="appearance-modal-title"><i class="fa-solid fa-palette" aria-hidden="true"></i> Appearance Settings</span>
      <button type="button" class="toolbar-btn project-settings-modal-close" data-cg-close="appearance-modal" aria-label="Close">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <div class="project-settings-modal-body panel-content" style="display:flex;flex-direction:column;gap:16px;padding:16px 18px;">
      <fieldset class="cg-fieldset--ns-primary" style="margin:0;padding:var(--space-10px) 10px 10px;border:1px solid #141414;border-top-color:#0a0a0a;border-left-color:#0a0a0a;border-radius:var(--radius-3px);background:var(--bg-inset);box-shadow:inset 0 2px 6px #00000073,inset 0 1px #ffffff0a;">
        <legend style="font-size:var(--text-11px);font-weight:600;color:var(--text);padding:0 2px 8px;float:none;">
          <i class="fa-solid fa-expand" aria-hidden="true"></i> UI Scale
        </legend>
        <p style="font-size:var(--text-10px);color:var(--text-dim);margin:0 0 8px;line-height:1.4;">Adjust text and control size for the interface.</p>
        <div class="cg-segmented cg-segmented--matte magnification-selector" role="radiogroup" aria-label="Magnification level" style="width:100%;">
          <button type="button" class="cg-segmented-segment" data-mag-level="0">Small (1x)</button>
          <button type="button" class="cg-segmented-segment" data-mag-level="1">Medium (1.25x)</button>
          <button type="button" class="cg-segmented-segment" data-mag-level="2">Large (1.5x)</button>
          <button type="button" class="cg-segmented-segment" data-mag-level="3">X-Large (2x)</button>
        </div>
      </fieldset>

      <fieldset class="cg-fieldset--ns-primary" style="margin:0;padding:var(--space-10px) 10px 10px;border:1px solid #141414;border-top-color:#0a0a0a;border-left-color:#0a0a0a;border-radius:var(--radius-3px);background:var(--bg-inset);box-shadow:inset 0 2px 6px #00000073,inset 0 1px #ffffff0a;">
        <legend style="font-size:var(--text-11px);font-weight:600;color:var(--text);padding:0 2px 8px;float:none;">
          <i class="fa-solid fa-font" aria-hidden="true"></i> Fonts
        </legend>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div class="appearance-font-row" style="display:flex;align-items:center;gap:10px;">
            <label style="flex:0 0 100px;font-size:var(--text-10px);color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;">Titlebars</label>
            <select class="cg-nspopup appearance-font-select" data-font-prop="--font-titlebar" style="flex:1;">
              <option value="'Space Grotesk', 'Inter', 'Segoe UI', sans-serif">Space Grotesk</option>
              <option value="'Inter', 'Segoe UI', 'Lucida Grande', sans-serif">Inter</option>
              <option value="'Source Sans 3', 'Courier New', Courier, monospace">Source Sans 3</option>
              <option value="'Saira', 'Inter', 'Segoe UI', sans-serif">Saira</option>
              <option value="'Fira Sans', 'Inter', 'Segoe UI', sans-serif">Fira Sans</option>
              <option value="'Gidole', 'Inter', 'Segoe UI', sans-serif">Gidole</option>
            </select>
          </div>
          <div class="appearance-font-row" style="display:flex;align-items:center;gap:10px;">
            <label style="flex:0 0 100px;font-size:var(--text-10px);color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;">Body</label>
            <select class="cg-nspopup appearance-font-select" data-font-prop="--font-body" style="flex:1;">
              <option value="'Inter', 'Segoe UI', 'Lucida Grande', sans-serif">Inter</option>
              <option value="'Space Grotesk', 'Inter', 'Segoe UI', sans-serif">Space Grotesk</option>
              <option value="'Source Sans 3', 'Courier New', Courier, monospace">Source Sans 3</option>
              <option value="'Fira Sans', 'Inter', 'Segoe UI', sans-serif">Fira Sans</option>
            </select>
          </div>
          <div class="appearance-font-row" style="display:flex;align-items:center;gap:10px;">
            <label style="flex:0 0 100px;font-size:var(--text-10px);color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;">Buttons</label>
            <select class="cg-nspopup appearance-font-select" data-font-prop="--font-btn" style="flex:1;">
              <option value="'Saira', 'Inter', 'Segoe UI', sans-serif">Saira</option>
              <option value="'Inter', 'Segoe UI', 'Lucida Grande', sans-serif">Inter</option>
              <option value="'Space Grotesk', 'Inter', 'Segoe UI', sans-serif">Space Grotesk</option>
              <option value="'Gidole', 'Inter', 'Segoe UI', sans-serif">Gidole</option>
            </select>
          </div>
          <div class="appearance-font-row" style="display:flex;align-items:center;gap:10px;">
            <label style="flex:0 0 100px;font-size:var(--text-10px);color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;">Screenplay</label>
            <select class="cg-nspopup appearance-font-select" data-font-prop="--font-screenplay" style="flex:1;">
              <option value="'Inter', 'Segoe UI', 'Lucida Grande', sans-serif">Inter</option>
              <option value="'Source Sans 3', 'Courier New', Courier, monospace">Source Sans 3</option>
              <option value="'Courier New', Courier, monospace">Courier New</option>
            </select>
          </div>
          <div class="appearance-font-row" style="display:flex;align-items:center;gap:10px;">
            <label style="flex:0 0 100px;font-size:var(--text-10px);color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;">Monospace</label>
            <select class="cg-nspopup appearance-font-select" data-font-prop="--font-mono" style="flex:1;">
              <option value="'JetBrains Mono', 'Courier New', Courier, monospace">JetBrains Mono</option>
              <option value="'Courier New', Courier, monospace">Courier New</option>
            </select>
          </div>
        </div>
      </fieldset>
    </div>
    <div class="project-settings-modal-footer bevel-sunken">
      <button type="button" class="toolbar-btn toolbar-btn--shape-soft" data-cg-close="appearance-modal">Close</button>
    </div>
  </div>
</div>
`;
