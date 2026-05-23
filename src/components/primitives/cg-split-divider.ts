import { html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import {
  LayoutResizeController,
  type LayoutResizeTarget,
} from '@/controllers/layout-resize-controller';

@customElement('cg-split-divider')
export class CgSplitDivider extends CgLightElement {
  @property({ type: String }) label = 'Resize panel';

  @property({ type: String, attribute: 'resize-target' })
  resizeTarget: LayoutResizeTarget | '' = '';

  private _resize: LayoutResizeController | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add('split-divider');
    this.setAttribute('role', 'separator');
    if (this.resizeTarget) {
      this._resize = new LayoutResizeController(this, this.resizeTarget);
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._resize = null;
  }

  render() {
    return html`<span class="sr-only">${this.label}</span>`;
  }
}
