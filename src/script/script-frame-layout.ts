import type { EditorView } from '@codemirror/view';
import { getActiveProjectSettings } from '@/data/project-data';

/** Fixed width for every storyboard frame thumbnail in the script (height from project aspect). */
export const FRAME_WIDTH_EM = 11;

/** Bottom margin on floated frame wraps (matches CSS). */
export const FRAME_FLOAT_MARGIN_EM = 0.65;

function aspectWidthOverHeight(ratio: string): number {
  const parts = String(ratio || '16:9')
    .split(':')
    .map((p) => parseFloat(p.trim()));
  if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) return parts[0] / parts[1];
  return 16 / 9;
}

export function scriptEditorEmPx(view: EditorView): number {
  const fontSize = parseFloat(getComputedStyle(view.contentDOM).fontSize);
  return Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 16;
}

export function getStoryboardFrameBoxSizePx(view: EditorView): { width: number; height: number } {
  const em = scriptEditorEmPx(view);
  const width = Math.round(em * FRAME_WIDTH_EM);
  const aspect = aspectWidthOverHeight(getActiveProjectSettings().aspectRatio);
  const height = Math.max(24, Math.round(width / aspect));
  return { width, height };
}

/** One floated frame block: thumbnail height + wrap margin. */
export function getStoryboardFrameFloatBlockHeightPx(view: EditorView): number {
  const { height } = getStoryboardFrameBoxSizePx(view);
  return height + Math.round(scriptEditorEmPx(view) * FRAME_FLOAT_MARGIN_EM);
}
