import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import { closeAllToolbarSplitMenus } from '@/services/toolbar-split-service';

/**
 * Split toolbar control (main action + dropdown trigger + menu).
 * Light DOM: slotted children are captured before render (native &lt;slot&gt; needs shadow DOM).
 */
@customElement('cg-toolbar-split')
export class CgToolbarSplit extends CgLightElement {
  @property({ type: String }) variant = '';
  @property({ type: String, attribute: 'menu-id' }) menuId = '';
  @property({ type: String, attribute: 'main-title' }) mainTitle = '';
  @property({ type: String, attribute: 'main-id' }) mainId = '';
  @property({ type: Boolean, attribute: 'menu-wide' }) menuWide = false;
  /** Single button with caret — click toggles menu (no separate trigger segment). */
  @property({ type: Boolean, reflect: true }) unified = false;

  @state() private _open = false;
  private _wasOpen = false;

  private _mainHtml = '';
  private _menuNodes: Node[] = [];
  private _triggerHtml = '';
  private _slotsCaptured = false;
  /** Preserves externally built menu HTML (status bar) across Lit re-renders. */
  private _savedMenuHtml = '';

  connectedCallback(): void {
    this._captureLightDomSlots();
    super.connectedCallback();
    this.classList.add('toolbar-split');
    this._applyHostVariantClass();
    this.addEventListener('cg-close-menu', this.closeMenu);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('cg-close-menu', this.closeMenu);
  }

  protected willUpdate(): void {
    const menu = this.getMenuEl();
    if (this.menuId && menu?.innerHTML) {
      this._savedMenuHtml = menu.innerHTML;
    }
  }

  updated(changed: Map<string, unknown>): void {
    super.updated(changed);
    if (changed.has('variant') || changed.has('unified')) {
      this._applyHostVariantClass();
    }
    this._syncRenderedDom();
    const menu = this.getMenuEl();
    if (this.menuId && menu && this._savedMenuHtml && !menu.innerHTML) {
      menu.innerHTML = this._savedMenuHtml;
    }

    if (this._open && !this._wasOpen) {
      this.dispatchEvent(
        new CustomEvent('cg-menu-open', { bubbles: true, detail: { split: this } })
      );
    }
    this._wasOpen = this._open;
  }

  /** Host gets layout variants only (e.g. toolbar-split--compact); btn-ai stays on buttons. */
  private _applyHostVariantClass(): void {
    this.classList.add('toolbar-split');
    Array.from(this.classList).forEach((c) => {
      if (c.startsWith('toolbar-split--') && c !== 'toolbar-split--open') {
        this.classList.remove(c);
      }
    });
    if (this.variant.startsWith('toolbar-split')) {
      this.classList.add(this.variant);
    }
    if (this.unified) {
      this.classList.add('toolbar-split--unified');
    } else {
      this.classList.remove('toolbar-split--unified');
    }
    this.classList.toggle('toolbar-split--gui-chrome', this.variant === 'gui-chrome');
    this.classList.remove('btn-ai');
  }

  private _buttonModifierClass(): string {
    if (this.variant === 'btn-ai') return ' btn-ai';
    if (this.variant === 'gui-chrome') return ' toolbar-btn--gui-chrome';
    return '';
  }

  private _captureLightDomSlots(): void {
    if (this._slotsCaptured) return;
    this._slotsCaptured = true;

    const mainSrc = this.querySelector(':scope > [slot="main"]');
    if (mainSrc) {
      this._mainHtml = mainSrc.innerHTML;
      mainSrc.remove();
    }

    const menuSrc = this.querySelector(':scope > [slot="menu"]');
    if (menuSrc) {
      this._menuNodes = Array.from(menuSrc.childNodes).map((n) => n.cloneNode(true));
      menuSrc.remove();
    }

    const triggerSrc = this.querySelector(':scope > [slot="trigger"]');
    if (triggerSrc) {
      this._triggerHtml = triggerSrc.innerHTML;
      triggerSrc.remove();
    }
  }

