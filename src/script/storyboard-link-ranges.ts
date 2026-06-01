import type { EditorView } from '@codemirror/view';
import { storyboardFrames } from '@/data/project-data';
import type { StoryboardFrame } from '@/storyboard/storyboard-types';

export type StoryboardLinkRange = {
  frameId: number;
  from: number;
  to: number;
};

/** Resolve a frame's script span — prefers stored range, falls back to scriptLink search. */
export function resolveFrameScriptRange(
  view: EditorView,
  frame: Pick<StoryboardFrame, 'id' | 'scriptLink' | 'scriptRange'>
): { from: number; to: number } | null {
  const docLen = view.state.doc.length;
  if (frame.scriptRange) {
    const start = Math.max(0, Math.min(frame.scriptRange.start, docLen));
    const end = Math.max(start, Math.min(frame.scriptRange.end, docLen));
    if (end > start) return { from: start, to: end };
  }
  const link = frame.scriptLink?.trim();
  if (!link) return null;
  const text = view.state.doc.toString();
  const idx = text.toLowerCase().indexOf(link.toLowerCase());
  if (idx === -1) return null;
  return { from: idx, to: idx + link.length };
}

/** Apply script link text + character range to a storyboard frame. */
export function applyScriptLinkRangeToFrame(
  frame: StoryboardFrame,
  text: string,
  from: number,
  to: number
): void {
  frame.scriptLink = text;
  frame.scriptRange = { start: from, end: to };
}

export function getStoryboardLinkRanges(view: EditorView): StoryboardLinkRange[] {
  const ranges: StoryboardLinkRange[] = [];
  const occupied: Array<{ from: number; to: number }> = [];

  for (const frame of storyboardFrames as StoryboardFrame[]) {
    const span = resolveFrameScriptRange(view, frame);
    if (!span) continue;
    const overlaps = occupied.some((r) => span.from < r.to && span.to > r.from);
    if (overlaps) continue;
    occupied.push(span);
    ranges.push({ frameId: frame.id, from: span.from, to: span.to });
  }

  return ranges.sort((a, b) => a.from - b.from || a.frameId - b.frameId);
}

export function blurStoryboardFrameThumbFocus(): void {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active.closest('.cm-storyboard-frame-box')) {
    active.blur();
  }
}
