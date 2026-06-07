import { html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import { whenBootReady } from '@/app/boot-coordinator';
import {
  getProjectTreeChildren,
  getSelectedTreeName,
  getTreeSectionKeyForNode,
  handleTreeNodeSelect,
  subscribeProjectTree,
} from '@/tree/project-tree-service';
import { bindAppShellToHost } from '@/stores/bind-app-shell-host';
import { getHierarchySectionShortcutChip } from '@/keybindings/hierarchy-keybindings';
import { sectionKeyForTopLevelName } from '@/tree/tree-constants';
import type { TreeNode } from '@/tree/tree-types';
import { filterVisibleNodes } from '@/services/section-visibility-service';
import { appShellStore } from '@/stores/app-shell-store';
import { patchAppShellPreferences } from '@/stores/app-shell';
import { applyLayoutChromeFromPreferences } from '@/services/layout-service';
import type { CineGenPreferences } from '@/services/preferences';
import { LAYOUT_LIMITS } from '@/services/layout-metrics';
import { openProjectOverview } from '@/workspace/project-overview';

const VIEW_OPTIONS = [
  { value: 'tree', label: 'Tree', icon: 'fa-solid fa-sitemap' },
  { value: 'grid', label: 'Grid', icon: 'fa-solid fa-border-all' },
  { value: 'grid-plus', label: 'Grid+', icon: 'fa-solid fa-table-cells' },
] as const satisfies ReadonlyArray<{
  value: CineGenPreferences['projectHierarchyViewMode'];
  label: string;
  icon: string;
}>;

/** Next tree level under a top-level folder (unwraps `group` nodes like the tree view). */
function gridPlusChildNodes(parent: TreeNode, sectionKey: string | null): TreeNode[] {
  const visible = filterVisibleNodes(parent.children ?? [], sectionKey);
  const out: TreeNode[] = [];
  for (const child of visible) {
    if (child.type === 'group' && child.children?.length) {
      out.push(...filterVisibleNodes(child.children, sectionKey));
    } else if (child.type !== 'tree-divider') {
      out.push(child);
    }
  }
  return out;
}

/** Whether `parent` or any of its descendants has the given name. */
function treeContainsName(parent: TreeNode, name: string): boolean {
  if (parent.name === name) return true;
  for (const child of parent.children ?? []) {
    if (treeContainsName(child, name)) return true;
  }
  return false;
}

/** Left project hierarchy panel (tree header + `cinegen-project-tree`). */
@customElement('cinegen-project-sidebar')
export class CinegenProjectSidebar extends CgLightElement {
  @state() private _viewMode: CineGenPreferences['projectHierarchyViewMode'] = 'tree';

  private _shellUnsub: (() => void) | null = null;
  private _shellBindUnsub: (() => void) | null = null;
  private _treeUnsub: (() => void) | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.id = 'project-hierarchy-sidebar';
    this.classList.add('bevel-flat', 'flex', 'flex-col', 'min-h-0');
    this.style.minWidth = `${LAYOUT_LIMITS.minSidebarPx}px`;
    if (!this.style.width) {
      applyLayoutChromeFromPreferences();
    }
    whenBootReady('store', () => this._applyHierarchyViewMode());
    this._shellUnsub = appShellStore.subscribe(() => this._applyHierarchyViewMode());
    this._shellBindUnsub = bindAppShellToHost(this);
    this._treeUnsub = subscribeProjectTree(() => this.requestUpdate());
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._shellUnsub?.();
    this._shellUnsub = null;
    this._shellBindUnsub?.();
    this._shellBindUnsub = null;
    this._treeUnsub?.();
    this._treeUnsub = null;
  }

  private _applyHierarchyViewMode(): void {
    const mode = appShellStore.preferences.projectHierarchyViewMode ?? 'tree';
    if (this._viewMode !== mode) this._viewMode = mode;
  }

  private _openFeaturesModal(): void {
    void (window as Window & { openProjectFeaturesModal?: () => Promise<void> }).openProjectFeaturesModal?.();
  }

  private _openProjectOverview(): void {
    void openProjectOverview();
  }

  private _setView(mode: CineGenPreferences['projectHierarchyViewMode']) {
    if (this._viewMode === mode) return;
    this._viewMode = mode;
    patchAppShellPreferences({ projectHierarchyViewMode: mode });
  }

  private _onGridItemClick(node: TreeNode, sectionKey: string | null) {
    handleTreeNodeSelect(node, sectionKey);
  }

  private _onGridPlusChildClick(node: TreeNode, e: Event) {
    e.stopPropagation();
    handleTreeNodeSelect(node, getTreeSectionKeyForNode(node));
  }

  private _renderGrid() {
    const roots = getProjectTreeChildren().filter(
      (n): n is TreeNode => n.type !== 'tree-divider'
    );
    const selectedName = getSelectedTreeName();
    return html`
      <div class="hierarchy-grid">
        ${roots.map((node) => {
          const sectionKey = sectionKeyForTopLevelName(node.name);
          const isSelected = Boolean(sectionKey && selectedName && treeContainsName(node, selectedName));
          return html`
            <button
              type="button"
              class="hierarchy-grid-item bevel-raised ${sectionKey
                ? `hierarchy-grid-item--section-${sectionKey} tree-section-${sectionKey}${isSelected ? ' selected' : ''}`
                : ''}"
              data-section=${sectionKey ?? nothing}
              @click=${() => this._onGridItemClick(node, sectionKey)}
              title=${node.desc ?? node.name}
            >
              <i class="fa-solid ${node.icon || 'fa-folder'}"></i>
              <span class="hierarchy-grid-label">${node.name}</span>
              ${sectionKey
                ? html`<span class="tree-shortcut-chip">${getHierarchySectionShortcutChip(node.name)}</span>`
                : nothing}
            </button>
          `;
        })}
      </div>
    `;
  }

  private _renderGridPlus() {
    const roots = getProjectTreeChildren().filter(
      (n): n is TreeNode => n.type !== 'tree-divider'
    );
    const selectedName = getSelectedTreeName();
    return html`
      <div class="hierarchy-grid hierarchy-grid-plus">
        ${roots.map((node) => {
          const sectionKey = sectionKeyForTopLevelName(node.name);
          const isSelected = Boolean(sectionKey && selectedName && treeContainsName(node, selectedName));
          const sectionClass = sectionKey
            ? `hierarchy-grid-plus-card--section-${sectionKey} tree-section-${sectionKey}${isSelected ? ' selected' : ''}`
            : '';
          const children = gridPlusChildNodes(node, sectionKey);
          return html`
            <div
              class="hierarchy-grid-plus-card bevel-raised ${sectionClass}"
              data-section=${sectionKey ?? nothing}
            >
              <button
                type="button"
                class="hierarchy-grid-plus-head"
                data-tree-depth="0"
                @click=${() => this._onGridItemClick(node, sectionKey)}
                title=${node.desc ?? node.name}
              >
                <i class="fa-solid ${node.icon || 'fa-folder'}"></i>
                <span class="hierarchy-grid-label">${node.name}</span>
                ${sectionKey
                  ? html`<span class="tree-shortcut-chip">${getHierarchySectionShortcutChip(node.name)}</span>`
                  : nothing}
              </button>
              ${children.length
                ? html`
                    <div class="hierarchy-grid-plus-children" role="group" aria-label=${`${node.name} items`}>
                      ${children.map(
                        (child) => html`
                          <button
                            type="button"
                            class="hierarchy-grid-plus-child toolbar-btn${child.name === selectedName ? ' selected' : ''}"
                            data-tree-depth="1"
                            data-name=${child.name}
                            @click=${(e: Event) => this._onGridPlusChildClick(child, e)}
                            title=${child.desc ?? child.name}
                          >
                            <i class="fa-solid ${child.icon || 'fa-folder'}"></i>
                            <span class="hierarchy-grid-plus-child-label">${child.name}</span>
                          </button>
                        `
                      )}
                    </div>
                  `
                : nothing}
            </div>
          `;
        })}
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
        <button
          slot="actions"
          type="button"
          class="sidebar-project-overview-btn toolbar-btn"
          title="Project Overview"
          aria-label="Project Overview"
          @click=${() => this._openProjectOverview()}
        >
          <i class="fa-solid fa-chart-pie" aria-hidden="true"></i>
        </button>
      </cg-panel-header>
      <div class="panel-content tree-container" style="overflow-y: auto;">
        <div class="sidebar-view-bar">
          <div class="sidebar-view-group" role="group" aria-label="Hierarchy view">
            ${VIEW_OPTIONS.map(
              (opt) => html`
                <button
                  type="button"
                  class="sidebar-view-btn ${this._viewMode === opt.value ? 'active' : ''}"
                  data-view=${opt.value}
                  @click=${() => this._setView(opt.value)}
                  title=${opt.label}
                >
                  <i class="${opt.icon}" aria-hidden="true"></i>
                  <span>${opt.label}</span>
                </button>
              `
            )}
          </div>
          <button
            type="button"
            class="sidebar-features-btn"
            title="Project features"
            aria-label="Project features"
            @click=${() => this._openFeaturesModal()}
          >
            <i class="fa-solid fa-sliders" aria-hidden="true"></i>
            <span>Features</span>
          </button>
        </div>
        ${this._viewMode === 'tree'
          ? html`<cinegen-project-tree></cinegen-project-tree>`
          : this._viewMode === 'grid-plus'
            ? this._renderGridPlus()
            : this._renderGrid()}
      </div>
    `;
  }
}
