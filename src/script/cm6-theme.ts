import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

/** CineGen dark theme for the script editor. Matches the existing
 *  .script-editor / .fountain-* CSS palette.
 */

const cinegenDarkTheme = EditorView.theme({
  '&': {
    backgroundColor: '#202020',
    color: '#e0e0e0',
  },
  '.cm-content': {
    fontFamily: "var(--font-body)",
    fontSize: 'var(--script-editor-font-size, 18pt)',
    lineHeight: '1.6',
    padding: '20px 28px',
    caretColor: '#e8e8e8',
  },
  '.cm-gutters': {
    backgroundColor: '#202020',
    borderRight: 'none',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
  },
  '.cm-selectionBackground': {
    background: 'rgba(90, 140, 214, 0.42) !important',
  },
  '.cm-cursor': {
    borderLeftColor: '#e8e8e8',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  '.cm-scroller': {
    overflow: 'auto',
  },
  '.cm-tooltip': {
    backgroundColor: '#2a2a2a',
    border: '1px solid #444',
    color: '#e0e0e0',
  },
  '.cm-tooltip-autocomplete': {
    backgroundColor: '#2a2a2a',
    border: '1px solid #444',
  },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: '#3a3a3a',
    color: '#fff',
  },
}, { dark: true });

/** Maps Lezer tags to the Fountain colour palette used by CineGen. */
const fountainHighlightStyle = HighlightStyle.define([
  { tag: tags.heading, color: '#7fb4ff', fontWeight: 'bold' },
  { tag: tags.heading2, color: '#6fc9a8', fontWeight: 'bold' },
  { tag: tags.labelName, color: '#ffd479', fontWeight: 'bold' },
  { tag: tags.string, color: '#e0e0e0' },
  { tag: tags.emphasis, color: '#9aba9a', fontStyle: 'italic' },
  { tag: tags.keyword, color: '#c9a0dc', fontWeight: 'bold' },
  { tag: tags.quote, color: '#8ec8ff', fontStyle: 'italic' },
  { tag: tags.content, color: '#c8c8c8' },
]);

export const cinegenFountainTheme = [
  cinegenDarkTheme,
  syntaxHighlighting(fountainHighlightStyle),
];
