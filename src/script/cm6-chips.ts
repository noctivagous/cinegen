import { ViewPlugin, ViewUpdate, EditorView, Decoration } from '@codemirror/view';
import { RangeSetBuilder, Compartment } from '@codemirror/state';
import { classifyFountainDocument } from './fountain-bundle';
import { assetLibrary, breakdownData } from '@/data/project-data';

// ==================== TYPES ====================

interface ChipToken {
  text: string;
  type: string;
}

interface ChipMatch {
  from: number;
  to: number;
  type: string;
  text: string;
}

// ==================== HELPERS ====================

function normalizeEntityName(value: string): string {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function escapeRegExp(value: string): string {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function uniqueByName(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeEntityName(value);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function characterMatchAliases(name: string): string[] {
  const normalized = normalizeEntityName(name);
  if (!normalized) return [];
  const withoutParens = normalized.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const aliases = [normalized];
  if (withoutParens && withoutParens !== normalized) aliases.push(withoutParens);
  if (withoutParens) aliases.push(withoutParens.toUpperCase());
  return uniqueByName(aliases);
}

function splitEntityValue(value: string): string[] {
  return value.split(',').map(normalizeEntityName).filter(Boolean);
}

function collectBreakdownFieldValues(field: string): string[] {
  return uniqueByName(
    breakdownData.flatMap((row: any) => splitEntityValue(row[field] as string))
  );
}

/** Screenplay slug prefixes — always rendered as chips */
const FOUNTAIN_SLUG_CONVENTIONS = [
  'INT./EXT.',
  'INT/EXT.',
  'INT.',
  'EXT.',
  'EST.',
  'I/E.',
];

// ==================== TOKEN BUILDING ====================

function getScriptEntities(): { characters: string[]; locations: string[] } {
  const fn = (window as any).extractScriptEntities;
  if (typeof fn === 'function') {
    return fn() as { characters: string[]; locations: string[] };
  }
  return { characters: [], locations: [] };
}

function getProjectRegistryMatchTokens(): ChipToken[] {
  const tokens: ChipToken[] = [];

  // Slugs
  FOUNTAIN_SLUG_CONVENTIONS.forEach((text) => tokens.push({ text, type: 'slug' }));

  // Characters
  const scriptEntities = getScriptEntities();
  const characterNames = uniqueByName([
    ...assetLibrary.characters.map((item: any) => String(item.name)),
    ...scriptEntities.characters,
  ]);
  characterNames.forEach((name) => {
    characterMatchAliases(name).forEach((text) => {
      tokens.push({ text, type: 'character' });
    });
  });

  // Locations
  const locationNames = uniqueByName([
    ...assetLibrary.locations.map((item: any) => String(item.name)),
    ...collectBreakdownFieldValues('location'),
    ...scriptEntities.locations,
  ]);
  locationNames.forEach((name) => tokens.push({ text: name, type: 'location' }));

  // Props
  assetLibrary.props.forEach((item: any) => {
    tokens.push({ text: String(item.name), type: 'prop' });
  });

  // Vehicles
  assetLibrary.vehicles.forEach((item: any) => {
    tokens.push({ text: String(item.name), type: 'vehicle' });
  });

  // Effects / SFX
  const effectNames = uniqueByName([
    ...assetLibrary.effects.map((item: any) => String(item.name)),
    ...collectBreakdownFieldValues('sfx'),
  ]);
  effectNames.forEach((name) => tokens.push({ text: name, type: 'effect' }));

  // Wardrobe
  const wardrobeNames = uniqueByName([...collectBreakdownFieldValues('wardrobe')]);
  wardrobeNames.forEach((name) => tokens.push({ text: name, type: 'wardrobe' }));

  // Sort by length descending so longer tokens match first
  return tokens.sort((a, b) => b.text.length - a.text.length);
}

// ==================== MATCHING ====================

function findNonOverlappingMatches(text: string, tokens: ChipToken[]): ChipMatch[] {
  const matches: ChipMatch[] = [];
  for (const token of tokens) {
    if (!token.text) continue;
    const pattern =
      token.type === 'slug'
        ? escapeRegExp(token.text)
        : `\\b${escapeRegExp(token.text)}\\b`;
    const re = new RegExp(pattern, 'gi');
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      matches.push({
        from: match.index,
        to: match.index + match[0].length,
        text: match[0],
        type: token.type,
      });
    }
  }

  matches.sort((a, b) => a.from - b.from || (b.to - b.from) - (a.to - a.from));
  const kept: ChipMatch[] = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.from < cursor) continue;
    kept.push(m);
    cursor = m.to;
  }
  return kept;
}

// ==================== DECORATION BUILDING ====================

function buildChipDecorations(view: EditorView): ReturnType<RangeSetBuilder<Decoration>['finish']> {
  const tokens = getProjectRegistryMatchTokens();
  if (!tokens.length) return Decoration.none;

  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;
  const text = doc.toString();
  const lines = text.split('\n');
  const lineTypes = classifyFountainDocument(lines);

  let docOffset = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineType = lineTypes[i];

    if (lineType === 'character') {
      const m = line.match(/^(\s*)(.*?)(\s*)$/);
      if (m && m[2]) {
        const lead = m[1].length;
        const core = m[2];
        const coreLower = core.toLowerCase();
        const charTokens = tokens.filter((t) => t.type === 'character');
        let matched = false;
        for (const token of charTokens) {
          if (characterMatchAliases(token.text).some((a) => a.toLowerCase() === coreLower)) {
            builder.add(
              docOffset + lead,
              docOffset + lead + core.length,
              Decoration.mark({
                class: 'cm-chip cm-chip--character',
                attributes: {
                  'data-chip-type': 'character',
                  'data-chip-label': encodeURIComponent(core),
                },
              })
            );
            matched = true;
            break;
          }
        }
        if (!matched) {
          // Still decorate if the raw cue matches a character token
          const matches = findNonOverlappingMatches(line, charTokens);
          for (const match of matches) {
            builder.add(
              docOffset + match.from,
              docOffset + match.to,
              Decoration.mark({
                class: `cm-chip cm-chip--${match.type}`,
                attributes: {
                  'data-chip-type': match.type,
                  'data-chip-label': encodeURIComponent(match.text),
                },
              })
            );
          }
        }
      }
    } else {
      const matches = findNonOverlappingMatches(line, tokens);
      for (const match of matches) {
        builder.add(
          docOffset + match.from,
          docOffset + match.to,
          Decoration.mark({
            class: `cm-chip cm-chip--${match.type}`,
            attributes: {
              'data-chip-type': match.type,
              'data-chip-label': encodeURIComponent(match.text),
            },
          })
        );
      }
    }

    docOffset += line.length + 1; // +1 for newline
  }

  return builder.finish();
}

// ==================== VIEW PLUGIN ====================

const chipViewPlugin = ViewPlugin.fromClass(
  class {
    decorations: ReturnType<typeof buildChipDecorations>;
    constructor(view: EditorView) {
      this.decorations = buildChipDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged) {
        this.decorations = buildChipDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

// ==================== COMPARTMENT (dynamic enable/disable) ====================

const chipCompartment = new Compartment();

export function createChipExtension() {
  return [chipViewPlugin];
}

/** Call inside `createScriptEditor` extensions array. */
export function chipsExtension() {
  return chipCompartment.of(createChipExtension());
}

/** Toggle chips on/off at runtime. */
export function setChipsEnabled(view: EditorView, enabled: boolean): void {
  view.dispatch({
    effects: chipCompartment.reconfigure(enabled ? createChipExtension() : []),
  });
}
