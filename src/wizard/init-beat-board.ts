import {
  getBeatBoardState,
  resetBeatBoardState,
  setBeatBoardProjectId,
  addBeat,
  removeBeat,
  reorderBeat,
  updateBeat,
  addBbCharacter,
  removeBbCharacter,
  addBbLocation,
  removeBbLocation,
  setBbStyleMood,
  setBbLightingMood,
  setBbColorPalette,
  runBbReferenceSuggestion,
  setBbScriptOutline,
  setBbStoryboardsGenerated,
  setBbSceneKitBuilt,
  buildBbOutlinePayload,
  buildBbImportPayload,
} from '@/wizard/beat-board-bundle';

export interface BeatBoardApi {
  reset: () => void;
  getState: () => ReturnType<typeof getBeatBoardState>;
  setProjectId: (id: string) => void;
  addBeat: (title: string, desc: string, cameraNotes?: string) => ReturnType<typeof addBeat>;
  removeBeat: (id: string) => void;
  reorderBeat: (id: string, delta: number) => void;
  updateBeat: (id: string, partial: Record<string, unknown>) => void;
  addCharacter: (name: string, desc?: string) => ReturnType<typeof addBbCharacter>;
  removeCharacter: (id: string) => void;
  addLocation: (name: string, intExt?: string) => ReturnType<typeof addBbLocation>;
  removeLocation: (id: string) => void;
  setStyleMood: (v: string) => void;
  setLightingMood: (v: string) => void;
  setColorPalette: (colors: string[]) => void;
  runReferenceSuggestion: () => void;
  setScriptOutline: (text: string) => void;
  setStoryboardsGenerated: (count: number) => void;
  setKitBuilt: () => void;
  buildOutlinePayload: () => ReturnType<typeof buildBbOutlinePayload>;
  buildImportPayload: () => ReturnType<typeof buildBbImportPayload>;
}

export function initBeatBoard(): void {
  const api: BeatBoardApi = {
    reset: resetBeatBoardState,
    getState: getBeatBoardState,
    setProjectId: setBeatBoardProjectId,
    addBeat,
    removeBeat,
    reorderBeat,
    updateBeat: updateBeat as any,
    addCharacter: addBbCharacter,
    removeCharacter: removeBbCharacter,
    addLocation: (name: string, intExt?: string) => addBbLocation(name, (intExt || 'INT/EXT') as any),
    removeLocation: removeBbLocation,
    setStyleMood: setBbStyleMood,
    setLightingMood: setBbLightingMood,
    setColorPalette: setBbColorPalette,
    runReferenceSuggestion: runBbReferenceSuggestion,
    setScriptOutline: setBbScriptOutline,
    setStoryboardsGenerated: setBbStoryboardsGenerated,
    setKitBuilt: setBbSceneKitBuilt,
    buildOutlinePayload: buildBbOutlinePayload,
    buildImportPayload: buildBbImportPayload,
  };

  const w = window as any;
  if (!w.CineGen) w.CineGen = {};
  w.CineGen.beatBoard = api;
}
