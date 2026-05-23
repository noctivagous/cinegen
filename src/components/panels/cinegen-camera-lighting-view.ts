import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

@customElement('cinegen-camera-lighting-view')
export class CinegenCameraLightingView extends CgLightElement {
  connectedCallback(): void {
    super.connectedCallback();
    this.id = 'view-camera-lighting';
    this.classList.add('hidden', 'flex', 'flex-col', 'h-full');
  }

  render() {
    return html`
      <cg-panel-header>
        <span slot="title" class="workspace-panel-title"
          ><i class="fa-solid fa-camera"></i> CAMERA, LIGHTING &amp; ATMOSPHERE</span
        >
        <div slot="actions" class="flex gap-1">
          <button
            class="toolbar-btn btn-ai"
            style="padding: 2px 8px; font-size: 10px;"
            data-ws-action="buildCameraPrompt"
          >
            <i class="fa-solid fa-wand-magic-sparkles"></i> Build Shot Prompt
          </button>
          <button
            class="toolbar-btn"
            style="padding: 2px 8px; font-size: 10px;"
            data-ws-action="clearCameraSelections"
          >
            <i class="fa-solid fa-xmark"></i> Clear
          </button>
        </div>
      </cg-panel-header>
      <div id="camera-lighting-prompt-bar" class="cl-prompt-bar hidden">
        <span class="cl-prompt-label"><i class="fa-solid fa-film"></i> Shot Config:</span>
        <span id="camera-lighting-prompt-text" class="cl-prompt-text"></span>
      </div>
      <div
        id="camera-lighting-content"
        class="flex-1 overflow-auto p-3"
        style="background: var(--bg-inset);"
      ></div>
    `;
  }
}
