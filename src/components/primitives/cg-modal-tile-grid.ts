import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import { html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

export interface ModalTileDef {
  id: string;
  icon: string;
  title: string;
  desc: string;
}

/** Settings / AI Assist modal tile grid (replaces imperative DOM `replaceChildren`). */
@customElement('cg-modal-tile-grid')
export class CgModalTileGrid extends CgLightElement {
  @property({ attribute: false }) tiles: ModalTileDef[] = [];
  /** Optional kind passed through on `cg-modal-tile-select` (e.g. `assistant` | `task`). */
  @property({ type: String }) kind = '';

  render() {
    return html`${repeat(
      this.tiles,
      (tile) => tile.id,
      (tile) => html`
        <button
          type="button"
          class=${classMap({
            'settings-modal-tile': true,
            'toolbar-btn': true,
            'bevel-raised': true,
          })}
          @click=${() => this._onSelect(tile)}
        >
          <span class="settings-modal-tile-icon" aria-hidden="true">
            <i class=${tile.icon}></i>
          </span>
          <span class="settings-modal-tile-title">${tile.title}</span>
          <span class="settings-modal-tile-desc">${tile.desc}</span>
        </button>
      `
    )}`;
  }

  private _onSelect(tile: ModalTileDef): void {
    this.dispatchEvent(
      new CustomEvent('cg-modal-tile-select', {
        bubbles: true,
        composed: true,
        detail: { id: tile.id, kind: this.kind },
      })
    );
  }
}
