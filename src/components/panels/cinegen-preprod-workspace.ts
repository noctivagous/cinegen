import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import { getPersistedPreprodMode } from '@/tree/project-tree-service';
import { PREPROD_LAYOUT_CHROME } from '@/workspace/preprod-layout';

/** Pre-production workspace: script pane + storyboard pane (split). */
@customElement('cinegen-preprod-workspace')
export class CinegenPreprodWorkspace extends CgLightElement {
  connectedCallback(): void {
    super.connectedCallback();
    this.id = 'view-preprod-workspace';
    this.classList.add('flex', 'flex-col', 'h-full', 'min-h-0');
  }

  render() {
    const mode = getPersistedPreprodMode();
    const chrome = PREPROD_LAYOUT_CHROME[mode];
    const storyboardTogglesHidden = mode === 'script';
    return html`
      <cg-panel-header>
        <span slot="title" id="preprod-panel-title" class="workspace-panel-title"
          ><i class="fa-solid ${chrome.icon}"></i> ${chrome.label}</span
        >
        <div slot="actions" class="flex gap-1">
          <button
            class="toolbar-btn btn-ai"
            style="padding: 2px 8px; font-size: 10px;"
            data-ws-action="generateStoryboardReferences"
          >
            <i class="fa-solid fa-id-card"></i> Generate References
          </button>
          <button
            class="toolbar-btn btn-ai"
            style="padding: 2px 8px; font-size: 10px;"
            data-ws-action="generateBoards"
            id="generate-scene-frames-btn"
          >
            <i class="fa-solid fa-image"></i> Generate Scene Frames
          </button>
          <span
            id="storyboard-reference-gate-status"
            class="text-[10px]"
            style="padding:2px 6px;border:1px solid var(--border-dark);border-radius:4px;color:var(--text-dim)"
          >References required</span>
          <label class="flex items-center gap-1 text-[10px]" style="white-space:nowrap;">
            Storyboard mode
            <select class="cg-nspopup text-[10px]" data-storyboard-generation-mode-select>
              <option value="review">Review first</option>
              <option value="auto">Auto images</option>
            </select>
          </label>
          <button
            class="toolbar-btn btn-ai"
            style="padding: 2px 8px; font-size: 10px;"
            data-ws-action="make-storyboard-frame-text"
            id="make-storyboard-frame-text-btn"
            hidden
          >
            <i class="fa-solid fa-wand-magic"></i> Make Frame for Text
          </button>
          <button
            class="toolbar-btn"
            style="padding: 2px 8px; font-size: 10px; margin-left:auto;"
            data-ws-action="openSectionSettings"
            title="Section settings"
          >
            <i class="fa-solid fa-gear"></i>
          </button>
          <span
            id="storyboard-vis-toggles"
            class="flex items-center gap-1"
            style="margin-left:auto;"
            ?hidden=${storyboardTogglesHidden}
          >
            <span class="storyboard-toolbar-sep" aria-hidden="true"></span>
            <cg-toggle-group label="Storyboard visibility">
              <cg-vis-toggle
                label="Scene"
                title="Show scene numbers"
                data-storyboard-part="scene"
                checked
              ></cg-vis-toggle>
              <cg-vis-toggle
                label="Frame"
                title="Show frame thumbnails"
                data-storyboard-part="frame"
                checked
              ></cg-vis-toggle>
              <cg-vis-toggle
                label="Notes"
                title="Show notes under frames"
                data-storyboard-part="notes"
                checked
              ></cg-vis-toggle>
            </cg-toggle-group>
          </span>
        </div>
      </cg-panel-header>
      <div id="preprod-body" class="split-view flex-1 mode-${mode}">
        <cinegen-script-pane></cinegen-script-pane>
        <cg-split-divider
          id="preprod-split-divider"
          resize-target="preprod"
          label="Resize script and storyboard panes"
        ></cg-split-divider>
        <cinegen-storyboard-pane></cinegen-storyboard-pane>
      </div>
    `;
  }
}
