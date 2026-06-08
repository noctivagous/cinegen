import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

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
 * - Keep @customElement('cinegen-project-overview-view') tag unchanged
 * - Replace ENTIRE file content; export the class
 */

/** Top-level project dashboard in the main workspace. */
@customElement('cinegen-project-overview-view')
export class CinegenProjectOverviewView extends CgLightElement {
  connectedCallback(): void {
    super.connectedCallback();
    this.id = 'view-project-overview';
    this.classList.add('hidden', 'flex', 'flex-col', 'h-full');
  }

  render() {
    return html`
      <cg-panel-header>
        <span slot="title" id="project-overview-panel-title" class="workspace-panel-title"
          ><i class="fa-solid fa-chart-pie" aria-hidden="true"></i> Project Overview</span
        >
      </cg-panel-header>
      <cinegen-overview-panel id="project-overview-panel-content"></cinegen-overview-panel>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cinegen-project-overview-view': CinegenProjectOverviewView;
  }
}
