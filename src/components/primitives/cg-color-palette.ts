import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import {
  type HarmonyType,
  computeHarmony,
  hexToHsl,
  hslToHex,
  isValidHex,
  tint,
  shade,
  tone,
  HARMONY_TYPE_LABELS,
} from '@/color/color-engine';

export interface ColorPaletteChangeDetail {
  palette: string[];
}

export interface ColorPaletteSelectDetail {
  hex: string;
}

@customElement('cg-color-palette')
export class CgColorPalette extends CgLightElement {
  @property({ type: Array }) palette: string[] = [];
  @property({ type: Boolean }) readonly = false;
  @property({ type: Number }) maxColors = 20;
  @property({ type: Boolean }) showHarmony = true;
  @property({ type: String }) shownIn: 'wizard' | 'panel' | 'full' = 'wizard';

  @state() private _selectedIndex = -1;
  @state() private _hexInput = '';
  @state() private _showWheel = false;
  @state() private _activeHarmony: HarmonyType = 'complementary';
  @state() private _harmonyPreview: string[] = [];
  @state() private _manipulationPreview: string[] = [];

  private _dispatchChange(): void {
    this.dispatchEvent(new CustomEvent<ColorPaletteChangeDetail>('cg-palette-change', {
      bubbles: true,
      detail: { palette: [...this.palette] },
    }));
  }

  private _addColor(hex: string): void {
    if (!isValidHex(hex)) return;
    if (this.palette.length >= this.maxColors) return;
    if (this.palette.includes(hex.toLowerCase())) return;
    this.palette = [...this.palette, hex.toLowerCase()];
    this._dispatchChange();
  }

  private _removeColor(index: number): void {
    if (this.readonly) return;
    this.palette = this.palette.filter((_, i) => i !== index);
    if (this._selectedIndex >= index) this._selectedIndex = Math.max(-1, this._selectedIndex - 1);
    this._dispatchChange();
  }

  private _selectColor(index: number): void {
    this._selectedIndex = this._selectedIndex === index ? -1 : index;
    if (this._selectedIndex >= 0) {
      const hex = this.palette[this._selectedIndex];
      this._harmonyPreview = computeHarmony(hex, this._activeHarmony);
      this._manipulationPreview = [];
    }
  }

  private _onHarmonySelect(type: HarmonyType): void {
    this._activeHarmony = type;
    if (this._selectedIndex >= 0) {
      const hex = this.palette[this._selectedIndex];
      this._harmonyPreview = computeHarmony(hex, type);
    }
  }

  private _addHarmonyColor(hex: string): void {
    this._addColor(hex);
  }

  private _addAllHarmony(): void {
    for (const c of this._harmonyPreview) {
      this._addColor(c);
    }
  }

  private _applyManipulation(type: 'tint' | 'shade' | 'tone'): void {
    if (this._selectedIndex < 0) return;
    const hex = this.palette[this._selectedIndex];
    const fn = type === 'tint' ? tint : type === 'shade' ? shade : tone;
    this._manipulationPreview = [fn(hex, 0.2), fn(hex, 0.35), fn(hex, 0.5), fn(hex, 0.7)];
  }

  private _onHexAdd(): void {
    if (isValidHex(this._hexInput)) {
      this._addColor(this._hexInput);
      this._hexInput = '';
    }
  }

  private _onNativePickerInput(e: Event): void {
    const val = (e.target as HTMLInputElement).value;
    this._addColor(val);
  }

  private _copyToClipboard(hex: string): void {
    navigator.clipboard?.writeText(hex.toUpperCase());
  }

  get _swatchSize(): string {
    return this.shownIn === 'full' ? '32px' : this.shownIn === 'panel' ? '26px' : '22px';
  }

