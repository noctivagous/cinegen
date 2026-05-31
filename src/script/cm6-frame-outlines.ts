import {
  ViewPlugin,
  ViewUpdate,
  EditorView,
  Decoration,
  DecorationSet,
  WidgetType,
} from '@codemirror/view';
import { Range, Compartment } from '@codemirror/state';
import { classifyFountainDocument } from './fountain-bundle';

// ==================== TYPES ====================

interface SceneInfo {
  /** 0-based line index of the scene heading */
  firstLine: number;
  /** 0-based line index of the last non-blank line in the scene */
  lastLine: number;
  label: string;
}

interface ShotInfo {
  /** 0-based line index of the first content line in the shot */
  firstLine: number;
  /** 0-based line index of the last content line in the shot */
  lastLine: number;
  sceneIdx: number;
}

// ==================== FRAME PARSING ====================

function parseFrames(
  lines: string[],
  lineTypes: string[]
): { scenes: SceneInfo[]; shots: ShotInfo[] } {
  const scenes: SceneInfo[] = [];
  const shots: ShotInfo[] = [];

  // Collect 0-based indices of all scene headings
  const sceneStarts: number[] = [];
  for (let i = 0; i < lineTypes.length; i++) {
    if (lineTypes[i] === 'scene') sceneStarts.push(i);
  }

  for (let si = 0; si < sceneStarts.length; si++) {
    const start = sceneStarts[si];
    const nextStart = sceneStarts[si + 1] ?? lines.length;

    // Find last non-blank line in this scene range
    let end = nextStart - 1;
    while (end > start && !lines[end]?.trim()) end--;

    scenes.push({ firstLine: start, lastLine: end, label: lines[start]?.trim() ?? '' });

    // Find shot blocks (groups of non-blank lines) after the heading
    let shotStart: number | null = null;
    for (let i = start + 1; i <= end; i++) {
      const hasContent = !!lines[i]?.trim();
      if (hasContent && shotStart === null) {
        shotStart = i;
      } else if (!hasContent && shotStart !== null) {
        shots.push({ firstLine: shotStart, lastLine: i - 1, sceneIdx: si });
        shotStart = null;
      }
    }
    if (shotStart !== null) {
      shots.push({ firstLine: shotStart, lastLine: end, sceneIdx: si });
    }
  }

  return { scenes, shots };
}

// ==================== DRAG HANDLE WIDGET ====================

class FrameDragHandleWidget extends WidgetType {
  constructor(
    private readonly _edge: 'top' | 'bottom',
    private readonly _shotIdx: number,
    private readonly _lineIdx: number
  ) {
    super();
  }

  eq(other: WidgetType): boolean {
    return (
      other instanceof FrameDragHandleWidget &&
      other._edge === this._edge &&
      other._shotIdx === this._shotIdx &&
      other._lineIdx === this._lineIdx
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const el = document.createElement('div');
    el.className = `cm-frame-drag cm-frame-drag--${this._edge}`;
    el.title = 'Drag to adjust shot boundary';
    el.setAttribute('aria-hidden', 'true');

    const edge = this._edge;
    const lineIdx = this._lineIdx;
    el.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      _startBoundaryDrag(view, edge, lineIdx, e);
    });

    return el;
  }

  get estimatedHeight(): number { return 6; }
  ignoreEvent(): boolean { return false; }
}

// ==================== DRAG LOGIC ====================

interface DragState {
  view: EditorView;
  edge: 'top' | 'bottom';
  anchorLineIdx: number;
  startY: number;
  indicator: HTMLElement;
  onMove: (e: MouseEvent) => void;
  onUp: (e: MouseEvent) => void;
}

let _activeDrag: DragState | null = null;

function _startBoundaryDrag(
  view: EditorView,
  edge: 'top' | 'bottom',
  lineIdx: number,
  e: MouseEvent
): void {
  if (_activeDrag) return;

  // Ghost line indicator placed inside the scroller so it scrolls with content
  const scroller = view.scrollDOM;
  const indicator = document.createElement('div');
  indicator.className = 'cm-frame-drag-indicator';
  scroller.style.position = 'relative'; // ensure indicator can be positioned
  scroller.appendChild(indicator);

  const lineHeight = view.defaultLineHeight;
  const scrollerRect = scroller.getBoundingClientRect();

  const onMove = (ev: MouseEvent): void => {
    const drag = _activeDrag;
    if (!drag) return;
    const deltaY = ev.clientY - drag.startY;
    if (Math.abs(deltaY) >= lineHeight / 3) {
      // Position relative to the scroller element
      const yInScroller = ev.clientY - scrollerRect.top + scroller.scrollTop;
      indicator.style.top = `${yInScroller}px`;
      indicator.style.display = 'block';
    } else {
      indicator.style.display = 'none';
    }
  };

  const onUp = (ev: MouseEvent): void => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    const drag = _activeDrag;
    _activeDrag = null;
    drag?.indicator.remove();

    if (!drag) return;
    const deltaY = ev.clientY - drag.startY;
    const deltaLines = Math.round(deltaY / lineHeight);
    if (deltaLines !== 0) {
      _commitBoundaryDrag(drag.view, drag.edge, drag.anchorLineIdx, deltaLines);
    }
  };

  _activeDrag = { view, edge, anchorLineIdx: lineIdx, startY: e.clientY, indicator, onMove, onUp };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function _commitBoundaryDrag(
  view: EditorView,
  edge: 'top' | 'bottom',
  lineIdx: number,
  deltaLines: number
): void {
  const doc = view.state.doc;
  const lineCount = doc.lines;

  if (edge === 'top') {
    if (deltaLines < 0) {
      // Move top edge UP: remove the nearest blank line above to merge with previous shot
      for (let i = lineIdx - 1; i >= 0; i--) {
        if (i + 1 > lineCount) continue;
        const line = doc.line(i + 1);
        if (!line.text.trim()) {
          const from = line.from > 0 ? line.from - 1 : 0;
          view.dispatch({ changes: { from, to: line.to, insert: '' } });
          return;
        }
      }
    } else {
      // Move top edge DOWN: insert blank line before first line of shot (splits from previous shot)
      const line = doc.line(Math.min(lineIdx + 1, lineCount));
      view.dispatch({ changes: { from: line.from, to: line.from, insert: '\n' } });
    }
  } else {
    // edge === 'bottom'
    if (deltaLines > 0) {
      // Move bottom edge DOWN: remove the nearest blank line below to absorb next shot
      for (let i = lineIdx + 1; i < lineCount; i++) {
        const line = doc.line(i + 1);
        if (!line.text.trim()) {
          const from = line.from > 0 ? line.from - 1 : 0;
          view.dispatch({ changes: { from, to: line.to, insert: '' } });
          return;
        }
        // Stop if we hit content without finding a blank line first
        break;
      }
    } else {
      // Move bottom edge UP: insert blank line before the last line of shot (splits it off)
      const line = doc.line(Math.min(lineIdx + 1, lineCount));
      view.dispatch({ changes: { from: line.from, to: line.from, insert: '\n' } });
    }
  }
}

