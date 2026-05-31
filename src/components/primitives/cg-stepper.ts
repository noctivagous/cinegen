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
  @property({ type: Number }) value = 15;

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add('stepper', 'script-editor-font-stepper');
    this.dataset.scriptEditorFontStepper = '';
    this.dataset.min = String(this.min);
    this.dataset.max = String(this.max);
    this.dataset.step = String(this.step);
  }

  private _change(dir: number): void {
    const next = Math.min(this.max, Math.max(this.min, this.value + dir * this.step));
    if (next === this.value) return;
    this.value = next;
    this.dispatchEvent(
      new CustomEvent('cg-change', {
        bubbles: true,
        detail: { value: this.value },
      })
    );
  }

  render() {
    return html`
      <button type="button" @click=${() => this._change(-1)} aria-label="Decrease value">−</button>
      <input
        type="text"
        id=${this.inputId || nothing}
        .value=${String(this.value)}
        aria-label="Value"
        readonly
      />
      <button type="button" @click=${() => this._change(1)} aria-label="Increase value">+</button>
    `;
  }
}
