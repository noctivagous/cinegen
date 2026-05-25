import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { CgLightElement } from '@/components/lit-base';
import {
  type HarmonyType,
  type HslColor,
  computeHarmony,
  hexToHsl,
  hslToHex,
  hslToRgb,
  rgbToHsl,
  isValidHex,
  tint,
  shade,
  tone,
  HARMONY_TYPE_LABELS,
} from '@/color/color-engine';

export interface ColorWheelChangeDetail {
  hex: string;
  hsl: HslColor;
}

export interface ColorWheelHarmonyDetail {
  type: HarmonyType;
  palette: string[];
}

export interface ColorWheelAddDetail {
  colors: string[];
}

const RING_THICKNESS = 28;
const INNER_PAD = 2;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

@customElement('cg-color-wheel')
export class CgColorWheel extends CgLightElement {
  @property({ type: String }) mode: 'picker' | 'harmony' = 'picker';
  @property({ type: Number }) hue = 200;
  @property({ type: Number }) saturation = 70;
  @property({ type: Number }) lightness = 55;
  @property({ type: String }) harmonyType: HarmonyType = 'complementary';
  @property({ type: Array }) palette: string[] = [];

  @state() private _harmonyColors: string[] = [];
  @state() private _manipulationResult: string[] | null = null;
  @state() private _hexInput = '';
  @state() private _selectedHarmonyIndices: Set<number> = new Set();
  @state() private _isDragging: 'ring' | 'square' | null = null;

  private _canvas: HTMLCanvasElement | null = null;
  private _wheelSize = 220;
  private _ringOuter = 0;
  private _ringInner = 0;
  private _squareSize = 0;

  connectedCallback(): void {
    super.connectedCallback();
    this._recalcHarmony();
  }

  updated(changed: Map<string, unknown>): void {
    if (changed.has('hue') || changed.has('saturation') || changed.has('lightness') || changed.has('harmonyType')) {
      this._recalcHarmony();
    }
    this._drawCanvas();
  }

  private _recalcHarmony(): void {
    const base = hslToHex({ h: this.hue, s: this.saturation, l: this.lightness });
    this._harmonyColors = computeHarmony(base, this.harmonyType);
    this._manipulationResult = null;
  }

  private _initCanvas(canvas: HTMLCanvasElement | null): void {
    if (!canvas) return;
    this._canvas = canvas;
    this._drawCanvas();
  }

  private _getCanvasSize(): number {
    const parent = this._canvas?.parentElement;
    if (parent) {
      const w = parent.clientWidth;
      return Math.min(w, 240);
    }
    return 220;
  }

  private _drawCanvas(): void {
    const canvas = this._canvas;
    if (!canvas) return;

    const size = this._getCanvasSize();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const outer = size / 2 - 2;
    const inner = outer - RING_THICKNESS;
    this._wheelSize = size;
    this._ringOuter = outer;
    this._ringInner = inner;

    this._squareSize = Math.sqrt(2) * inner * 0.85;

    const halfSquare = this._squareSize / 2;

    ctx.clearRect(0, 0, size, size);

    this._drawRing(ctx, cx, cy, outer, inner);

    if (this.mode === 'picker') {
      this._drawSquare(ctx, cx, cy, halfSquare, inner);
      this._drawCrosshair(ctx, cx, cy, halfSquare);
    }

    this._drawHarmonyIndicators(ctx, cx, cy, outer, inner);
    this._drawPuck(ctx, cx, cy, outer, inner);
  }

