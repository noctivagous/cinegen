import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

@customElement('cg-panel-header')
export class CgPanelHeader extends CgLightElement {
  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add('panel-header');
  }

  render() {
    return html`
      <span class="panel-header-title"><slot name="title"></slot></span>
      <div class="panel-header-actions"><slot name="actions"></slot></div>
    `;
  }
}
