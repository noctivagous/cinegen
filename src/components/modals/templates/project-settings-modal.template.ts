import { html } from 'lit';

/** Modal markup (IDs preserved for services). */
export const projectSettingsModalTemplate = html`
<div id="project-settings-modal" class="project-settings-modal" hidden aria-hidden="true">
    <div class="project-settings-modal-backdrop" data-cg-close="project-settings-modal" aria-hidden="true"></div>
    <div class="project-settings-modal-dialog bevel-raised" role="dialog" aria-modal="true" aria-labelledby="project-settings-modal-title">
      <div class="project-settings-modal-header panel-header">
        <span id="project-settings-modal-title"><i class="fa-solid fa-folder-open"></i> Project Settings</span>
        <button type="button" class="toolbar-btn project-settings-modal-close" data-cg-close="project-settings-modal" aria-label="Close project settings">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <form id="project-settings-form" class="project-settings-form panel-content" autocomplete="off">
        <p class="project-settings-lead">Applies to the <strong id="project-settings-active-label">active</strong> production. These values drive storyboard framing, export defaults, and timecode display.</p>

        <div class="cg-accordion project-settings-accordion">
          <details class="cg-accordion-section" open>
            <summary class="cg-accordion-header">Identity</summary>
            <div class="cg-accordion-body">
              <div class="cg-accordion-row">
                <label for="project-settings-name">Project name</label>
                <input id="project-settings-name" class="cg-field" type="text" maxlength="120" required>
              </div>
            </div>
          </details>
          <details class="cg-accordion-section" open>
            <summary class="cg-accordion-header">Picture</summary>
            <div class="cg-accordion-body">
              <div class="cg-accordion-row">
                <label for="project-settings-aspect">Aspect ratio</label>
                <div class="cg-nspopup-wrap">
                  <select id="project-settings-aspect" class="cg-nspopup">
                    <option value="16:9">16:9 HD / UHD</option>
                    <option value="9:16">9:16 Vertical (social)</option>
                    <option value="1:1">1:1 Square</option>
                    <option value="21:9">21:9 Ultrawide</option>
                    <option value="2.39:1">2.39:1 Scope</option>
                    <option value="2.00:1">2:1 Full frame (Netflix-style)</option>
                    <option value="1.85:1">1.85:1 Flat</option>
                    <option value="4:3">4:3 Academy / TV</option>
                    <option value="1.37:1">1.37:1 Academy full</option>
                  </select>
                </div>
              </div>
              <div class="cg-accordion-row">
                <label for="project-settings-resolution">Default resolution <small>(480p or 720p; matches aspect)</small></label>
                <div class="cg-nspopup-wrap">
                  <select id="project-settings-resolution" class="cg-nspopup" aria-label="Default resolution by aspect"></select>
                </div>
              </div>
              <div class="cg-accordion-row">
                <label for="project-settings-colorspace">Working color</label>
                <div class="cg-nspopup-wrap">
                  <select id="project-settings-colorspace" class="cg-nspopup">
                    <option value="Rec.709">Rec. 709</option>
                    <option value="Rec.2020">Rec. 2020 / HDR pass-through</option>
                    <option value="ACEScg">ACES cg (proxy)</option>
                    <option value="DisplayP3">Display P3</option>
                  </select>
                </div>
              </div>
            </div>
          </details>
          <details class="cg-accordion-section" open>
            <summary class="cg-accordion-header">Time base</summary>
            <div class="cg-accordion-body">
              <div class="cg-accordion-row">
                <label for="project-settings-fps">Frame rate</label>
                <div class="cg-nspopup-wrap">
                  <select id="project-settings-fps" class="cg-nspopup">
                    <option value="23.976">23.976 (24p NTSC)</option>
                    <option value="24">24.000</option>
                    <option value="25">25 (PAL)</option>
                    <option value="29.97">29.97 (NTSC)</option>
                    <option value="30">30.000</option>
                    <option value="47.95">47.95</option>
                    <option value="48">48</option>
                    <option value="50">50</option>
                    <option value="59.94">59.94</option>
                    <option value="60">60</option>
                  </select>
                </div>
              </div>
              <div class="cg-accordion-row">
                <label for="project-settings-tc-mode">Timecode</label>
                <div class="cg-nspopup-wrap">
                  <select id="project-settings-tc-mode" class="cg-nspopup">
                    <option value="ndf">Non-drop frame</option>
                    <option value="df">Drop frame (29.97 / 59.94)</option>
                  </select>
                </div>
              </div>
            </div>
          </details>
        </div>
      </form>
      <div class="guide-modal-footer bevel-sunken project-settings-modal-footer">
        <span id="project-settings-save-hint" class="project-settings-save-hint">Changes apply to this project only.</span>
        <div class="project-settings-footer-actions">
          <button type="button" class="toolbar-btn toolbar-btn--shape-soft btn-back-to-settings" data-project-settings-action="back"><i class="fa-solid fa-caret-left" aria-hidden="true"></i><span>Back to Settings</span></button>
          <button type="button" class="toolbar-btn toolbar-btn--shape-soft" data-cg-close="project-settings-modal">Cancel</button>
          <button type="button" class="toolbar-btn toolbar-btn--shape-soft btn-ai" data-project-settings-action="save" id="project-settings-save">Save</button>
        </div>
      </div>
    </div>
  </div>
`;
