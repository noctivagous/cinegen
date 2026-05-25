import {
  getAssetWizardState,
  resetAssetWizardState,
  setAssetWizardProjectId,
  refreshProjectList,
  selectSourceProject,
  toggleCharacter,
  toggleLocation,
  toggleProp,
  updateCharacter,
  updateLocation,
  updateProp,
  removeCharacter,
  removeLocation,
  removeProp,
  setStyleAdopted,
  runGapAnalysis,
  setScriptGenerated,
  setSceneKitBuilt,
  buildOutlinePayload,
  buildImportPayload,
} from '@/wizard/asset-wizard-bundle';

export interface AssetWizardApi {
  reset: () => void;
  getState: () => ReturnType<typeof getAssetWizardState>;
  setProjectId: (id: string) => void;
  refreshProjectList: () => void;
  selectSource: (sourceId: string) => void;
  toggleChar: (id: string) => void;
  toggleLoc: (id: string) => void;
  toggleProp: (id: string) => void;
  updateChar: (id: string, partial: Record<string, unknown>) => void;
  updateLoc: (id: string, partial: Record<string, unknown>) => void;
  updateProp: (id: string, partial: Record<string, unknown>) => void;
  removeChar: (id: string) => void;
  removeLoc: (id: string) => void;
  removeProp: (id: string) => void;
  setStyleAdopted: (v: boolean) => void;
  runGapAnalysis: (scriptText: string) => void;
  setScriptGenerated: () => void;
  setKitBuilt: () => void;
  buildOutlinePayload: () => ReturnType<typeof buildOutlinePayload>;
  buildImportPayload: () => ReturnType<typeof buildImportPayload>;
}

export function initAssetWizard(): void {
  const api: AssetWizardApi = {
    reset: resetAssetWizardState,
    getState: getAssetWizardState,
    setProjectId: setAssetWizardProjectId,
    refreshProjectList,
    selectSource: selectSourceProject,
    toggleChar: toggleCharacter,
    toggleLoc: toggleLocation,
    toggleProp,
    updateChar: updateCharacter,
    updateLoc: updateLocation,
    updateProp,
    removeChar: removeCharacter,
    removeLoc: removeLocation,
    removeProp,
    setStyleAdopted,
    runGapAnalysis,
    setScriptGenerated,
    setKitBuilt: setSceneKitBuilt,
    buildOutlinePayload,
    buildImportPayload,
  };

  const w = window as any;
  if (!w.CineGen) w.CineGen = {};
  w.CineGen.assetWizard = api;
}
