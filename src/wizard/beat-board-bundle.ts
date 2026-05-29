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

/**
 * Generate a Fountain-format outline from beats, sync it to project state,
 * and map each beat to shots with cinematography parameters.
 */
export function applyBeatBoardSceneKit(projectId: string): {
  fountainText: string;
  scenesCreated: number;
  shotsCreated: number;
  charactersAdded: number;
  locationsAdded: number;
} {
  const s = _state;
  const beats = s.beats;
  const chars = s.characters;
  const locs = s.locations;

  // 1. Build Fountain outline from beats
  const lines: string[] = [];
  const usedLocs = new Set<string>();

  for (let i = 0; i < beats.length; i++) {
    const beat = beats[i];
    const loc = locs[i % locs.length]?.name || 'UNKNOWN LOCATION';
    const intExt = locs[i % locs.length]?.intExt || 'INT/EXT';
    const time = 'DAY'; // default; could be inferred from mood later
    usedLocs.add(loc);

    lines.push('');
    lines.push(`${intExt.toUpperCase()}. ${loc.toUpperCase()} — ${time}`);
    lines.push('');
    lines.push(`_${beat.title}_`);
    lines.push('');
    if (beat.description) {
      lines.push(beat.description);
      lines.push('');
    }
    if (beat.cameraNotes) {
      lines.push(`/* ${beat.cameraNotes} */`);
      lines.push('');
    }
  }

  const fountainText = lines.join('\n').trim();

  // 2. Sync to project via deterministic pipeline
  const { syncFountainToProject } = require('@/script/script-to-project') as typeof import('@/script/script-to-project');
  const syncResult = syncFountainToProject(fountainText, projectId);

  // 3. Enrich scenes with beat-to-shot mapping
  const { currentSceneData } = require('@/data/project-data') as typeof import('@/data/project-data');
  const scenes = Object.values(currentSceneData as Record<string, any>);
  let shotsCreated = syncResult.shotsCreated;

  for (let i = 0; i < beats.length && i < scenes.length; i++) {
    const beat = beats[i];
    const scene = scenes[i];
    if (!scene) continue;

    // Add beat-derived shots based on camera notes
    const camNotes = beat.cameraNotes?.toLowerCase() || '';
    const extraShots: any[] = [];
    const baseId = Date.now() + i * 100;

    if (camNotes.includes('close') || camNotes.includes('detail')) {
      extraShots.push({
        id: baseId,
        number: (scene.coverage?.length || 0) + 1,
        type: 'Insert',
        previsRole: 'coverage',
        label: `${beat.title} — Detail`,
        duration: formatPrevisDuration(beat.durationSeconds || 5),
        durationSeconds: beat.durationSeconds || 5,
        shotType: 'CU',
        cameraAngle: 'Eye-Level',
        cameraMovement: 'Static',
        lens: 'Medium (50mm)',
        lightingTechnique: 'Practical',
        composition: 'Depth of Field',
        status: 'planned',
        beatId: beat.id,
      });
    }
    if (camNotes.includes('wide') || camNotes.includes('establish')) {
      extraShots.push({
        id: baseId + 1,
        number: (scene.coverage?.length || 0) + 1,
        type: 'Coverage',
        previsRole: 'coverage',
        label: `${beat.title} — Wide`,
        duration: formatPrevisDuration(beat.durationSeconds || 5),
        durationSeconds: beat.durationSeconds || 5,
        shotType: 'WS',
        cameraAngle: 'High Angle',
        cameraMovement: 'Static',
        lens: 'Wide (14–24mm)',
        lightingTechnique: 'Hard',
        composition: 'Leading Lines',
        status: 'planned',
        beatId: beat.id,
      });
    }
    if (camNotes.includes('move') || camNotes.includes('track') || camNotes.includes('dolly')) {
      extraShots.push({
        id: baseId + 2,
        number: (scene.coverage?.length || 0) + 1,
        type: 'Coverage',
        previsRole: 'coverage',
        label: `${beat.title} — Tracking`,
        duration: formatPrevisDuration(beat.durationSeconds || 5),
        durationSeconds: beat.durationSeconds || 5,
        shotType: 'MS',
        cameraAngle: 'Eye-Level',
        cameraMovement: 'Tracking',
        lens: 'Standard (35mm)',
        lightingTechnique: 'Mixed',
        composition: 'Rule of Thirds',
        status: 'planned',
        beatId: beat.id,
      });
    }

    if (!extraShots.length) {
      // Default: at least one beat-specific shot
      extraShots.push({
        id: baseId,
        number: (scene.coverage?.length || 0) + 1,
        type: 'Coverage',
        previsRole: 'coverage',
        label: `${beat.title} — Beat ${i + 1}`,
        duration: formatPrevisDuration(beat.durationSeconds || 5),
        durationSeconds: beat.durationSeconds || 5,
        shotType: 'MS',
        cameraAngle: 'Eye-Level',
        cameraMovement: 'Static',
        lens: 'Standard (35mm)',
        lightingTechnique: 'Mixed',
        composition: 'Rule of Thirds',
        status: 'planned',
        beatId: beat.id,
      });
    }

    if (!scene.coverage) scene.coverage = [];
    scene.coverage.push(...extraShots);
    shotsCreated += extraShots.length;

    // Tag scene with beat metadata
    scene.beatTitle = beat.title;
    scene.beatDuration = beat.durationSeconds;
  }

  // 4. Add characters / locations to asset library
  const { assetLibrary: lib } = require('@/data/project-data') as typeof import('@/data/project-data');
  if (!lib.characters) lib.characters = [];
  if (!lib.locations) lib.locations = [];

  for (const c of chars) {
    lib.characters.push({
      id: c.id,
      name: c.name,
      role: 'supporting',
      desc: c.description || '',
      type: 'actor',
      usageRefs: [],
    });
  }
  for (const l of locs) {
    lib.locations.push({
      id: l.id,
      name: l.name,
      tags: l.intExt,
      desc: '',
      usageRefs: [],
    });
  }

  return {
    fountainText,
    scenesCreated: syncResult.sceneCount,
    shotsCreated,
    charactersAdded: chars.length,
    locationsAdded: locs.length,
  };
}

function formatPrevisDuration(seconds: number): string {
  return `${seconds}s`;
}
