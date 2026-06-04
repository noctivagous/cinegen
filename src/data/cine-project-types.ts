/** Cinegen `.cine` project package manifest (directory-based format). */

export const CINE_PROJECT_FORMAT = 'cinegen-package';
export const CINE_PROJECT_VERSION = 2;

export type CineProjectScreenplay = {
  format: 'fountain';
  text: string;
};

export type CineProjectStoryboard = {
  frames: unknown[];
  deletedFrames: unknown[];
  selectedFrameId: string | number | null;
  visibility: { scene: boolean; frame: boolean; notes: boolean };
  previsSelection?: {
    sceneId?: string | null;
    shotId?: number | null;
    frameId?: number | null;
    scriptRange?: { start: number; end: number } | null;
    timelineItemId?: string | null;
  };
  referenceBank?: Record<string, unknown>;
  sceneReferenceOverrides?: Record<string, unknown>;
  referenceGenerationStatus?: string;
};

export type CineProjectManifest = {
  format: typeof CINE_PROJECT_FORMAT;
  version: number;
  id: string;
  name: string;
  projectType?: string;
  workflowProfile?: string;
  documents: {
    screenplay: string;
    treatment: string;
    storyboard: string;
    tree?: string;
    scenes?: string;
    timeline?: string;
    outputs?: string;
    locations?: string;
    breakdown?: string;
    assetDetails?: string;
    characters?: string;
    props?: string;
    wardrobe?: string;
    vehicles?: string;
    effects?: string;
    generatedAssets?: string;
    importedAssets?: string;
    /** Cinematography department documents */
    shotLibrary?: string;
    cameraPresets?: string;
    referenceImages?: string;
    features?: string;
    motionReferences?: string;
    spatialAnnotations?: string;
    /** Sound department documents */
    productionSound?: string;
    adr?: string;
    foley?: string;
    sfx?: string;
    music?: string;
    tempMix?: string;
    /** Production Design extensions */
    sets?: string;
    /** Post Production department documents */
    colorPresets?: string;
    sequences?: string;
    vfx?: string;
    /** AI Director department documents */
    generationQueue?: string;
    reviewQueue?: string;
    costTracking?: string;
    modelRoutingRules?: string;
    agentLog?: string;
    /** Style guide document */
    style?: string;
    /** Script annotation sidecar */
    annotations?: string;
    /** ScratchPad free-form ideation entries */
    scratchpad?: string;
    /** Drafts — append-only generative experiment entries */
    drafts?: string;
  };
  settings?: Record<string, unknown>;
  tree?: Record<string, unknown>;
  scenes?: Record<string, unknown>;
  timeline?: unknown[];
  locations?: unknown[];
  breakdown?: unknown[];
  assetDetails?: Record<string, unknown>;
};

export type CineProjectFile = Omit<CineProjectManifest, 'documents'> & {
  screenplay: CineProjectScreenplay;
  treatment: Record<string, unknown>;
  storyboard: CineProjectStoryboard;
  assets: Record<string, unknown>;
  /** Cinematography department data */
  shotLibrary?: Record<string, unknown>[];
  cameraPresets?: Record<string, unknown>[];
  referenceImages?: Record<string, unknown>;
  motionReferences?: Record<string, unknown>[];
  spatialAnnotations?: Record<string, unknown>;
  /** Sound department data */
  productionSound?: Record<string, unknown>[];
  adr?: Record<string, unknown>[];
  foley?: Record<string, unknown>[];
  sfx?: Record<string, unknown>[];
  music?: Record<string, unknown>[];
  tempMix?: Record<string, unknown>;
  /** Production Design extensions */
  sets?: Record<string, unknown>[];
  /** Post Production department data */
  colorPresets?: Record<string, unknown>[];
  sequences?: Record<string, unknown>[];
  vfx?: Record<string, unknown>[];
  /** AI Director department data */
  generationQueue?: Record<string, unknown>[];
  reviewQueue?: Record<string, unknown>[];
  costTracking?: Record<string, unknown>[];
  modelRoutingRules?: Record<string, unknown>;
  agentLog?: Record<string, unknown>[];
  annotations?: Record<string, unknown>;
  scratchPad?: Record<string, unknown>;
  drafts?: Record<string, unknown>;
  /** Sidebar feature visibility + order (`features.cinefeatures`). */
  projectFeatures?: import('@/services/project-features-service').ProjectFeaturesConfig;
};

export type ProjectRegistryEntry = {
  id: string;
  name: string;
  settings: Record<string, unknown>;
  /** Basename of the `.cine` package directory in `project-files/` (e.g. `ascension-stream.cine`). */
  file?: string;
};