  private _drawRing(ctx: CanvasRenderingContext2D, cx: number, cy: number, outer: number, inner: number): void {
    const steps = 360;
    for (let i = 0; i < steps; i++) {
      const startAngle = (i / steps) * Math.PI * 2 - Math.PI / 2;
      const endAngle = ((i + 1) / steps) * Math.PI * 2 - Math.PI / 2;
      const hue = (i / steps) * 360;
      ctx.beginPath();
      ctx.arc(cx, cy, outer, startAngle, endAngle);
      ctx.arc(cx, cy, inner, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(cx, cy, outer, 0, Math.PI * 2);
    ctx.arc(cx, cy, inner, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  private _drawSquare(ctx: CanvasRenderingContext2D, cx: number, cy: number, half: number, inner: number): void {
    const size = half * 2;
    const imageData = ctx.createImageData(size, size);
    const h = this.hue;

    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const s = (px / size) * 100;
        const l = 100 - (py / size) * 100;
        const rgb = hslToRgb({ h, s, l });
        const idx = (py * size + px) * 4;
        imageData.data[idx] = rgb.r;
        imageData.data[idx + 1] = rgb.g;
        imageData.data[idx + 2] = rgb.b;
        imageData.data[idx + 3] = 255;
      }
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, inner - INNER_PAD, 0, Math.PI * 2);
    ctx.clip();

    ctx.putImageData(imageData, cx - half, cy - half);

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, inner - INNER_PAD);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.15)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, inner - INNER_PAD, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx, cy, inner - INNER_PAD, 0, Math.PI * 2);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  private _drawPuck(ctx: CanvasRenderingContext2D, cx: number, cy: number, outer: number, inner: number): void {
    const angle = ((this.hue - 90) / 360) * Math.PI * 2;
    const radius = (outer + inner) / 2;
    const px = cx + Math.cos(angle) * radius;
    const py = cy + Math.sin(angle) * radius;

    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private _drawCrosshair(ctx: CanvasRenderingContext2D, cx: number, cy: number, half: number): void {
    const sx = (this.saturation / 100) * this._squareSize;
    const sy = (1 - this.lightness / 100) * this._squareSize;
    const px = cx - half + sx;
    const py = cy - half + sy;

    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  private _drawHarmonyIndicators(ctx: CanvasRenderingContext2D, cx: number, cy: number, outer: number, inner: number): void {
    const baseHsl: HslColor = { h: this.hue, s: this.saturation, l: this.lightness };
    const base = hslToHex(baseHsl);
    const harmony = computeHarmony(base, this.harmonyType);
    const radius = (outer + inner) / 2;

    const hueValues: number[] = [];
    for (const c of harmony) {
      const hsl = hexToHsl(c);
      if (hsl) hueValues.push(hsl.h);
    }

    if (hueValues.length > 1) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      for (const h of hueValues) {
        const angle = ((h - 90) / 360) * Math.PI * 2;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
      }
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.setLineDash([]);
      for (let i = 0; i < hueValues.length; i++) {
        for (let j = i + 1; j < hueValues.length; j++) {
          const a1 = ((hueValues[i] - 90) / 360) * Math.PI * 2;
          const a2 = ((hueValues[j] - 90) / 360) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(cx, cy, radius, Math.min(a1, a2), Math.max(a1, a2));
          ctx.strokeStyle = 'rgba(255,255,255,0.25)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    for (const h of hueValues) {
      const angle = ((h - 90) / 360) * Math.PI * 2;
      const px = cx + Math.cos(angle) * radius;
      const py = cy + Math.sin(angle) * radius;
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
  }

  private _getEventHSL(e: MouseEvent | Touch): { h: number; s: number; l: number } | null {
    const canvas = this._canvas;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const size = this._wheelSize;
    const cx = size / 2;
    const cy = size / 2;

    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < this._ringInner - INNER_PAD && this.mode === 'picker') {
      const squareStart = this._ringInner - INNER_PAD;
      const half = this._squareSize / 2;
      const sx = x - cx + half;
      const sy = y - cy + half;
      if (sx >= 0 && sx <= this._squareSize && sy >= 0 && sy <= this._squareSize) {
        const s = (sx / this._squareSize) * 100;
        const l = 100 - (sy / this._squareSize) * 100;
        return { h: this.hue, s: clamp(s, 0, 100), l: clamp(l, 0, 100) };
      }
      return null;
    }

    if (dist >= this._ringInner && dist <= this._ringOuter) {
      const angle = Math.atan2(dy, dx);
      let degrees = ((angle + Math.PI / 2) / (Math.PI * 2)) * 360;
      degrees = ((degrees % 360) + 360) % 360;
      return { h: Math.round(degrees), s: this.saturation, l: this.lightness };
    }

    return null;
  }

  private _onPointerDown(e: PointerEvent): void {
    if (!this._canvas) return;
    this._canvas.setPointerCapture(e.pointerId);

    const hsl = this._getEventHSL(e);
    if (!hsl) return;

    const canvas = this._canvas;
    const rect = canvas.getBoundingClientRect();
    const dist = Math.sqrt(Math.pow(e.clientX - rect.left - this._wheelSize / 2, 2) + Math.pow(e.clientY - rect.top - this._wheelSize / 2, 2));

    if (dist < this._ringInner - INNER_PAD && this.mode === 'picker') {
      this._isDragging = 'square';
    } else {
      this._isDragging = 'ring';
    }

    this._applyHSL(hsl);
  }

  private _onPointerMove(e: PointerEvent): void {
    if (!this._isDragging) return;
    const hsl = this._getEventHSL(e);
    if (hsl) this._applyHSL(hsl);
  }

  private _onPointerUp(): void {
    this._isDragging = null;
  }

  private _applyHSL(hsl: { h: number; s: number; l: number }): void {
    this.hue = Math.round(hsl.h);
    this.saturation = Math.round(hsl.s);
    this.lightness = Math.round(hsl.l);
    const hex = hslToHex({ h: this.hue, s: this.saturation, l: this.lightness });
    this._recalcHarmony();
    this.dispatchEvent(new CustomEvent<ColorWheelChangeDetail>('cg-color-pick', {
      bubbles: true,
      detail: { hex, hsl: { h: this.hue, s: this.saturation, l: this.lightness } },
    }));
  }

  private _onHarmonyTypeChange(type: HarmonyType): void {
    this.harmonyType = type;
    const base = hslToHex({ h: this.hue, s: this.saturation, l: this.lightness });
    const palette = computeHarmony(base, type);
    this.dispatchEvent(new CustomEvent<ColorWheelHarmonyDetail>('cg-harmony-change', {
      bubbles: true,
      detail: { type, palette },
    }));
  }

  private _onHexInput(): void {
    if (isValidHex(this._hexInput)) {
      const hsl = hexToHsl(this._hexInput);
      if (hsl) {
        this.hue = Math.round(hsl.h);
        this.saturation = Math.round(hsl.s);
        this.lightness = Math.round(hsl.l);
        this._recalcHarmony();
      }
    }
  }

  private _applyTint(): void {
    const base = hslToHex({ h: this.hue, s: this.saturation, l: this.lightness });
    this._manipulationResult = [tint(base, 0.3), tint(base, 0.5), tint(base, 0.7)];
  }

  private _applyShade(): void {
    const base = hslToHex({ h: this.hue, s: this.saturation, l: this.lightness });
    this._manipulationResult = [shade(base, 0.3), shade(base, 0.5), shade(base, 0.7)];
  }

  private _applyTone(): void {
    const base = hslToHex({ h: this.hue, s: this.saturation, l: this.lightness });
    this._manipulationResult = [tone(base, 0.3), tone(base, 0.5), tone(base, 0.7)];
  }

  private _addToPalette(colors: string[]): void {
    this.dispatchEvent(new CustomEvent<ColorWheelAddDetail>('cg-palette-add', {
      bubbles: true,
      detail: { colors },
    }));
  }

  private _toggleHarmonyIndex(idx: number): void {
    const next = new Set(this._selectedHarmonyIndices);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    this._selectedHarmonyIndices = next;
  }

  private _addSelectedHarmony(): void {
    const selected = [...this._selectedHarmonyIndices].map((i) => this._harmonyColors[i]);
    if (selected.length) this._addToPalette(selected);
  }

  get currentHex(): string {
    return hslToHex({ h: this.hue, s: this.saturation, l: this.lightness });
  }

  render() {
    const currentHex = this.currentHex;
    const harmonyTypes: HarmonyType[] = [
      'complementary', 'split-complement', 'triad', 'analogous',
      'mutual-complement', 'near-complement', 'double-complement',
    ];

    return html`
      <div class="cg-color-wheel" style="display:flex;flex-direction:column;gap:8px;font-size:13px;color:#ccc;">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <div class="cg-color-wheel__wheel-wrap" style="position:relative;flex-shrink:0;">
            <canvas
              class="cg-color-wheel__canvas"
              style="display:block;cursor:crosshair;border-radius:50%;width:220px;height:220px;"
              @pointerdown=${this._onPointerDown}
              @pointermove=${this._onPointerMove}
              @pointerup=${this._onPointerUp}
              @pointercancel=${this._onPointerUp}
              ${(el: any) => this._initCanvas(el)}
            ></canvas>
          </div>

          <div class="cg-color-wheel__controls" style="display:flex;flex-direction:column;gap:6px;min-width:140px;flex:1;">
            <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;">
              <span style="display:inline-block;width:32px;height:32px;border-radius:4px;background:${currentHex};border:1px solid #555;flex-shrink:0;"></span>
              <div style="display:flex;gap:4px;align-items:center;">
                <input type="color" .value=${currentHex} style="width:28px;height:28px;padding:1px;border:1px solid #555;border-radius:3px;background:none;cursor:pointer;"
                  @input=${(e: any) => {
                    this._hexInput = e.target.value;
                    this._onHexInput();
                  }}
                />
                <input type="text" class="cg-field" style="width:80px;font-size:12px;font-family:monospace;"
                  .value=${currentHex.toUpperCase()}
                  @input=${(e: any) => { this._hexInput = e.target.value; }}
                  @change=${() => this._onHexInput()}
                  placeholder="#FF00FF"
                />
              </div>
              <button class="toolbar-btn btn-ai" style="font-size:11px;padding:4px 8px;" @click=${() => this._addToPalette([currentHex])}>
                <i class="fa-solid fa-plus"></i> Add
              </button>
            </div>

            ${this.mode === 'harmony' ? html`
              <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:2px;">
                <button class="cg-color-wheel__action-btn toolbar-btn" style="font-size:11px;padding:3px 8px;color:#4c6;" @click=${() => this._addToPalette(this._harmonyColors)}>
                  <i class="fa-solid fa-layer-group"></i> Add All
                </button>
                <button class="cg-color-wheel__action-btn toolbar-btn" style="font-size:11px;padding:3px 8px;color:#6cf;" @click=${this._addSelectedHarmony}
                  ?disabled=${this._selectedHarmonyIndices.size === 0}>
                  <i class="fa-solid fa-check"></i> Add Selected
                </button>
              </div>
            ` : ''}
          </div>
        </div>

        <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;">
          ${harmonyTypes.map((t) => html`
            <button type="button" class="toolbar-btn ${this.harmonyType === t ? 'btn-ai' : ''}"
              style="font-size:10px;padding:2px 8px;"
              @click=${() => this._onHarmonyTypeChange(t)}>
              ${HARMONY_TYPE_LABELS[t]}
            </button>
          `)}
        </div>

        <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;margin-top:2px;">
          <button type="button" class="toolbar-btn" style="font-size:10px;padding:2px 8px;" @click=${this._applyTint} title="Mix with white → lighter, pastel">
            <i class="fa-solid fa-sun"></i> Tint
          </button>
          <button type="button" class="toolbar-btn" style="font-size:10px;padding:2px 8px;" @click=${this._applyShade} title="Mix with black → darker, deeper">
            <i class="fa-solid fa-moon"></i> Shade
          </button>
          <button type="button" class="toolbar-btn" style="font-size:10px;padding:2px 8px;" @click=${this._applyTone} title="Mix with gray → muted, desaturated">
            <i class="fa-solid fa-droplet"></i> Tone
          </button>
        </div>

        ${this._manipulationResult ? html`
          <div style="display:flex;gap:4px;flex-wrap:wrap;padding:4px 0;">
            ${this._manipulationResult.map((c) => html`
              <span style="display:inline-flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;"
                @click=${() => this._addToPalette([c])}>
                <span style="display:block;width:24px;height:24px;border-radius:4px;background:${c};border:1px solid #444;"></span>
                <span style="font-size:9px;font-family:monospace;color:#888;">${c.toUpperCase()}</span>
              </span>
            `)}
          </div>
        ` : ''}

        <div style="display:flex;gap:4px;flex-wrap:wrap;padding:4px 0;">
          ${this._harmonyColors.map((c, i) => html`
            <span style="display:inline-flex;flex-direction:column;align-items:center;gap:2px;padding:2px;border:1px solid ${this._selectedHarmonyIndices.has(i) ? '#6cf' : 'transparent'};border-radius:4px;cursor:pointer;"
              @click=${() => this._toggleHarmonyIndex(i)}
              @dblclick=${() => this._addToPalette([c])}>
              <span style="display:block;width:24px;height:24px;border-radius:4px;background:${c};border:1px solid #444;"></span>
              <span style="font-size:9px;font-family:monospace;color:#888;">${c.toUpperCase()}</span>
            </span>
          `)}
        </div>
      </div>
    `;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
