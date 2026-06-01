import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';

@customElement('cg-reference-upload')
export class CgReferenceUpload extends CgLightElement {
  @property() label = '';
  @property() currentUrl = '';
  @property() field = '';
  @property() accept = 'image/*';
  @property({ type: Boolean }) multiple = false;

  @state() private _dragOver = false;
  @state() private _previewUrl = '';

  private _fileInput: HTMLInputElement | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add('block', 'relative');
    this._previewUrl = this.currentUrl;
  }

  updated(changed: Map<string, unknown>): void {
    if (changed.has('currentUrl')) {
      this._previewUrl = this.currentUrl;
    }
  }

  private _onDragEnter(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this._dragOver = true;
  }

  private _onDragOver(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  }

  private _onDragLeave(e: DragEvent): void {
    const host = e.currentTarget as HTMLElement;
    const related = e.relatedTarget as Node | null;
    if (related && host.contains(related)) return;
    this._dragOver = false;
  }

  private _onDrop(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this._dragOver = false;
    const files = e.dataTransfer?.files;
    if (!files?.length) return;
    this._handleFiles(files);
  }

  private _onFilePicked(e: Event): void {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (!files?.length) return;
    this._handleFiles(files);
    input.value = '';
  }

  private _handleFiles(files: FileList): void {
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      this._readFile(file);
      if (!this.multiple) break;
    }
  }

  private _readFile(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      this._previewUrl = dataUrl;
      this.dispatchEvent(new CustomEvent('cg-file-loaded', {
        bubbles: true,
        composed: true,
        detail: { dataUrl, field: this.field, fileName: file.name },
      }));
    };
    reader.onerror = () => {
      this.dispatchEvent(new CustomEvent('cg-file-error', {
        bubbles: true,
        composed: true,
        detail: { error: 'Failed to read file', field: this.field },
      }));
    };
    reader.readAsDataURL(file);
  }

  private _removeImage(e: Event): void {
    e.stopPropagation();
    this._previewUrl = '';
    this.dispatchEvent(new CustomEvent('cg-file-removed', {
      bubbles: true,
      composed: true,
      detail: { field: this.field },
    }));
  }

  private _openPicker(): void {
    if (!this._fileInput) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = this.accept;
      input.multiple = this.multiple;
      input.style.display = 'none';
      input.addEventListener('change', (e) => this._onFilePicked(e));
      this.appendChild(input);
      this._fileInput = input;
    }
    this._fileInput.click();
  }

  render() {
    const hasImage = !!this._previewUrl;
    return html`
      <div
        class="cg-ref-upload relative ${this._dragOver ? 'drag-over' : ''}"
        style="
          width: 100px; height: 100px;
          border: 2px dashed ${hasImage ? 'var(--border-subtle, #444)' : 'var(--border, #555)'};
          border-radius: 6px;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          cursor: pointer; overflow: hidden; position: relative;
          background: ${hasImage ? 'transparent' : 'var(--bg-inset, #1a1a1a)'};
        "
        @click=${() => this._openPicker()}
        @dragenter=${this._onDragEnter}
        @dragover=${this._onDragOver}
        @dragleave=${this._onDragLeave}
        @drop=${this._onDrop}
      >
        ${hasImage
          ? html`
              <img
                src=${this._previewUrl}
                alt=${this.label || 'Reference'}
                style="width:100%;height:100%;object-fit:cover;border-radius:4px;"
              />
              <button
                type="button"
                class="cg-ref-remove"
                style="
                  position: absolute; top: 2px; right: 2px;
                  width: 18px; height: 18px; border-radius: 50%;
                  background: rgba(0,0,0,0.7); color: #fff;
                  border: none; font-size: 12px; line-height: 18px;
                  text-align: center; cursor: pointer; padding: 0;
                "
                @click=${this._removeImage}
              >&times;</button>
            `
          : html`
              <span style="font-size:20px;opacity:0.4;">+</span>
            `}
      </div>
      ${this.label
        ? html`<div style="font-size:9px;text-align:center;margin-top:2px;color:var(--text-dim,#888);">${this.label}</div>`
        : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cg-reference-upload': CgReferenceUpload;
  }
}
