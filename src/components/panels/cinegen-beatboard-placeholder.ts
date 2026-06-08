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
 * - Keep @customElement('cinegen-beatboard-placeholder') tag unchanged
 * - Replace ENTIRE file content; export the class
 */

import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

@customElement('cinegen-beatboard-placeholder')
export class CinegenBeatboardPlaceholder extends CgLightElement {
  render() {
    return html`
      <div
        style="
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--text-dim);
          gap: 16px;
          padding: 40px;
          text-align: center;
        "
      >
        <i class="fa-solid fa-clapperboard" style="font-size: 48px; opacity: 0.4;"></i>
        <h2 style="margin: 0; font-size: 18px; font-weight: 500; color: var(--text-main);">Beatboard</h2>
        <p style="margin: 0; max-width: 360px; line-height: 1.5;">
          Beat-based storyboarding and scene planning view — coming soon.
        </p>
      </div>
    `;
  }
}
