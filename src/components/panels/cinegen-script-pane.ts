import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

const SCRIPT_PANE_TABS = [
  { value: 'script', label: 'Script', icon: 'fa-solid fa-scroll' },
  { value: 'info', label: 'Script Info', icon: 'fa-solid fa-tags' },
  { value: 'treatment', label: 'Treatment', icon: 'fa-solid fa-book-open' },
];

const TREATMENT_LAYOUT_OPTIONS = [
  { value: 'one-column', label: '1', icon: 'fa-solid fa-align-justify' },
  { value: 'two-column', label: '2', icon: 'fa-solid fa-table-columns' },
];

@customElement('cinegen-script-pane')
export class CinegenScriptPane extends CgLightElement {
  connectedCallback(): void {
    super.connectedCallback();
    this.id = 'preprod-script-pane';
    this.classList.add('split-pane');
    if (!this.style.width) this.style.width = '50%';
  }

  render() {
    return html`
      <div
        class="bevel-sunken flex items-center justify-between gap-2"
        style="padding: 4px 8px; background: #2a2a2a; border-bottom: 1px solid #1a1a1a;"
      >
        <div class="script-pane-header-left">
          <span style="font-size: 10px; color: var(--text-dim);">SCRIPT EDITOR (.FOUNTAIN)</span>
          <cg-segmented-control
            data-segmented="script-pane"
            name="Script pane mode"
            variant="script-pane-segmented"
            .options=${SCRIPT_PANE_TABS}
            value="script"
          ></cg-segmented-control>
        </div>
        <div id="script-pane-header-actions" class="flex items-center gap-1">
          <cg-toolbar-split
            id="script-import-export-split"
            variant="toolbar-split--compact"
            menu-id="script-import-export-menu"
            main-title="Import and export script files"
          >
            <span slot="main"><i class="fa-solid fa-right-left"></i> Import/Export</span>
            <div slot="menu">
              <button
                type="button"
                class="toolbar-split-menu-item"
                role="menuitem"
                data-script-io-action="save-fountain"
              >
                Save .fountain…
              </button>
              <button
                type="button"
                class="toolbar-split-menu-item"
                role="menuitem"
                data-script-io-action="import-fountain"
              >
                Import .fountain…
              </button>
              <button
                type="button"
                class="toolbar-split-menu-item"
                role="menuitem"
                data-script-io-action="import-fdx"
              >
                Import .fdx…
              </button>
            </div>
          </cg-toolbar-split>
        </div>
      </div>
      <input id="fdx-file-input" type="file" accept=".fdx,application/xml,text/xml" class="hidden" />
      <input id="fountain-file-input" type="file" accept=".fountain,.txt,text/plain" class="hidden" />
      <div id="script-pane-content">
        <div id="script-pane-script" class="script-pane-view">
          <cinegen-script-editor-chrome></cinegen-script-editor-chrome>
          <cinegen-script-editor></cinegen-script-editor>
        </div>
        <cinegen-script-info-pane></cinegen-script-info-pane>
        <div id="script-pane-treatment" class="script-pane-view hidden">
          <div class="script-info-toolbar bevel-sunken treatment-toolbar">
            <span class="treatment-toolbar-title"
              ><i class="fa-solid fa-book-open" aria-hidden="true"></i> TREATMENT — Story guide for
              AI</span
            >
            <div
              id="treatment-layout-control"
              class="treatment-layout-control"
              role="group"
              aria-label="Treatment column layout"
            >
              <cg-segmented-control
                data-segmented="treatment-layout"
                name="Treatment column layout"
                variant="treatment-layout-segmented"
                .options=${TREATMENT_LAYOUT_OPTIONS}
                value="two-column"
              ></cg-segmented-control>
            </div>
            <div class="treatment-toolbar-actions">
              <button
                type="button"
                class="toolbar-btn btn-ai"
                style="padding: 2px 8px; font-size: 10px;"
                data-ws-action="applyTreatmentToScriptGeneration"
              >
                <i class="fa-solid fa-wand-magic-sparkles"></i> Use for AI Script
              </button>
            </div>
          </div>
          <cinegen-treatment-panel id="treatment-form"></cinegen-treatment-panel>
        </div>
      </div>
    `;
  }
}
