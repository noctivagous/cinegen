import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

export interface CheckboxTreeNode {
  id: string;
  label: string;
  checked?: boolean;
  children?: CheckboxTreeNode[];
}

function computeState(node: CheckboxTreeNode): 'checked' | 'unchecked' | 'mixed' {
  if (!node.children || node.children.length === 0) {
    return node.checked ? 'checked' : 'unchecked';
  }
  const childStates = node.children.map(computeState);
  if (childStates.every((s) => s === 'checked')) return 'checked';
  if (childStates.every((s) => s === 'unchecked')) return 'unchecked';
  return 'mixed';
}

function setAll(nodes: CheckboxTreeNode[], checked: boolean): void {
  for (const n of nodes) {
    n.checked = checked;
    if (n.children) setAll(n.children, checked);
  }
}

function findNode(nodes: CheckboxTreeNode[], id: string): CheckboxTreeNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) {
      const found = findNode(n.children, id);
      if (found) return found;
    }
  }
  return null;
}

@customElement('cg-checkbox-tree')
export class CgCheckboxTree extends CgLightElement {
  @property({ attribute: false }) nodes: CheckboxTreeNode[] = [];
  @property({ type: Boolean, reflect: true }) compact = false;

  private _onNodeClick(node: CheckboxTreeNode): void {
    const next = computeState(node) !== 'checked';
    node.checked = next;
    if (node.children) setAll(node.children, next);
    this.requestUpdate();
    this.dispatchEvent(
      new CustomEvent('cg-change', {
        bubbles: true,
        detail: { nodes: this.nodes },
      })
    );
  }

  private _renderNode(node: CheckboxTreeNode, depth: number): unknown {
    const state = computeState(node);
    const checked = state === 'checked';
    const mixed = state === 'mixed';
    const hasChildren = Boolean(node.children?.length);

    return html`
      <div class="cg-checkbox-tree-row" style="padding-left: ${depth * 16}px">
        <label class="cg-checkbox-tree-label">
          <input
            type="checkbox"
            class="cg-checkbox-tree-input"
            .checked=${checked}
            .indeterminate=${mixed}
            @change=${() => this._onNodeClick(node)}
          />
          <span class="cg-checkbox-tree-box" aria-hidden="true">
            ${mixed
              ? html`<span class="cg-checkbox-tree-dash"></span>`
              : checked
                ? html`<i class="fa-solid fa-check cg-checkbox-tree-check" aria-hidden="true"></i>`
                : nothing}
          </span>
          <span class="cg-checkbox-tree-text">${node.label}</span>
        </label>
      </div>
      ${hasChildren ? node.children!.map((c) => this._renderNode(c, depth + 1)) : nothing}
    `;
  }

  render() {
    return html`
      <div class="cg-checkbox-tree ${this.compact ? 'cg-checkbox-tree--compact' : ''}">
        ${this.nodes.map((n) => this._renderNode(n, 0))}
      </div>
    `;
  }
}
