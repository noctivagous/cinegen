import {
  ViewPlugin,
  ViewUpdate,
  EditorView,
  Decoration,
  DecorationSet,
  WidgetType,
} from '@codemirror/view';
import { Compartment, StateEffect, Range } from '@codemirror/state';
import { getActiveProjectSettings, selectedStoryboardFrameId, storyboardFrames } from '@/data/project-data';
import { getStoryboardFrameWrapRanges, type ScriptBoxRange } from '@/script/script-box-ranges';
import { CG_STORYBOARD_FRAME_SELECTED } from '@/events/shell-events';
import { openStoryboardFrameEditor } from '@/storyboard/storyboard-bundle';
import type { StoryboardFrame } from '@/storyboard/storyboard-types';
import { selectStoryboardFrameById } from '@/workspace/shot-frame-bridge';

/** Fixed width for every storyboard frame thumbnail in the script (height from project aspect). */
const FRAME_WIDTH_EM = 11;

const refreshFrameWrapsEffect = StateEffect.define<null>();

function aspectWidthOverHeight(ratio: string): number {
  const parts = String(ratio || '16:9')
    .split(':')
    .map((p) => parseFloat(p.trim()));
  if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) return parts[0] / parts[1];
  return 16 / 9;
}

export function getStoryboardFrameBoxSizePx(view: EditorView): { width: number; height: number } {
  const fontSize = parseFloat(getComputedStyle(view.contentDOM).fontSize);
  const em = Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 16;
  const width = Math.round(em * FRAME_WIDTH_EM);
  const aspect = aspectWidthOverHeight(getActiveProjectSettings().aspectRatio);
  const height = Math.max(24, Math.round(width / aspect));
  return { width, height };
}

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
    box.setAttribute('role', 'button');

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
  const selectedId = selectedStoryboardFrameId != null ? Number(selectedStoryboardFrameId) : null;
  const frames = getStoryboardFrameWrapRanges(view).sort((a, b) => a.from - b.from || a.frameId! - b.frameId!);
  const decos: Range<Decoration>[] = [];

  for (const range of frames) {
    try {
      const line = view.state.doc.lineAt(range.from);
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
  view.dispatch({
    effects: frameWrapsCompartment.reconfigure(enabled ? createFrameWrapsExtension() : []),
  });
  view.dom.classList.toggle('cm-storyboard-frames-visible', enabled);
}

/** Force frame-wrap remeasure (storyboard / aspect ratio changes). */
export function refreshStoryboardFrameWraps(view: EditorView): void {
  view.dispatch({ effects: refreshFrameWrapsEffect.of(null) });
}

/** @deprecated alias for toolbar wiring */
export const setStoryboardFrameBoxesEnabled = setStoryboardFrameWrapsEnabled;
