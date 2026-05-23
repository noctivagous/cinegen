import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

@customElement('cinegen-storyboard-pane')
export class CinegenStoryboardPane extends CgLightElement {
  connectedCallback(): void {
    super.connectedCallback();
    this.id = 'preprod-story-pane';
    this.classList.add('split-pane');
    if (!this.style.width) this.style.width = '50%';
  }

  render() {
    return html`
      <div
        class="bevel-sunken flex items-center justify-between gap-2"
        style="padding: 4px 8px; background: #2a2a2a; border-bottom: 1px solid #1a1a1a;"
      >
        <span style="font-size: 10px; color: var(--text-dim);">Storyboard frame</span>
        <div class="flex items-center gap-2 storyboard-toolbar-actions">
          <label class="flex items-center gap-1 text-[10px]" style="white-space:nowrap;">
            Mode
            <input type="radio" name="storyboard-generation-mode" value="review" checked />
            Review
            <input type="radio" name="storyboard-generation-mode" value="auto" />
            Auto
          </label>
          <label class="flex items-center gap-1 text-[10px]" style="cursor:pointer; white-space:nowrap;">
            <input type="checkbox" id="autogen-boards-cb" /> autogenerate images
          </label>
          <span class="storyboard-toolbar-sep" aria-hidden="true"></span>
          <button class="toolbar-btn btn-ai" data-ws-action="generateStoryboardReferences">
            <i class="fa-solid fa-id-card"></i> References
          </button>
          <button class="toolbar-btn" data-ws-action="addStoryboardFrame">
            <i class="fa-solid fa-plus"></i> Add Frame
          </button>
          <button class="toolbar-btn" data-ws-action="duplicateSelectedFrame">
            <i class="fa-regular fa-copy"></i> Duplicate
          </button>
          <button class="toolbar-btn" data-ws-action="moveSelectedFrameUp" title="Move frame up">
            <i class="fa-solid fa-arrow-up"></i>
          </button>
          <button class="toolbar-btn" data-ws-action="moveSelectedFrameDown" title="Move frame down">
            <i class="fa-solid fa-arrow-down"></i>
          </button>
          <button class="toolbar-btn" data-ws-action="linkSelectedFrameToScript">
            <i class="fa-solid fa-link"></i> Link to Cursor
          </button>
          <button class="toolbar-btn" data-ws-action="deleteSelectedFrame">
            <i class="fa-solid fa-trash"></i> Delete
          </button>
          <button class="toolbar-btn" data-ws-action="restoreLastDeletedFrame">
            <i class="fa-solid fa-trash-arrow-up"></i> Restore Last
          </button>
          <span
            id="storyboard-reference-gate-status-inline"
            class="text-[10px]"
            style="padding:1px 5px;border:1px solid var(--border-dark);border-radius:4px;color:var(--text-dim)"
          >References required</span>
        </div>
      </div>
      <cinegen-storyboard></cinegen-storyboard>
    `;
  }
}
