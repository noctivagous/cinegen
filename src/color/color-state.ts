import { isValidHex, paletteToString, stringToPalette } from '@/color/color-engine';

type PaletteSubscriber = (palette: string[]) => void;

interface ColorStateSnapshot {
  palette: string[];
  recentColors: string[];
}

let _palette: string[] = [];
let _recentColors: string[] = [];
let _subscriberId = 0;
const _subscribers = new Map<number, PaletteSubscriber>();

function _notify(): void {
  for (const cb of _subscribers.values()) {
    try { cb([..._palette]); } catch { /* subscriber error */ }
  }
}

export const colorState = {
  setPalette(palette: string[]): void {
    _palette = palette.filter(isValidHex);
    _notify();
  },

  addColor(hex: string): void {
    const c = hex.toLowerCase();
    if (!isValidHex(c)) return;
    if (_palette.includes(c)) return;
    _palette = [..._palette, c];
    _recentColors = [c, ..._recentColors.filter((x) => x !== c)].slice(0, 20);
    _notify();
  },

  removeColor(hex: string): void {
    const c = hex.toLowerCase();
    _palette = _palette.filter((x) => x !== c);
    _notify();
  },

  clear(): void {
    _palette = [];
    _notify();
  },

  getPalette(): string[] {
    return [..._palette];
  },

  getRecentColors(): string[] {
    return [..._recentColors];
  },

  setRecentColors(colors: string[]): void {
    _recentColors = colors.filter(isValidHex).slice(0, 20);
  },

  subscribe(cb: PaletteSubscriber): () => void {
    const id = ++_subscriberId;
    _subscribers.set(id, cb);
    return () => { _subscribers.delete(id); };
  },

  snapshot(): ColorStateSnapshot {
    return { palette: [..._palette], recentColors: [..._recentColors] };
  },

  restore(snap: ColorStateSnapshot): void {
    _palette = snap.palette.filter(isValidHex);
    _recentColors = snap.recentColors.filter(isValidHex).slice(0, 20);
    _notify();
  },

  /** Serialise palette to comma-separated string for ProductionContext styleGuide. */
  toStyleGuideString(): string {
    return paletteToString(_palette);
  },

  /** Load palette from ProductionContext styleGuide string. */
  fromStyleGuideString(s: string): void {
    _palette = stringToPalette(s);
    _notify();
  },
};
