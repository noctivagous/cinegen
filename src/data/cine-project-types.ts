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
};

export type ProjectRegistryEntry = {
  id: string;
  name: string;
  settings: Record<string, unknown>;
  /** Basename of the `.cine` package directory in `project-files/` (e.g. `ascension-stream.cine`). */
  file?: string;
};
