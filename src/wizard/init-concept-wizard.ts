import {
  getConceptWizardState,
  resetConceptWizardState,
  setConceptWizardProjectId,
  setMoodDescription,
  setSceneSettings,
  setLightingDesc,
  setAtmosphereNotes,
  setVibe,
  addAtmosphereTag,
  removeAtmosphereTag,
  addColorToPalette,
  removeColorFromPalette,
  addUploadedImage,
  removeUploadedImage,
  setUploadCategory,
  getImagesByCategory,
  setConceptsGenerating,
  applyGeneratedConcepts,
  addGeneratedImage,
  addLocation,
  removeLocation,
  updateLocation,
  assignPlateToLocation,
  addArchetype,
  removeArchetype,
  updateArchetype,
  setGenerationPrompts,
  setScriptOutline,
  setSceneKitBuilt,
  buildConceptPayload,
  buildScriptOutlinePayload,
} from '@/wizard/concept-wizard-bundle';

export interface ConceptWizardApi {
  reset: () => void;
  getState: () => ReturnType<typeof getConceptWizardState>;
  setProjectId: (id: string) => void;
  setMoodDescription: (text: string) => void;
  setSceneSettings: (text: string) => void;
  setLightingDesc: (text: string) => void;
  setAtmosphereNotes: (text: string) => void;
  setVibe: (partial: Record<string, number>) => void;
  addAtmosphereTag: (tag: string) => void;
  removeAtmosphereTag: (tag: string) => void;
  addColor: (color: string) => void;
  removeColor: (color: string) => void;
  addImage: (file: File, category: string) => Promise<unknown>;
  removeImage: (id: string) => void;
  setImageCategory: (id: string, category: string) => void;
  getImagesByCategory: (category: string) => unknown[];
  setGenerating: (v: boolean) => void;
  applyConcepts: (data: Record<string, unknown>) => void;
  addGeneratedImage: (prompt: string, url: string, category: string) => void;
  addLocation: (name: string, intExt: string) => unknown;
  removeLocation: (id: string) => void;
  updateLocation: (id: string, partial: Record<string, unknown>) => void;
  assignPlateToLocation: (locId: string, imageId: string) => void;
  addArchetype: (archetype: string, name: string) => unknown;
  removeArchetype: (id: string) => void;
  updateArchetype: (id: string, partial: Record<string, unknown>) => void;
  setGenerationPrompts: (prompts: string[]) => void;
  setScriptOutline: (outline: string) => void;
  setKitBuilt: () => void;
  buildConceptPayload: () => ReturnType<typeof buildConceptPayload>;
  buildOutlinePayload: () => ReturnType<typeof buildScriptOutlinePayload>;
}

export function initConceptWizard(): void {
  const api: ConceptWizardApi = {
    reset: resetConceptWizardState,
    getState: getConceptWizardState,
    setProjectId: setConceptWizardProjectId,
    setMoodDescription,
    setSceneSettings,
    setLightingDesc,
    setAtmosphereNotes,
    setVibe,
    addAtmosphereTag,
    removeAtmosphereTag,
    addColor: addColorToPalette,
    removeColor: removeColorFromPalette,
    addImage: (file: File, category: string) => addUploadedImage(file, category as any),
    removeImage: removeUploadedImage,
    setImageCategory: (id: string, category: string) => setUploadCategory(id, category as any),
    getImagesByCategory: (category: string) => getImagesByCategory(category as any),
    setGenerating: setConceptsGenerating,
    applyConcepts: applyGeneratedConcepts as any,
    addGeneratedImage: (prompt: string, url: string, category: string) => addGeneratedImage(prompt, url, category as any),
    addLocation: (name: string, intExt: string) => addLocation(name, intExt as any),
    removeLocation,
    updateLocation,
    assignPlateToLocation,
    addArchetype,
    removeArchetype,
    updateArchetype,
    setGenerationPrompts,
    setScriptOutline,
    setKitBuilt: setSceneKitBuilt,
    buildConceptPayload,
    buildOutlinePayload: buildScriptOutlinePayload,
  };

  const w = window as any;
  if (!w.CineGen) w.CineGen = {};
  w.CineGen.conceptWizard = api;
}
