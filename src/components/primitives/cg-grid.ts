import { html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

@customElement('cg-grid')
export class CgGrid extends CgLightElement {
  @property({ type: Number }) columns = 0;

  @property({ type: String }) gap = '8px';

  @property({ attribute: 'min-column-width' })
  minColumnWidth = '';

  @property({ type: String, attribute: 'row-gap' })
  rowGap = '';

  @property({ type: String, attribute: 'column-gap' })
  columnGap = '';

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add('cg-grid');
  }

  updated(): void {
    if (this.minColumnWidth) {
      this.style.gridTemplateColumns = `repeat(auto-fill, minmax(${this.minColumnWidth}, 1fr))`;
    } else if (this.columns > 0) {
      this.style.gridTemplateColumns = `repeat(${this.columns}, 1fr)`;
    } else {
      this.style.gridTemplateColumns = '';
    }
    this.style.gap = this.gap || '8px';
    if (this.rowGap) {
      this.style.rowGap = this.rowGap;
    }
    if (this.columnGap) {
      this.style.columnGap = this.columnGap;
    }
  }

  render() {
    return html`<slot></slot>`;
  }
}
