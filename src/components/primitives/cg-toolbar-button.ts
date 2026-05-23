import { html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

@customElement('cg-toolbar-button')
export class CgToolbarButton extends CgLightElement {
  @property({ type: String }) variant = '';
  @property({ type: Boolean, reflect: true }) active = false;
  @property({ type: String }) icon = '';
  @property({ type: String }) label = '';
  @property({ type: String }) title = '';

  render() {
    const classes = ['toolbar-btn', this.variant].filter(Boolean).join(' ');
    const iconHtml = this.icon
      ? html`<i class="${this.icon}" aria-hidden="true"></i>`
      : null;
    const labelHtml = this.label
      ? html` ${this.label}`
      : html`<slot></slot>`;

    return html`
      <button
        type="button"
        class=${classes}
        title=${this.title || ''}
        ?disabled=${this.hasAttribute('disabled')}
      >
        ${iconHtml}${labelHtml}
      </button>
    `;
  }
}
