import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

export interface SegmentedSplitSegment {
  key: string;
  label: string;
  title?: string;
  icon?: string;
  /** Element id for status dot updated by status-bar-service */
  indicatorId?: string;
}

@customElement('cg-segmented-split')
export class CgSegmentedSplit extends CgLightElement {
  @property({ type: String }) variant = '';
  @property({ attribute: false }) segments: SegmentedSplitSegment[] = [];

  @state() private _openKey: string | null = null;

  private _menuHtml: Record<string, string> = {};
  /** Preserves externally built menu HTML across Lit re-renders. */
  private _savedMenuHtml: Record<string, string> = {};
  private _slotsCaptured = false;
  private _clickOutsideHandler = (e: MouseEvent) => this._onClickOutside(e);
  private _escHandler = (e: KeyboardEvent) => this._onEsc(e);

  connectedCallback(): void {
    this._captureSlots();
    super.connectedCallback();
    this.classList.add('cg-segmented-split');
    if (this.variant) this.classList.add(this.variant);
    document.addEventListener('click', this._clickOutsideHandler);
    document.addEventListener('keydown', this._escHandler);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('click', this._clickOutsideHandler);
    document.removeEventListener('keydown', this._escHandler);
  }

  private _captureSlots(): void {
    if (this._slotsCaptured) return;
    this._slotsCaptured = true;
    for (const seg of this.segments) {
      const src = this.querySelector(`:scope > [slot="menu-${seg.key}"]`);
      if (src) {
        this._menuHtml[seg.key] = src.innerHTML;
        src.remove();
      }
    }
  }

  private _onClickOutside(e: MouseEvent): void {
    if (!this._openKey) return;
    const target = e.target as HTMLElement;
    if (target.closest(`cg-segmented-split#${this.id}`)) return;
    this._closeAllMenus();
  }

  private _onEsc(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this._openKey) this._closeAllMenus();
  }

  private _openMenu(key: string): void {
    this._closeAllMenus();
    this._openKey = key;
    this.classList.add('cg-segmented-split--open');
    const menu = this.querySelector<HTMLElement>(`.cg-segmented-split-menu[data-key="${key}"]`);
    if (menu) {
      menu.hidden = false;
      requestAnimationFrame(() => this._positionMenu(menu));
    }
    this.dispatchEvent(
      new CustomEvent('cg-menu-open', { bubbles: true, detail: { key, split: this } })
    );
  }

  private _closeAllMenus(): void {
    this._openKey = null;
    this.classList.remove('cg-segmented-split--open');
    this.querySelectorAll<HTMLElement>('.cg-segmented-split-menu').forEach((m) => {
      m.hidden = true;
    });
  }

  private _positionMenu(menu: HTMLElement): void {
    const segment = this.querySelector<HTMLElement>(`.cg-segmented-split-segment.open`);
    if (!segment) return;

    menu.style.position = 'fixed';
    menu.style.visibility = 'hidden';
    menu.style.pointerEvents = 'none';

    const segRect = segment.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const pad = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxH = vh - pad * 2;

    menu.style.maxHeight = `${maxH}px`;
    const menuW = menuRect.width || 240;
    const menuH = Math.min(menuRect.height || 0, maxH);

    let top = segRect.bottom + 2;
    let left = segRect.left;

    if (top + menuH > vh - pad) top = segRect.top - menuH - 2;
    if (left < pad) left = pad;
    if (left + menuW > vw - pad) left = vw - pad - menuW;
    if (top < pad) top = pad;

    menu.style.top = `${Math.round(top)}px`;
    menu.style.left = `${Math.round(left)}px`;
    menu.style.visibility = '';
    menu.style.pointerEvents = '';
  }

  private _onSegmentClick(key: string): void {
    // Dispatch cg-segment-action BEFORE opening menu so handlers can build menu content
    this.dispatchEvent(
      new CustomEvent('cg-segment-action', { bubbles: true, detail: { key, split: this } })
    );
    if (this._openKey === key) {
      this._closeAllMenus();
    } else {
      this._openMenu(key);
    }
  }

  protected willUpdate(): void {
    for (const seg of this.segments) {
      const menu = this.querySelector<HTMLElement>(`.cg-segmented-split-menu[data-key="${seg.key}"]`);
      if (menu?.innerHTML) {
        this._savedMenuHtml[seg.key] = menu.innerHTML;
      }
    }
  }

  render() {
    return html`
      <div class="cg-segmented-split-inner" role="group" aria-label="${this.variant || 'segmented split'}">
        ${this.segments.map((seg, i) => {
          const isOpen = this._openKey === seg.key;
          const cls = [
            'cg-segmented-split-segment',
            isOpen ? 'open' : '',
            i === 0 ? 'first' : '',
            i === this.segments.length - 1 ? 'last' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return html`
            <button
              type="button"
              class=${cls}
              data-sub-key=${seg.key}
              title=${seg.title || seg.label || nothing}
              aria-expanded=${isOpen ? 'true' : 'false'}
              aria-haspopup="menu"
              @click=${() => this._onSegmentClick(seg.key)}
            >
              ${seg.indicatorId
                ? html`<span class="sa-status-indicator" id=${seg.indicatorId}></span>`
                : nothing}
              ${seg.icon ? html`<i class="${seg.icon}" aria-hidden="true"></i>` : nothing}
              <span class="cg-segmented-split-label">${seg.label}</span>
              <i class="fa-solid fa-caret-down cg-segmented-split-caret" aria-hidden="true"></i>
            </button>
          `;
        })}
      </div>
      ${this.segments.map(
        (seg) => html`
          <div
            class="cg-segmented-split-menu toolbar-split-menu"
            data-key=${seg.key}
            role="menu"
            ?hidden=${this._openKey !== seg.key}
          ></div>
        `
      )}
    `;
  }

  updated(): void {
    for (const seg of this.segments) {
      const menu = this.querySelector<HTMLElement>(`.cg-segmented-split-menu[data-key="${seg.key}"]`);
      if (!menu) continue;
      if (this._savedMenuHtml[seg.key] && !menu.innerHTML) {
        menu.innerHTML = this._savedMenuHtml[seg.key];
      } else if (this._menuHtml[seg.key] && !menu.innerHTML) {
        menu.innerHTML = this._menuHtml[seg.key];
      }
    }
  }
}
