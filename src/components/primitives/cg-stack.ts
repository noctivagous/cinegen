import { html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

@customElement('cg-stack')
export class CgStack extends CgLightElement {
  @property({ type: String })
  direction: 'row' | 'column' = 'row';

  @property({ type: String }) gap = '8px';

  @property({ type: String })
  align: 'start' | 'center' | 'end' | 'stretch' | 'baseline' = 'stretch';

  @property({ type: String })
  justify: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly' = 'start';

  @property({ type: Boolean }) wrap = false;

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add('cg-stack');
  }

  updated(): void {
    this.style.display = 'flex';
    this.style.flexDirection = this.direction;
    this.style.gap = this.gap || '8px';
    this.style.alignItems = this.align;
    this.style.justifyContent = this.justify === 'between'
      ? 'space-between'
      : this.justify === 'around'
        ? 'space-around'
        : this.justify === 'evenly'
          ? 'space-evenly'
          : this.justify;
    this.style.flexWrap = this.wrap ? 'wrap' : 'nowrap';
  }

  render() {
    return html`<slot></slot>`;
  }
}
