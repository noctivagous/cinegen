export interface LibrarySourceProject {
  id: string;
  name: string;
  source: 'local' | 'cine';
  updatedAt: string;
  assetCounts: {
    characters: number;
    locations: number;
    props: number;
  };
}

export interface ImportedCharacter {
  id: string;
  srcId: string;
  name: string;
  role: string;
  description: string;
  selected: boolean;
}

export interface ImportedLocation {
  id: string;
  srcId: string;
  name: string;
  intExt: string;
  description: string;
  selected: boolean;
}

export interface ImportedProp {
  id: string;
  srcId: string;
  name: string;
  description: string;
  selected: boolean;
}

export interface AssetWizardState {
  projectId: string;
  sourceProjects: LibrarySourceProject[];
  selectedSourceId: string | null;
  sourceCharacters: ImportedCharacter[];
  sourceLocations: ImportedLocation[];
  sourceProps: ImportedProp[];
  sourceStyleNotes: string;
  sourceColorPalette: string[];
  sourceLightingMood: string;
  pendingCharacters: ImportedCharacter[];
  pendingLocations: ImportedLocation[];
  pendingProps: ImportedProp[];
  gapAnalysis: { missingChars: string[]; missingLocs: string[] };
  styleAdopted: boolean;
  scriptGenerated: boolean;
  sceneKitBuilt: boolean;
}

export function createEmptyAssetWizardState(): AssetWizardState {
  return {
    projectId: '',
    sourceProjects: [],
    selectedSourceId: null,
    sourceCharacters: [],
    sourceLocations: [],
    sourceProps: [],
    sourceStyleNotes: '',
    sourceColorPalette: [],
    sourceLightingMood: '',
    pendingCharacters: [],
    pendingLocations: [],
    pendingProps: [],
    gapAnalysis: { missingChars: [], missingLocs: [] },
    styleAdopted: false,
    scriptGenerated: false,
    sceneKitBuilt: false,
  };
}

let _idCounter = 0;

export function generateImportId(prefix: string): string {
  return `aw-${prefix}-${Date.now()}-${++_idCounter}`;
}
