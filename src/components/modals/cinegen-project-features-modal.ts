import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import type { FeatureTreeNode } from '@/components/primitives/cg-feature-tree';
import {
  buildFeatureTreeForModal,
  configFromFeatureTreeNodes,
  getProjectFeaturesConfig,
  rerouteSelectionIfDisabled,
  setProjectFeaturesConfig,
} from '@/services/project-features-service';
import { requestProjectTreeRefresh } from '@/tree/project-tree-service';

@customElement('cinegen-project-features-modal')
export class CinegenProjectFeaturesModal extends CgLightElement {
  @state() private _nodes: FeatureTreeNode[] = [];

  refresh(): void {
    this._nodes = buildFeatureTreeForModal(getProjectFeaturesConfig());
    this.requestUpdate();
  }

  private _apply(nodes: FeatureTreeNode[], order: string[]): void {
    const config = configFromFeatureTreeNodes(nodes, order);
    setProjectFeaturesConfig(config);
    requestProjectTreeRefresh();
    const ov = document.querySelector('cinegen-overview-panel') as HTMLElement & { refresh?: () => void } | null;
    ov?.refresh?.();
    rerouteSelectionIfDisabled();
  }

  private _onTreeChange(e: CustomEvent<{ nodes: FeatureTreeNode[]; order: string[] }>): void {
    this._nodes = e.detail.nodes;
    this._apply(e.detail.nodes, e.detail.order);
  }

  render() {
    return html`
      <div class="project-features-tree-wrap bevel-sunken">
        <cg-feature-tree .nodes=${this._nodes} @cg-change=${this._onTreeChange}></cg-feature-tree>
      </div>
    `;
  }
}
