import { ViewPlugin, ViewUpdate, EditorView, Decoration } from '@codemirror/view';
import { RangeSetBuilder, Compartment } from '@codemirror/state';
import { storyboardFrames } from '@/data/project-data';

// ==================== HELPERS ====================

function escapeRegExp(value: string): string {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getScriptAnchorTokens(): { text: string; type: 'anchor' }[] {
  const seen = new Set<string>();
  const tokens: { text: string; type: 'anchor' }[] = [];

  for (const frame of storyboardFrames) {
    const text = String(frame.scriptLink || '').trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tokens.push({ text, type: 'anchor' });
  }

  // Longest first so shorter substrings don't mask longer ones
  return tokens.sort((a, b) => b.text.length - a.text.length);
}

function findAnchorMatches(text: string, tokens: { text: string; type: 'anchor' }[]) {
  const matches: { from: number; to: number; text: string }[] = [];
  const lower = text.toLowerCase();

  for (const token of tokens) {
    const search = token.text.toLowerCase();
    if (!search) continue;
    let idx = 0;
    while ((idx = lower.indexOf(search, idx)) !== -1) {
      matches.push({
        from: idx,
        to: idx + token.text.length,
        text: text.slice(idx, idx + token.text.length),
      });
      idx += search.length;
    }
  }

  matches.sort((a, b) => a.from - b.from || (b.to - b.from) - (a.to - a.from));

  const kept: typeof matches = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.from < cursor) continue;
    kept.push(m);
    cursor = m.to;
  }

  return kept;
}

// ==================== DECORATION BUILDING ====================

function buildAnchorDecorations(view: EditorView): ReturnType<RangeSetBuilder<Decoration>['finish']> {
  const tokens = getScriptAnchorTokens();
  if (!tokens.length) return Decoration.none;

  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;
  const text = doc.toString();
  const matches = findAnchorMatches(text, tokens);

  for (const match of matches) {
    builder.add(
      match.from,
      match.to,
      Decoration.mark({
        class: 'cm-anchor',
        attributes: { title: 'Storyboard anchor' },
      })
    );
  }

  return builder.finish();
}

// ==================== VIEW PLUGIN ====================

const anchorViewPlugin = ViewPlugin.fromClass(
  class {
    decorations: ReturnType<typeof buildAnchorDecorations>;
    constructor(view: EditorView) {
      this.decorations = buildAnchorDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged) {
        this.decorations = buildAnchorDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

// ==================== COMPARTMENT ====================

const anchorCompartment = new Compartment();

function createAnchorExtension() {
  return [anchorViewPlugin];
}

/** Call inside `createScriptEditor` extensions array. */
export function anchorsExtension() {
  return anchorCompartment.of(createAnchorExtension());
}

/** Toggle anchors on/off at runtime. */
export function setAnchorsEnabled(view: EditorView, enabled: boolean): void {
  view.dispatch({
    effects: anchorCompartment.reconfigure(enabled ? createAnchorExtension() : []),
  });
}
