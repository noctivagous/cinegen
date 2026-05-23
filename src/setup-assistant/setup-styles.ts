/**
 * Injects the setup-assistant modal styles once into the document head.
 */

const SETUP_STYLES_CSS = `
/* ── Setup Assistant Modal ─────────────────────────────── */
.setup-assistant-modal {
  position: fixed; inset: 0; z-index: 1100;
  display: flex; align-items: center; justify-content: center;
}
.setup-assistant-modal[hidden] {
  display: none !important;
}
.setup-assistant-backdrop {
  position: absolute; inset: 0;
  background: rgba(0,0,0,.65);
  backdrop-filter: blur(3px);
}
.setup-assistant-dialog {
  position: relative; z-index: 1;
  width: min(780px, calc(100vw - 32px));
  max-height: calc(100vh - 48px);
  display: flex; flex-direction: column;
  border-radius: 4px;
  background: var(--bg-dark);
  overflow: hidden;
}
.setup-assistant-header {
  flex: 0 0 auto;
}
.setup-assistant-close {
  margin-left: auto;
}

/* Rail */
.sa-rail {
  display: flex; flex-wrap: nowrap; gap: 0;
  background: color-mix(in srgb, var(--bg-panel) 80%, #000);
  border-bottom: 1px solid var(--border-dark);
  overflow-x: auto;
  flex: 0 0 auto;
  scrollbar-width: none;
}
.sa-rail::-webkit-scrollbar { display: none; }
.sa-rail-step {
  display: flex; flex-direction: column; align-items: center;
  gap: 4px; padding: 8px 10px;
  min-width: 72px; flex: 1;
  border-right: 1px solid var(--border-dark);
  opacity: .45; font-size: 10px;
  color: var(--text-dim);
  transition: opacity .15s, background .15s;
  margin: 0; font: inherit; line-height: inherit;
  background: transparent; border-top: none; border-bottom: none; border-left: none;
}
button.sa-rail-step { appearance: none; -webkit-appearance: none; }
.sa-rail-step:last-child { border-right: none; }
.sa-rail-step--clickable { cursor: pointer; }
.sa-rail-step--clickable:hover:not(.sa-rail-step--active) {
  opacity: .88;
  background: color-mix(in srgb, var(--accent-blue) 8%, transparent);
}
.sa-rail-step--clickable:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--accent-blue) 70%, transparent);
  outline-offset: -2px;
}
.sa-rail-step--locked { cursor: default; pointer-events: none; }
.sa-rail-step--done {
  opacity: .75;
  color: var(--text-main);
}
.sa-rail-step--active {
  opacity: 1;
  color: var(--text-highlight);
  background: color-mix(in srgb, var(--accent-blue) 12%, transparent);
}
.sa-rail-dot {
  width: 22px; height: 22px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%;
  background: color-mix(in srgb, var(--bg-panel) 60%, transparent);
  font-size: 11px;
}
.sa-rail-step--active .sa-rail-dot {
  background: color-mix(in srgb, var(--accent-blue) 30%, transparent);
  color: #88c0f0;
}
.sa-rail-step--done .sa-rail-dot {
  color: #6cbe6c;
}
.sa-rail-label { font-weight: 600; letter-spacing: .04em; text-transform: uppercase; font-size: 9px; }

/* Body */
.sa-body {
  flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden;
  background: var(--bg-inset);
}

/* Footer */
.sa-footer {
  flex: 0 0 auto;
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px;
}
.sa-footer-hint { flex: 1; font-size: 10px; color: var(--text-dim); }
.sa-footer-actions { display: flex; gap: 6px; }

/* Welcome */
.sa-welcome {
  padding: 28px 32px 24px;
  display: flex; flex-direction: column; align-items: center; text-align: center;
}
.sa-welcome-logo { font-size: 40px; color: var(--accent-blue); margin-bottom: 12px; opacity: .85; }
.sa-welcome-title { font-size: 18px; font-weight: 700; color: var(--text-highlight); margin: 0 0 8px; }
.sa-welcome-lead { color: var(--text-main); margin: 0 0 20px; max-width: 520px; line-height: 1.5; }
.sa-modality-overview {
  width: 100%; max-width: 520px;
  border: 1px solid var(--border-dark);
  border-radius: 3px; overflow: hidden; margin-bottom: 20px;
  text-align: left;
}
.sa-modality-row {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-dark);
  font-size: 11px;
}
.sa-modality-row:last-child { border-bottom: none; }
.sa-modality-icon { font-size: 14px; color: var(--text-dim); margin-top: 2px; flex: 0 0 auto; }
.sa-modality-hint { display: block; color: var(--text-dim); margin-top: 2px; }
.sa-welcome-note { font-size: 10px; color: var(--text-dim); max-width: 520px; margin: 0; }

/* Step sections */
.sa-step-section { padding: 20px 24px 24px; }
.sa-step-title {
  font-size: 13px; font-weight: 700; color: var(--text-highlight);
  margin: 0 0 6px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}
.sa-step-skip-note { font-size: 10px; color: var(--text-dim); font-weight: 400; }
.sa-step-desc { color: var(--text-main); margin: 0 0 6px; font-size: 11px; line-height: 1.5; }
.sa-step-tip {
  font-size: 10px; color: var(--text-dim);
  background: color-mix(in srgb, var(--accent-blue) 8%, var(--bg-panel));
  border-left: 2px solid color-mix(in srgb, var(--accent-blue) 50%, transparent);
  padding: 6px 10px; margin: 0 0 16px; border-radius: 0 2px 2px 0;
}

/* Storage step */
.sa-label { display: block; font-size: 10px; color: var(--text-dim); margin-bottom: 4px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; }
.sa-proxy-input-row { display: flex; gap: 6px; }
.sa-proxy-input-row .cg-field { flex: 1; }

/* Test status */
.sa-test-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
.sa-test-status {
  font-size: 10px; color: var(--text-dim);
  display: flex; align-items: center; gap: 5px;
}
.sa-test-status--ok        { color: #6cbe6c; }
.sa-test-status--ratelimit { color: #b0b87a; }
.sa-test-status--err       { color: #d46060; }
.sa-test-status--cors      { color: #d4a060; }
.sa-test-status--testing   { color: var(--text-dim); }

/* Badges */
.sa-badge {
  display: inline-flex; align-items: center;
  padding: 1px 6px; border-radius: 2px;
  font-size: 9px; font-weight: 700; letter-spacing: .06em;
  text-transform: uppercase; line-height: 16px;
  white-space: nowrap;
}
.sa-badge--required    { background: color-mix(in srgb, #c94444 25%, var(--bg-panel)); color: #e88; border: 1px solid #c9444460; }
.sa-badge--recommended { background: color-mix(in srgb, #d4a040 20%, var(--bg-panel)); color: #dba; border: 1px solid #d4a04060; }
.sa-badge--optional    { background: color-mix(in srgb, var(--accent-blue) 15%, var(--bg-panel)); color: #8ab4d8; border: 1px solid color-mix(in srgb, var(--accent-blue) 40%, transparent); }

/* Model caps */
.sa-model-caps { font-size: 10px; color: var(--text-dim); margin: 4px 0 0; padding-left: 2px; line-height: 1.45; }

/* Done / summary */
.sa-done-section { padding-bottom: 16px; }
.sa-done-list { display: flex; flex-direction: column; gap: 0; margin: 16px 0; border: 1px solid var(--border-dark); border-radius: 3px; overflow: hidden; }
.sa-done-row {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 14px; font-size: 11px;
  border-bottom: 1px solid var(--border-dark);
}
.sa-done-row:last-child { border-bottom: none; }
.sa-done-row > i { font-size: 15px; margin-top: 2px; flex: 0 0 auto; }
.sa-done-ok > i    { color: #6cbe6c; }
.sa-done-skipped > i { color: var(--text-dim); }
.sa-done-empty > i { color: #d46060; }
.sa-done-label { color: var(--text-dim); margin-left: 6px; }
.sa-done-model { display: block; font-size: 10px; color: var(--text-dim); margin-top: 2px; }
.sa-done-note  { font-size: 10px; color: var(--text-dim); margin: 12px 0 0; }
.sa-done-actions { margin-top: 8px; }
.sa-done-warning {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 14px; font-size: 11px; line-height: 1.5;
  background: color-mix(in srgb, #c94444 12%, var(--bg-panel));
  border: 1px solid #c9444440; border-radius: 3px; margin-bottom: 12px;
}
.sa-done-warning > i { color: #e88; flex: 0 0 auto; margin-top: 2px; font-size: 14px; }
.sa-done-warning p { margin: 4px 0 0; }

/* Submodality chips on Done page */
.sa-done-subchips { display: inline-flex; gap: 4px; margin: 0 6px; }
.sa-done-subchip {
  display: inline-block;
  padding: 1px 4px; border-radius: 2px;
  font-size: 9px; font-weight: 600; letter-spacing: 0.02em;
  color: var(--text-dim);
  background: color-mix(in srgb, var(--bg-panel) 80%, #000);
  border: 1px solid var(--border-dark);
}
.sa-done-subchip--has { color: var(--text-highlight); }
.sa-done-subchip--tts.sa-done-subchip--has   { background: color-mix(in srgb, #7ecbf7 30%, var(--bg-panel)); border-color: color-mix(in srgb, #7ecbf7 50%, transparent); }
.sa-done-subchip--sfx.sa-done-subchip--has   { background: color-mix(in srgb, #f77ec7 30%, var(--bg-panel)); border-color: color-mix(in srgb, #f77ec7 50%, transparent); }
.sa-done-subchip--music.sa-done-subchip--has { background: color-mix(in srgb, #a47ef7 30%, var(--bg-panel)); border-color: color-mix(in srgb, #a47ef7 50%, transparent); }

/* Accordion within setup assistant: remove narrow max-width */
.setup-assistant-dialog .cg-accordion {
  max-width: none;
}
.setup-assistant-dialog .cg-accordion-row label {
  flex: 0 0 80px;
}

.sa-coverage-table {
  width: 100%; border-collapse: collapse; font-size: 11px; margin: 12px 0;
  border: 1px solid var(--border-dark); border-radius: 3px; overflow: hidden;
}
.sa-coverage-table th, .sa-coverage-table td {
  padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--border-dark);
  vertical-align: middle;
}
.sa-coverage-table th { background: color-mix(in srgb, var(--bg-panel) 90%, #000); font-weight: 600; font-size: 10px; text-transform: uppercase; color: var(--text-dim); }
.sa-coverage-table tr:last-child td { border-bottom: none; }
.sa-coverage-skip-label { display: inline-flex; align-items: center; gap: 6px; margin-right: 8px; font-size: 10px; color: var(--text-dim); }
.sa-coverage-model-wrap { margin-top: 8px; display: flex; flex-direction: column; gap: 6px; }
.sa-coverage-model-wrap.hidden { display: none; }
.sa-coverage-baseurl-row { margin-top: 4px; }
.sa-coverage-baseurl-row.hidden { display: none; }
.sa-coverage-model-select { width: 100%; }
.sa-coverage-table td .sa-test-row { margin-top: 0; margin-bottom: 6px; }

/* Provider and Model field labels */
.sa-coverage-provider-row,
.sa-coverage-model-row { display: flex; align-items: center; gap: 8px; margin: 6px 0; }
.sa-coverage-provider-row.hidden,
.sa-coverage-model-row.hidden { display: none; }
.sa-coverage-field-label {
  font-size: 10px; color: var(--text-dim); white-space: nowrap;
  flex: 0 0 auto; min-width: 50px;
}
.sa-coverage-provider-row .cg-nspopup-wrap,
.sa-coverage-model-row .cg-nspopup-wrap { flex: 1 1 auto; }

/* Audio sub-modalities table (TTS, SFX, Music) */
.sa-audio-sub-table {
  width: 100%; border-collapse: collapse; font-size: 10px;
  margin: 8px 0; background: color-mix(in srgb, var(--bg-panel) 95%, #000);
  border: 1px solid var(--border-dark); border-radius: 3px;
}
.sa-audio-sub-table td {
  padding: 6px 8px; border-bottom: 1px solid var(--border-dark); vertical-align: middle;
}
.sa-audio-sub-table tr:last-child td { border-bottom: none; }
.sa-audio-sub-label {
  width: 35%; font-size: 10px; color: var(--text-dim); white-space: nowrap; vertical-align: top; padding-top: 8px;
}
.sa-audio-sub-select {
  width: 65%;
}
.sa-audio-sub-field {
  display: flex; align-items: center; gap: 6px; margin: 4px 0;
}
.sa-audio-sub-field .sa-coverage-field-label {
  min-width: 45px; font-size: 9px;
}
.sa-audio-sub-field .cg-nspopup-wrap {
  flex: 1 1 auto; margin: 0;
}
.sa-audio-sub-field select { width: 100%; font-size: 10px; }

/* Advanced toggle section for API URLs */
.sa-coverage-advanced { margin-top: 8px; font-size: 10px; }
.sa-coverage-advanced-summary {
  cursor: pointer; color: var(--text-dim); font-size: 10px;
  display: flex; align-items: center; gap: 4px; user-select: none;
}
.sa-coverage-advanced-summary::before {
  content: '▶'; font-size: 8px; transition: transform 0.2s;
}
.sa-coverage-advanced[open] .sa-coverage-advanced-summary::before {
  transform: rotate(90deg);
}
.sa-coverage-advanced-content {
  padding: 8px 0 4px 12px; border-left: 1px solid var(--border-dark);
  margin-left: 4px;
}
.sa-coverage-advanced .sa-coverage-baseurl-row {
  display: flex; align-items: center; gap: 8px; margin: 0;
}
.sa-coverage-advanced .sa-coverage-baseurl-row.hidden { display: none; }
.sa-coverage-advanced .cg-field { flex: 1 1 auto; font-size: 10px; }

.sa-wiz-add-panel { padding: 12px; margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
.sa-wiz-muted { color: var(--text-dim); font-size: 11px; }
.sa-wiz-empty { text-align: center; color: var(--text-dim); padding: 16px; }
.sa-wiz-vendor-actions { display: flex; gap: 6px; flex-wrap: wrap; }

.sa-prov-step .sa-step-desc { margin-bottom: 10px; }
.sa-prov-catalog { display: flex; flex-direction: column; gap: 14px; margin-bottom: 16px; }
.sa-prov-section { padding: 0 2px; }
.sa-prov-section-title {
  font-size: 12px; font-weight: 600; color: var(--text-highlight);
  margin: 0 0 6px; letter-spacing: 0.02em;
}
.sa-prov-section-desc, .sa-prov-subsection-label {
  font-size: 10px; line-height: 1.45; color: var(--text-dim); margin: 0 0 8px;
}
.sa-prov-subsection-label {
  font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;
  margin-top: 4px;
}
.sa-prov-rows { display: flex; flex-direction: column; gap: 6px; }
.sa-prov-matrix {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 8px;
  align-items: start;
}
.sa-prov-card-wrapper {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 100%;
  border-radius: 4px;
}
.sa-prov-card {
  display: flex; flex-direction: column;
  border: 1px solid var(--border-dark); border-radius: 4px;
  background: color-mix(in srgb, var(--bg-panel) 92%, #000);
  overflow: hidden;
  transition: border-color .2s, background .2s, box-shadow .2s;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
  min-height: 108px;
}
.sa-prov-card:hover:not(.sa-prov-card--active) {
  border-color: color-mix(in srgb, var(--border-light) 50%, var(--border-dark));
  background: color-mix(in srgb, var(--bg-panel) 78%, #000);
}
.sa-prov-card--active {
  border-color: color-mix(in srgb, var(--border-light) 70%, #fff);
  background: color-mix(in srgb, var(--bg-panel) 55%, #fff);
  color: #1a1a1a;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  border-radius: 4px 4px 0 0;
}
.sa-prov-card--active .sa-prov-name,
.sa-prov-card--active .sa-prov-blurb {
  color: #1a1a1a;
}
.sa-prov-toggle {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; width: 100%; text-align: left;
  background: transparent; border: none; cursor: pointer;
  color: inherit; font-family: inherit;
  pointer-events: none;
}
.sa-prov-card:hover .sa-prov-toggle {
  background: transparent;
}
.sa-prov-card-text {
  flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px;
}
.sa-prov-toggle-indicator {
  flex: 0 0 18px; width: 18px; height: 18px;
  border-radius: 2px; border: 2px solid #111;
  background: rgba(0, 0, 0, 0.75);
  position: relative; transition: border-color .2s, background .2s;
}
.sa-prov-card--active .sa-prov-toggle-indicator {
  border-color: #222;
  background: transparent;
}
.sa-prov-card--active.sa-prov-card--catalog-loaded .sa-prov-toggle-indicator {
  border-color: #3a8f3a;
  background: #3a8f3a;
}
.sa-prov-card--active.sa-prov-card--catalog-loaded .sa-prov-toggle-indicator::after {
  content: ''; position: absolute; left: 5px; top: 2px;
  width: 4px; height: 8px; border: solid #fff;
  border-width: 0 2px 2px 0; transform: rotate(45deg);
}
.sa-prov-card-details {
  padding: 10px 12px; display: flex; flex-direction: column; gap: 8px;
  background: color-mix(in srgb, var(--bg-panel) 88%, #000);
  border: 1px solid var(--border-dark); border-top: none;
  border-radius: 0 0 4px 4px;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
}
.sa-prov-card-details.hidden { display: none; }
.sa-prov-card-controls {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  pointer-events: auto;
}
.sa-prov-row {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
  padding: 8px 10px; border: 1px solid var(--border-dark); border-radius: 3px;
  background: color-mix(in srgb, var(--bg-panel) 92%, #000);
}
.sa-prov-row-main {
  flex: 1 1 auto; min-width: 0; display: flex; align-items: flex-start; gap: 10px;
}
.sa-prov-row-text { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.sa-prov-logo-frame {
  flex: 0 0 36px; width: 36px; height: 36px; flex-shrink: 0;
  border-radius: 4px; background: color-mix(in srgb, #fff 6%, var(--bg-panel));
  border: 1px solid var(--border-dark); overflow: hidden; box-sizing: border-box;
}
.sa-prov-logo {
  display: block; width: 100%; height: 100%;
  object-fit: contain; object-position: center;
  filter: grayscale(80%) contrast(100%)  opacity(1);
}
.sa-prov-name { font-size: 11px; font-weight: 600; color: var(--text); }
.sa-prov-blurb { font-size: 10px; line-height: 1.35; color: var(--text-dim); }
.sa-prov-row-controls {
  flex: 0 0 auto; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  justify-content: flex-end; max-width: 58%;
}
.sa-prov-key-input { width: min(200px, 42vw); min-width: 120px; font-size: 11px; }
.sa-prov-url-input { width: min(220px, 44vw); min-width: 140px; font-size: 11px; }
.sa-prov-add-url-row.hidden { display: none; }
.sa-prov-row--needs-url .sa-prov-row-controls { flex-wrap: wrap; }
.sa-prov-save-btn { flex-shrink: 0; }
.sa-prov-status { font-size: 10px; white-space: nowrap; }
.sa-prov-status--ok { color: #6cbe6c; }
.sa-prov-status--err { color: #d46060; max-width: 140px; overflow: hidden; text-overflow: ellipsis; }
.sa-prov-section--manual { border-top: 1px solid var(--border-dark); padding-top: 12px; }
.sa-prov-manual-add { margin-top: 10px; }
.sa-prov-add-label { font-size: 11px; font-weight: 600; margin: 0 0 8px; color: var(--text-highlight); }
.sa-prov-manual-empty { margin: 4px 0 8px; padding-left: 2px; }
@media (max-width: 520px) {
  .sa-prov-matrix { grid-template-columns: repeat(2, 1fr); }
  .sa-prov-row { flex-direction: column; align-items: stretch; }
  .sa-prov-row-controls { max-width: none; justify-content: flex-start; }
  .sa-prov-key-input { width: 100%; }
}
.sa-models-block { margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--border-dark); }
.sa-models-block:last-child { border-bottom: none; margin-bottom: 0; }
.sa-models-block-title { font-size: 12px; margin: 0 0 6px; color: var(--text-highlight); }

/* ── Provider modality chip bar (top of Providers pane) ─────────────────── */
.sa-prov-chip-bar {
  display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
  margin-bottom: 14px;
}
.sa-prov-chip-bar-label {
  font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--text-dim); flex: 0 0 auto; margin-right: 2px;
}
.sa-prov-top-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 8px; border-radius: 2px;
  font-size: 10px; font-weight: 600; letter-spacing: 0.04em;
  color: var(--text-dim);
  background: color-mix(in srgb, var(--bg-panel) 80%, #000);
  border: 1px solid var(--border-dark);
  transition: background .25s, color .25s, border-color .25s;
}
.sa-prov-top-chip--covered { color: var(--text-highlight); }
.sa-prov-top-chip--llm.sa-prov-top-chip--covered   { background: color-mix(in srgb, #6a9fd8 18%, var(--bg-panel)); border-color: color-mix(in srgb, #6a9fd8 40%, transparent); }
.sa-prov-top-chip--video.sa-prov-top-chip--covered { background: color-mix(in srgb, #9a7ad8 18%, var(--bg-panel)); border-color: color-mix(in srgb, #9a7ad8 40%, transparent); }
.sa-prov-top-chip--image.sa-prov-top-chip--covered { background: color-mix(in srgb, #6ab88a 18%, var(--bg-panel)); border-color: color-mix(in srgb, #6ab88a 40%, transparent); }
.sa-prov-top-chip--audio.sa-prov-top-chip--covered { background: color-mix(in srgb, #d8a86a 18%, var(--bg-panel)); border-color: color-mix(in srgb, #d8a86a 40%, transparent); }

/* Sub-chips inside audio chip */
.sa-prov-subchip {
  display: inline-flex; align-items: center; gap: 2px;
  padding: 1px 4px; border-radius: 2px;
  font-size: 9px; font-weight: 600; letter-spacing: 0.02em;
  color: var(--text-dim);
  background: color-mix(in srgb, var(--bg-panel) 90%, #000);
  border: 1px solid var(--border-dark);
  margin-left: 4px;
}
.sa-prov-subchip--covered { color: var(--text-highlight); }
.sa-prov-subchip--tts.sa-prov-subchip--covered   { background: color-mix(in srgb, #7ecbf7 30%, var(--bg-panel)); border-color: color-mix(in srgb, #7ecbf7 50%, transparent); }
.sa-prov-subchip--sfx.sa-prov-subchip--covered   { background: color-mix(in srgb, #f77ec7 30%, var(--bg-panel)); border-color: color-mix(in srgb, #f77ec7 50%, transparent); }
.sa-prov-subchip--music.sa-prov-subchip--covered { background: color-mix(in srgb, #a47ef7 30%, var(--bg-panel)); border-color: color-mix(in srgb, #a47ef7 50%, transparent); }

/* ── Per-row modality chips (appear after connection test) ──────────────── */
.sa-prov-mod-chips { display: inline-flex; flex-wrap: wrap; gap: 3px; }
.sa-prov-mod-chip {
  display: inline-block;
  padding: 1px 5px; border-radius: 2px;
  font-size: 9px; font-weight: 600; letter-spacing: 0.03em;
  color: var(--text-highlight);
}
.sa-prov-mod-chip--llm   { background: color-mix(in srgb, #6a9fd8 24%, #2a2a2a); }
.sa-prov-mod-chip--video { background: color-mix(in srgb, #9a7ad8 24%, #2a2a2a); }
.sa-prov-mod-chip--image { background: color-mix(in srgb, #6ab88a 24%, #2a2a2a); }
.sa-prov-mod-chip--audio { background: color-mix(in srgb, #d8a86a 24%, #2a2a2a); display: inline-flex; align-items: center; gap: 3px; }

/* Sub-chips inside audio mod chip */
.sa-prov-mod-subchip {
  display: inline-block;
  padding: 0px 3px; border-radius: 1px;
  font-size: 8px; font-weight: 600; letter-spacing: 0.02em;
  color: var(--text-dim);
  background: color-mix(in srgb, var(--bg-panel) 80%, #000);
  border: 1px solid var(--border-dark);
}
.sa-prov-mod-subchip--tts   { background: color-mix(in srgb, #7ecbf7 40%, #2a2a2a); color: var(--text-highlight); border-color: color-mix(in srgb, #7ecbf7 60%, transparent); }
.sa-prov-mod-subchip--sfx   { background: color-mix(in srgb, #f77ec7 40%, #2a2a2a); color: var(--text-highlight); border-color: color-mix(in srgb, #f77ec7 60%, transparent); }
.sa-prov-mod-subchip--music { background: color-mix(in srgb, #a47ef7 40%, #2a2a2a); color: var(--text-highlight); border-color: color-mix(in srgb, #a47ef7 60%, transparent); }

/* ── Provider row status extras ─────────────────────────────────────────── */
.sa-prov-status--testing { color: var(--text-dim); display: inline-flex; align-items: center; gap: 4px; }
.sa-prov-status--pending { color: var(--text-dim); font-style: italic; }
`;

export function injectSetupStyles(): void {
  if (document.getElementById('sa-styles')) return;
  const style = document.createElement('style');
  style.id = 'sa-styles';
  style.textContent = SETUP_STYLES_CSS;
  document.head.appendChild(style);
}