  /** Lit re-render clears button contents; restore after each update. */
  private _syncRenderedDom(): void {
    const mainBtn = this.querySelector<HTMLElement>(
      this.unified ? '.toolbar-split-unified' : '.toolbar-split-main'
    );
    if (mainBtn && this._mainHtml) {
      const caret = this.unified
        ? '<i class="fa-solid fa-caret-down toolbar-split-unified-caret" aria-hidden="true"></i>'
        : '';
      const label = `<span class="toolbar-split-main-label">${this._mainHtml}</span>`;
      const content = this.unified ? `${label}${caret}` : label;
      if (mainBtn.innerHTML !== content) mainBtn.innerHTML = content;
    }

    const triggerBtn = this.querySelector<HTMLElement>('.toolbar-split-trigger');
    if (triggerBtn) {
      const caret = '<i class="fa-solid fa-caret-down" aria-hidden="true"></i>';
      const html = this._triggerHtml || caret;
      if (triggerBtn.innerHTML !== html) triggerBtn.innerHTML = html;
    }

    const menuEl = this.querySelector<HTMLElement>('.toolbar-split-menu');
    if (menuEl && this._menuNodes.length && menuEl.childNodes.length === 0) {
      menuEl.append(...this._menuNodes.map((n) => n.cloneNode(true)));
    }
  }

  get isOpen(): boolean {
    return this._open;
  }

  openMenu(): void {
    closeAllToolbarSplitMenus();
    this._open = true;
    this.classList.add('toolbar-split--open');
    const menu = this.getMenuEl();
    const trigger = this._menuTriggerEl();
    if (menu) menu.hidden = false;
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
    this.requestUpdate();
  }

  closeMenu(): void {
    this._open = false;
    this.classList.remove('toolbar-split--open');
    const menu = this.getMenuEl();
    const trigger = this._menuTriggerEl();
    if (menu) menu.hidden = true;
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    if (!this._open) this._savedMenuHtml = '';
    this.requestUpdate();
    this.dispatchEvent(new CustomEvent('cg-menu-close', { bubbles: true }));
  }

  private _menuTriggerEl(): HTMLElement | null {
    return this.querySelector<HTMLElement>(
      this.unified ? '.toolbar-split-unified' : '.toolbar-split-trigger'
    );
  }

  toggleMenu(): void {
    if (this._open) this.closeMenu();
    else this.openMenu();
  }

  getMenuEl(): HTMLElement | null {
    if (this.menuId) {
      return this.querySelector<HTMLElement>(`#${CSS.escape(this.menuId)}`);
    }
    return this.querySelector<HTMLElement>('.toolbar-split-menu');
  }

  private _onMainClick = (e: Event) => {
    if (this.unified) {
      e.stopPropagation();
      this.toggleMenu();
      return;
    }
    this.dispatchEvent(
      new CustomEvent('cg-main-action', { bubbles: true, detail: { originalEvent: e } })
    );
  };

  private _onTriggerClick = (e: Event) => {
    e.stopPropagation();
    this.toggleMenu();
    this.dispatchEvent(
      new CustomEvent('cg-trigger-action', { bubbles: true, detail: { originalEvent: e } })
    );
  };

  render() {
    const menuClass = [
      'toolbar-split-menu',
      this.menuWide ? 'toolbar-split-menu--wide' : '',
    ]
      .filter(Boolean)
      .join(' ');

    const aiClass = this._buttonModifierClass();

    if (this.unified) {
      return html`
        <button
          type="button"
          id=${this.mainId || nothing}
          class="toolbar-btn toolbar-split-unified${aiClass}"
          title=${this.mainTitle || ''}
          aria-expanded=${this._open ? 'true' : 'false'}
          aria-haspopup="menu"
          aria-controls=${this.menuId || nothing}
          @click=${this._onMainClick}
        ></button>
        <div
          id=${this.menuId || nothing}
          class=${menuClass}
          role="menu"
          ?hidden=${!this._open}
        ></div>
      `;
    }

    return html`
      <button
        type="button"
        id=${this.mainId || nothing}
        class="toolbar-btn toolbar-split-main${aiClass}"
        title=${this.mainTitle || ''}
        @click=${this._onMainClick}
      ></button>
      <button
        type="button"
        class="toolbar-btn toolbar-split-trigger${aiClass}"
        aria-expanded=${this._open ? 'true' : 'false'}
        aria-haspopup="menu"
        aria-controls=${this.menuId || nothing}
        @click=${this._onTriggerClick}
      ></button>
      <div
        id=${this.menuId || nothing}
        class=${menuClass}
        role="menu"
        ?hidden=${!this._open}
      ></div>
    `;
  }
}
