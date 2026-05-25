import {
  resetVisualWizardState,
  getVisualWizardState,
  addUploadedImage,
  removeUploadedImage,
  setUploadCategory,
  getImagesByCategory,
  addDetectedCharacter,
  removeCharacter,
  updateCharacter,
  assignImageToCharacter,
  addDetectedLocation,
  removeLocation,
  updateLocation,
  assignImageToLocation,
  addDetectedProp,
  removeProp,
  updateProp,
  assignImageToProp,
  setVisualWizardProjectId,
  setVisualWizardColorPalette,
  setVisualWizardLightingMood,
  setVisualWizardStyleNotes,
  addColorToPalette,
  removeColorFromPalette,
  setScriptGenerated,
  setSceneKitBuilt,
  setStoryboardsGenerated,
  buildSceneKitPayload,
  buildGenerateOutlinePayload,
  collectCategoryImagesForIdentify,
  collectColorExtractionImages,
} from '@/wizard/visual-wizard-bundle';

export interface VisualWizardApi {
  reset: typeof resetVisualWizardState;
  getState: typeof getVisualWizardState;
  addImage: typeof addUploadedImage;
  removeImage: typeof removeUploadedImage;
  setCategory: typeof setUploadCategory;
  getImagesByCategory: typeof getImagesByCategory;
  addCharacter: typeof addDetectedCharacter;
  removeCharacter: typeof removeCharacter;
  updateCharacter: typeof updateCharacter;
  assignImageToChar: typeof assignImageToCharacter;
  addLocation: typeof addDetectedLocation;
  removeLocation: typeof removeLocation;
  updateLocation: typeof updateLocation;
  assignImageToLoc: typeof assignImageToLocation;
  addProp: typeof addDetectedProp;
  removeProp: typeof removeProp;
  updateProp: typeof updateProp;
  assignImageToProp: typeof assignImageToProp;
  setProjectId: typeof setVisualWizardProjectId;
  setPalette: typeof setVisualWizardColorPalette;
  setLightingMood: typeof setVisualWizardLightingMood;
  setStyleNotes: typeof setVisualWizardStyleNotes;
  addColor: typeof addColorToPalette;
  removeColor: typeof removeColorFromPalette;
  setScriptGenerated: typeof setScriptGenerated;
  setKitBuilt: typeof setSceneKitBuilt;
  setBoardsGenerated: typeof setStoryboardsGenerated;
  buildKitPayload: typeof buildSceneKitPayload;
  buildOutlinePayload: typeof buildGenerateOutlinePayload;
  getIdentifyImages: typeof collectCategoryImagesForIdentify;
  getColorImages: typeof collectColorExtractionImages;
}

export function initVisualWizard(): void {
  const api: VisualWizardApi = {
    reset: resetVisualWizardState,
    getState: getVisualWizardState,
    addImage: addUploadedImage,
    removeImage: removeUploadedImage,
    setCategory: setUploadCategory,
    getImagesByCategory,
    addCharacter: addDetectedCharacter,
    removeCharacter,
    updateCharacter,
    assignImageToChar: assignImageToCharacter,
    addLocation: addDetectedLocation,
    removeLocation,
    updateLocation,
    assignImageToLoc: assignImageToLocation,
    addProp: addDetectedProp,
    removeProp,
    updateProp,
    assignImageToProp,
    setProjectId: setVisualWizardProjectId,
    setPalette: setVisualWizardColorPalette,
    setLightingMood: setVisualWizardLightingMood,
    setStyleNotes: setVisualWizardStyleNotes,
    addColor: addColorToPalette,
    removeColor: removeColorFromPalette,
    setScriptGenerated,
    setKitBuilt: setSceneKitBuilt,
    setBoardsGenerated: setStoryboardsGenerated,
    buildKitPayload: buildSceneKitPayload,
    buildOutlinePayload: buildGenerateOutlinePayload,
    getIdentifyImages: collectCategoryImagesForIdentify,
    getColorImages: collectColorExtractionImages,
  };

  const w = window as any;
  if (!w.CineGen) w.CineGen = {};
  w.CineGen.visualWizard = api;
}
