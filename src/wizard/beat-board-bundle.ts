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
import { applyWizardOutput } from '@/wizard/wizard-completion-hook';
import type { WizardOutput } from '@/wizard/wizard-output-types';

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
 *
 * Uses WizardOutput + applyWizardOutput() for canonical project mutation,
 * then applies beat-specific shot enrichment directly.
 */
export function applyBeatBoardSceneKit(): {
  output: WizardOutput;
  fountainText: string;
  shotsCreated: number;
} {
  const s = _state;
  const beats = s.beats;
  const chars = s.characters;
  const locs = s.locations;

  // 1. Build Fountain outline from beats
  const lines: string[] = [];

  for (let i = 0; i < beats.length; i++) {
    const beat = beats[i];
    const loc = locs[i % locs.length]?.name || 'UNKNOWN LOCATION';
    const intExt = locs[i % locs.length]?.intExt || 'INT/EXT';

    lines.push('');
    lines.push(`${intExt.toUpperCase()}. ${loc.toUpperCase()} — DAY`);
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

  // 2. Build scene overrides keyed by deterministic sceneId
  const sceneOverrides: Record<string, { beatTitle: string; beatDuration: number; cameraNotes: string }> = {};
  const beatEntries: import('@/wizard/wizard-output-types').BeatBoardEntry[] = [];

  for (let i = 0; i < beats.length; i++) {
    const beat = beats[i];
    const sceneId = `scene${String(i + 1).padStart(2, '0')}`;
    sceneOverrides[sceneId] = {
      beatTitle: beat.title,
      beatDuration: beat.durationSeconds || 5,
      cameraNotes: beat.cameraNotes || '',
    };
    beatEntries.push({
      id: beat.id,
      order: i,
      title: beat.title,
      description: beat.description,
      sceneId,
      characters: [],
      locationId: locs[i % locs.length]?.id,
      cameraNotes: beat.cameraNotes,
      durationSeconds: beat.durationSeconds || 5,
      assetNeeds: beat.assetNeeds || [],
    });
  }

  // 3. Gather mood board items from beat assetNeeds
  const moodBoardItems: import('@/wizard/wizard-output-types').WizardMoodBoardItem[] = [];
  for (const beat of beats) {
    for (const need of beat.assetNeeds || []) {
      if (!need.trim()) continue;
      moodBoardItems.push({
        type: 'text',
        label: need.trim(),
        source: need.trim(),
        notes: `Suggested by beat: ${beat.title}`,
      });
    }
  }

  // 4. Build and apply WizardOutput
  const output: WizardOutput = {
    fountainText,
    sceneOverrides,
    beatBoard: { entries: beatEntries },
    characters: chars.map((c) => ({
      id: c.id,
      name: c.name,
      role: 'supporting',
      description: c.description || '',
    })),
    locations: locs.map((l) => ({
      id: l.id,
      name: l.name,
      intExt: l.intExt,
    })),
    styleGuide: {
      lightingMood: s.lightingMood || undefined,
      visualTone: s.styleMood || undefined,
      colorPalette: s.colorPalette.length ? [...s.colorPalette] : undefined,
    },
    moodBoardItems: moodBoardItems.length ? moodBoardItems : undefined,
    featureBranches: ['production-office', 'scenes', 'casting', 'production-design', 'cinematography', 'mood-boards'],
  };

  applyWizardOutput(output);

  // 5. Beat-specific shot enrichment (richer than the generic camera-notes path in applyWizardOutput)
  const { currentSceneData } = require('@/data/project-data') as typeof import('@/data/project-data');
  const scenes = Object.values(currentSceneData as Record<string, any>);
  let shotsCreated = 0;

  for (let i = 0; i < beats.length && i < scenes.length; i++) {
    const beat = beats[i];
    const scene = scenes[i];
    if (!scene) continue;

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
        duration: `${beat.durationSeconds || 5}s`,
        durationSeconds: beat.durationSeconds || 5,
        shotType: 'CU', cameraAngle: 'Eye-Level', cameraMovement: 'Static',
        lens: 'Medium (50mm)', lightingTechnique: 'Practical', composition: 'Depth of Field',
        status: 'planned', beatId: beat.id,
      });
    }
    if (camNotes.includes('wide') || camNotes.includes('establish')) {
      extraShots.push({
        id: baseId + 1,
        number: (scene.coverage?.length || 0) + 1,
        type: 'Coverage',
        previsRole: 'coverage',
        label: `${beat.title} — Wide`,
        duration: `${beat.durationSeconds || 5}s`,
        durationSeconds: beat.durationSeconds || 5,
        shotType: 'WS', cameraAngle: 'High Angle', cameraMovement: 'Static',
        lens: 'Wide (14–24mm)', lightingTechnique: 'Hard', composition: 'Leading Lines',
        status: 'planned', beatId: beat.id,
      });
    }
    if (camNotes.includes('move') || camNotes.includes('track') || camNotes.includes('dolly')) {
      extraShots.push({
        id: baseId + 2,
        number: (scene.coverage?.length || 0) + 1,
        type: 'Coverage',
        previsRole: 'coverage',
        label: `${beat.title} — Tracking`,
        duration: `${beat.durationSeconds || 5}s`,
        durationSeconds: beat.durationSeconds || 5,
        shotType: 'MS', cameraAngle: 'Eye-Level', cameraMovement: 'Tracking',
        lens: 'Standard (35mm)', lightingTechnique: 'Mixed', composition: 'Rule of Thirds',
        status: 'planned', beatId: beat.id,
      });
    }

    if (!extraShots.length) {
      extraShots.push({
        id: baseId,
        number: (scene.coverage?.length || 0) + 1,
        type: 'Coverage',
        previsRole: 'coverage',
        label: `${beat.title} — Beat ${i + 1}`,
        duration: `${beat.durationSeconds || 5}s`,
        durationSeconds: beat.durationSeconds || 5,
        shotType: 'MS', cameraAngle: 'Eye-Level', cameraMovement: 'Static',
        lens: 'Standard (35mm)', lightingTechnique: 'Mixed', composition: 'Rule of Thirds',
        status: 'planned', beatId: beat.id,
      });
    }

    if (!scene.coverage) scene.coverage = [];
    scene.coverage.push(...extraShots);
    shotsCreated += extraShots.length;
  }

  return { output, fountainText, shotsCreated };
}