// ==================== DECORATION BUILDING ====================

function _buildDecorations(view: EditorView): DecorationSet {
  const doc = view.state.doc;
  const text = doc.toString();
  const lines = text.split('\n');
  const lineTypes = classifyFountainDocument(lines);
  const { scenes, shots } = parseFrames(lines, lineTypes);

  const decos: Range<Decoration>[] = [];

  // ── Scene line decorations ──
  // Include ALL lines from firstLine to lastLine (including blanks) so that
  // left/right borders run continuously through the scene.
  for (const scene of scenes) {
    for (let i = scene.firstLine; i <= scene.lastLine; i++) {
      const lineNum = i + 1;
      if (lineNum > doc.lines) continue;
      let cls = 'cm-frame-scene';
      if (i === scene.firstLine && i === scene.lastLine) {
        cls += ' cm-frame-scene-single';
      } else if (i === scene.firstLine) {
        cls += ' cm-frame-scene-first';
      } else if (i === scene.lastLine) {
        cls += ' cm-frame-scene-last';
      }
      try {
        const line = doc.line(lineNum);
        decos.push(Decoration.line({ class: cls }).range(line.from));
      } catch { /* line out of range */ }
    }
  }

  // ── Shot line decorations + drag widgets ──
  for (let si = 0; si < shots.length; si++) {
    const shot = shots[si];
    for (let i = shot.firstLine; i <= shot.lastLine; i++) {
      const lineNum = i + 1;
      if (lineNum > doc.lines) continue;
      let cls = 'cm-frame-shot';
      if (i === shot.firstLine && i === shot.lastLine) {
        cls += ' cm-frame-shot-single';
      } else if (i === shot.firstLine) {
        cls += ' cm-frame-shot-first';
      } else if (i === shot.lastLine) {
        cls += ' cm-frame-shot-last';
      }
      try {
        const line = doc.line(lineNum);
        decos.push(Decoration.line({ class: cls }).range(line.from));
      } catch { /* line out of range */ }
    }

    // Drag handle widgets at shot boundaries
    const firstLineNum = shot.firstLine + 1;
    const lastLineNum = shot.lastLine + 1;
    if (firstLineNum <= doc.lines && lastLineNum <= doc.lines) {
      try {
        const firstLine = doc.line(firstLineNum);
        const lastLine = doc.line(lastLineNum);
        // Top handle: block widget BEFORE the first line of the shot
        decos.push(
          Decoration.widget({
            widget: new FrameDragHandleWidget('top', si, shot.firstLine),
            block: true,
            side: -1,
          }).range(firstLine.from)
        );
        // Bottom handle: block widget AFTER the last line of the shot
        decos.push(
          Decoration.widget({
            widget: new FrameDragHandleWidget('bottom', si, shot.lastLine),
            block: true,
            side: 1,
          }).range(lastLine.to)
        );
      } catch { /* line out of range */ }
    }
  }

  // Let CM6 sort by (from, startSide) for us
  return Decoration.set(decos, true);
}

// ==================== VIEW PLUGIN ====================

const _frameOutlinesPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = _buildDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = _buildDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);

// ==================== COMPARTMENT (dynamic enable/disable) ====================

const _frameOutlinesCompartment = new Compartment();

function _createFrameOutlinesExtension() {
  return [_frameOutlinesPlugin];
}

/** Call inside `createScriptEditor` extensions array. Enabled by default. */
export function frameOutlinesExtension() {
  return _frameOutlinesCompartment.of(_createFrameOutlinesExtension());
}

/** Toggle scene/shot box outlines on/off at runtime. */
export function setFrameOutlinesEnabled(view: EditorView, enabled: boolean): void {
  view.dispatch({
    effects: _frameOutlinesCompartment.reconfigure(
      enabled ? _createFrameOutlinesExtension() : []
    ),
  });
}
