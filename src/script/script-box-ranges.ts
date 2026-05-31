import type { EditorView } from '@codemirror/view';
import { classifyFountainLine } from '@/script/fountain-bundle';
import { currentSceneData, storyboardFrames } from '@/data/project-data';
import {
  getFramesForShot,
  getShotsForScene,
  sceneNumberFromSceneId,
} from '@/workspace/shot-frame-bridge';
import type { SceneShot } from '@/workspace/scene-types';
import type { StoryboardFrame } from '@/storyboard/storyboard-types';

export type ScriptBoxKind = 'scene' | 'shot' | 'frame';

export type ScriptBoxRange = {
  kind: ScriptBoxKind;
  from: number;
  to: number;
  sceneId: string;
  sceneNumber: number;
  shotId?: number;
  frameId?: number;
  label: string;
  /** Linked storyboard frames for shot labels. */
  frameCount?: number;
  /** Frame box has no generated image yet. */
  isEmpty?: boolean;
};

function findAnchorPos(doc: string, anchor: string): number {
  const needle = anchor.trim().toLowerCase();
  if (!needle) return -1;
  return doc.toLowerCase().indexOf(needle);
}

function snapToLineBoundary(view: EditorView, pos: number, edge: 'start' | 'end'): number {
  const doc = view.state.doc;
  const clamped = Math.max(0, Math.min(pos, doc.length));
  try {
    const line = doc.lineAt(clamped);
    return edge === 'start' ? line.from : line.to;
  } catch {
    return clamped;
  }
}

/** Scene spans: from each scene heading through the character before the next heading. */
export function computeSceneRanges(view: EditorView): ScriptBoxRange[] {
  const doc = view.state.doc;
  const ranges: ScriptBoxRange[] = [];
  let sceneCounter = 0;

  for (let lineNo = 1; lineNo <= doc.lines; lineNo++) {
    const line = doc.line(lineNo);
    const trimmed = line.text.trim();
    if (classifyFountainLine(trimmed) !== 'scene' || !trimmed) continue;

    sceneCounter++;
    const sceneId = `scene${String(sceneCounter).padStart(2, '0')}`;
    let endLine = doc.lines;
    for (let next = lineNo + 1; next <= doc.lines; next++) {
      const nextTrimmed = doc.line(next).text.trim();
      if (classifyFountainLine(nextTrimmed) === 'scene' && nextTrimmed) {
        endLine = next - 1;
        break;
      }
    }

    const endPos = endLine >= lineNo ? doc.line(endLine).to : line.to;
    ranges.push({
      kind: 'scene',
      from: line.from,
      to: endPos,
      sceneId,
      sceneNumber: sceneCounter,
      label: `Scene ${sceneCounter}`,
    });
  }

  return ranges;
}

function shotAnchorPos(doc: string, shot: SceneShot, sceneId: string): number {
  if (shot.scriptRange && shot.scriptRange.start >= 0) return shot.scriptRange.start;
  const link = shot.scriptLink || getFramesForShot(sceneId, shot.id)[0]?.scriptLink;
  if (link) {
    const idx = findAnchorPos(doc, link);
    if (idx >= 0) return idx;
  }
  return -1;
}

function frameAnchorPos(doc: string, frame: StoryboardFrame): number {
  const link = frame.scriptLink?.trim();
  if (!link) return -1;
  return findAnchorPos(doc, link);
}

function isEmptyFrame(frame: StoryboardFrame): boolean {
  if (frame.imageUrl) return false;
  const status = String(frame.generatingStatus || '').toLowerCase();
  return status !== 'generating' && status !== 'pending';
}

function makeFrameRange(
  view: EditorView,
  frame: StoryboardFrame,
  scene: ScriptBoxRange,
  shot: SceneShot,
  sceneNum: number,
  from: number,
  to: number
): ScriptBoxRange {
  return {
    kind: 'frame',
    from: snapToLineBoundary(view, from, 'start'),
    to: snapToLineBoundary(view, Math.max(from, to), 'end'),
    sceneId: scene.sceneId,
    sceneNumber: sceneNum,
    shotId: shot.id,
    frameId: frame.id,
    label: frame.label || `Frame ${frame.id}`,
    isEmpty: isEmptyFrame(frame),
  };
}

