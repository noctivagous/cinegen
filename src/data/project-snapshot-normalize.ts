/**
 * Central normalizers for AppliedCineProject snapshots on load.
 * Fills missing required fields with safe defaults before runtime state is applied.
 */
import type { AppliedCineProject } from '@/data/cine-project-loader';
import { DEFAULT_FOUNTAIN_SCRIPT } from '@/data/default-fountain-script';
import { buildBlankProjectFeaturesConfig } from '@/tree/project-feature-catalog';
import type { MoodBoard } from '@/data/project-data';

function normalizeMoodBoardsSnapshot(raw: unknown): MoodBoard[] {
  if (!Array.isArray(raw)) return [];
  const boards: MoodBoard[] = [];
  for (const b of raw) {
    if (!b || typeof b !== 'object') continue;
    const board = b as Partial<MoodBoard> & Record<string, unknown>;
    const id = typeof board.id === 'string' ? board.id : '';
    const name = typeof board.name === 'string' ? board.name : '';
    if (!id || !name) continue;
    boards.push({
      id,
      name,
      items: Array.isArray(board.items) ? board.items : [],
      viewMode: board.viewMode === 'kanban' ? 'kanban' : 'grid',
      createdAt: typeof board.createdAt === 'number' ? board.createdAt : Date.now(),
      updatedAt: typeof board.updatedAt === 'number' ? board.updatedAt : Date.now(),
    });
  }
  return boards;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeAssetLibrary(raw: unknown): Record<string, unknown> {
  const source = asObject(raw);
  return {
    characters: asArray(source.characters),
    locations: asArray(source.locations),
    props: asArray(source.props),
    vehicles: asArray(source.vehicles),
    wardrobe: asArray(source.wardrobe),
    effects: asArray(source.effects),
    audio: asArray(source.audio),
    production: asArray(source.production),
    media:
      source.media && typeof source.media === 'object'
        ? (source.media as Record<string, unknown>)
        : { generated: [], imported: [] },
  };
}

function normalizeStyleGuide(raw: unknown): Record<string, unknown> {
  const sg = asObject(raw);
  return {
    colorPalette: asArray(sg.colorPalette).filter((c) => typeof c === 'string'),
    lightingMood: typeof sg.lightingMood === 'string' ? sg.lightingMood : '',
    lensStyle: typeof sg.lensStyle === 'string' ? sg.lensStyle : '',
    visualTone: typeof sg.visualTone === 'string' ? sg.visualTone : '',
    styleReference: typeof sg.styleReference === 'string' ? sg.styleReference : '',
  };
}

function normalizeReferenceImages(applied: AppliedCineProject): Record<string, unknown> {
  const ref = asObject(applied.referenceImages);
  let moodBoards = normalizeMoodBoardsSnapshot(ref.moodBoards);
  if (!moodBoards.length) {
    const id = `mb-${Date.now()}`;
    moodBoards = [
      {
        id,
        name: 'Visual DNA',
        items: [],
        viewMode: 'grid',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];
  }
  const activeId =
    typeof ref.activeMoodBoardId === 'string' && ref.activeMoodBoardId
      ? ref.activeMoodBoardId
      : moodBoards[0]?.id ?? null;
  return {
    ...ref,
    moodBoards,
    activeMoodBoardId: activeId,
  };
}

function normalizeScreenplay(applied: AppliedCineProject): AppliedCineProject['projectScreenplay'] {
  const sp = applied.projectScreenplay;
  if (sp?.format === 'fountain' && typeof sp.text === 'string') {
    return { format: 'fountain', text: sp.text };
  }
  return { format: 'fountain', text: DEFAULT_FOUNTAIN_SCRIPT };
}

/** Ensure snapshot invariants before applying to mutable module state. */
export function normalizeAppliedCineProject(applied: AppliedCineProject): AppliedCineProject {
  const tree = asObject(applied.projectData);
  if (!tree.name || typeof tree.name !== 'string') {
    tree.name = 'Untitled Production';
  }
  if (!tree.type) tree.type = 'project';

  return {
    ...applied,
    projectScreenplay: normalizeScreenplay(applied),
    projectData: tree,
    projectTreatment: asObject(applied.projectTreatment),
    currentSceneData: asObject(applied.currentSceneData),
    storyboardFrames: asArray(applied.storyboardFrames),
    deletedStoryboardFrames: asArray(applied.deletedStoryboardFrames),
    selectedStoryboardFrameId: applied.selectedStoryboardFrameId ?? null,
    storyboardVisibility: {
      scene: applied.storyboardVisibility?.scene !== false,
      frame: applied.storyboardVisibility?.frame !== false,
      notes: applied.storyboardVisibility?.notes !== false,
    },
    storyboardReferenceBank: asObject(applied.storyboardReferenceBank) as AppliedCineProject['storyboardReferenceBank'],
    sceneReferenceOverrides: asObject(applied.sceneReferenceOverrides),
    referenceGenerationStatus:
      typeof applied.referenceGenerationStatus === 'string'
        ? applied.referenceGenerationStatus
        : 'idle',
    previsSelectionState: applied.previsSelectionState ?? {
      sceneId: null,
      shotId: null,
      frameId: null,
      scriptRange: null,
      timelineItemId: null,
    },
    timelineClips: asArray(applied.timelineClips),
    locationLibrary: asArray(applied.locationLibrary),
    assetLibrary: normalizeAssetLibrary(applied.assetLibrary),
    breakdownData: asArray(applied.breakdownData),
    assetDetailData: asObject(applied.assetDetailData),
    referenceImages: normalizeReferenceImages(applied),
    styleGuide: normalizeStyleGuide(applied.styleGuide),
    projectFeatures: applied.projectFeatures ?? buildBlankProjectFeaturesConfig(),
    shotLibrary: asArray(applied.shotLibrary) as Record<string, unknown>[],
    cameraPresets: asArray(applied.cameraPresets) as Record<string, unknown>[],
    generationQueue: asArray(applied.generationQueue) as Record<string, unknown>[],
    reviewQueue: asArray(applied.reviewQueue) as Record<string, unknown>[],
    agentLog: asArray(applied.agentLog) as Record<string, unknown>[],
  };
}
