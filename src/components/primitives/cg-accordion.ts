import { html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

@customElement('cg-accordion')
export class CgAccordion extends CgLightElement {
  @property({ type: String }) heading = '';
  @property({ type: Boolean }) open = true;

  render() {
    return html`
      <details class="cg-accordion-section" ?open=${this.open}>
        <summary class="cg-accordion-header">${this.heading}</summary>
        <div class="cg-accordion-body">
          <slot></slot>
        </div>
      </details>
    `;
  }
}
