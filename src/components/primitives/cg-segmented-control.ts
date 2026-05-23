import { html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

export interface SegmentedOption {
  value: string;
  label: string;
  icon?: string;
}

@customElement('cg-segmented-control')
export class CgSegmentedControl extends CgLightElement {
  @property({ type: String }) value = '';
  @property({ type: String }) name = 'segmented';
  @property({ type: String }) variant = 'cg-segmented--matte';
  @property({ attribute: false }) options: SegmentedOption[] = [];

  private _onSegmentClick(value: string) {
    if (value === this.value) return;
    this.value = value;
    this.dispatchEvent(
      new CustomEvent('cg-change', {
        bubbles: true,
        detail: { value },
      })
    );
  }

  render() {
    const groupClass = ['cg-segmented', this.variant].filter(Boolean).join(' ');
    return html`
      <div class=${groupClass} role="group" aria-label=${this.name}>
        ${this.options.map(
          (opt) => html`
            <button
              type="button"
              class="cg-segmented-segment ${this.value === opt.value ? 'active' : ''}"
              data-segmented-value=${opt.value}
              @click=${() => this._onSegmentClick(opt.value)}
            >
              ${opt.icon
                ? html`<i class="${opt.icon}" aria-hidden="true"></i> `
                : null}
              ${opt.label}
            </button>
          `
        )}
        <slot></slot>
      </div>
    `;
  }
}
