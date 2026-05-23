import { html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

/** Groups `cg-vis-toggle` controls with shared layout + `role="group"`. */
@customElement('cg-toggle-group')
export class CgToggleGroup extends CgLightElement {
  @property() label = '';

  connectedCallback(): void {
    super.connectedCallback();
    if (!this.classList.contains('storyboard-visibility-toggles')) {
      this.classList.add('storyboard-visibility-toggles');
    }
    this.setAttribute('role', 'group');
    if (this.label) this.setAttribute('aria-label', this.label);
  }

  render() {
    return html`
      <slot></slot>
    `;
  }
}