function appendFrameRanges(
  view: EditorView,
  ranges: ScriptBoxRange[],
  scene: ScriptBoxRange,
  shot: SceneShot,
  shotFrom: number,
  shotTo: number,
  sceneNum: number
): void {
  const frames = getFramesForShot(scene.sceneId, shot.id);
  if (!frames.length) return;

  const docText = view.state.doc.toString();
  const sorted = [...frames].sort((a, b) => a.id - b.id);
  const entries = sorted.map((frame) => ({
    frame,
    pos: frameAnchorPos(docText, frame),
  }));
  const anchored = entries
    .filter((entry) => entry.pos >= shotFrom && entry.pos <= shotTo)
    .sort((a, b) => a.pos - b.pos || a.frame.id - b.frame.id);

  if (!anchored.length) {
    const count = sorted.length;
    const span = Math.max(1, shotTo - shotFrom);
    const slice = span / count;
    for (let i = 0; i < count; i++) {
      const frame = sorted[i];
      const fFrom = i === 0 ? shotFrom : shotFrom + Math.floor(i * slice);
      const fTo = i === count - 1 ? shotTo : shotFrom + Math.floor((i + 1) * slice) - 1;
      ranges.push(makeFrameRange(view, frame, scene, shot, sceneNum, fFrom, fTo));
    }
    return;
  }

  for (let fi = 0; fi < anchored.length; fi++) {
    const { frame } = anchored[fi];
    const fNext = fi + 1 < anchored.length ? anchored[fi + 1].pos : shotTo + 1;
    const fFrom = Math.max(shotFrom, anchored[fi].pos);
    const fTo = Math.min(shotTo, fNext > fFrom ? fNext - 1 : shotTo);
    ranges.push(makeFrameRange(view, frame, scene, shot, sceneNum, fFrom, fTo));
  }
}

