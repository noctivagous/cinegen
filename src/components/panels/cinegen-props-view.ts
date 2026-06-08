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
 * - Keep @customElement('cinegen-props-view') tag unchanged
 * - Replace ENTIRE file content; export the class
 *
 * ── AI GUI SPEC: Props (Prompt #12) ──
 *
 * Goal: A prop catalog with scene assignment tracking and visual reference management.
 *
 * Requirements:
 * - Prop Catalog (main content): responsive grid of prop cards. Each card:
 *   Large thumbnail, prop name, category badge (Hand Prop/Set Dressing/
 *   Consumable/Special Effect), status badge (Not Started/Sourced/Built/
 *   Ready/In Use), scene count badge. Click → detail panel.
 *
 * - Category Filter Bar (top): pill buttons for each category + "All".
 *
 * - Search Bar — search by name, description, scene number.
 *
 * - Prop Detail Panel (right/expandable, when selected): image gallery
 *   (upload more), name (editable), description, category dropdown,
 *   quantity input, status dropdown with date tracking, Scene Assignment
 *   (multi-select script scenes). Three asset paths: Upload, AI Fetch,
 *   AI Generate.
 *
 * - Status Dashboard (bottom, collapsible): summary bar with counts per
 *   status + mini progress bar.
 */

import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

@customElement('cinegen-props-view')
export class CinegenPropsView extends CgLightElement {
  connectedCallback(): void {
    super.connectedCallback();
    this.id = 'view-props-design';
    this.classList.add('hidden', 'flex', 'flex-col', 'h-full');
  }

  render() {
    return html`
      <cg-panel-header>
        <span slot="title" class="workspace-panel-title"
          ><i class="fa-solid fa-box-open"></i> PROPS</span
        >
      </cg-panel-header>
      <div class="flex-1 flex items-center justify-center text-[var(--text-dim)] text-sm p-8">
        <i class="fa-solid fa-box-open text-4xl mb-4 opacity-30"></i>
        <p>Props panel — ready for AI GUI replacement.</p>
      </div>
    `;
  }
}
