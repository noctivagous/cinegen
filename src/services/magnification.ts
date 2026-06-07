import { savePreferences } from '@/services/preferences';

const SCALE_FACTORS = [1, 1.25, 1.5, 2];
const SCALE_LABELS = ['Small (1x)', 'Medium (1.25x)', 'Large (1.5x)', 'X-Large (2x)'];
const DEFAULT_LEVEL = 1; // Medium = 1.25× current

export function applyMagnification(level: number): void {
  const factor = SCALE_FACTORS[level] ?? 1.25;
  const root = document.documentElement;

  // Core scale factor — all calc(Npx * var(--ui-scale)) tokens pick this up
  root.style.setProperty('--ui-scale', String(factor));

  // Keep --status-bar-scale in sync so the status bar scales with the UI
  root.style.setProperty('--status-bar-scale', String(factor));

  // Radius tokens must round UP (CSS calc can't do ceil)
  [2, 3, 4, 6].forEach(px => {
    root.style.setProperty(`--radius-${px}px`, `${Math.ceil(px * factor)}px`);
  });

  window.dispatchEvent(new CustomEvent('uichange', { detail: { type: 'magnification', level } }));
}

export function setMagnification(level: number): void {
  applyMagnification(level);
  savePreferences({ uiMagnificationLevel: level });
}

export function getMagnificationLevel(): number {
  const raw = document.documentElement.style.getPropertyValue('--ui-scale');
  const factor = parseFloat(raw) || 1.25;
  const idx = SCALE_FACTORS.indexOf(factor);
  return idx === -1 ? DEFAULT_LEVEL : idx;
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

window.CineGenMagnification = {
  applyMagnification,
  setMagnification,
  getMagnificationLevel,
  SCALE_LABELS,
};
