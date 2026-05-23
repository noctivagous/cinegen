import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

@customElement('cinegen-workspace-empty')
export class CinegenWorkspaceEmpty extends CgLightElement {
  connectedCallback(): void {
    super.connectedCallback();
    this.id = 'view-default';
    this.classList.add('hidden', 'flex', 'items-center', 'justify-center', 'h-full', 'bevel-sunken');
  }

  render() {
    return html`
      <div class="text-center" style="color: var(--text-dim);">
        <i class="fa-solid fa-film" style="font-size: 48px; opacity: 0.3;"></i>
        <p class="mt-4">Select a node from Project Hierarchy</p>
        <button data-ws-action="globalAIAssist" class="mt-6 px-6 py-2 btn-ai text-sm">
          Let AI suggest next step
        </button>
      </div>
    `;
  }
}
