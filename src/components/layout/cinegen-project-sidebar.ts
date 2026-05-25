import { html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import {
  getProjectTreeChildren,
  handleTreeNodeSelect,
} from '@/tree/project-tree-service';
import { sectionKeyForTopLevelName } from '@/tree/tree-constants';
import type { TreeNode } from '@/tree/tree-types';

const VIEW_OPTIONS = [
  { value: 'tree', label: 'Tree', icon: 'fa-solid fa-sitemap' },
  { value: 'grid', label: 'Grid', icon: 'fa-solid fa-border-all' },
];

/** Left project hierarchy panel (tree header + `cinegen-project-tree`). */
@customElement('cinegen-project-sidebar')
export class CinegenProjectSidebar extends CgLightElement {
  @property({ type: String }) viewMode: 'tree' | 'grid' = 'tree';

  connectedCallback(): void {
    super.connectedCallback();
    this.id = 'project-hierarchy-sidebar';
    this.classList.add('bevel-flat', 'flex', 'flex-col', 'min-h-0');
    if (!this.style.width) {
      this.style.width = '280px';
      this.style.minWidth = '200px';
    }
  }

  private _setView(mode: 'tree' | 'grid') {
    if (this.viewMode === mode) return;
    this.viewMode = mode;
  }

  private _onGridItemClick(node: TreeNode) {
    const sectionKey = sectionKeyForTopLevelName(node.name);
    handleTreeNodeSelect(node, sectionKey);
  }

  private _renderGrid() {
    const roots = getProjectTreeChildren().filter(
      (n): n is TreeNode => n.type !== 'tree-divider'
    );
    return html`
      <div class="hierarchy-grid">
        ${roots.map(
          (node) => html`
            <button
              type="button"
              class="hierarchy-grid-item bevel-raised"
              @click=${() => this._onGridItemClick(node)}
              title=${node.desc ?? node.name}
            >
              <i class="fa-solid ${node.icon || 'fa-folder'}"></i>
              <span class="hierarchy-grid-label">${node.name}</span>
            </button>
          `
        )}
      </div>
    `;
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
        <div class="sidebar-view-bar">
          <div class="sidebar-view-group" role="group" aria-label="Hierarchy view">
            ${VIEW_OPTIONS.map(
              (opt) => html`
                <button
                  type="button"
                  class="sidebar-view-btn ${this.viewMode === opt.value ? 'active' : ''}"
                  data-view=${opt.value}
                  @click=${() => this._setView(opt.value as 'tree' | 'grid')}
                  title=${opt.label}
                >
                  <i class="${opt.icon}" aria-hidden="true"></i>
                  <span>${opt.label}</span>
                </button>
              `
            )}
          </div>
        </div>
        ${this.viewMode === 'tree'
          ? html`<cinegen-project-tree></cinegen-project-tree>`
          : this._renderGrid()}
      </div>
    `;
  }
}
