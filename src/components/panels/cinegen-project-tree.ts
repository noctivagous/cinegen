import { consume } from '@lit/context';
import { classMap } from 'lit/directives/class-map.js';
import { html, nothing, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import { appShellStoreContext } from '@/context/app-shell-context';
import { appShellStore, type AppShellStore } from '@/stores/app-shell-store';
import { bindAppShellToHost } from '@/stores/bind-app-shell-host';
import { sectionKeyForTopLevelName, TREE_SECTION_BY_NAME } from '@/tree/tree-constants';
import { getSectionShortcutChip } from '@/keybindings/init-keybindings';
import {
  getProjectTreeChildren,
  getSelectedTreeName,
  handleTreeNodeSelect,
  getScrapFrameCount,
  sceneTreeSubtitle,
  requestProjectTreeRefresh,
  subscribeProjectTree,
  toggleTreeNodeExpanded,
} from '@/tree/project-tree-service';
import type { TreeNode } from '@/tree/tree-types';
import { filterVisibleNodes } from '@/services/section-visibility-service';

@customElement('cinegen-project-tree')
export class CinegenProjectTree extends CgLightElement {
  @consume({ context: appShellStoreContext })
  private _shellStore?: AppShellStore;

  private _treeUnsub: (() => void) | null = null;
  private _shellUnsub: (() => void) | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add('p-1');
    this.id = 'project-tree';
    this._treeUnsub = subscribeProjectTree(() => this.requestUpdate());
    this._shellUnsub = bindAppShellToHost(this, () => this._shellStore ?? appShellStore);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._treeUnsub?.();
    this._treeUnsub = null;
    this._shellUnsub?.();
    this._shellUnsub = null;
  }

  private _onItemClick(node: TreeNode, sectionKey: string | null, e: Event): void {
    e.stopImmediatePropagation();
    handleTreeNodeSelect(node, sectionKey);
  }

  private _onToggle(node: TreeNode, e: Event): void {
    e.stopPropagation();
    toggleTreeNodeExpanded(node);
  }

  private _onItemDblClick(node: TreeNode, e: Event): void {
    e.preventDefault();
    e.stopPropagation();
    toggleTreeNodeExpanded(node);
  }

  private _itemClassMap(
    node: TreeNode,
    level: number,
    section: string | null,
    selected: boolean
  ): Record<string, boolean> {
    return {
      'tree-item': true,
      'tree-item--toplevel': level === 0 && Boolean(section),
      [`tree-section-${section}`]: Boolean(section),
      'tree-item--global-assets': node.name === 'Global Assets',
      'tree-item--scene': node.type === 'scene',
      selected,
    };
  }

  private _renderNodes(
    nodes: TreeNode[],
    level: number,
    sectionKey: string | null
  ): TemplateResult[] {
    const visible = filterVisibleNodes(nodes, sectionKey);
    return visible.flatMap((node) => this._renderNode(node, level, sectionKey));
  }

  private _renderNode(node: TreeNode, level: number, sectionKey: string | null): TemplateResult[] {
    if (node.type === 'tree-divider') {
      return [
        html`<div class="tree-sidebar-divider" role="separator" aria-hidden="true"></div>`,
      ];
    }

    let section = sectionKey;
    if (level === 0 && node.name) {
      const top = sectionKeyForTopLevelName(node.name);
      if (top) section = top;
    }

    if (node.type === 'group' && node.children?.length) {
      return [
        html`<div
          class=${classMap({
            'tree-group-outline': true,
            [`tree-section-${section}`]: Boolean(section),
          })}
          role="group"
          aria-label="Script, storyboard, and combined views"
        >
          ${this._renderNodes(node.children, level + 1, section)}
        </div>`,
      ];
    }

    const selected = getSelectedTreeName() === node.name;
    const hasChildren = Boolean(node.children?.length);
    const labelText =
      node.type === 'scrap' ? `${node.name} (${getScrapFrameCount()})` : node.name;

    const item = html`
      <div
        class=${classMap(this._itemClassMap(node, level, section, selected))}
        data-tree-depth=${String(level)}
        data-type=${node.type}
        data-view=${node.view ?? 'default'}
        data-name=${node.name}
        data-section=${section ?? nothing}
        data-scene-id=${node.sceneId ?? nothing}
        data-preprod-mode=${node.preprodMode ?? nothing}
        @click=${(e: Event) => this._onItemClick(node, section, e)}
        @dblclick=${hasChildren ? (e: Event) => this._onItemDblClick(node, e) : nothing}
      >
        ${hasChildren
          ? html`<span class="toggle" @click=${(e: Event) => this._onToggle(node, e)}
              >${node.expanded ? '▼' : '▶'}</span
            >`
          : nothing}
        <i class="fa-solid ${node.icon ?? 'fa-folder'}"></i>
        ${node.type === 'scene'
          ? html`<span class="tree-item-label-stack">
              <span class="tree-item-line-primary">${node.name}</span>
              ${(() => {
                const sub = sceneTreeSubtitle(node);
                return sub
                  ? html`<span class="tree-item-line-secondary">${sub}</span>`
                  : nothing;
              })()}
            </span>`
          : html`<span class=${classMap({ 'tree-label-folder': node.type === 'folder' })}
              >${labelText}</span
            >`}
        ${level === 0 && section
          ? html`<span class="tree-shortcut-chip">${getSectionShortcutChip(node.name)}</span>`
          : nothing}
      </div>
    `;

    const out: TemplateResult[] = [item];

    if (hasChildren && node.expanded) {
      const visibleChildren = filterVisibleNodes(node.children!, section);
      if (visibleChildren.length) {
        out.push(
          html`<div
            class=${classMap({
              'tree-children': true,
              expanded: true,
              [`tree-section-${section}`]: Boolean(section),
            })}
          >
            ${this._renderNodes(visibleChildren, level + 1, section)}
          </div>`
        );
      }
    }

    return out;
  }

  render() {
    void (this._shellStore ?? appShellStore).activeProjectId;
    const roots = getProjectTreeChildren();
    if (!roots.length) return nothing;
    return html`${this._renderNodes(roots, 0, null)}`;
  }
}

