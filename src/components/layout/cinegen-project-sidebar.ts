import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

/** Left project hierarchy panel (tree header + `cinegen-project-tree`). */
@customElement('cinegen-project-sidebar')
export class CinegenProjectSidebar extends CgLightElement {
  connectedCallback(): void {
    super.connectedCallback();
    this.id = 'project-hierarchy-sidebar';
    this.classList.add('bevel-flat', 'flex', 'flex-col', 'min-h-0');
    if (!this.style.width) {
      this.style.width = '280px';
      this.style.minWidth = '200px';
    }
  }

  render() {
    return html`
      <cg-panel-header>
        <span
          slot="title"
          id="project-tree-header-label"
          class="flex items-center gap-2 min-w-0 flex-1 overflow-hidden"
        ></span>
      </cg-panel-header>
      <div class="panel-content tree-container" style="overflow-y: auto;">
        <cinegen-project-tree></cinegen-project-tree>
      </div>
    `;
  }
}
