export interface BeatEntry {
  id: string;
  order: number;
  title: string;
  description: string;
  durationSeconds: number;
  cameraNotes?: string;
  assetNeeds: string[];
  linkedFrameIds: number[];
}

export interface BeatCharacter {
  id: string;
  name: string;
  description: string;
}

export interface BeatLocation {
  id: string;
  name: string;
  intExt: 'INT' | 'EXT' | 'INT/EXT';
}

export interface BeatReferenceItem {
  label: string;
  assetType: 'character' | 'location' | 'prop' | 'plate';
  priority: number;
}

export interface BeatBoardState {
  projectId: string | null;
  beats: BeatEntry[];
  characters: BeatCharacter[];
  locations: BeatLocation[];
  styleMood: string;
  lightingMood: string;
  colorPalette: string[];
  scriptOutline: string;
  scriptGenerated: boolean;
  storyboardsGenerated: boolean;
  storyboardFrameCount: number;
  sceneKitBuilt: boolean;
  referenceQueue: BeatReferenceItem[];
  generationStatus: 'idle' | 'generating' | 'ready' | 'error';
}

export function createEmptyBeatBoardState(): BeatBoardState {
  return {
    projectId: null,
    beats: [],
    characters: [],
    locations: [],
    styleMood: '',
    lightingMood: '',
    colorPalette: [],
    scriptOutline: '',
    scriptGenerated: false,
    storyboardsGenerated: false,
    storyboardFrameCount: 0,
    sceneKitBuilt: false,
    referenceQueue: [],
    generationStatus: 'idle',
  };
}

let _idCounter = 0;

export function generateBeatId(): string {
  return `bb-beat-${Date.now().toString(36)}-${++_idCounter}`;
}

export function generateBbCharId(): string {
  return `bb-char-${Date.now().toString(36)}-${++_idCounter}`;
}

export function generateBbLocId(): string {
  return `bb-loc-${Date.now().toString(36)}-${++_idCounter}`;
}
