import { html, nothing, type TemplateResult } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { when } from 'lit/directives/when.js';
import { customElement, property, state } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

export type EntryWizardSlide = {
  title: string;
  body?: string;
  tip?: string;
  /** When provided, replaces the static body/tip rendering with an interactive Lit template. */
  renderFn?: (host: CinegenEntryWizardBody) => TemplateResult;
};

/** Reusable slide body for entry-point wizards (Script, Visual, Concept, Asset, Storyboard). */
@customElement('cinegen-entry-wizard-body')
export class CinegenEntryWizardBody extends CgLightElement {
  @property({ type: Array })
  slides: EntryWizardSlide[] = [];

  @state() private _index = 0;

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add('entry-wizard-body', 'panel-content', 'bevel-flat');
  }

  showSlide(index: number): void {
    if (index < 0 || index >= this.slides.length) return;
    this._index = index;
  }

  get slideIndex(): number {
    return this._index;
  }

  render() {
    const slide = this.slides[this._index];
    if (!slide) return nothing;

    if (slide.renderFn) {
      return html`
        <h3 class="entry-wizard-slide-title">${slide.title}</h3>
        ${slide.renderFn(this)}
      `;
    }

    return html`
      <h3 class="entry-wizard-slide-title">${slide.title}</h3>
      ${unsafeHTML(slide.body || '')}
      ${when(
        slide.tip,
        () => html`<div class="entry-wizard-tip">
            <strong>In CineGen:</strong> ${unsafeHTML(slide.tip!)}
          </div>`,
        () => nothing
      )}
    `;
  }
}