  render() {
    const swatchSize = this._swatchSize;

    return html`
      <div class="cg-color-palette" style="font-size:13px;color:#ccc;">
        ${!this.readonly ? html`
          <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px;flex-wrap:wrap;">
            <input type="color" style="width:30px;height:28px;padding:1px;border:1px solid #555;border-radius:3px;background:none;cursor:pointer;"
              @input=${this._onNativePickerInput}
            />
            <input type="text" class="cg-field" style="width:100px;font-size:12px;font-family:monospace;"
              .value=${this._hexInput}
              @input=${(e: any) => { this._hexInput = e.target.value; }}
              @keydown=${(e: any) => { if (e.key === 'Enter') this._onHexAdd(); }}
              placeholder="#FF00FF"
            />
            <button class="toolbar-btn" style="font-size:11px;padding:3px 8px;" @click=${this._onHexAdd}
              ?disabled=${!isValidHex(this._hexInput)}>
              <i class="fa-solid fa-plus"></i> Add
            </button>
            <button class="toolbar-btn" style="font-size:11px;padding:3px 8px;"
              @click=${() => { this._showWheel = !this._showWheel; }}>
              <i class="fa-solid fa-palette"></i> Wheel
            </button>
            <span style="font-size:10px;color:#666;">${this.palette.length}/${this.maxColors}</span>
          </div>

          ${this._showWheel ? html`
            <cg-color-wheel
              style="display:block;margin-bottom:8px;padding:8px;background:#1a1a1a;border-radius:6px;border:1px solid #333;"
              @cg-palette-add=${(e: any) => {
                for (const c of e.detail.colors) this._addColor(c);
                this.requestUpdate();
              }}
            ></cg-color-wheel>
          ` : ''}
        ` : ''}

        ${this.palette.length === 0 ? html`
          <p style="font-size:12px;color:#666;text-align:center;padding:8px 0;">No colors in palette</p>
        ` : html`
          <div style="display:flex;flex-wrap:wrap;gap:4px;">
            ${this.palette.map((c, i) => html`
              <div style="display:flex;flex-direction:column;align-items:center;gap:2px;position:relative;cursor:pointer;"
                @click=${() => this._selectColor(i)}
                @dblclick=${() => this._copyToClipboard(c)}>
                <span style="display:block;width:${swatchSize};height:${swatchSize};border-radius:4px;background:${c};
                  border:2px solid ${this._selectedIndex === i ? '#fff' : 'transparent'};
                  box-shadow:${this._selectedIndex === i ? '0 0 4px rgba(255,255,255,0.3)' : 'none'};"
                  title="${c.toUpperCase()} (double-click to copy)">
                </span>
                <span style="font-size:9px;font-family:monospace;color:#888;line-height:1;">${c.toUpperCase()}</span>
                ${!this.readonly && this._selectedIndex === i ? html`
                  <button type="button" class="cg-color-palette__remove"
                    style="position:absolute;top:-4px;right:-4px;width:16px;height:16px;border-radius:50%;background:#c33;border:none;color:#fff;font-size:10px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;"
                    @click=${(e: any) => { e.stopPropagation(); this._removeColor(i); }}
                    title="Remove ${c.toUpperCase()}">×</button>
                ` : ''}
              </div>
            `)}
          </div>
        `}

        ${this._selectedIndex >= 0 && !this.readonly ? html`
          <div style="margin-top:8px;padding-top:8px;border-top:1px solid #333;">
            <div style="display:flex;gap:4px;align-items:center;margin-bottom:6px;">
              <span style="font-size:11px;color:#aaa;">Selected: <strong style="font-family:monospace;">${this.palette[this._selectedIndex].toUpperCase()}</strong></span>
              <button class="toolbar-btn" style="font-size:10px;padding:2px 6px;" @click=${() => this._applyManipulation('tint')} title="Mix with white">Tint</button>
              <button class="toolbar-btn" style="font-size:10px;padding:2px 6px;" @click=${() => this._applyManipulation('shade')} title="Mix with black">Shade</button>
              <button class="toolbar-btn" style="font-size:10px;padding:2px 6px;" @click=${() => this._applyManipulation('tone')} title="Mix with gray">Tone</button>
            </div>

            ${this._manipulationPreview.length > 0 ? html`
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">
                ${this._manipulationPreview.map((c) => html`
                  <span style="display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;"
                    @click=${() => { this._addColor(c); this.requestUpdate(); }}>
                    <span style="display:block;width:20px;height:20px;border-radius:3px;background:${c};border:1px solid #444;"></span>
                    <span style="font-size:8px;font-family:monospace;color:#666;">${c.toUpperCase()}</span>
                  </span>
                `)}
              </div>
            ` : ''}

            ${this.showHarmony ? html`
              <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px;">
                ${(['complementary','split-complement','triad','analogous'] as HarmonyType[]).map((t) => html`
                  <button class="toolbar-btn ${this._activeHarmony === t ? 'btn-ai' : ''}"
                    style="font-size:10px;padding:2px 6px;"
                    @click=${() => this._onHarmonySelect(t)}>${HARMONY_TYPE_LABELS[t]}</button>
                `)}
              </div>
              ${this._harmonyPreview.length > 0 ? html`
                <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px;">
                  ${this._harmonyPreview.map((c) => html`
                    <span style="display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;"
                      @click=${() => { this._addHarmonyColor(c); this.requestUpdate(); }}
                      title="Click to add">
                      <span style="display:block;width:20px;height:20px;border-radius:3px;background:${c};border:1px solid #444;"></span>
                      <span style="font-size:8px;font-family:monospace;color:#666;">${c.toUpperCase()}</span>
                    </span>
                  `)}
                </div>
                <button class="toolbar-btn" style="font-size:10px;padding:2px 8px;" @click=${() => { this._addAllHarmony(); this.requestUpdate(); }}>
                  <i class="fa-solid fa-layer-group"></i> Add All Harmony
                </button>
              ` : ''}
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }
}
