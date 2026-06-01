import {
  ViewPlugin,
  ViewUpdate,
  EditorView,
  Decoration,
  DecorationSet,
} from '@codemirror/view';
import { Range, StateEffect } from '@codemirror/state';
import { selectedStoryboardFrameId } from '@/data/project-data';
import { CG_STORYBOARD_FRAME_SELECTED, CG_STORYBOARD_FRAMES_CHANGED } from '@/events/shell-events';
import {
  blurStoryboardFrameThumbFocus,
  getStoryboardLinkRanges,
} from '@/script/storyboard-link-ranges';
import { clearStoryboardFrameSelection, selectStoryboardFrameById } from '@/workspace/shot-frame-bridge';

const refreshStoryboardLinksEffect = StateEffect.define<null>();

function buildStoryboardLinkDecorations(view: EditorView): DecorationSet {
  const selectedId =
    selectedStoryboardFrameId != null ? Number(selectedStoryboardFrameId) : null;
  const links = getStoryboardLinkRanges(view);
  const decos: Range<Decoration>[] = [];

  for (const link of links) {
    const selected = selectedId != null && link.frameId === selectedId;
    decos.push(
      Decoration.mark({
        class: selected ? 'cm-storyboard-link cm-storyboard-link--selected' : 'cm-storyboard-link',
        attributes: {
          'data-frame-id': String(link.frameId),
          title: 'Storyboard frame link — click to select frame',
        },
      }).range(link.from, link.to)
    );
  }

  return Decoration.set(decos, true);
}

function frameIdFromLinkTarget(target: EventTarget | null): number | null {
  const el = (target as HTMLElement | null)?.closest?.('.cm-storyboard-link[data-frame-id]') as
    | HTMLElement
    | null;
  if (!el?.dataset.frameId) return null;
  const id = parseInt(el.dataset.frameId, 10);
  return Number.isFinite(id) ? id : null;
}

const storyboardLinksPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    private _onFramesChanged = (): void => {
      this.decorations = buildStoryboardLinkDecorations(this.view);
    };
    private _onSelectionChange = (): void => {
      this.decorations = buildStoryboardLinkDecorations(this.view);
    };

    constructor(readonly view: EditorView) {
      this.decorations = buildStoryboardLinkDecorations(view);
      window.addEventListener(CG_STORYBOARD_FRAMES_CHANGED, this._onFramesChanged);
      window.addEventListener(CG_STORYBOARD_FRAME_SELECTED, this._onSelectionChange);
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.transactions.some((tr) =>
          tr.effects.some((e) => e.is(refreshStoryboardLinksEffect))
        )
      ) {
        this.decorations = buildStoryboardLinkDecorations(update.view);
      }
    }

    destroy() {
      window.removeEventListener(CG_STORYBOARD_FRAMES_CHANGED, this._onFramesChanged);
      window.removeEventListener(CG_STORYBOARD_FRAME_SELECTED, this._onSelectionChange);
    }
  },
  { decorations: (v) => v.decorations }
);

function storyboardLinkInteractionHandlers(): ReturnType<typeof EditorView.domEventHandlers> {
  return EditorView.domEventHandlers({
    mousedown(event, view) {
      const frameId = frameIdFromLinkTarget(event.target);
      if (frameId != null) {
        event.preventDefault();
        selectStoryboardFrameById(frameId);
        view.dispatch({ effects: refreshStoryboardLinksEffect.of(null) });
        return true;
      }

      if ((event.target as HTMLElement | null)?.closest?.('.cm-storyboard-frame-wrap')) {
        return false;
      }

      blurStoryboardFrameThumbFocus();
      if (selectedStoryboardFrameId != null) {
        clearStoryboardFrameSelection();
        view.dispatch({ effects: refreshStoryboardLinksEffect.of(null) });
      }
      return false;
    },
  });
}

/** Per-frame storyboard link underlines in the script editor. */
export function storyboardLinksExtension() {
  return [storyboardLinksPlugin, storyboardLinkInteractionHandlers()];
}

export function refreshStoryboardLinks(view: EditorView): void {
  view.dispatch({ effects: refreshStoryboardLinksEffect.of(null) });
}
