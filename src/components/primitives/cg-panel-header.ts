import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

/** Light-DOM panel title bar; mounts slotted title/actions into a stable two-column layout. */
@customElement('cg-panel-header')
export class CgPanelHeader extends CgLightElement {
  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add('panel-header');
    this._mountSlottedContent();
  }

  protected updated(): void {
    this._mountSlottedContent();
  }

  /** Reparent slotted nodes so flex/grid rules apply (light DOM slots stay as host children). */
  private _mountSlottedContent(): void {
    const titleMount = this.querySelector('.panel-header-title');
    const actionsMount = this.querySelector('.panel-header-actions');
    if (!titleMount || !actionsMount) return;

    for (const el of [...this.children]) {
      if (el === titleMount || el === actionsMount) continue;
      const slot = el.getAttribute('slot');
      el.removeAttribute('slot');
      if (slot === 'actions') {
        actionsMount.appendChild(el);
      } else {
        titleMount.appendChild(el);
      }
    }

    titleMount.querySelector('slot')?.remove();
    actionsMount.querySelector('slot')?.remove();
  }

  render() {
    return html`
      <span class="panel-header-title"><slot name="title"></slot></span>
      <div class="panel-header-actions"><slot name="actions"></slot></div>
    `;
  }
}
