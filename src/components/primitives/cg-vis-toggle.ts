import { html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

/** Storyboard / script-editor visibility switch (styled checkbox). */
@customElement('cg-vis-toggle')
export class CgVisToggle extends CgLightElement {
  @property({ type: Boolean, reflect: true }) checked = false;
  @property() label = '';
  @property() title = '';
  /** Storyboard part key (`scene`, `frame`, `notes`). */
  @property({ attribute: 'data-storyboard-part' }) storyboardPart = '';
  @property({ type: Boolean, attribute: 'data-script-editor-chips' }) scriptEditorChips = false;
  @property({ type: Boolean, attribute: 'data-script-editor-anchors' }) scriptEditorAnchors = false;
  @property({ type: Boolean, attribute: 'data-script-editor-box-outlines' }) scriptEditorBoxOutlines = false;

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add('storyboard-vis-toggle');
  }

  private _onChange = (e: Event): void => {
    const input = e.target as HTMLInputElement;
    this.checked = input.checked;
    const part =
      this.storyboardPart ||
      (this.scriptEditorChips
        ? 'chips'
        : this.scriptEditorAnchors
          ? 'anchors'
          : this.scriptEditorBoxOutlines
            ? 'boxOutlines'
            : '');
    this.dispatchEvent(
      new CustomEvent('cg-change', {
        bubbles: true,
        detail: { part, checked: this.checked },
      })
    );
  };

  render() {
    return html`
      <input
        type="checkbox"
        .checked=${this.checked}
        title=${this.title || nothing}
        data-storyboard-part=${this.storyboardPart || nothing}
        ?data-script-editor-chips=${this.scriptEditorChips}
        ?data-script-editor-anchors=${this.scriptEditorAnchors}
        ?data-script-editor-box-outlines=${this.scriptEditorBoxOutlines}
        @change=${this._onChange}
      />
      <span class="storyboard-vis-switch" aria-hidden="true"></span>
      <span class="storyboard-vis-label">${this.label}</span>
    `;
  }
}
