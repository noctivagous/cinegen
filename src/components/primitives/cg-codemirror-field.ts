import { html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import { createPlainEditor, setPlainEditorDoc, type PlainEditorVariant } from '@/script/cm6-plain-editor';
import type { EditorView } from '@codemirror/view';

/**
 * Bevel-sunken CodeMirror field — matches styleguide script/prompt wells.
 */
@customElement('cg-codemirror-field')
export class CgCodemirrorField extends CgLightElement {
  @property({ type: String }) label = '';
  @property({ type: String }) value = '';
  @property({ type: Boolean }) readOnly = true;
  @property({ type: String, reflect: true }) variant: PlainEditorVariant = 'plain';
  @property({ type: Number }) minHeight = 72;
  @property({ type: String }) hint = '';

  private _view: EditorView | null = null;
  private _host: HTMLElement | null = null;

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }
    .cm-field-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-dim);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .cm-field-shell {
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
    }
    .cm-field-shell .cm-host {
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }
    .cm-field-hint {
      font-size: 10px;
      color: var(--text-dim);
      font-style: italic;
    }
  `;

  protected override createRenderRoot() {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.classList.add('cg-codemirror-field');
  }

  override updated(changed: Map<string, unknown>): void {
    if (!this._view) {
      this._mount();
    }
    if (this._view && changed.has('value')) {
      setPlainEditorDoc(this._view, this.value || '');
    }
    if (changed.has('minHeight') && this._host) {
      this._host.style.minHeight = `${this.minHeight}px`;
    }
  }

  override disconnectedCallback(): void {
    this._view?.destroy();
    this._view = null;
    super.disconnectedCallback();
  }

  private _mount(): void {
    this._host = this.querySelector<HTMLElement>('.cm-host');
    if (!this._host || this._view) return;
    this._host.style.minHeight = `${this.minHeight}px`;
    this._view = createPlainEditor({
      parent: this._host,
      doc: this.value || '',
      readOnly: this.readOnly,
      variant: this.variant,
      minHeight: this.minHeight,
      onChange: (text) => {
        if (!this.readOnly) {
          this.value = text;
          this.dispatchEvent(
            new CustomEvent('cg-change', { detail: { value: text }, bubbles: true, composed: true })
          );
        }
      },
    });
  }

  render() {
    return html`
      ${this.label
        ? html`<div class="cm-field-label">${this.label}</div>`
        : null}
      <div class="bevel-sunken cm-field-shell" style="min-height:${this.minHeight}px">
        <div class="cm-host"></div>
      </div>
      ${this.hint ? html`<div class="cm-field-hint">${this.hint}</div>` : null}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cg-codemirror-field': CgCodemirrorField;
  }
}
