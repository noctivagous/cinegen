import { savePreferences } from '@/services/preferences';

const SCALE_FACTORS = [1, 1.25, 1.5, 2];
const SCALE_LABELS = ['Small (1x)', 'Medium (1.25x)', 'Large (1.5x)', 'X-Large (2x)'];
const DEFAULT_LEVEL = 1; // Medium = 1.25x current

// All px values used in CSS — must match token names in CineGenBaseGUI-tokens.css
const TYPOGRAPHY_PX = [8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 24, 28, 40, 48];
const SPACING_PX = [2, 3, 4, 5, 6, 8, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80];
const RADIUS_PX = [2, 3, 4, 6];

export function applyMagnification(level: number): void {
  const factor = SCALE_FACTORS[level] ?? 1.25;
  const root = document.documentElement;

  // Store the factor for reference
  root.style.setProperty('--ui-scale', String(factor));

  // Override typography tokens (exact decimals, no rounding)
  TYPOGRAPHY_PX.forEach(px => {
    root.style.setProperty(`--text-${px}px`, `${px * factor}px`);
  });

  // Override spacing tokens (exact decimals)
  SPACING_PX.forEach(px => {
    root.style.setProperty(`--space-${px}px`, `${px * factor}px`);
  });

  // Override radius tokens — ROUND UP as requested
  RADIUS_PX.forEach(px => {
    root.style.setProperty(`--radius-${px}px`, `${Math.ceil(px * factor)}px`);
  });

  // Dispatch event for components that need to react
  window.dispatchEvent(new CustomEvent('uichange', { detail: { type: 'magnification', level } }));
}

export function setMagnification(level: number): void {
  applyMagnification(level);
  savePreferences({ uiMagnificationLevel: level });
}

export function getMagnificationLevel(): number {
  const scale = document.documentElement.style.getPropertyValue('--ui-scale');
  const factor = parseFloat(scale) || 1.25;
  return SCALE_FACTORS.indexOf(factor);
}

export function initMagnification(prefs: { uiMagnificationLevel?: number }): void {
  applyMagnification(prefs.uiMagnificationLevel ?? DEFAULT_LEVEL);
}

declare global {
  interface Window {
    CineGenMagnification: {
      applyMagnification: typeof applyMagnification;
      setMagnification: typeof setMagnification;
      getMagnificationLevel: typeof getMagnificationLevel;
      SCALE_LABELS: typeof SCALE_LABELS;
    };
  }
}

window.CineGenMagnification = { applyMagnification, setMagnification, getMagnificationLevel, SCALE_LABELS };
