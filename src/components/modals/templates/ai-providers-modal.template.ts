import { html } from 'lit';
import { renderModalShell } from '../modal-shell';

/** Migrated to renderModalShell — body = form, footer = actions. */
export const renderAiProvidersModal = () => {
  const body = html`
    <!-- Storage bar — fixed strip, not inside the scrolling body -->
    <div class="aip-storage-bar bevel-sunken">
      <span class="aip-storage-label">Server key storage</span>
      <p id="ai-providers-storage-hint" class="aip-storage-hint">
        Keys are managed through backend environment files in <code>backends/.env</code>.
      </p>
    </div>

    <!-- Scrollable form body -->
    <form id="ai-providers-form" class="project-settings-form" autocomplete="off">

      <div class="cg-segmented cg-segmented--matte aip-settings-tabs" role="tablist" data-segmented="aip-settings-tabs">
        <button type="button" class="cg-segmented-segment active" data-aip-tab="providers" role="tab" aria-selected="true">
          <i class="fa-solid fa-key" aria-hidden="true"></i> API Keys &amp; Service Providers
        </button>
        <button type="button" class="cg-segmented-segment" data-aip-tab="models" role="tab" aria-selected="false">
          <i class="fa-solid fa-sliders" aria-hidden="true"></i> AI Models &amp; Modalities
        </button>
      </div>

      <div id="aip-panel-providers" class="aip-settings-panel" role="tabpanel">
      <p class="project-settings-lead">
        Providers with keys in <strong>backends/.env</strong> appear automatically. Optionally add entries here to test connections or override a key for this browser. Assign models on <strong>AI Models &amp; Modalities</strong>.
      </p>

      <!-- Provider master-detail — fixed 260 px, inner panes scroll independently -->
      <div class="aip-master-detail">

        <!-- Left: provider list -->
        <div class="aip-master">
          <div class="aip-master-head">
            <span>Providers</span>
            <button type="button" class="toolbar-btn toolbar-btn--shape-soft aip-master-add" data-aip-action="add-vendor" title="Add provider" aria-label="Add provider">
              <i class="fa-solid fa-plus" aria-hidden="true"></i>
            </button>
          </div>
          <div id="api-keys-vendor-list" class="aip-list-scroll" role="listbox" aria-label="Provider list"></div>
        </div>

        <!-- Right: detail pane -->
        <div class="aip-detail">
          <div id="api-keys-detail-empty" class="aip-detail-empty">
            <p>Select a provider or click <i class="fa-solid fa-plus" aria-hidden="true"></i> to add one.</p>
          </div>
          <div id="api-keys-detail-form" class="aip-detail-form" hidden>

            <!-- Identity section -->
            <div class="asset-form-section">
              <div class="asset-form-section-title">Provider identity</div>
              <div class="asset-form-row">
                <label for="api-keys-detail-name">Name</label>
                <input id="api-keys-detail-name" class="cg-field" type="text" autocomplete="organization" spellcheck="false" placeholder="e.g. My OpenAI">
              </div>
              <div class="asset-form-row">
                <label for="api-keys-detail-provider">Type</label>
                <div class="cg-nspopup-wrap">
                  <select id="api-keys-detail-provider" class="cg-nspopup"></select>
                </div>
              </div>
            </div>

            <!-- API Keys section -->
            <div class="asset-form-section">
              <div class="asset-form-section-title">API keys</div>

              <div class="aip-key-block">
                <div class="aip-key-label">
                  API key <span class="aip-key-hint" id="api-keys-detail-meta"></span>
                </div>
                <div class="api-keys-input-row">
                  <input id="api-keys-detail-input" class="cg-field api-keys-secret-input" type="password" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="API key" placeholder="Paste key (this browser only)">
                  <button type="button" class="toolbar-btn toolbar-btn--shape-soft api-keys-reveal-btn" data-aip-action="toggle-key-reveal">Show</button>
                  <button type="button" class="toolbar-btn toolbar-btn--shape-soft" data-aip-action="clear-key">Clear</button>
                </div>
              </div>
            </div>

            <cinegen-aip-test-connection></cinegen-aip-test-connection>

            <!-- Remove section — mirrors .asset-form-section--danger -->
            <div class="asset-form-section asset-form-section--danger">
              <button type="button" class="toolbar-btn asset-form-delete-btn" data-aip-action="remove-vendor">
                <i class="fa-solid fa-trash" aria-hidden="true"></i> Remove this provider
              </button>
            </div>

          </div><!-- /aip-detail-form -->
        </div><!-- /aip-detail -->

      </div><!-- /aip-master-detail -->
      </div><!-- /aip-panel-providers -->

      <div id="aip-panel-models" class="aip-settings-panel" role="tabpanel" hidden>
      <p class="project-settings-lead">
        Assign which <strong>credential</strong> and <strong>model</strong> handle Text, Image, Video, and Sound. These choices drive storyboards, the debug modal, and all AI services.
      </p>

      <!-- Modality Routing + Request Behavior + Diagnostics -->
      <div class="cg-accordion project-settings-accordion aip-routing-accordion">

        <details class="cg-accordion-section" open>
          <summary class="cg-accordion-header"><i class="fa-solid fa-route" aria-hidden="true" style="margin-right:4px;"></i>Modality Routing</summary>
          <div class="cg-accordion-body">
            <p class="project-settings-lead" style="margin-bottom:10px;">Pick provider type, credential (vendor entry), and default model per modality. Use <strong>Test connection</strong> on the API Keys tab to refresh live model lists.</p>

            <p id="ai-api-gate-llm" class="ai-api-modality-gate" hidden>Add an <strong>API key</strong> for at least one provider above to configure routing.</p>
            <fieldset id="ai-api-fieldset-llm" class="ai-api-modality-fieldset">
              <legend class="ai-api-modality-legend"><i class="fa-solid fa-comments" aria-hidden="true"></i> Language (LLM) — AI assistants &amp; script generation</legend>
              <div class="cg-accordion-row">
                <label for="ai-api-provider-llm">Provider</label>
                <div class="cg-nspopup-wrap"><select id="ai-api-provider-llm" class="cg-nspopup"></select></div>
              </div>
              <div class="cg-accordion-row">
                <label for="ai-api-credential-llm">Credential</label>
                <div class="cg-nspopup-wrap"><select id="ai-api-credential-llm" class="cg-nspopup"></select></div>
              </div>
              <div class="cg-accordion-row">
                <label for="ai-api-model-llm">Default model</label>
                <div class="cg-nspopup-wrap"><select id="ai-api-model-llm" class="cg-nspopup"></select></div>
              </div>
              <div class="cg-accordion-row">
                <label for="ai-api-fallback-llm">Fallback model</label>
                <div class="cg-nspopup-wrap"><select id="ai-api-fallback-llm" class="cg-nspopup"></select></div>
              </div>
              <div class="cg-accordion-row">
                <label for="ai-api-baseurl-llm">Base URL <small>(opt.)</small></label>
                <input id="ai-api-baseurl-llm" class="cg-field" type="url" placeholder="https://api.openai.com/v1">
              </div>
              <p id="ai-api-caps-llm" class="ai-api-caps-readout" aria-live="polite"></p>
            </fieldset>

            <p id="ai-api-gate-image" class="ai-api-modality-gate" hidden>Add an <strong>API key</strong> for at least one provider above to configure routing.</p>
            <fieldset id="ai-api-fieldset-image" class="ai-api-modality-fieldset">
              <legend class="ai-api-modality-legend"><i class="fa-solid fa-image" aria-hidden="true"></i> Image — storyboards &amp; reference frames</legend>
              <div class="cg-accordion-row">
                <label for="ai-api-provider-image">Provider</label>
                <div class="cg-nspopup-wrap"><select id="ai-api-provider-image" class="cg-nspopup"></select></div>
              </div>
              <div class="cg-accordion-row">
                <label for="ai-api-credential-image">Credential</label>
                <div class="cg-nspopup-wrap"><select id="ai-api-credential-image" class="cg-nspopup"></select></div>
              </div>
              <div class="cg-accordion-row">
                <label for="ai-api-model-image">Default model</label>
                <div class="cg-nspopup-wrap"><select id="ai-api-model-image" class="cg-nspopup"></select></div>
              </div>
              <div class="cg-accordion-row">
                <label for="ai-api-fallback-image">Fallback model</label>
                <div class="cg-nspopup-wrap"><select id="ai-api-fallback-image" class="cg-nspopup"></select></div>
              </div>
              <div class="cg-accordion-row">
                <label for="ai-api-baseurl-image">Base URL <small>(opt.)</small></label>
                <input id="ai-api-baseurl-image" class="cg-field" type="url" placeholder="https://api.openai.com/v1">
              </div>
              <p id="ai-api-caps-image" class="ai-api-caps-readout" aria-live="polite"></p>
            </fieldset>

            <p id="ai-api-gate-video" class="ai-api-modality-gate" hidden>Add a <strong>Video</strong> key for at least one provider above to configure routing.</p>
            <fieldset id="ai-api-fieldset-video" class="ai-api-modality-fieldset">
              <legend class="ai-api-modality-legend"><i class="fa-solid fa-film" aria-hidden="true"></i> Video — shot &amp; take generation</legend>
              <div class="cg-accordion-row">
                <label for="ai-api-provider-video">Provider</label>
                <div class="cg-nspopup-wrap"><select id="ai-api-provider-video" class="cg-nspopup"></select></div>
              </div>
              <div class="cg-accordion-row">
                <label for="ai-api-credential-video">Credential</label>
                <div class="cg-nspopup-wrap"><select id="ai-api-credential-video" class="cg-nspopup"></select></div>
              </div>
              <div class="cg-accordion-row">
                <label for="ai-api-model-video">Default model</label>
                <div class="cg-nspopup-wrap"><select id="ai-api-model-video" class="cg-nspopup"></select></div>
              </div>
              <div class="cg-accordion-row">
                <label for="ai-api-fallback-video">Fallback model</label>
                <div class="cg-nspopup-wrap"><select id="ai-api-fallback-video" class="cg-nspopup"></select></div>
              </div>
              <div class="cg-accordion-row">
                <label for="ai-api-baseurl-video">Base URL <small>(opt.)</small></label>
                <input id="ai-api-baseurl-video" class="cg-field" type="url" placeholder="https://your-video-endpoint.example">
              </div>
              <p id="ai-api-caps-video" class="ai-api-caps-readout" aria-live="polite"></p>
            </fieldset>

            <p id="ai-api-gate-audio" class="ai-api-modality-gate" hidden>Add an <strong>API key</strong> for at least one provider above to configure routing.</p>
            <fieldset id="ai-api-fieldset-audio" class="ai-api-modality-fieldset">
              <legend class="ai-api-modality-legend"><i class="fa-solid fa-headphones" aria-hidden="true"></i> Audio — voice, sound effects &amp; music score</legend>
              <div class="cg-accordion-row">
                <label for="ai-api-provider-audio">Provider</label>
                <div class="cg-nspopup-wrap"><select id="ai-api-provider-audio" class="cg-nspopup"></select></div>
              </div>
              <div class="cg-accordion-row">
                <label for="ai-api-credential-audio">Credential</label>
                <div class="cg-nspopup-wrap"><select id="ai-api-credential-audio" class="cg-nspopup"></select></div>
              </div>
              <div class="cg-accordion-row">
                <label for="ai-api-model-audio">Default model</label>
                <div class="cg-nspopup-wrap"><select id="ai-api-model-audio" class="cg-nspopup"></select></div>
              </div>
              <div class="cg-accordion-row">
                <label for="ai-api-voice-audio">Default voice</label>
                <div class="cg-nspopup-wrap"><select id="ai-api-voice-audio" class="cg-nspopup"></select></div>
              </div>
              <div class="cg-accordion-row">
                <label for="ai-api-fallback-audio">Fallback model</label>
                <div class="cg-nspopup-wrap"><select id="ai-api-fallback-audio" class="cg-nspopup"></select></div>
              </div>
              <div class="cg-accordion-row">
                <label for="ai-api-baseurl-audio">Base URL <small>(opt.)</small></label>
                <input id="ai-api-baseurl-audio" class="cg-field" type="url" placeholder="https://api.elevenlabs.io/v1">
              </div>
              <p id="ai-api-caps-audio" class="ai-api-caps-readout" aria-live="polite"></p>
            </fieldset>
          </div>
        </details>

        <details class="cg-accordion-section">
          <summary class="cg-accordion-header">Request Behavior</summary>
          <div class="cg-accordion-body">
            <div class="cg-accordion-row">
              <label for="ai-api-timeout-seconds">Timeout (seconds)</label>
              <input id="ai-api-timeout-seconds" class="cg-field" type="number" min="10" max="3600" step="1" value="120">
            </div>
            <div class="cg-accordion-row">
              <label for="ai-api-max-retries">Max retries</label>
              <input id="ai-api-max-retries" class="cg-field" type="number" min="0" max="10" step="1" value="2">
            </div>
            <div class="cg-accordion-row">
              <label for="ai-api-max-concurrency">Max concurrent requests</label>
              <input id="ai-api-max-concurrency" class="cg-field" type="number" min="1" max="32" step="1" value="4">
            </div>
          </div>
        </details>

        <details class="cg-accordion-section">
          <summary class="cg-accordion-header">Diagnostics</summary>
          <div class="cg-accordion-body">
            <div class="cg-accordion-row">
              <label for="ai-api-log-level">Console log level</label>
              <div class="cg-nspopup-wrap">
                <select id="ai-api-log-level" class="cg-nspopup">
                  <option value="off">Off</option>
                  <option value="errors">Errors only</option>
                  <option value="verbose">Verbose (dev)</option>
                </select>
              </div>
            </div>
          </div>
        </details>

      </div><!-- /accordion -->
      </div><!-- /aip-panel-models -->

    </form>
  `;

  const footer = html`
    <span id="ai-providers-save-hint" class="project-settings-save-hint">Routing applies to storyboards, debug, and all AI services.</span>
    <div class="project-settings-footer-actions">
      <button type="button" class="toolbar-btn toolbar-btn--shape-soft btn-back-to-settings" data-aip-action="back-settings"><i class="fa-solid fa-caret-left" aria-hidden="true"></i><span>Back to Settings</span></button>
      <button type="button" class="toolbar-btn toolbar-btn--shape-soft" data-cg-close="ai-providers-modal">Cancel</button>
      <button type="button" class="toolbar-btn toolbar-btn--shape-soft btn-ai" data-aip-action="save">Save</button>
    </div>
  `;

  return renderModalShell({
    id: 'ai-providers-modal',
    title: 'AI Settings',
    titleIcon: 'fa-solid fa-key',
    body,
    footer,
    dialogClass: 'bevel-raised aip-modal-dialog',
  });
};
