import { EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { Compartment, StateEffect } from '@codemirror/state';
import {
  allScriptBoxRanges,
  applyShotRangeUpdate,
  type ScriptBoxRange,
} from '@/script/script-box-ranges';
import { markProjectDirty } from '@/services/project-service';

type DragTarget = {
  kind: 'shot';
  sceneId: string;
  shotId: number;
  edge: 'start' | 'end';
};

let activeDrag: DragTarget | null = null;

const refreshBoxOutlinesEffect = StateEffect.define<null>();

function posAtY(view: EditorView, clientY: number): number {
  const rect = view.scrollDOM.getBoundingClientRect();
  const y = clientY - rect.top + view.scrollDOM.scrollTop;
  const block = view.elementAtHeight(y);
  if (!block) return 0;
  const pos = view.coordsAtPos(block.from);
  if (!pos) return block.from;
  return view.posAtCoords({ x: pos.left + 4, y: clientY }) ?? block.from;
}

function rangeGeometry(view: EditorView, range: ScriptBoxRange): { top: number; height: number; left: number; width: number } | null {
  const fromBlock = view.lineBlockAt(range.from);
  const toBlock = view.lineBlockAt(Math.max(range.from, range.to));
  const top = fromBlock.top;
  const height = Math.max(fromBlock.height, toBlock.top + toBlock.height - top);
  const content = view.contentDOM.getBoundingClientRect();
  const scroller = view.scrollDOM.getBoundingClientRect();
  const left = content.left - scroller.left + view.scrollDOM.scrollLeft;
  const width = content.width;
  if (height <= 0 || width <= 0) return null;
  return { top, height, left, width };
}

function insetEmPx(view: EditorView): number {
  const fontSize = parseFloat(getComputedStyle(view.contentDOM).fontSize);
  return Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 16;
}

function insetShotGeometry(
  shotGeom: { top: number; height: number; left: number; width: number },
  sceneGeom: { top: number; height: number; left: number; width: number },
  inset: number
): { top: number; height: number; left: number; width: number } {
  const sceneBottom = sceneGeom.top + sceneGeom.height;
  const shotBottom = shotGeom.top + shotGeom.height;
  const left = sceneGeom.left + inset;
  const width = Math.max(0, sceneGeom.width - inset * 2);
  const top = Math.max(shotGeom.top, sceneGeom.top + inset);
  const bottom = Math.min(shotBottom, sceneBottom - inset);
  const height = Math.max(0, bottom - top);
  return { top, height, left, width };
}

function onDragMove(event: MouseEvent, view: EditorView): void {
  if (!activeDrag) return;
  const pos = posAtY(view, event.clientY);
  applyShotRangeUpdate(activeDrag.sceneId, activeDrag.shotId, activeDrag.edge, pos, view);
  view.dispatch({ effects: refreshBoxOutlinesEffect.of(null) });
}

function finishDrag(view: EditorView): void {
  if (!activeDrag) return;
  activeDrag = null;
  document.body.classList.remove('script-box-resizing');
  window.removeEventListener('mousemove', onDragMoveBound);
  window.removeEventListener('mouseup', onFinishBound);
  markProjectDirty(['scenes']);
  window.dispatchEvent(new CustomEvent('script-box-ranges-changed'));
}

let dragView: EditorView | null = null;

function onDragMoveBound(event: MouseEvent): void {
  if (dragView) onDragMove(event, dragView);
}

function onFinishBound(): void {
  if (dragView) finishDrag(dragView);
}

function startDrag(view: EditorView, target: DragTarget, event: MouseEvent): void {
  event.preventDefault();
  event.stopPropagation();
  activeDrag = target;
  dragView = view;
  document.body.classList.add('script-box-resizing');
  window.addEventListener('mousemove', onDragMoveBound);
  window.addEventListener('mouseup', onFinishBound);
}

class BoxOutlineLayer {
  dom: HTMLElement;
  private boxes = new Map<string, HTMLElement>();

  constructor(readonly view: EditorView) {
    this.dom = document.createElement('div');
    this.dom.className = 'cm-box-outline-layer';
    this.dom.setAttribute('aria-hidden', 'true');
    view.scrollDOM.insertBefore(this.dom, view.contentDOM);
    this.render();
  }

  update(update: ViewUpdate): void {
    if (
      update.docChanged ||
      update.viewportChanged ||
      update.geometryChanged ||
      update.transactions.some((tr) => tr.effects.some((e) => e.is(refreshBoxOutlinesEffect)))
    ) {
      this.render();
    }
  }

  destroy(): void {
    if (activeDrag && dragView === this.view) finishDrag(this.view);
    this.dom.remove();
    this.boxes.clear();
  }

  private boxKey(range: ScriptBoxRange): string {
    if (range.kind === 'scene') return `scene:${range.sceneId}`;
    return `shot:${range.sceneId}:${range.shotId}`;
  }

  private render(): void {
    const ranges = allScriptBoxRanges(this.view);
    const seen = new Set<string>();
    const inset = insetEmPx(this.view);

    const sceneGeoms = new Map<string, { top: number; height: number; left: number; width: number }>();
    for (const range of ranges) {
      if (range.kind !== 'scene') continue;
      const geom = rangeGeometry(this.view, range);
      if (geom) sceneGeoms.set(range.sceneId, geom);
    }

    for (const range of ranges) {
      if (range.kind === 'frame') continue;
      const key = this.boxKey(range);
      seen.add(key);
      let geom = rangeGeometry(this.view, range);
      if (!geom) continue;

      if (range.kind === 'shot') {
        const sceneGeom = sceneGeoms.get(range.sceneId);
        if (sceneGeom) geom = insetShotGeometry(geom, sceneGeom, inset);
        if (geom.height <= 0 || geom.width <= 0) continue;
      }

      let el = this.boxes.get(key);
      if (!el) {
        el = document.createElement('div');
        el.className = `cm-script-box cm-script-box--${range.kind}`;
        el.dataset.boxKind = range.kind;

        const label = document.createElement('span');
        label.className = 'cm-script-box-label';
        el.appendChild(label);

        if (range.kind === 'shot' && range.shotId != null) {
          const topHandle = document.createElement('button');
          topHandle.type = 'button';
          topHandle.className = 'cm-script-box-handle cm-script-box-handle--top';
          topHandle.title = 'Adjust top edge';
          topHandle.addEventListener('mousedown', (event) => {
            startDrag(this.view, {
              kind: 'shot',
              sceneId: range.sceneId,
              shotId: range.shotId!,
              edge: 'start',
            }, event);
          });
          el.appendChild(topHandle);

          const bottomHandle = document.createElement('button');
          bottomHandle.type = 'button';
          bottomHandle.className = 'cm-script-box-handle cm-script-box-handle--bottom';
          bottomHandle.title = 'Adjust bottom edge';
          bottomHandle.addEventListener('mousedown', (event) => {
            startDrag(this.view, {
              kind: 'shot',
              sceneId: range.sceneId,
              shotId: range.shotId!,
              edge: 'end',
            }, event);
          });
          el.appendChild(bottomHandle);
        }

        this.dom.appendChild(el);
        this.boxes.set(key, el);
      }

      el.style.top = `${geom.top}px`;
      el.style.height = `${geom.height}px`;
      el.style.left = `${geom.left}px`;
      el.style.width = `${geom.width}px`;

      const labelEl = el.querySelector<HTMLElement>('.cm-script-box-label');
      if (labelEl) labelEl.textContent = range.label;
    }

    for (const [key, el] of this.boxes) {
      if (!seen.has(key)) {
        el.remove();
        this.boxes.delete(key);
      }
    }
  }
}

const boxOutlinePlugin = ViewPlugin.fromClass(BoxOutlineLayer);

const boxOutlineCompartment = new Compartment();

function createBoxOutlineExtension() {
  return [boxOutlinePlugin, EditorView.baseTheme({})];
}

/** Include in createScriptEditor extensions (enabled by default). */
export function boxOutlinesExtension() {
  return boxOutlineCompartment.of(createBoxOutlineExtension());
}

/** Toggle scene/shot box outlines at runtime. */
export function setBoxOutlinesEnabled(view: EditorView, enabled: boolean): void {
  view.dispatch({
    effects: boxOutlineCompartment.reconfigure(enabled ? createBoxOutlineExtension() : []),
  });
}

/** Force overlay remeasure (e.g. after storyboard / scene data changes). */
export function refreshBoxOutlines(view: EditorView): void {
  view.dispatch({ effects: refreshBoxOutlinesEffect.of(null) });
}
