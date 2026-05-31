import { StreamLanguage } from '@codemirror/language';
import { tags } from '@lezer/highlight';

/** CM6 StreamParser for Fountain screenplay format.
 *  Re-uses the regex logic from classifyFountainLine / classifyFountainDocument
 *  but maps each line to a CM6 syntax tag for highlight styling.
 */

type ParserState = { mode: 'action' | 'dialogue' };

function classifyLine(trimmed: string): string {
  if (/^={3,}\s*$/.test(trimmed)) return 'section';
  if (/^\./.test(trimmed)) return 'scene';
  if (/^(INT|EXT|EST|INT\/EXT|I\/E)[. \t\/]/i.test(trimmed)) return 'scene';
  if (/^\(.+\)$/.test(trimmed)) return 'parenthetical';
  if (/^>[ \t]/.test(trimmed)) return 'transition';
  if (/^~/.test(trimmed)) return 'lyrics';
  if (/TO:\s*$/.test(trimmed) && trimmed === trimmed.toUpperCase() && trimmed.length < 48) {
    return 'transition';
  }

  const withoutAt = trimmed.replace(/^@\s*/, '');
  const charCore = withoutAt.replace(/\s*\([^)]*\)\s*$/, '').trim();
  if (
    charCore.length >= 2 &&
    charCore.length < 42 &&
    !/[a-z]/.test(charCore) &&
    /^[A-Z][A-Z0-9\s.\-_'"]*$/.test(charCore) &&
    !/^(INT|EXT|EST)/i.test(charCore)
  ) {
    return 'character';
  }
  return 'action';
}

/** Maps a Fountain line classification to a Lezer highlight tag.
 *  These tags are consumed by the HighlightStyle in cm6-theme.ts.
 */
function lineToTag(base: string, state: ParserState): string | null {
  if (base === 'scene' || base === 'transition') {
    state.mode = 'action';
    return base === 'scene' ? 'heading' : 'keyword';
  }
  if (base === 'character') {
    state.mode = 'dialogue';
    return 'labelName';
  }
  if (base === 'parenthetical') {
    if (state.mode !== 'dialogue') state.mode = 'action';
    return 'emphasis';
  }
  if (state.mode === 'dialogue' && base === 'action') {
    return 'string';
  }
  if (base === 'section') {
    state.mode = 'action';
    return 'heading2';
  }
  if (base === 'lyrics') {
    state.mode = 'action';
    return 'quote';
  }
  return 'content';
}

export const fountainLanguage = StreamLanguage.define<ParserState>({
  name: 'fountain',
  startState() {
    return { mode: 'action' };
  },
  token(stream, state) {
    if (stream.eol()) {
      stream.next();
      return null;
    }
    const trimmed = stream.string.trim();
    if (!trimmed) {
      if (state.mode === 'dialogue') state.mode = 'action';
      stream.skipToEnd();
      return null;
    }
    const base = classifyLine(trimmed);
    const tag = lineToTag(base, state);
    stream.skipToEnd();
    return tag;
  },
  languageData: {
    commentTokens: { line: false, block: { open: '[[', close: ']]' } },
  },
});
