import { html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

/** Compact numeric stepper (− / value / +). */
@customElement('cg-stepper')
export class CgStepper extends CgLightElement {
  @property({ type: Number }) min = 0;
  @property({ type: Number }) max = 100;
  @property({ type: Number }) step = 1;
  @property({ attribute: 'input-id' }) inputId = '';

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add('stepper', 'script-editor-font-stepper');
    this.dataset.scriptEditorFontStepper = '';
    this.dataset.min = String(this.min);
    this.dataset.max = String(this.max);
    this.dataset.step = String(this.step);
  }

  render() {
    return html`
      <button type="button" data-step="-1" aria-label="Decrease value">−</button>
      <input
        type="text"
        id=${this.inputId || nothing}
        value="15"
        aria-label="Value"
        readonly
      />
      <button type="button" data-step="1" aria-label="Increase value">+</button>
    `;
  }
}
