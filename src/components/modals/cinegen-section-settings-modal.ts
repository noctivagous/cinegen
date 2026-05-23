import { html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import type { CheckboxTreeNode } from '@/components/primitives/cg-checkbox-tree';
import {
  buildCheckboxTreeNodes,
  getCurrentSectionKey,
  setNodeVisibility,
} from '@/services/section-visibility-service';

@customElement('cinegen-section-settings-modal')
export class CinegenSectionSettingsModal extends CgLightElement {
  @state() private _sectionKey: string | null = null;
  @state() private _nodes: CheckboxTreeNode[] = [];

  refresh(): void {
    this._sectionKey = getCurrentSectionKey();
    this._nodes = buildCheckboxTreeNodes(this._sectionKey);
    this.requestUpdate();
  }

  private _onTreeChange(e: CustomEvent<{ nodes: CheckboxTreeNode[] }>): void {
    const sectionKey = this._sectionKey;
    if (!sectionKey) return;
    const apply = (nodes: CheckboxTreeNode[]) => {
      for (const n of nodes) {
        setNodeVisibility(sectionKey, n.id, n.checked !== false);
        if (n.children) apply(n.children);
      }
    };
    apply(e.detail.nodes);
    this._nodes = [...this._nodes];
    this.requestUpdate();
    (window as unknown as { requestProjectTreeRefresh?: () => void }).requestProjectTreeRefresh?.();
    const ov = document.querySelector('cinegen-overview-panel') as HTMLElement & { refresh?: () => void } | null;
    ov?.refresh?.();
  }

  render() {
    const title = this._sectionKey
      ? this._sectionKey.charAt(0).toUpperCase() + this._sectionKey.slice(1)
      : 'Section';

    if (!this._nodes.length) {
      return html`
        <div class="section-settings-grid">
          <p style="padding:16px;color:var(--text-dim);font-size:12px;">
            No configurable sections for the current workspace.
          </p>
        </div>
      `;
    }

    return html`
      <div class="section-settings-grid">
        ${this._nodes.map(
          (node) => html`
            <div class="section-settings-card bevel-sunken">
              <div class="section-settings-card-header">${node.label}</div>
              <div class="section-settings-card-body">
                <cg-checkbox-tree
                  .nodes=${node.children ?? [node]}
                  compact
                  @cg-change=${this._onTreeChange}
                ></cg-checkbox-tree>
              </div>
            </div>
          `
        )}
      </div>
    `;
  }
}
