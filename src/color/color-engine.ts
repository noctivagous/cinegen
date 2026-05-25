export type HarmonyType =
  | 'complementary'
  | 'split-complement'
  | 'triad'
  | 'analogous'
  | 'mutual-complement'
  | 'near-complement'
  | 'double-complement';

export type PaletteManipulation = 'tint' | 'shade' | 'tone';

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface HslColor {
  h: number;
  s: number;
  l: number;
}

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(value * f) / f;
}

export function isValidHex(s: string): s is `#${string}` {
  return HEX_PATTERN.test(s);
}

export function hexToRgb(hex: string): RgbColor | null {
  if (!isValidHex(hex)) return null;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

export function rgbToHex(rgb: RgbColor): string {
  const r = clamp(Math.round(rgb.r), 0, 255).toString(16).padStart(2, '0');
  const g = clamp(Math.round(rgb.g), 0, 255).toString(16).padStart(2, '0');
  const b = clamp(Math.round(rgb.b), 0, 255).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

export function rgbToHsl(rgb: RgbColor): HslColor {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return {
    h: Math.round(clamp(h, 0, 360)),
    s: Math.round(clamp(s * 100, 0, 100)),
    l: Math.round(clamp(l * 100, 0, 100)),
  };
}

export function hslToRgb(hsl: HslColor): RgbColor {
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;
  if (s === 0) {
    const v = Math.round(clamp(l * 255, 0, 255));
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(clamp(hue2rgb(p, q, h + 1 / 3) * 255, 0, 255)),
    g: Math.round(clamp(hue2rgb(p, q, h) * 255, 0, 255)),
    b: Math.round(clamp(hue2rgb(p, q, h - 1 / 3) * 255, 0, 255)),
  };
}

export function hexToHsl(hex: string): HslColor | null {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHsl(rgb) : null;
}

export function hslToHex(hsl: HslColor): string {
  return rgbToHex(hslToRgb(hsl));
}

export function hexToDisplayString(hex: string): string {
  if (!isValidHex(hex)) return hex;
  return hex.toUpperCase();
}

function hueShift(hue: number, shift: number): number {
  return ((hue + shift) % 360 + 360) % 360;
}

function hexFromHsl(h: number, s: number, l: number): string {
  return hslToHex({ h: Math.round(h), s: Math.round(s), l: Math.round(l) });
}

function hexFromHue(hue: number, s = 70, l = 55): string {
  return hexFromHsl(hue, s, l);
}

function hexForHarmony(baseHsl: HslColor, hue: number): string {
  return hexFromHsl(hue, baseHsl.s, baseHsl.l);
}

export function complementary(base: string): string[] {
  const hsl = hexToHsl(base);
  if (!hsl) return [base];
  return [base, hexForHarmony(hsl, hueShift(hsl.h, 180))];
}

export function splitComplements(base: string): string[] {
  const hsl = hexToHsl(base);
  if (!hsl) return [base];
  return [
    base,
    hexForHarmony(hsl, hueShift(hsl.h, 150)),
    hexForHarmony(hsl, hueShift(hsl.h, 210)),
  ];
}

export function triad(base: string): string[] {
  const hsl = hexToHsl(base);
  if (!hsl) return [base];
  return [
    base,
    hexForHarmony(hsl, hueShift(hsl.h, 120)),
    hexForHarmony(hsl, hueShift(hsl.h, 240)),
  ];
}

export function analogous(base: string, count = 5, step = 30): string[] {
  const hsl = hexToHsl(base);
  if (!hsl) return [base];
  const half = Math.floor(count / 2);
  const result: string[] = [];
  for (let i = -half; i <= half; i++) {
    result.push(hexForHarmony(hsl, hueShift(hsl.h, i * step)));
  }
  return result;
}

export function mutualComplement(base: string, offset = 15): string[] {
  const hsl = hexToHsl(base);
  if (!hsl) return [base];
  const comp = hueShift(hsl.h, 180);
  return [
    base,
    hexForHarmony(hsl, hueShift(hsl.h, offset)),
    hexForHarmony(hsl, comp),
    hexForHarmony(hsl, hueShift(comp, -offset)),
    hexForHarmony(hsl, hueShift(comp, offset)),
  ];
}

export function nearComplement(base: string, offset = 15): string[] {
  const hsl = hexToHsl(base);
  if (!hsl) return [base];
  const near = hueShift(hsl.h, 180);
  return [
    base,
    hexForHarmony(hsl, hueShift(near, -offset)),
    hexForHarmony(hsl, hueShift(near, offset)),
  ];
}

export function doubleComplements(base1: string, base2?: string): string[] {
  if (base2) {
    const h1 = hexToHsl(base1);
    const h2 = hexToHsl(base2);
    if (!h1 || !h2) return [base1, base2];
    return [
      base1,
      hexForHarmony(h1, hueShift(h1.h, 180)),
      base2,
      hexForHarmony(h2, hueShift(h2.h, 180)),
    ];
  }
  const hsl = hexToHsl(base1);
  if (!hsl) return [base1];
  return [
    base1,
    hexForHarmony(hsl, hueShift(hsl.h, 180)),
    hexForHarmony(hsl, hueShift(hsl.h, 60)),
    hexForHarmony(hsl, hueShift(hsl.h, 240)),
  ];
}

export function computeHarmony(base: string, type: HarmonyType): string[] {
  switch (type) {
    case 'complementary':
      return complementary(base);
    case 'split-complement':
      return splitComplements(base);
    case 'triad':
      return triad(base);
    case 'analogous':
      return analogous(base);
    case 'mutual-complement':
      return mutualComplement(base);
    case 'near-complement':
      return nearComplement(base);
    case 'double-complement':
      return doubleComplements(base);
  }
}

export function tint(color: string, factor: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  const f = clamp(factor, 0, 1);
  return rgbToHex({
    r: rgb.r + (255 - rgb.r) * f,
    g: rgb.g + (255 - rgb.g) * f,
    b: rgb.b + (255 - rgb.b) * f,
  });
}

export function shade(color: string, factor: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  const f = clamp(factor, 0, 1);
  return rgbToHex({
    r: rgb.r * (1 - f),
    g: rgb.g * (1 - f),
    b: rgb.b * (1 - f),
  });
}

export function tone(color: string, factor: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  const f = clamp(factor, 0, 1);
  const gray = 128;
  return rgbToHex({
    r: rgb.r + (gray - rgb.r) * f,
    g: rgb.g + (gray - rgb.g) * f,
    b: rgb.b + (gray - rgb.b) * f,
  });
}

export function manipulatePalette(palette: string[], type: PaletteManipulation, factor: number): string[] {
  const fn = type === 'tint' ? tint : type === 'shade' ? shade : tone;
  return palette.map((c) => fn(c, factor));
}

export function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const a = [r, g, b].map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = luminance(hex1);
  const l2 = luminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function paletteToString(palette: string[]): string {
  return palette.join(', ');
}

export function stringToPalette(s: string): string[] {
  return s
    .split(',')
    .map((c) => c.trim())
    .filter(isValidHex);
}

export const HARMONY_TYPE_LABELS: Record<HarmonyType, string> = {
  complementary: 'Complementary',
  'split-complement': 'Split Complement',
  triad: 'Triad',
  analogous: 'Analogous',
  'mutual-complement': 'Mutual Complement',
  'near-complement': 'Near Complement',
  'double-complement': 'Double Complement',
};

export const MANIPULATION_LABELS: Record<PaletteManipulation, string> = {
  tint: 'Tint',
  shade: 'Shade',
  tone: 'Tone',
};
