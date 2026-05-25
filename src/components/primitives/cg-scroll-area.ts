import { html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

@customElement('cg-scroll-area')
export class CgScrollArea extends CgLightElement {
  @property({ type: String })
  direction: 'both' | 'horizontal' | 'vertical' = 'vertical';

  @property({ attribute: 'max-height' })
  maxHeight = '';

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add('cg-scroll-area');
  }

  updated(): void {
    this.style.overflowX = this.direction === 'horizontal' || this.direction === 'both'
      ? 'auto'
      : 'hidden';
    this.style.overflowY = this.direction === 'vertical' || this.direction === 'both'
      ? 'auto'
      : 'hidden';
    this.style.flex = '1';
    this.style.minHeight = '0';
    this.style.minWidth = '0';
    if (this.maxHeight) {
      this.style.maxHeight = this.maxHeight;
    }
  }

  render() {
    return html`<slot></slot>`;
  }
}
