/**
 * @AI-GUI — TARGET FOR REPLACEMENT
 *
 * Conventions for AI GUI replacement:
 * - Lit 3 + TS decorators (experimentalDecorators: true, useDefineForClassFields: false)
 * - Extend CgLightElement (Light DOM only — NO shadowRoot)
 * - Global CSS classes only (cg-panel-header, cg-btn, flex, grid, gap-*, etc.)
 * - CSS vars: --accent-blue, --text-dim, --bg-panel, --border-light
 * - Font Awesome 6 via <i class="fa-solid fa-*"></i>
 * - @/ path alias maps to src/
 * - Event constants from events/shell-events.ts — NO raw custom-event strings
 * - Keep @customElement('cinegen-timeline-view') tag unchanged
 * - Replace ENTIRE file content; export the class
 */

import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

@customElement('cinegen-timeline-view')
export class CinegenTimelineView extends CgLightElement {
  connectedCallback(): void {
    super.connectedCallback();
    this.id = 'view-timeline';
    this.classList.add('hidden', 'flex', 'flex-col', 'h-full');
  }

  render() {
    return html`
      <cg-panel-header>
        <span slot="title" class="workspace-panel-title"
          ><i class="fa-solid fa-film"></i> SEQUENCE / ASSEMBLY - Rough Cut</span
        >
        <div slot="actions" class="flex gap-1">
          <button
            data-ws-action="autoAssembleTimeline"
            class="toolbar-btn btn-ai"
            style="padding: 2px 8px; font-size: 10px;"
          >
            <i class="fa-solid fa-robot"></i> AI Assemble
          </button>
          <button
            data-ws-action="exportTimeline"
            class="toolbar-btn"
            style="padding: 2px 8px; font-size: 10px;"
          >
            <i class="fa-solid fa-download"></i> Export EDL
          </button>
        </div>
      </cg-panel-header>
      <div class="timeline-container flex-1">
        <cinegen-timeline></cinegen-timeline>
      </div>
      <div
        class="flex justify-center text-[10px] text-[var(--text-dim)] py-2 border-t border-[var(--border-dark)]"
      >
        Drag shots from Scene views • Total runtime:
        <span id="timeline-duration" class="font-bold text-white">2:14</span>
      </div>
    `;
  }
}
