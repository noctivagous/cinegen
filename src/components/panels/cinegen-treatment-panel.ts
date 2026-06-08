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
 * - Keep @customElement('cinegen-treatment-panel') tag unchanged
 * - Replace ENTIRE file content; export the class
 */

import { classMap } from 'lit/directives/class-map.js';
import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import { projectTreatment } from '@/data/project-data';
import {
  TREATMENT_FIELDS,
  TREATMENT_FULL_WIDTH_FIELDS,
  TREATMENT_SECTIONS,
  treatmentSectionId,
  type TreatmentFieldDef,
} from '@/workspace/treatment-config';
import {
  afterTreatmentPanelRender,
  syncTreatmentFromForm,
} from '@/workspace/treatment-form-service';
import { escHtml } from '@/utils/html';
import { updateInspector } from '@/components/panels/cinegen-inspector';

@customElement('cinegen-treatment-panel')
export class CinegenTreatmentPanel extends CgLightElement {
  connectedCallback(): void {
    if (!this.id) this.id = 'treatment-form';
    this.classList.add('script-info-content', 'treatment-panel');
    if (!this.hasAttribute('role')) this.setAttribute('role', 'form');
    if (!this.hasAttribute('aria-label')) {
      this.setAttribute('aria-label', 'Project treatment');
    }
    super.connectedCallback();
  }

  refresh(): void {
    this.requestUpdate();
  }

  private _onFieldInput(): void {
    syncTreatmentFromForm(this);
    updateInspector('treatment', { ...projectTreatment });
    window.CineGen?.getTreatmentForStoryAI?.();
    window.CineGen && (window.CineGen.lastTreatmentVisualContext = window.CineGen.getTreatmentForVisualAI?.());
  }

  private _fieldTemplate(field: TreatmentFieldDef) {
    const value = (projectTreatment as Record<string, string>)[field.key] ?? '';
    const full = TREATMENT_FULL_WIDTH_FIELDS.has(field.key);
    const inputClass = field.inputClass ? ` ${field.inputClass}` : '';

    const control =
      field.type === 'textarea'
        ? html`<textarea
            class=${`treatment-input${inputClass}`}
            data-treatment-field=${field.key}
            rows=${field.rows ?? 3}
            .value=${value}
            @input=${this._onFieldInput}
          ></textarea>`
        : html`<input
            type="text"
            class=${`treatment-input${inputClass}`}
            data-treatment-field=${field.key}
            .value=${value}
            @input=${this._onFieldInput}
          />`;

    return html`
      <label class=${classMap({ 'treatment-field': true, 'treatment-field--full': full })}>
        <span class="treatment-field-label">
          <i class="fa-solid ${field.icon}" aria-hidden="true"></i> ${escHtml(field.label)}
        </span>
        ${control}
        ${field.hint ? html`<p class="treatment-field-hint">${escHtml(field.hint)}</p>` : null}
      </label>
    `;
  }

  render() {
    const fieldByKey = Object.fromEntries(TREATMENT_FIELDS.map((f) => [f.key, f]));

    return html`
      <p class="treatment-intro">
        Define the story guide before the script. Screenplay and story AI use all fields here. Visual
        look is driven by properties and your Look Library—not movie titles from Treatment unless you
        add them there yourself.
      </p>
      ${TREATMENT_SECTIONS.map((section) => {
        const sid = treatmentSectionId(section.title);
        return html`
          <section class="treatment-section" aria-labelledby=${sid}>
            <h3 class="treatment-section-title" id=${sid}>${escHtml(section.title)}</h3>
            <div class="treatment-fields">
              ${section.fieldKeys.map((key) => {
                const field = fieldByKey[key];
                return field ? this._fieldTemplate(field) : null;
              })}
            </div>
          </section>
        `;
      })}
    `;
  }

  protected updated(): void {
    afterTreatmentPanelRender(this);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cinegen-treatment-panel': CinegenTreatmentPanel;
  }
}
