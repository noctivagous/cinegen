export interface ScriptWizardCharacter {
  name: string;
  age: string;
  build: string;
  vibe: string;
}

export interface ScriptWizardLocation {
  name: string;
  description: string;
  isInterior: boolean;
}

export interface ScriptWizardState {
  projectId: string | null;
  scriptText: string;
  detectedCharacters: string[];
  detectedLocations: string[];
  characters: ScriptWizardCharacter[];
  locations: ScriptWizardLocation[];
  styleNotes: string;
  referencesGenerated: boolean;
  references: Array<{ label: string; imageUrl?: string; category: string }>;
  storyboardsGenerated: boolean;
  storyboardFrameCount: number;
}

export function createEmptyScriptWizardState(): ScriptWizardState {
  return {
    projectId: null,
    scriptText: '',
    detectedCharacters: [],
    detectedLocations: [],
    characters: [],
    locations: [],
    styleNotes: '',
    referencesGenerated: false,
    references: [],
    storyboardsGenerated: false,
    storyboardFrameCount: 0,
  };
}

export const scriptWizardState: ScriptWizardState = createEmptyScriptWizardState();

export function resetScriptWizardState(): void {
  Object.assign(scriptWizardState, createEmptyScriptWizardState());
}

function uniqueByName(names: string[]): string[] {
  const seen = new Set<string>();
  return names.filter((n) => {
    const key = n.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function extractEntitiesFromText(text: string): { characters: string[]; locations: string[] } {
  const lines = text.split('\n');
  const characters: string[] = [];
  const locations: string[] = [];

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (/^[A-Z][A-Z0-9 .'\-()]+$/.test(trimmed) && trimmed.length <= 40) {
      const cleaned = trimmed.replace(/\s*\([^)]*\)\s*$/, '').trim();
      if (cleaned && !characters.includes(cleaned)) characters.push(cleaned);
    }
    if (/^\s*(INT\.?|EXT\.?|EST\.?|INT\/EXT\.?|I\/E\.?)\s+/i.test(trimmed)) {
      let slug = trimmed.replace(/^(INT\.?|EXT\.?|EST\.?|INT\/EXT\.?|I\/E\.?)\s*/i, '').trim();
      slug = slug.split(/\s+-\s+/)[0].trim();
      if (slug && !locations.includes(slug)) locations.push(slug);
    }
  });

  return { characters: uniqueByName(characters), locations: uniqueByName(locations) };
}

export function inferInteriorFromName(name: string, scriptText: string): boolean {
  const re = new RegExp(`^\\s*(INT\\.?|EXT\\.?)\\s+${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'im');
  const match = scriptText.match(re);
  if (match) return /^INT/i.test(match[1]);
  return false;
}
