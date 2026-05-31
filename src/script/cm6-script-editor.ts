import { EditorView, keymap } from '@codemirror/view';
import { EditorState, Transaction } from '@codemirror/state';
import { history, historyKeymap } from '@codemirror/commands';
import { fountainLanguage } from './cm6-fountain-language';
import { cinegenFountainTheme } from './cm6-theme';
import { sceneGutter } from './scene-gutter';
import type { SceneGutterConfig } from './scene-gutter';
import { annotationField } from './cm6-annotations';
import { chipsExtension } from './cm6-chips';
import { anchorsExtension } from './cm6-anchors';
import { getProjectFountainText, setProjectFountainText } from '@/data/project-data';
import { markProjectDirty } from '@/services/project-service';

export { getProjectFountainText };

let scriptProjectSyncTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleProjectSync(view: EditorView): void {
  if (scriptProjectSyncTimer !== null) clearTimeout(scriptProjectSyncTimer);
  scriptProjectSyncTimer = setTimeout(() => {
    scriptProjectSyncTimer = null;
    const text = view.state.doc.toString();
    setProjectFountainText(text);
    markProjectDirty(['screenplay']);
  }, 250);
}

export interface ScriptEditorConfig {
  /** Called on debounced document changes */
  onChange?(view: EditorView): void;
  /** Called on mouseup inside the editor */
  onMouseUp?(view: EditorView, event: MouseEvent): void;
  /** Called on keyup inside the editor */
  onKeyUp?(view: EditorView, event: KeyboardEvent): void;
  /** Called on contextmenu inside the editor */
  onContextMenu?(view: EditorView, event: MouseEvent): void;
  /** Called when the editor scrolls (sync previs margin) */
  onScroll?(view: EditorView): void;
  /** Scene gutter click handler */
  sceneGutter?: SceneGutterConfig;
}

/** Create a CodeMirror 6 EditorView configured for Fountain screenplay editing. */
export function createScriptEditor(
  host: HTMLElement,
  config: ScriptEditorConfig = {}
): EditorView {
  const extensions = [
    ...cinegenFountainTheme,
    history(),
    keymap.of(historyKeymap),
    fountainLanguage,
    EditorView.lineWrapping,
    EditorState.allowMultipleSelections.of(false),
    ...(config.sceneGutter ? [sceneGutter(config.sceneGutter)] : []),
    annotationField,
    chipsExtension(),
    anchorsExtension(),
    EditorView.domEventHandlers({
      mouseup(_event, view) {
        config.onMouseUp?.(view, _event as MouseEvent);
        return false;
      },
      keyup(_event, view) {
        config.onKeyUp?.(view, _event as KeyboardEvent);
        return false;
      },
      contextmenu(_event, view) {
        config.onContextMenu?.(view, _event as MouseEvent);
        return false;
      },
      scroll(_event, view) {
        config.onScroll?.(view);
        return false;
      },
    }),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        scheduleProjectSync(update.view);
        config.onChange?.(update.view);
      }
    }),
  ];

  const state = EditorState.create({
    doc: getProjectFountainText(),
    extensions,
  });

  const view = new EditorView({
    state,
    parent: host,
  });

  return view;
}

/** Insert a Fountain snippet at the current cursor position.
 *  `spec.sel` are offsets inside the inserted text for post-insert selection.
 */
export function insertFountainSnippetIntoEditor(
  view: EditorView,
  text: string,
  sel?: readonly [number, number] | null
): void {
  const { from } = view.state.selection.main;
  const tr = view.state.update({
    changes: { from, to: view.state.selection.main.to, insert: text },
    selection: {
      anchor: sel ? from + sel[0] : from + text.length,
      head: sel ? from + sel[1] : from + text.length,
    },
  });
  view.dispatch(tr);
  view.focus();
}

/** Replace the editor document and optionally scroll to a position. */
export function setEditorDocument(view: EditorView, text: string, scrollToEnd = false): void {
  const tr = view.state.update({
    changes: { from: 0, to: view.state.doc.length, insert: text },
    selection: { anchor: 0 },
  });
  view.dispatch(tr);
  if (scrollToEnd) {
    view.dispatch({
      effects: EditorView.scrollIntoView(view.state.doc.length, { y: 'end' }),
    });
  }
}

/** Scroll the editor so the given document position is visible. */
export function scrollEditorToPos(view: EditorView, pos: number): void {
  view.dispatch({
    effects: EditorView.scrollIntoView(pos, { y: 'center' }),
  });
}

/** Set the editor selection range. */
export function setEditorSelection(view: EditorView, anchor: number, head?: number): void {
  view.dispatch({
    selection: { anchor, head: head ?? anchor },
    scrollIntoView: true,
  });
}
