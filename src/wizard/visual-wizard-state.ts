export type VisualWizardImageCategory =
  | 'character'
  | 'mood-board'
  | 'location'
  | 'prop'
  | 'style-reference';

export interface VisualWizardUpload {
  id: string;
  file?: File;
  dataUrl: string;
  name: string;
  category: VisualWizardImageCategory;
  tags: string[];
}

export interface VisualWizardCharacter {
  id: string;
  name: string;
  role: 'protagonist' | 'antagonist' | 'supporting' | 'extra';
  faceImage: VisualWizardUpload | null;
  profileImage: VisualWizardUpload | null;
  threeQuarterImage: VisualWizardUpload | null;
  fullBodyImage: VisualWizardUpload | null;
  age: string;
  build: string;
  vibe: string;
}

export interface VisualWizardLocation {
  id: string;
  name: string;
  exteriorImages: VisualWizardUpload[];
  interiorImages: VisualWizardUpload[];
  isInterior: boolean;
  intExt: 'INT' | 'EXT' | 'INT/EXT';
  description: string;
}

export interface VisualWizardProp {
  id: string;
  name: string;
  image: VisualWizardUpload | null;
  description: string;
}

export interface VisualWizardState {
  projectId: string | null;
  uploadedImages: VisualWizardUpload[];
  characters: VisualWizardCharacter[];
  locations: VisualWizardLocation[];
  props: VisualWizardProp[];
  colorPalette: string[];
  lightingMood: string;
  styleNotes: string;
  scriptGenerated: boolean;
  scriptOutline: string;
  sceneKitBuilt: boolean;
  storyboardsGenerated: boolean;
  storyboardFrameCount: number;
}

export function createEmptyVisualWizardState(): VisualWizardState {
  return {
    projectId: null,
    uploadedImages: [],
    characters: [],
    locations: [],
    props: [],
    colorPalette: [],
    lightingMood: '',
    styleNotes: '',
    scriptGenerated: false,
    scriptOutline: '',
    sceneKitBuilt: false,
    storyboardsGenerated: false,
    storyboardFrameCount: 0,
  };
}

export function generateImageId(): string {
  return `vw-img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function generateCharId(): string {
  return `vw-char-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function generateLocId(): string {
  return `vw-loc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function generatePropId(): string {
  return `vw-prop-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
