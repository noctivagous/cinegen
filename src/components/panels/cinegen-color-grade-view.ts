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
 * - Keep @customElement('cinegen-color-grade-view') tag unchanged
 * - Replace ENTIRE file content; export the class
 *
 * ── AI GUI SPEC: Color Grade / Color Wheel (Prompt #10) ──
 *
 * Goal: A color grading workstation with iro.js wheel.
 *
 * Requirements:
 * - Color Wheel (iro.js HSV wheel) — primary color picker for overall grade.
 *
 * - Lift / Gamma / Gain — three grouped sections, each with:
 *   Small iro.js color wheel, Hue/Saturation/Value number inputs,
 *   Reset to neutral button.
 *
 * - Tone Controls — column of labeled sliders: Temperature (warm↔cool),
 *   Tint (green↔magenta), Saturation, Contrast, Lift, Gamma, Gain.
 *
 * - Preset Library — grid of saved grade presets with thumbnail previews:
 *   "Film Stock" (Kodak Vision3, Fuji Eterna…), "Mood" (Warm Summer, Cold
 *   Winter, Neon Noir…), "Genre" (Western, Sci-Fi, Noir, Romance).
 *   Save Current as Preset button.
 *
 * - Shot/Scene Preview — reference thumbnail with before/after split/toggle.
 *
 * - Export → applies grade to selected shot or whole scene, writes to
 *   `colorState` and `styleGuide.colorPalette`.
 */

import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

@customElement('cinegen-color-grade-view')
export class CinegenColorGradeView extends CgLightElement {
  connectedCallback(): void {
    super.connectedCallback();
    this.id = 'view-color-grade';
    this.classList.add('hidden', 'flex', 'flex-col', 'h-full');
  }

  render() {
    return html`
      <cg-panel-header>
        <span slot="title" class="workspace-panel-title"
          ><i class="fa-solid fa-palette"></i> COLOR GRADE</span
        >
      </cg-panel-header>
      <div class="flex-1 flex items-center justify-center text-[var(--text-dim)] text-sm p-8">
        <i class="fa-solid fa-palette text-4xl mb-4 opacity-30"></i>
        <p>Color Grade panel — ready for AI GUI replacement.</p>
      </div>
    `;
  }
}
