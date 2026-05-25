export type ConceptWizardImageCategory = 'mood-board' | 'style-reference' | 'background-plate' | 'other';

export interface ConceptWizardUpload {
  id: string;
  file?: File;
  dataUrl: string;
  name: string;
  category: ConceptWizardImageCategory;
  tags: string[];
}

export interface ConceptWizardVibe {
  temperature: number;
  tension: number;
  lighting: number;
  energy: number;
  stylization: number;
}

export interface ConceptGeneratedImage {
  id: string;
  prompt: string;
  url: string;
  category: 'style-reference' | 'background-plate' | 'mood-board';
}

export interface ConceptLocation {
  id: string;
  name: string;
  description: string;
  intExt: 'INT' | 'EXT' | 'INT/EXT';
  generatedImageId?: string;
}

export interface ConceptArchetype {
  id: string;
  archetype: string;
  name: string;
  description: string;
  vibe: string;
  role: 'protagonist' | 'antagonist' | 'supporting' | 'extra';
}

export interface ConceptWizardState {
  projectId: string;
  moodDescription: string;
  uploadedImages: ConceptWizardUpload[];
  colorPalette: string[];
  sceneSettings: string;
  lightingDesc: string;
  atmosphereNotes: string;
  atmosphereTags: string[];
  currentVibe: ConceptWizardVibe;
  generatedAtmosphereTags: string[];
  generatedVibe: ConceptWizardVibe;
  generatedColorPalette: string[];
  lightingMood: string;
  styleNotes: string;
  generatedImages: ConceptGeneratedImage[];
  locations: ConceptLocation[];
  archetypes: ConceptArchetype[];
  generationPrompts: string[];
  scriptOutline: string;
  sceneKitBuilt: boolean;
  conceptsGenerating: boolean;
}

export function createEmptyConceptWizardState(): ConceptWizardState {
  return {
    projectId: '',
    moodDescription: '',
    uploadedImages: [],
    colorPalette: [],
    sceneSettings: '',
    lightingDesc: '',
    atmosphereNotes: '',
    atmosphereTags: [],
    currentVibe: {
      temperature: 0,
      tension: 0,
      lighting: 0,
      energy: 0,
      stylization: 50,
    },
    generatedAtmosphereTags: [],
    generatedVibe: { temperature: 0, tension: 0, lighting: 0, energy: 0, stylization: 50 },
    generatedColorPalette: [],
    lightingMood: '',
    styleNotes: '',
    generatedImages: [],
    locations: [],
    archetypes: [],
    generationPrompts: [],
    scriptOutline: '',
    sceneKitBuilt: false,
    conceptsGenerating: false,
  };
}

let _idCounter = 0;

export function generateUploadId(): string {
  return `cw-up-${Date.now()}-${++_idCounter}`;
}

export function generateLocationId(): string {
  return `cw-loc-${Date.now()}-${++_idCounter}`;
}

export function generateArchetypeId(): string {
  return `cw-arch-${Date.now()}-${++_idCounter}`;
}

export function generateImageId(): string {
  return `cw-img-${Date.now()}-${++_idCounter}`;
}
