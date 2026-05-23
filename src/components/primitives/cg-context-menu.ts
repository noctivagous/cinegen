import { html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { CgLightElement } from '@/components/lit-base';
import { closeAllContextMenus } from '@/services/context-menu-host';
import { positionMenuWithinViewport } from '@/services/context-menu-position';
import type {
  ContextMenuHeader,
  ContextMenuItem,
  ContextMenuOpenOptions,
} from '@/services/context-menu-types';
import { escHtml } from '@/utils/html';

@customElement('cg-context-menu')
export class CgContextMenu extends CgLightElement {
  @state() private _open = false;
  @state() private _items: ContextMenuItem[] = [];
  @state() private _header: ContextMenuHeader | null = null;

  private _x = 0;
  private _y = 0;
  private _onSelect: ((actionId: string) => void) | null = null;
  private _typeModifier = '';

  connectedCallback(): void {
    super.connectedCallback();
    this.hidden = true;
    this.setAttribute('role', 'menu');
    if (!this.classList.contains('chip-context-menu')) {
      this.classList.add('chip-context-menu');
    }
  }

  open(options: ContextMenuOpenOptions): void {
    closeAllContextMenus();
    this._items = options.items;
    this._header = options.header ?? null;
    this._x = options.x;
    this._y = options.y;
    this._onSelect = options.onSelect;
    this._applyTypeModifier(options.typeModifier ?? '');
    this._open = true;
    this.hidden = false;
    this.requestUpdate();
  }

  close(): void {
    this._open = false;
    this._onSelect = null;
    this.hidden = true;
    this._applyTypeModifier('');
    this.requestUpdate();
  }

  containsTarget(target: EventTarget | null): boolean {
    return Boolean(target && this.contains(target as Node));
  }

  private _applyTypeModifier(modifier: string): void {
    [...this.classList].forEach((c) => {
      if (c.startsWith('chip-context-menu--')) this.classList.remove(c);
    });
    const mod = modifier.trim();
    if (mod) this.classList.add(`chip-context-menu--${mod}`);
    this._typeModifier = mod;
  }

  protected updated(changed: Map<PropertyKey, unknown>): void {
    super.updated(changed);
    if (this._open && (changed.has('_open') || changed.has('_items'))) {
      positionMenuWithinViewport(this, this._x, this._y);
    }
  }

  private _onItemClick(actionId: string): void {
    const handler = this._onSelect;
    this.close();
    handler?.(actionId);
  }

  render() {
    if (!this._open) return nothing;

    return html`
      ${this._header
        ? html`
            <div class="chip-context-menu-header" role="presentation">
              <span class="chip-context-menu-header-label">${escHtml(this._header.label)}</span>
              <span class="chip-context-menu-header-type">${escHtml(this._header.caption)}</span>
            </div>
          `
        : nothing}
      ${repeat(
        this._items,
        (item) => item.id,
        (item) => html`
          <button
            type="button"
            class="chip-context-menu-item"
            role="menuitem"
            data-action-id=${item.id}
            @click=${(e: Event) => {
              e.stopPropagation();
              this._onItemClick(item.id);
            }}
          >
            <i class="fa-solid ${item.icon}" aria-hidden="true"></i>
            <span>${escHtml(item.label)}</span>
          </button>
        `
      )}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cg-context-menu': CgContextMenu;
  }
}
