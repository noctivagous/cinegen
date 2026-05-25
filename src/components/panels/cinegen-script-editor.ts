import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

/**
 * Script editor host — Fountain textarea + syntax backdrop.
 * Fountain parse/render stays in fountain-bundle.
 */
@customElement('cinegen-script-editor')
export class CinegenScriptEditor extends CgLightElement {
  private _wired = false;

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add('script-editor-stack');
    this.id = 'script-editor-stack';
  }

  protected firstUpdated(): void {
    this.wireTextarea();
    const ta = this.getTextarea();
    if (ta && !ta.value && window.getProjectFountainText?.()) {
      window.hydrateScriptEditorFromProject?.();
    }
    this.scheduleBackdropRender();
  }

  wireTextarea(): void {
    if (this._wired) return;
    const ta = this.getTextarea();
    if (!ta) return;
    this._wired = true;

    ta.addEventListener('input', () => {
      window.scheduleFountainRender?.();
      window.scheduleScriptEditorProjectSync?.();
    });
    ta.addEventListener('scroll', () => window.syncScriptRenderScroll?.(), { passive: true });
    ta.addEventListener('contextmenu', (e: MouseEvent) => {
      e.preventDefault();
      window.showScriptContextMenu?.(e.clientX, e.clientY);
    });
    ta.addEventListener('mouseup', () => window.syncScriptSelectionToStoryboard?.());
    ta.addEventListener('keyup', () => window.syncScriptSelectionToStoryboard?.());

    const margin = this.querySelector<HTMLElement>('#script-previs-margin');
    if (margin) {
      margin.addEventListener('click', (event: Event) => {
        window.handleScriptPrevisMarginClick?.(event);
      });
      margin.addEventListener('mousedown', (event: MouseEvent) => {
        window.handleScriptPrevisMarginDragStart?.(event);
      });
    }
    window.addEventListener('previs-selection-changed', () => {
      window.renderScriptPrevisMargin?.();
    });
    window.addEventListener('storyboard-frames-changed', () => {
      window.renderScriptPrevisMargin?.();
    });
    window.addEventListener('previs-timing-changed', () => {
      window.renderScriptPrevisMargin?.();
    });
  }

  getTextarea(): HTMLTextAreaElement | null {
    return this.querySelector<HTMLTextAreaElement>('#script-editor');
  }

  scheduleBackdropRender(): void {
    window.scheduleFountainRender?.();
  }

  render() {
    return html`
      <div class="script-editor-layout">
        <div id="script-previs-margin" class="script-previs-margin"></div>
        <div class="script-editor-main">
          <div id="script-editor-render-layer" class="script-editor-render-layer" aria-hidden="true">
            <div id="script-editor-render" class="script-editor-render"></div>
          </div>
          <textarea
            id="script-editor"
            class="script-editor script-editor-input"
            spellcheck="false"
          ></textarea>
        </div>
      </div>
    `;
  }
}
