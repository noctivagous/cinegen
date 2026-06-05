import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { cinegenFountainTheme } from './cm6-theme';

const plainUiTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: '#202020',
      color: '#e0e0e0',
      height: '100%',
    },
    '.cm-content': {
      fontFamily: "'Source Sans 3', 'Segoe UI', system-ui, sans-serif",
      fontSize: '11px',
      lineHeight: '1.55',
      padding: '8px 12px',
      caretColor: '#e8e8e8',
    },
    '.cm-scroller': {
      overflow: 'auto',
      fontFamily: 'inherit',
    },
    '.cm-gutters': {
      display: 'none',
    },
    '&.cm-focused': {
      outline: 'none',
    },
  },
  { dark: true }
);

const scriptMonoTheme = EditorView.theme(
  {
    '.cm-content': {
      fontFamily: "'Courier New', Courier, monospace",
      fontSize: '11px',
      lineHeight: '1.6',
    },
  },
  { dark: true }
);

export type PlainEditorVariant = 'plain' | 'script' | 'fountain';

export interface PlainEditorOptions {
  parent: HTMLElement;
  doc: string;
  readOnly?: boolean;
  variant?: PlainEditorVariant;
  minHeight?: number;
  onChange?: (text: string) => void;
}

export function createPlainEditor(opts: PlainEditorOptions): EditorView {
  const { parent, doc, readOnly = true, variant = 'plain', minHeight = 72, onChange } = opts;

  const theme =
    variant === 'fountain'
      ? [...cinegenFountainTheme, EditorView.lineWrapping]
      : [
          plainUiTheme,
          ...(variant === 'script' ? [scriptMonoTheme] : []),
          EditorView.lineWrapping,
          EditorView.theme({
            '&': { minHeight: `${minHeight}px` },
          }),
        ];

  const extensions = [
    ...theme,
    EditorState.readOnly.of(readOnly),
    EditorView.editable.of(!readOnly),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) onChange?.(update.state.doc.toString());
    }),
  ];

  return new EditorView({
    parent,
    state: EditorState.create({ doc, extensions }),
  });
}

export function setPlainEditorDoc(view: EditorView, doc: string): void {
  if (view.state.doc.toString() === doc) return;
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: doc },
  });
}
