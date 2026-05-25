import {
  createEmptyBeatBoardState,
  generateBeatId,
  generateBbCharId,
  generateBbLocId,
  type BeatBoardState,
  type BeatEntry,
  type BeatCharacter,
  type BeatLocation,
  type BeatReferenceItem,
} from '@/wizard/beat-board-state';

let _state: BeatBoardState = createEmptyBeatBoardState();

export function getBeatBoardState(): BeatBoardState {
  return _state;
}

export function resetBeatBoardState(): void {
  _state = createEmptyBeatBoardState();
}

export function setBeatBoardProjectId(id: string): void {
  _state.projectId = id;
}

export function addBeat(title: string, description: string, cameraNotes?: string): BeatEntry {
  const beat: BeatEntry = {
    id: generateBeatId(),
    order: _state.beats.length,
    title,
    description,
    durationSeconds: 5,
    cameraNotes,
    assetNeeds: [],
    linkedFrameIds: [],
  };
  _state.beats.push(beat);
  return beat;
}

export function removeBeat(id: string): void {
  _state.beats = _state.beats.filter((b) => b.id !== id);
}

export function reorderBeat(id: string, delta: number): void {
  const idx = _state.beats.findIndex((b) => b.id === id);
  if (idx < 0) return;
  const target = idx + delta;
  if (target < 0 || target >= _state.beats.length) return;
  const temp = _state.beats[idx];
  _state.beats[idx] = _state.beats[target];
  _state.beats[target] = temp;
}

export function updateBeat(id: string, partial: Partial<BeatEntry>): void {
  const b = _state.beats.find((x) => x.id === id);
  if (b) Object.assign(b, partial);
}

export function addBbCharacter(name: string, description?: string): BeatCharacter {
  const c: BeatCharacter = { id: generateBbCharId(), name, description: description || '' };
  _state.characters.push(c);
  return c;
}

export function removeBbCharacter(id: string): void {
  _state.characters = _state.characters.filter((c) => c.id !== id);
}

export function addBbLocation(name: string, intExt: BeatLocation['intExt'] = 'INT/EXT'): BeatLocation {
  const l: BeatLocation = { id: generateBbLocId(), name, intExt };
  _state.locations.push(l);
  return l;
}

export function removeBbLocation(id: string): void {
  _state.locations = _state.locations.filter((l) => l.id !== id);
}

export function setBbStyleMood(v: string): void {
  _state.styleMood = v;
}

export function setBbLightingMood(v: string): void {
  _state.lightingMood = v;
}

export function setBbColorPalette(colors: string[]): void {
  _state.colorPalette = colors;
}

export function setBbScriptOutline(text: string): void {
  _state.scriptOutline = text;
  _state.scriptGenerated = true;
}

export function setBbStoryboardsGenerated(count: number): void {
  _state.storyboardsGenerated = true;
  _state.storyboardFrameCount = count;
}

export function setBbSceneKitBuilt(): void {
  _state.sceneKitBuilt = true;
}

export function runBbReferenceSuggestion(): void {
  const queue: BeatReferenceItem[] = [];
  const allBeatText = _state.beats.map((b) => `${b.title} ${b.description} ${b.cameraNotes || ''}`).join(' ').toLowerCase();
  const charNames = _state.characters.map((c) => c.name.toLowerCase());
  const locNames = _state.locations.map((l) => l.name.toLowerCase());

  const commonWords = new Set(['the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'and', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'but', 'or', 'if', 'so', 'as', 'it', 'its', 'this', 'that', 'by', 'from', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'because', 'about']);

  const uniqueWords = [...new Set(allBeatText.split(/\s+/))].filter(
    (w) => w.length > 2 && !commonWords.has(w) && !charNames.includes(w) && !locNames.includes(w),
  );

  for (const word of uniqueWords.slice(0, 10)) {
    queue.push({ label: word, assetType: 'prop', priority: 5 });
  }

  _state.referenceQueue = queue;
}

export function buildBbOutlinePayload(): {
  beats: Array<{ title: string; description: string; cameraNotes?: string }>;
  characters: Array<{ name: string; description?: string }>;
  locations: Array<{ name: string; intExt?: string }>;
} {
  return {
    beats: _state.beats.map((b) => ({
      title: b.title,
      description: b.description,
      cameraNotes: b.cameraNotes,
    })),
    characters: _state.characters.map((c) => ({ name: c.name, description: c.description })),
    locations: _state.locations.map((l) => ({ name: l.name, intExt: l.intExt })),
  };
}

export function buildBbImportPayload(): {
  characters: BeatCharacter[];
  locations: BeatLocation[];
  style: { mood: string; lighting: string; palette: string[] };
} {
  return {
    characters: [..._state.characters],
    locations: [..._state.locations],
    style: {
      mood: _state.styleMood,
      lighting: _state.lightingMood,
      palette: [..._state.colorPalette],
    },
  };
}