/** Shots and storyboard frames nested within each scene span. */
export function computeShotAndFrameRanges(view: EditorView): ScriptBoxRange[] {
  const docText = view.state.doc.toString();
  const scenes = computeSceneRanges(view);
  const ranges: ScriptBoxRange[] = [];

  for (const scene of scenes) {
    const shots = [...getShotsForScene(scene.sceneId)].sort(
      (a, b) => (a.number ?? 0) - (b.number ?? 0) || a.id - b.id
    );

    if (!shots.length) continue;

    type AnchorEntry = { shot: SceneShot; pos: number };
    const anchored: AnchorEntry[] = [];
    for (const shot of shots) {
      const pos = shotAnchorPos(docText, shot, scene.sceneId);
      if (pos >= scene.from) anchored.push({ shot, pos: pos >= 0 ? pos : scene.from });
    }

    anchored.sort((a, b) => a.pos - b.pos || (a.shot.number ?? 0) - (b.shot.number ?? 0));

    for (let i = 0; i < anchored.length; i++) {
      const { shot } = anchored[i];
      const nextPos = i + 1 < anchored.length ? anchored[i + 1].pos : scene.to + 1;
      const from =
        shot.scriptRange?.start != null && shot.scriptRange.start >= scene.from
          ? shot.scriptRange.start
          : Math.max(scene.from, anchored[i].pos);
      const to =
        shot.scriptRange?.end != null && shot.scriptRange.end <= scene.to
          ? shot.scriptRange.end
          : Math.min(scene.to, nextPos > from ? nextPos - 1 : scene.to);

      const sceneNum = sceneNumberFromSceneId(scene.sceneId);
      const shotNum = shot.number ?? i + 1;
      const frames = getFramesForShot(scene.sceneId, shot.id);
      ranges.push({
        kind: 'shot',
        from: snapToLineBoundary(view, from, 'start'),
        to: snapToLineBoundary(view, Math.max(from, to), 'end'),
        sceneId: scene.sceneId,
        sceneNumber: sceneNum,
        shotId: shot.id,
        label: `Shot ${sceneNum}.${shotNum}`,
        frameCount: frames.length,
      });

      appendFrameRanges(view, ranges, scene, shot, from, to, sceneNum);
    }
  }

  // Fallback: derive shot groups from storyboard when scene data has no coverage
  if (!ranges.some((r) => r.kind === 'shot')) {
    const frames = storyboardFrames as StoryboardFrame[];
    for (const scene of scenes) {
      const sceneNum = String(scene.sceneNumber);
      const sceneFrames = frames.filter(
        (f) => String(f.scene || '1').replace(/\D/g, '') === sceneNum.replace(/\D/g, '')
      );
      if (!sceneFrames.length) continue;

      const byShot = new Map<number | 'unassigned', StoryboardFrame[]>();
      for (const frame of sceneFrames) {
        const key = frame.shotId ?? ('unassigned' as const);
        if (!byShot.has(key)) byShot.set(key, []);
        byShot.get(key)!.push(frame);
      }

      let shotIndex = 0;
      for (const [, groupFrames] of byShot) {
        shotIndex++;
        const anchors = groupFrames
          .map((f) => frameAnchorPos(docText, f))
          .filter((p) => p >= scene.from)
          .sort((a, b) => a - b);
        const from = anchors[0] >= 0 ? anchors[0] : scene.from;
        const to = scene.to;
        const shotId = groupFrames[0]?.shotId;
        ranges.push({
          kind: 'shot',
          from: snapToLineBoundary(view, from, 'start'),
          to: snapToLineBoundary(view, to, 'end'),
          sceneId: scene.sceneId,
          sceneNumber: scene.sceneNumber,
          shotId,
          label: `Shot ${scene.sceneNumber}.${shotIndex}`,
          frameCount: groupFrames.length,
        });

        if (shotId != null) {
          const pseudoShot = { id: shotId } as SceneShot;
          appendFrameRanges(view, ranges, scene, pseudoShot, from, to, scene.sceneNumber);
        } else {
          for (let fi = 0; fi < groupFrames.length; fi++) {
            const frame = groupFrames[fi];
            const fNext = fi + 1 < groupFrames.length ? frameAnchorPos(docText, groupFrames[fi + 1]) : to + 1;
            const fFrom = Math.max(from, frameAnchorPos(docText, frame) >= 0 ? frameAnchorPos(docText, frame) : from);
            const fTo = Math.min(to, fNext > fFrom ? fNext - 1 : to);
            ranges.push({
              kind: 'frame',
              from: snapToLineBoundary(view, fFrom, 'start'),
              to: snapToLineBoundary(view, Math.max(fFrom, fTo), 'end'),
              sceneId: scene.sceneId,
              sceneNumber: scene.sceneNumber,
              frameId: frame.id,
              label: frame.label || `Frame ${frame.id}`,
              isEmpty: isEmptyFrame(frame),
            });
          }
        }
      }
    }
  }

  return ranges;
}

export function allScriptBoxRanges(view: EditorView): ScriptBoxRange[] {
  return [...computeSceneRanges(view), ...computeShotAndFrameRanges(view)];
}

/** Storyboard frame anchor ranges for floated script widgets. */
export function getStoryboardFrameWrapRanges(view: EditorView): ScriptBoxRange[] {
  return computeShotAndFrameRanges(view).filter((range) => range.kind === 'frame');
}

export function applyShotRangeUpdate(
  sceneId: string,
  shotId: number,
  edge: 'start' | 'end',
  pos: number,
  view: EditorView
): void {
  const scenes = currentSceneData as Record<string, { coverage?: SceneShot[] }>;
  const shot = scenes[sceneId]?.coverage?.find((s) => s.id === shotId);
  if (!shot) return;

  const snapped = snapToLineBoundary(view, pos, edge === 'start' ? 'start' : 'end');
  const scene = computeSceneRanges(view).find((s) => s.sceneId === sceneId);
  const fallbackStart = scene?.from ?? 0;
  const fallbackEnd = scene?.to ?? view.state.doc.length;
  const current = shot.scriptRange ?? { start: fallbackStart, end: fallbackEnd };

  if (edge === 'start') {
    const end = Math.max(current.end, snapped + 1);
    shot.scriptRange = { start: Math.min(snapped, end - 1), end };
  } else {
    const start = Math.min(current.start, snapped - 1);
    shot.scriptRange = { start, end: Math.max(snapped, start + 1) };
  }
}
