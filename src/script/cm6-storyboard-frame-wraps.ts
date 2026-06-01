import {
  ViewPlugin,
  ViewUpdate,
  EditorView,
  Decoration,
  DecorationSet,
  WidgetType,
} from '@codemirror/view';
import { Compartment, StateEffect, Range } from '@codemirror/state';
import { selectedStoryboardFrameId, storyboardFrames } from '@/data/project-data';
import { getStoryboardFrameWrapRanges, reflowShotRangesForStoryboardFrames, type ScriptBoxRange } from '@/script/script-box-ranges';
import {
  getStoryboardFrameBoxSizePx,
  getStoryboardFrameFloatBlockHeightPx,
} from '@/script/script-frame-layout';
import { CG_STORYBOARD_FRAME_SELECTED } from '@/events/shell-events';
import { openStoryboardFrameEditor } from '@/storyboard/storyboard-bundle';
import type { StoryboardFrame } from '@/storyboard/storyboard-types';
import { selectStoryboardFrameById } from '@/workspace/shot-frame-bridge';
import { blurStoryboardFrameThumbFocus } from '@/script/storyboard-link-ranges';

export { getStoryboardFrameBoxSizePx } from '@/script/script-frame-layout';

const refreshFrameWrapsEffect = StateEffect.define<null>();

function frameById(frameId: number | undefined): StoryboardFrame | undefined {
  if (frameId == null) return undefined;
  return (storyboardFrames as StoryboardFrame[]).find((f) => f.id === frameId);
}

class StoryboardFrameWrapWidget extends WidgetType {
  constructor(
    private readonly _range: ScriptBoxRange,
    private readonly _width: number,
    private readonly _height: number,
    private readonly _selected: boolean
  ) {
    super();
  }

  eq(other: WidgetType): boolean {
    return (
      other instanceof StoryboardFrameWrapWidget &&
      other._range.frameId === this._range.frameId &&
      other._range.from === this._range.from &&
      other._width === this._width &&
      other._height === this._height &&
      other._range.isEmpty === this._range.isEmpty &&
      other._range.label === this._range.label &&
      other._selected === this._selected
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const frame = frameById(this._range.frameId);
    const wrap = document.createElement('span');
    wrap.className = 'cm-storyboard-frame-wrap';
    wrap.contentEditable = 'false';

    const box = document.createElement('span');
    box.className = 'cm-storyboard-frame-box';
    if (this._range.isEmpty) box.classList.add('cm-storyboard-frame-box--empty');
    if (this._selected) box.classList.add('cm-storyboard-frame-box--selected');
    box.style.width = `${this._width}px`;
    box.style.height = `${this._height}px`;
    box.title = `${this._range.label} — click to inspect, double-click to edit`;

    if (frame?.imageUrl) {
      const img = document.createElement('img');
      img.className = 'cm-storyboard-frame-box-image';
      img.src = frame.imageUrl;
      img.alt = this._range.label;
      img.draggable = false;
      box.appendChild(img);
    }

    const label = document.createElement('span');
    label.className = 'cm-storyboard-frame-box-label';
    label.textContent = this._range.label;
    box.appendChild(label);

    if (this._range.frameId != null) {
      box.dataset.frameId = String(this._range.frameId);

      const activateFrame = (): void => {
        selectStoryboardFrameById(this._range.frameId!);
        view.dispatch({ effects: refreshFrameWrapsEffect.of(null) });
      };

      const openEditor = (): void => {
        const current = frameById(this._range.frameId);
        if (current) openStoryboardFrameEditor(current);
      };

      box.addEventListener('mousedown', (event) => {
        event.preventDefault();
      });

      box.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        activateFrame();
        blurStoryboardFrameThumbFocus();
      });

      box.addEventListener('dblclick', (event) => {
        event.preventDefault();
        event.stopPropagation();
        openEditor();
      });
    }

    wrap.appendChild(box);
    return wrap;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

function buildFrameWrapDecorations(view: EditorView): DecorationSet {
  const { width, height } = getStoryboardFrameBoxSizePx(view);
  const floatBlockHeight = getStoryboardFrameFloatBlockHeightPx(view);
  const selectedId = selectedStoryboardFrameId != null ? Number(selectedStoryboardFrameId) : null;
  const frames = getStoryboardFrameWrapRanges(view).sort((a, b) => a.from - b.from || a.frameId! - b.frameId!);
  const decos: Range<Decoration>[] = [];
  const framesPerLine = new Map<number, number>();

  for (const range of frames) {
    try {
      const line = view.state.doc.lineAt(range.from);
      framesPerLine.set(line.from, (framesPerLine.get(line.from) ?? 0) + 1);
      const selected = selectedId != null && range.frameId === selectedId;
      decos.push(
        Decoration.widget({
          widget: new StoryboardFrameWrapWidget(range, width, height, selected),
          side: -1,
          block: false,
        }).range(line.from)
      );
    } catch {
      /* position out of range */
    }
  }

  for (const [lineFrom, count] of framesPerLine) {
    const minHeight = count * floatBlockHeight;
    decos.push(
      Decoration.line({
        attributes: { style: `min-height: ${minHeight}px` },
      }).range(lineFrom)
    );
  }

  return Decoration.set(decos, true);
}

const frameWrapsPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    private _onSelectionChange = (): void => {
      this.decorations = buildFrameWrapDecorations(this.view);
    };

    constructor(readonly view: EditorView) {
      this.decorations = buildFrameWrapDecorations(view);
      window.addEventListener(CG_STORYBOARD_FRAME_SELECTED, this._onSelectionChange);
    }
    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.geometryChanged ||
        update.transactions.some((tr) => tr.effects.some((e) => e.is(refreshFrameWrapsEffect)))
      ) {
        this.decorations = buildFrameWrapDecorations(update.view);
        update.view.requestMeasure();
      }
    }
    destroy() {
      window.removeEventListener(CG_STORYBOARD_FRAME_SELECTED, this._onSelectionChange);
    }
  },
  { decorations: (v) => v.decorations }
);

const frameWrapsCompartment = new Compartment();

function createFrameWrapsExtension() {
  return [
    frameWrapsPlugin,
    EditorView.theme({
      '&.cm-editor.cm-storyboard-frames-visible .cm-content': {
        minHeight: '100%',
      },
    }),
  ];
}

/** Include in createScriptEditor extensions (disabled until toggled on). */
export function storyboardFrameWrapsExtension() {
  return frameWrapsCompartment.of([]);
}

/** Toggle right-floated storyboard frame boxes in the script. */
export function setStoryboardFrameWrapsEnabled(view: EditorView, enabled: boolean): void {
  if (enabled) reflowShotRangesForStoryboardFrames(view);
  view.dispatch({
    effects: frameWrapsCompartment.reconfigure(enabled ? createFrameWrapsExtension() : []),
  });
  view.dom.classList.toggle('cm-storyboard-frames-visible', enabled);
  if (enabled) view.requestMeasure();
}

/** Force frame-wrap remeasure (storyboard / aspect ratio changes). */
export function refreshStoryboardFrameWraps(view: EditorView): void {
  view.dispatch({ effects: refreshFrameWrapsEffect.of(null) });
  view.requestMeasure();
}

/** @deprecated alias for toolbar wiring */
export const setStoryboardFrameBoxesEnabled = setStoryboardFrameWrapsEnabled;
