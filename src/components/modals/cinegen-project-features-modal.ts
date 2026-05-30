import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import type { FeatureTreeNode } from '@/components/primitives/cg-feature-tree';
import {
  buildAllEnabledFeaturesConfig,
  buildBlankProjectFeaturesConfig,
  flattenCatalogIds,
} from '@/tree/project-feature-catalog';
import {
  buildFeatureTreeForModal,
  configFromFeatureTreeNodes,
  effectiveParentId,
  getProjectFeaturesConfig,
  rerouteSelectionIfDisabled,
  setProjectFeaturesConfig,
} from '@/services/project-features-service';
import { requestProjectTreeRefresh } from '@/tree/project-tree-service';

interface FeaturePreset {
  id: string;
  label: string;
  roots: string[];
}

const FEATURE_PRESETS: FeaturePreset[] = [
  { id: 'all', label: 'All', roots: ['all'] },
  { id: 'pre-production', label: 'Pre-Production', roots: ['production-office'] },
  { id: 'cinematography', label: 'Cinematography', roots: ['cinematography'] },
  { id: 'production-design', label: 'Production Design', roots: ['production-design'] },
  { id: 'casting', label: 'Casting', roots: ['casting'] },
  { id: 'sound', label: 'Sound', roots: ['sound-department'] },
  { id: 'post', label: 'Post Production', roots: ['post-production'] },
  { id: 'ai-director', label: 'AI Director', roots: ['ai-director'] },
  { id: 'minimal', label: 'Minimal', roots: ['minimal'] },
];

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

  private _applyPreset(presetId: string): void {
    if (presetId === 'all') {
      setProjectFeaturesConfig(buildAllEnabledFeaturesConfig());
    } else if (presetId === 'minimal') {
      setProjectFeaturesConfig(buildBlankProjectFeaturesConfig());
    } else {
      const preset = FEATURE_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;
      const config = buildBlankProjectFeaturesConfig();
      for (const rootId of preset.roots) {
        const prefix = rootId ? `${rootId}/` : '';
        for (const id of flattenCatalogIds()) {
          if (id === rootId || id.startsWith(prefix)) {
            config.enabled[id] = true;
            let parent = effectiveParentId(id, config);
            while (parent) {
              config.enabled[parent] = true;
              parent = effectiveParentId(parent, config);
            }
          }
        }
      }
      setProjectFeaturesConfig(config);
    }
    this.refresh();
    requestProjectTreeRefresh();
    const ov = document.querySelector('cinegen-overview-panel') as HTMLElement & { refresh?: () => void } | null;
    ov?.refresh?.();
    rerouteSelectionIfDisabled();
  }

  render() {
    return html`
      <style>
        .preset-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 4px;
          padding: 6px 8px;
          margin-bottom: 4px;
        }
        .preset-btn {
          background: var(--chrome-btn-bg);
          border: 1px solid var(--chrome-border-outer);
          border-top-color: var(--chrome-border-highlight);
          border-left-color: var(--chrome-border-highlight);
          color: var(--text-main);
          padding: 4px 6px;
          cursor: pointer;
          font-size: 11px;
          text-shadow: 0 -1px 0 rgba(0,0,0,0.8);
          box-shadow: var(--chrome-inset-top), var(--chrome-drop-shadow);
          transition: none;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .preset-btn:hover {
          background: var(--chrome-btn-bg-hover);
          color: var(--text-highlight);
        }
        .preset-btn:active {
          background: var(--chrome-btn-bg-active);
          border-color: var(--chrome-active-border);
          border-top-color: var(--chrome-active-border-top);
          border-left-color: var(--chrome-active-border-top);
          box-shadow: var(--chrome-active-inset);
        }
      </style>
      <div class="preset-grid">
        ${FEATURE_PRESETS.map(
          (p) => html`
            <button
              class="preset-btn"
              type="button"
              title="${p.label}"
              @click=${() => this._applyPreset(p.id)}
            >
              ${p.label}
            </button>
          `
        )}
      </div>
      <div class="project-features-tree-wrap bevel-sunken">
        <cg-feature-tree .nodes=${this._nodes} @cg-change=${this._onTreeChange}></cg-feature-tree>
      </div>
    `;
  }
}
