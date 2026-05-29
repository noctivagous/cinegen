import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

export interface FeatureTreeNode {
  id: string;
  label: string;
  checked?: boolean;
  icon?: string;
  children?: FeatureTreeNode[];
}

type DropMode = 'before' | 'inside' | 'after';

function cloneNodes(nodes: FeatureTreeNode[]): FeatureTreeNode[] {
  return nodes.map((n) => ({
    ...n,
    checked: n.checked !== false,
    children: n.children?.length ? cloneNodes(n.children) : undefined,
  }));
}

function findNodeWithParent(
  nodes: FeatureTreeNode[],
  id: string,
  parent: FeatureTreeNode | null = null
): { node: FeatureTreeNode; parent: FeatureTreeNode | null; list: FeatureTreeNode[]; index: number } | null {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.id === id) return { node: n, parent, list: nodes, index: i };
    if (n.children?.length) {
      const found = findNodeWithParent(n.children, id, n);
      if (found) return found;
    }
  }
  return null;
}

function removeNode(nodes: FeatureTreeNode[], id: string): FeatureTreeNode | null {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) {
      return nodes.splice(i, 1)[0];
    }
    if (nodes[i].children?.length) {
      const removed = removeNode(nodes[i].children!, id);
      if (removed) return removed;
    }
  }
  return null;
}

function flattenDepthFirst(nodes: FeatureTreeNode[]): string[] {
  const out: string[] = [];
  const walk = (list: FeatureTreeNode[]) => {
    for (const n of list) {
      out.push(n.id);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

function computeCheckState(node: FeatureTreeNode): 'checked' | 'unchecked' | 'mixed' {
  if (!node.children?.length) return node.checked !== false ? 'checked' : 'unchecked';
  const states = node.children.map(computeCheckState);
  if (states.every((s) => s === 'checked')) return 'checked';
  if (states.every((s) => s === 'unchecked')) return 'unchecked';
  return 'mixed';
}

function setSubtreeChecked(node: FeatureTreeNode, checked: boolean): void {
  node.checked = checked;
  node.children?.forEach((c) => setSubtreeChecked(c, checked));
}

@customElement('cg-feature-tree')
export class CgFeatureTree extends CgLightElement {
  @property({ attribute: false }) nodes: FeatureTreeNode[] = [];

  @state() private _dragId: string | null = null;
  @state() private _dropTarget: { id: string; mode: DropMode } | null = null;

  private _working: FeatureTreeNode[] = [];

  willUpdate(changed: Map<string, unknown>): void {
    if (changed.has('nodes')) {
      this._working = cloneNodes(this.nodes);
    }
  }

  private _emitChange(): void {
    this.dispatchEvent(
      new CustomEvent('cg-change', {
        bubbles: true,
        detail: {
          nodes: this._working,
          order: flattenDepthFirst(this._working),
        },
      })
    );
  }

  private _onCheck(node: FeatureTreeNode): void {
    const next = computeCheckState(node) !== 'checked';
    setSubtreeChecked(node, next);
    this.requestUpdate();
    this._emitChange();
  }

  private _onDragStart(id: string, e: DragEvent): void {
    this._dragId = id;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
    }
  }

  private _onDragEnd(): void {
    this._dragId = null;
    this._dropTarget = null;
  }

  private _onDragOver(id: string, e: DragEvent): void {
    e.preventDefault();
    if (!this._dragId || this._dragId === id) return;
    const row = e.currentTarget as HTMLElement;
    const rect = row.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const third = rect.height / 3;
    let mode: DropMode = 'inside';
    if (y < third) mode = 'before';
    else if (y > rect.height - third) mode = 'after';
    this._dropTarget = { id, mode };
  }

  private _onDragLeave(): void {
    this._dropTarget = null;
  }

  private _onDrop(targetId: string, e: DragEvent): void {
    e.preventDefault();
    const dragId = this._dragId;
    const mode = this._dropTarget?.id === targetId ? this._dropTarget.mode : 'inside';
    this._dragId = null;
    this._dropTarget = null;
    if (!dragId || dragId === targetId) return;

    const removed = removeNode(this._working, dragId);
    if (!removed) return;

    const target = findNodeWithParent(this._working, targetId);
    if (!target) return;

    if (mode === 'inside') {
      target.node.children ??= [];
      target.node.children.push(removed);
    } else {
      const insertIndex = mode === 'before' ? target.index : target.index + 1;
      target.list.splice(insertIndex, 0, removed);
    }

    this.requestUpdate();
    this._emitChange();
  }

  private _rowClass(id: string): string {
    const parts = ['cg-feature-tree-row'];
    if (this._dragId === id) parts.push('cg-feature-tree-row--dragging');
    if (this._dropTarget?.id === id) {
      parts.push(`cg-feature-tree-row--drop-${this._dropTarget.mode}`);
    }
    return parts.join(' ');
  }

  private _renderNode(node: FeatureTreeNode, depth: number): unknown {
    const state = computeCheckState(node);
    const checked = state === 'checked';
    const mixed = state === 'mixed';

    return html`
      <div
        class=${this._rowClass(node.id)}
        style="padding-left: ${depth * 16}px"
        draggable="true"
        @dragstart=${(e: DragEvent) => this._onDragStart(node.id, e)}
        @dragend=${() => this._onDragEnd()}
        @dragover=${(e: DragEvent) => this._onDragOver(node.id, e)}
        @dragleave=${() => this._onDragLeave()}
        @drop=${(e: DragEvent) => this._onDrop(node.id, e)}
      >
        <span class="cg-feature-tree-handle" aria-hidden="true" title="Drag to reorder"
          ><i class="fa-solid fa-grip-vertical"></i
        ></span>
        <label class="cg-feature-tree-label">
          <input
            type="checkbox"
            class="cg-feature-tree-input"
            .checked=${checked}
            .indeterminate=${mixed}
            @change=${() => this._onCheck(node)}
          />
          <span class="cg-feature-tree-box" aria-hidden="true">
            ${mixed
              ? html`<span class="cg-feature-tree-dash"></span>`
              : checked
                ? html`<i class="fa-solid fa-check cg-feature-tree-check" aria-hidden="true"></i>`
                : nothing}
          </span>
          ${node.icon
            ? html`<i class="fa-solid ${node.icon} cg-feature-tree-icon" aria-hidden="true"></i>`
            : nothing}
          <span class="cg-feature-tree-text">${node.label}</span>
        </label>
      </div>
      ${node.children?.map((c) => this._renderNode(c, depth + 1)) ?? nothing}
    `;
  }

  render() {
    const list = this._working.length ? this._working : cloneNodes(this.nodes);
    return html`
      <div class="cg-feature-tree">
        ${list.map((n) => this._renderNode(n, 0))}
      </div>
    `;
  }
}
