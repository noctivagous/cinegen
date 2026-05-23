import { html, nothing } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { when } from 'lit/directives/when.js';
import { customElement, state } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import { GUIDE_SECTIONS } from '@/toolbar/toolbar-data';

/** Guide modal body content (section HTML from `GUIDE_SECTIONS`). */
@customElement('cinegen-guide-modal-body')
export class CinegenGuideModalBody extends CgLightElement {
  @state() private _index = 0;

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add('guide-modal-body', 'panel-content');
    this.id = 'guide-modal-body';
  }

  showSection(index: number): void {
    if (index < 0 || index >= GUIDE_SECTIONS.length) return;
    this._index = index;
  }

  get sectionIndex(): number {
    return this._index;
  }

  render() {
    const section = GUIDE_SECTIONS[this._index];
    if (!section) return nothing;

    return html`
      ${unsafeHTML(section.body)}
      ${when(
        section.tip,
        () => html`<div class="guide-app-tip">
            <strong>In CineGen:</strong> ${unsafeHTML(section.tip!)}
          </div>`,
        () => nothing
      )}
    `;
  }
}
