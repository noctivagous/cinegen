import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

/** Top-level project dashboard in the main workspace. */
@customElement('cinegen-project-overview-view')
export class CinegenProjectOverviewView extends CgLightElement {
  connectedCallback(): void {
    super.connectedCallback();
    this.id = 'view-project-overview';
    this.classList.add('hidden', 'flex', 'flex-col', 'h-full');
  }

  render() {
    return html`
      <cg-panel-header>
        <span slot="title" id="project-overview-panel-title" class="workspace-panel-title"
          ><i class="fa-solid fa-chart-pie" aria-hidden="true"></i> Project Overview</span
        >
      </cg-panel-header>
      <cinegen-overview-panel id="project-overview-panel-content"></cinegen-overview-panel>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cinegen-project-overview-view': CinegenProjectOverviewView;
  }
}
