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
 * - Keep @customElement('cinegen-wardrobe-view') tag unchanged
 * - Replace ENTIRE file content; export the class
 *
 * ── AI GUI SPEC: Wardrobe / Costume (Prompt #11) ──
 *
 * Goal: A body-diagram-based costume design board where garments are applied
 * to a figure and linked to characters.
 *
 * Requirements:
 * - Body Diagram Canvas (center, large): Fabric.js canvas with blank body
 *   outline (male/female toggle), zone outlines (head/torso/arms/hands/legs/feet),
 *   click zone → garment picker, drag garment onto zone, layer order with
 *   layer stack panel.
 *
 * - Garment Library (left sidebar): categoried grid: Tops, Bottoms, Dresses,
 *   Outerwear, Footwear, Accessories, Underwear. Each card: thumbnail, name,
 *   color swatches. Search/filter bar. Three asset paths: Upload, AI Fetch,
 *   AI Generate.
 *
 * - Garment Config Panel (right sidebar, when garment selected): type selector,
 *   color picker (iro.js mini wheel), pattern/texture ref slot, fit toggle
 *   (Close/Regular/Loose), layer spinner, notes field, Remove button.
 *
 * - Character Link Bar (top): dropdown to select character from Casting.
 *   Import height/build/era/style notes from character description, auto-suggest
 *   garments. Saved costume → CharacterGuideEntry.references.costume[].
 *
 * - Footer: garment count, character assignment badge.
 */

import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

@customElement('cinegen-wardrobe-view')
export class CinegenWardrobeView extends CgLightElement {
  connectedCallback(): void {
    super.connectedCallback();
    this.id = 'view-wardrobe-design';
    this.classList.add('hidden', 'flex', 'flex-col', 'h-full');
  }

  render() {
    return html`
      <cg-panel-header>
        <span slot="title" class="workspace-panel-title"
          ><i class="fa-solid fa-shirt"></i> WARDROBE / COSTUME DESIGN</span
        >
      </cg-panel-header>
      <div class="flex-1 flex items-center justify-center text-[var(--text-dim)] text-sm p-8">
        <i class="fa-solid fa-shirt text-4xl mb-4 opacity-30"></i>
        <p>Wardrobe panel — ready for AI GUI replacement.</p>
      </div>
    `;
  }
}
