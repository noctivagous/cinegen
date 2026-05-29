/**
 * Project serializer: converts runtime in-memory project state into typed .cine document files.
 * Validation via parseCineManifest + validateCrossFileIntegrity is the final gate before any write.
 *
 * Used by autosave, export, "Duplicate Sample As Local", and new project creation.
 * All writes target server-resident server/projects/<id>.cine/ via POST /api/projects/:id/documents.
 *
 * This slice implements real mappings for the core documents using AppliedCineProject snapshots
 * (sourced from captureRuntimeProjectSnapshot in project-service). Validation gate is documented
 * and will be enforced once the cross-file validator is exported or a server equivalent is added.
 */

import type {
  CineProjectManifest,
  CineProjectScreenplay,
  CineProjectStoryboard,
} from '@/data/cine-project-types';
import type { AppliedCineProject } from '@/data/cine-project-loader';
// NOTE: validateCrossFileIntegrity is currently module-private in cine-project-loader.
// For real serialization we will either export it or run an equivalent server-side check.
import { parseCineManifest } from '@/data/cine-project-loader';
import { validateCrossFileIntegrity } from '@/data/cine-project-validator';

export type SerializeResult = {
  manifest: CineProjectManifest;
  documents: Record<string, string>; // document filename -> serialized JSON content
  valid: boolean;
  errors: string[];
};

/**
 * Build a rich manifest + document map from a full AppliedCineProject snapshot.
 * This is the canonical entry point for any write path.
 */
export function serializeAppliedProject(applied: AppliedCineProject, projectId: string, name: string): SerializeResult {
  const screenplayFilename = 'screenplay.cinescript';
  const treatmentFilename = 'treatment.cinetreatment';
  const storyboardFilename = 'storyboard.cinestoryboard';
  const scenesFilename = 'scenes.cinescenes';
  const breakdownFilename = 'breakdown.cinebreakdown';
  const charactersFilename = 'characters.cinecharacters';
  const locationsFilename = 'locations.cinelocations';
  const referenceImagesFilename = 'references.cinereferenceimages';
  const styleFilename = 'style.cinestyle';
  const featuresFilename = 'features.cinefeatures';

  const manifest: CineProjectManifest = {
    format: 'cinegen-package',
    version: 2,
    id: projectId,
    name,
    documents: {
      screenplay: screenplayFilename,
      treatment: treatmentFilename,
      storyboard: storyboardFilename,
      scenes: scenesFilename,
      breakdown: breakdownFilename,
      characters: charactersFilename,
      locations: locationsFilename,
      referenceImages: referenceImagesFilename,
      style: styleFilename,
      features: featuresFilename,
    },
    settings: (applied as any).settings || {},
  };

  const screenplay: CineProjectScreenplay = {
    format: 'fountain',
    text: applied.projectScreenplay?.text ?? '',
  };

  const storyboardDoc: Partial<CineProjectStoryboard> = {
    frames: applied.storyboardFrames ?? [],
    deletedFrames: applied.deletedStoryboardFrames ?? [],
    selectedFrameId: applied.selectedStoryboardFrameId ?? null,
    visibility: applied.storyboardVisibility ?? { scene: true, frame: true, notes: true },
    sceneReferenceOverrides: applied.sceneReferenceOverrides ?? {},
    referenceBank: applied.storyboardReferenceBank ?? undefined,
    previsSelection: applied.previsSelectionState ?? undefined,
    referenceGenerationStatus: applied.referenceGenerationStatus ?? undefined,
  };

  // Simple scenes document: the currentSceneData map (per-scene shot/config data)
  const scenesDoc = applied.currentSceneData ?? {};

  // Breakdown rows as-is
  const breakdownDoc = applied.breakdownData ?? [];

  // Characters: prefer assetLibrary.characters, fall back to empty
  const charactersDoc = (applied.assetLibrary as any)?.characters ?? [];

  // Locations: locationLibrary + any in assetLibrary
  const locationsDoc = (applied as any).locationLibrary ?? (applied.assetLibrary as any)?.locations ?? [];

  const referenceImagesDoc = applied.referenceImages ?? { moodBoards: [], activeMoodBoardId: null };
  const styleDoc = applied.styleGuide ?? { colorPalette: [], lightingMood: '', lensStyle: '', visualTone: '', styleReference: '' };
  const featuresDoc =
    applied.projectFeatures ??
    ({ version: 1, enabled: {}, order: [] } as import('@/services/project-features-service').ProjectFeaturesConfig);

  const documents: Record<string, string> = {
    [screenplayFilename]: JSON.stringify(screenplay, null, 2),
    [treatmentFilename]: JSON.stringify(applied.projectTreatment ?? {}, null, 2),
    [storyboardFilename]: JSON.stringify(storyboardDoc, null, 2),
    [scenesFilename]: JSON.stringify(scenesDoc, null, 2),
    [breakdownFilename]: JSON.stringify(breakdownDoc, null, 2),
    [charactersFilename]: JSON.stringify(charactersDoc, null, 2),
    [locationsFilename]: JSON.stringify(locationsDoc, null, 2),
    [referenceImagesFilename]: JSON.stringify(referenceImagesDoc, null, 2),
    [styleFilename]: JSON.stringify(styleDoc, null, 2),
    [featuresFilename]: JSON.stringify(featuresDoc, null, 2),
  };

  // Validation gate
  let valid = true;
  const errors: string[] = [];

  try {
    parseCineManifest(JSON.stringify(manifest), `serializer:${projectId}`);
    validateCrossFileIntegrity({
      packageBasename: projectId,
      scenes: scenesDoc,
      storyboard: storyboardDoc,
      locations: locationsDoc,
      characters: charactersDoc,
    });
  } catch (e) {
    valid = false;
    errors.push(e instanceof Error ? e.message : String(e));
  }

  return { manifest, documents, valid, errors };
}

/** Legacy-friendly wrapper (still supported during transition). */
export function serializeProjectToCineDocuments(projectId: string, projectName: string, currentState?: Partial<AppliedCineProject>): SerializeResult {
  // When a partial is supplied we still produce the richer set where fields exist
  const fakeFull = {
    projectScreenplay: currentState?.projectScreenplay ?? { format: 'fountain', text: '' },
    projectTreatment: currentState?.projectTreatment ?? {},
    storyboardFrames: currentState?.storyboardFrames ?? [],
    deletedStoryboardFrames: currentState?.deletedStoryboardFrames ?? [],
    selectedStoryboardFrameId: currentState?.selectedStoryboardFrameId ?? null,
    storyboardVisibility: currentState?.storyboardVisibility,
    sceneReferenceOverrides: currentState?.sceneReferenceOverrides,
    storyboardReferenceBank: currentState?.storyboardReferenceBank,
    previsSelectionState: currentState?.previsSelectionState,
    referenceGenerationStatus: currentState?.referenceGenerationStatus,
    currentSceneData: (currentState as any)?.currentSceneData ?? {},
    breakdownData: (currentState as any)?.breakdownData ?? [],
    assetLibrary: (currentState as any)?.assetLibrary ?? {},
    locationLibrary: (currentState as any)?.locationLibrary ?? [],
  } as AppliedCineProject;

  return serializeAppliedProject(fakeFull, projectId, projectName);
}

// TODO (follow-up slices):
// - Mood boards + styleGuide + colorState -> referenceImages / style docs
// - generationQueue / reviewQueue / agentLog / ProductionContext -> AI Director docs
// - Full shotLibrary, cameraPresets, spatialAnnotations, etc. from cinematography state
// - Previs / timeline documents
// - Wire the validator gate + refuse writes on invalid snapshots
// - Incremental dirty tracking so we only POST changed documents on autosave
// - createNewProject() that writes an initial scaffold .cine package via this serializer
