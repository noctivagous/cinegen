import { DEFAULT_FOUNTAIN_SCRIPT } from '@/data/default-fountain-script';
import {
  CINE_PROJECT_FORMAT,
  CINE_PROJECT_VERSION,
  type CineProjectFile,
  type CineProjectManifest,
  type CineProjectScreenplay,
  type ProjectRegistryEntry,
} from '@/data/cine-project-types';
import { PREPROD_MODES, SUPPORTED_TREE_VIEWS, TREE_VIEW_REQUIREMENTS } from '@/tree/tree-view-contract';
import {
  parseJsonValue,
  assertObject,
  assertArray,
  assertDocExtension,
  validateArrayOfRecords,
  validateCrossFileIntegrity as _validateCrossFileIntegrity,
} from '@/data/cine-project-validator';
import { runMigrations } from '@/data/cine-migrations/migration-registry';
// Import side-effect: registers migrations in the global registry
import '@/data/cine-migrations/v2-baseline';
import '@/data/cine-migrations/v2-to-v3';
import { parseManifestZod } from '@/data/cine-schemas';

/** Raw `.cine/` package files — loaded on demand (not at app boot). */
const packageFileLoaders = import.meta.glob('./project-files/**/*', {
  eager: false,
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>;

const packageRawByPath: Record<string, string> = {};
const cineByBasename = new Map<string, CineProjectFile>();
const _packageErrors: string[] = [];
let _packagesLoaded = false;
let _packagesLoadPromise: Promise<void> | null = null;

export function getPackageLoadErrors(): string[] {
  return [..._packageErrors];
}

export async function ensureCinePackagesLoaded(): Promise<void> {
  if (_packagesLoaded) return;
  if (_packagesLoadPromise) return _packagesLoadPromise;
  _packagesLoadPromise = (async () => {
    for (const [path, load] of Object.entries(packageFileLoaders)) {
      try {
        packageRawByPath[path] = await load();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        _packageErrors.push(`Failed to read "${path}": ${msg}`);
      }
    }
    for (const [path, raw] of Object.entries(packageRawByPath)) {
      if (!path.endsWith('/cine.manifest.json')) continue;
      const basename = packageBasenameFromManifestPath(path);
      if (!basename) continue;
      try {
        const manifest = parseCineManifest(raw, basename);
        cineByBasename.set(basename, loadCinePackage(manifest, basename));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        _packageErrors.push(`Failed to load "${basename}": ${msg}`);
      }
    }
    _packagesLoaded = true;
  })();
  return _packagesLoadPromise;
}

export function listCineProjectFiles(): string[] {
  return [...cineByBasename.keys()].sort();
}

function packageBasenameFromManifestPath(path: string): string | null {
  const parts = path.split('/');
  const idx = parts.lastIndexOf('cine.manifest.json');
  if (idx < 1) return null;
  return parts[idx - 1] || null;
}

export function parseCineManifest(
  raw: string,
  sourceLabel = 'project',
  opts?: { migrate?: boolean }
): CineProjectManifest {
  // Zod structural pre-validation: gives path-aware error messages
  // (e.g. "manifest.documents: expected object, got undefined").
  // Swallow Zod errors here and let the imperative checks below produce
  // the final thrown error, but log the structured path for debugging.
  try {
    parseManifestZod(raw);
  } catch (zodErr: unknown) {
    if (zodErr && typeof zodErr === 'object' && 'errors' in zodErr) {
      const issues = (zodErr as { errors?: Array<{ path: (string | number)[]; message: string }> }).errors;
      if (issues?.length) {
        const pathStr = issues[0].path.join('.');
        console.warn(`[parseCineManifest] Zod validation note for ${sourceLabel}: ${pathStr}: ${issues[0].message}`);
      }
    }
  }

  const doc = assertObject(parseJsonValue(raw, sourceLabel), sourceLabel, '.manifest root');
  const file = doc as CineProjectManifest;
  if (file.format !== CINE_PROJECT_FORMAT) {
    throw new Error(
      `Invalid .cine package (${sourceLabel}): expected format "${CINE_PROJECT_FORMAT}", got "${String((file as { format?: unknown }).format)}"`
    );
  }
  const version = Number(file.version);
  if (version !== CINE_PROJECT_VERSION) {
    if (opts?.migrate && version < CINE_PROJECT_VERSION) {
      // Migration path: future implementation would call runMigrations here
      // with the full document map. For now, the registry has no forward
      // migrations defined (only the v2 baseline), so this will throw
      // with a clear message.
      throw new Error(
        `.cine package version migration not yet implemented for ${sourceLabel}: ` +
        `loaded version ${version}, current is ${CINE_PROJECT_VERSION}. ` +
        `Migration registry exists but no forward migrations are registered yet.`
      );
    }
    throw new Error(
      `Unsupported .cine package version in ${sourceLabel}: ${String(file.version)} (expected ${CINE_PROJECT_VERSION})`
    );
  }
  if (!file.id || !file.name) {
    throw new Error(`Invalid .cine package (${sourceLabel}): missing id or name`);
  }
  if (!file.documents || typeof file.documents !== 'object') {
    throw new Error(`Invalid .cine package (${sourceLabel}): missing documents map`);
  }
  if (!file.documents.screenplay || !file.documents.treatment || !file.documents.storyboard) {
    throw new Error(`Invalid .cine package (${sourceLabel}): documents must include screenplay, treatment, and storyboard`);
  }
  assertDocExtension(file.documents.screenplay, '.cinescript', sourceLabel);
  assertDocExtension(file.documents.treatment, '.cinetreatment', sourceLabel);
  assertDocExtension(file.documents.storyboard, '.cinestoryboard', sourceLabel);
  if (file.documents.tree) assertDocExtension(file.documents.tree, '.cinetree', sourceLabel);
  if (file.documents.scenes) assertDocExtension(file.documents.scenes, '.cinescenes', sourceLabel);
  if (file.documents.timeline) assertDocExtension(file.documents.timeline, '.cinetimeline', sourceLabel);
  if (file.documents.outputs) assertDocExtension(file.documents.outputs, '.cineoutputs', sourceLabel);
  if (file.documents.locations) assertDocExtension(file.documents.locations, '.cinelocations', sourceLabel);
  if (file.documents.breakdown) assertDocExtension(file.documents.breakdown, '.cinebreakdown', sourceLabel);
  if (file.documents.assetDetails) {
    assertDocExtension(file.documents.assetDetails, '.cineassetdetails', sourceLabel);
  }
  if (file.documents.characters) assertDocExtension(file.documents.characters, '.cinecharacters', sourceLabel);
  if (file.documents.props) assertDocExtension(file.documents.props, '.cineprops', sourceLabel);
  if (file.documents.wardrobe) assertDocExtension(file.documents.wardrobe, '.cinewardrobe', sourceLabel);
  if (file.documents.vehicles) assertDocExtension(file.documents.vehicles, '.cinevehicles', sourceLabel);
  if (file.documents.effects) assertDocExtension(file.documents.effects, '.cineeffects', sourceLabel);
  if (file.documents.generatedAssets) {
    assertDocExtension(file.documents.generatedAssets, '.cinegenerated', sourceLabel);
  }
  if (file.documents.importedAssets) {
    assertDocExtension(file.documents.importedAssets, '.cineimported', sourceLabel);
  }
  if (file.documents.shotLibrary) assertDocExtension(file.documents.shotLibrary, '.cineshotlibrary', sourceLabel);
  if (file.documents.cameraPresets) assertDocExtension(file.documents.cameraPresets, '.cinecamerapresets', sourceLabel);
  if (file.documents.referenceImages) assertDocExtension(file.documents.referenceImages, '.cinereferenceimages', sourceLabel);
  if (file.documents.motionReferences) assertDocExtension(file.documents.motionReferences, '.cinemotionreferences', sourceLabel);
  if (file.documents.spatialAnnotations) assertDocExtension(file.documents.spatialAnnotations, '.cinespatialannotations', sourceLabel);
  if (file.documents.productionSound) assertDocExtension(file.documents.productionSound, '.cineproductionsound', sourceLabel);
  if (file.documents.adr) assertDocExtension(file.documents.adr, '.cineadr', sourceLabel);
  if (file.documents.foley) assertDocExtension(file.documents.foley, '.cinefoley', sourceLabel);
  if (file.documents.sfx) assertDocExtension(file.documents.sfx, '.cinesfx', sourceLabel);
  if (file.documents.music) assertDocExtension(file.documents.music, '.cinemusic', sourceLabel);
  if (file.documents.tempMix) assertDocExtension(file.documents.tempMix, '.cinetempmix', sourceLabel);
  if (file.documents.sets) assertDocExtension(file.documents.sets, '.cinesets', sourceLabel);
  if (file.documents.colorPresets) assertDocExtension(file.documents.colorPresets, '.cinecolorpresets', sourceLabel);
  if (file.documents.sequences) assertDocExtension(file.documents.sequences, '.cinesequences', sourceLabel);
  if (file.documents.vfx) assertDocExtension(file.documents.vfx, '.cinevfx', sourceLabel);
  if (file.documents.generationQueue) assertDocExtension(file.documents.generationQueue, '.cinegenerationqueue', sourceLabel);
  if (file.documents.reviewQueue) assertDocExtension(file.documents.reviewQueue, '.cinereviewqueue', sourceLabel);
  if (file.documents.costTracking) assertDocExtension(file.documents.costTracking, '.cinecosttracking', sourceLabel);
  if (file.documents.modelRoutingRules) assertDocExtension(file.documents.modelRoutingRules, '.cinemodelrouting', sourceLabel);
  if (file.documents.agentLog) assertDocExtension(file.documents.agentLog, '.cineagentlog', sourceLabel);
  return file;
}

export function loadCineProjectByFile(filename: string): CineProjectFile {
  const doc = cineByBasename.get(filename);
  if (!doc) {
    const available = listCineProjectFiles().join(', ') || '(none)';
    throw new Error(`Missing .cine package "${filename}". Available: ${available}`);
  }
  return doc;
}

function getPackageRaw(packageBasename: string, relativePath: string): string {
  const key = `./project-files/${packageBasename}/${relativePath}`;
  const raw = packageRawByPath[key];
  if (typeof raw !== 'string') {
    throw new Error(`Missing file in .cine package "${packageBasename}": ${relativePath}`);
  }
  return raw;
}

function loadScreenplayDoc(packageBasename: string, relativePath: string): CineProjectScreenplay {
  const sourceLabel = `${packageBasename}/${relativePath}`;
  assertDocExtension(relativePath, '.cinescript', sourceLabel);
  const text = getPackageRaw(packageBasename, relativePath).trim();
  return { format: 'fountain', text: text || DEFAULT_FOUNTAIN_SCRIPT };
}

function loadTreatmentDoc(packageBasename: string, relativePath: string): Record<string, unknown> {
  const sourceLabel = `${packageBasename}/${relativePath}`;
  assertDocExtension(relativePath, '.cinetreatment', sourceLabel);
  return assertObject(
    parseJsonValue(getPackageRaw(packageBasename, relativePath), sourceLabel),
    sourceLabel,
    '.cinetreatment object'
  );
}

function loadStoryboardDoc(packageBasename: string, relativePath: string): CineProjectFile['storyboard'] {
  const sourceLabel = `${packageBasename}/${relativePath}`;
  assertDocExtension(relativePath, '.cinestoryboard', sourceLabel);
  const raw = assertObject(
    parseJsonValue(getPackageRaw(packageBasename, relativePath), sourceLabel),
    sourceLabel,
    '.cinestoryboard object'
  );
  const storyboard = raw as CineProjectFile['storyboard'];
  if (storyboard?.visibility && typeof storyboard.visibility === 'object') {
    const v = storyboard.visibility as Record<string, unknown>;
    if (
      (v.scene != null && typeof v.scene !== 'boolean') ||
      (v.frame != null && typeof v.frame !== 'boolean') ||
      (v.notes != null && typeof v.notes !== 'boolean')
    ) {
      throw new Error(
        `Invalid .cine package file (${sourceLabel}): "visibility" must contain boolean scene/frame/notes (.cinestoryboard schema)`
      );
    }
  }
  return {
    frames: Array.isArray(storyboard?.frames) ? storyboard.frames : [],
    deletedFrames: Array.isArray(storyboard?.deletedFrames) ? storyboard.deletedFrames : [],
    selectedFrameId: storyboard?.selectedFrameId ?? null,
    visibility: storyboard?.visibility ?? { scene: true, frame: true, notes: true },
    previsSelection:
      storyboard?.previsSelection && typeof storyboard.previsSelection === 'object'
        ? storyboard.previsSelection
        : {
            sceneId: null,
            shotId: null,
            frameId: null,
            scriptRange: null,
            timelineItemId: null,
          },
    referenceBank: (storyboard?.referenceBank && typeof storyboard.referenceBank === 'object'
      ? storyboard.referenceBank
      : { characters: [], locations: [], interiors: [], exteriors: [] }) as Record<string, unknown>,
    sceneReferenceOverrides: (storyboard?.sceneReferenceOverrides && typeof storyboard.sceneReferenceOverrides === 'object'
      ? storyboard.sceneReferenceOverrides
      : {}) as Record<string, unknown>,
    referenceGenerationStatus:
      typeof storyboard?.referenceGenerationStatus === 'string' ? storyboard.referenceGenerationStatus : 'idle',
  };
}

function loadJsonDoc(packageBasename: string, relativePath: string): Record<string, unknown> {
  const sourceLabel = `${packageBasename}/${relativePath}`;
  return assertObject(
    parseJsonValue(getPackageRaw(packageBasename, relativePath), sourceLabel),
    sourceLabel,
    'object document'
  );
}

function loadOptionalArrayDoc(
  packageBasename: string,
  relativePath: string | undefined,
  extension: string,
  schemaHint: string,
  requiredField = ''
): Record<string, unknown>[] | undefined {
  if (!relativePath) return undefined;
  const sourceLabel = `${packageBasename}/${relativePath}`;
  assertDocExtension(relativePath, extension, sourceLabel);
  const arr = assertArray(parseJsonValue(getPackageRaw(packageBasename, relativePath), sourceLabel), sourceLabel, schemaHint);
  return validateArrayOfRecords(arr, sourceLabel, schemaHint, requiredField);
}

function validateCrossFileIntegrity(params: import('@/data/cine-project-validator').ValidateCrossFileIntegrityParams): void {
  const packagePrefix = `./project-files/${params.packageBasename}/`;
  const packageFileSet = new Set(
    Object.keys(packageRawByPath)
      .filter((k) => k.startsWith(packagePrefix))
      .map((k) => k.slice(packagePrefix.length))
  );
  _validateCrossFileIntegrity({ ...params, packageFileSet });
}

function loadCinePackage(manifest: CineProjectManifest, packageBasename: string): CineProjectFile {
  const { documents, ...rest } = manifest;
  const assetLibrary: Record<string, unknown> = {};
  const characters = loadOptionalArrayDoc(
    packageBasename,
    documents.characters,
    '.cinecharacters',
    '.cinecharacters schema: array of character records',
    'id'
  );
  const props = loadOptionalArrayDoc(
    packageBasename,
    documents.props,
    '.cineprops',
    '.cineprops schema: array of prop records',
    'id'
  );
  const wardrobe = loadOptionalArrayDoc(
    packageBasename,
    documents.wardrobe,
    '.cinewardrobe',
    '.cinewardrobe schema: array of wardrobe records',
    'id'
  );
  const vehicles = loadOptionalArrayDoc(
    packageBasename,
    documents.vehicles,
    '.cinevehicles',
    '.cinevehicles schema: array of vehicle records',
    'id'
  );
  const effects = loadOptionalArrayDoc(
    packageBasename,
    documents.effects,
    '.cineeffects',
    '.cineeffects schema: array of effects records',
    'id'
  );
  const generatedAssets = loadOptionalArrayDoc(
    packageBasename,
    documents.generatedAssets,
    '.cinegenerated',
    '.cinegenerated schema: array of generated asset records',
    'id'
  );
  const importedAssets = loadOptionalArrayDoc(
    packageBasename,
    documents.importedAssets,
    '.cineimported',
    '.cineimported schema: array of imported asset records',
    'id'
  );
  const outputs = loadOptionalArrayDoc(
    packageBasename,
    documents.outputs,
    '.cineoutputs',
    '.cineoutputs schema: array of output records',
    'id'
  );
  if (characters) assetLibrary.characters = characters;
  if (props) assetLibrary.props = props;
  if (wardrobe) assetLibrary.wardrobe = wardrobe;
  if (vehicles) assetLibrary.vehicles = vehicles;
  if (effects) assetLibrary.effects = effects;
  if (generatedAssets || importedAssets) {
    assetLibrary.media = {
      ...(generatedAssets ? { generated: generatedAssets } : {}),
      ...(importedAssets ? { imported: importedAssets } : {}),
    };
  }

  if (documents.tree) assertDocExtension(documents.tree, '.cinetree', `${packageBasename}/${documents.tree}`);
  const tree = documents.tree ? loadJsonDoc(packageBasename, documents.tree) : undefined;

  if (documents.scenes) assertDocExtension(documents.scenes, '.cinescenes', `${packageBasename}/${documents.scenes}`);
  const scenes = documents.scenes ? loadJsonDoc(packageBasename, documents.scenes) : undefined;

  const timeline = loadOptionalArrayDoc(
    packageBasename,
    documents.timeline,
    '.cinetimeline',
    '.cinetimeline schema: array of timeline clip records'
  );
  const locations = loadOptionalArrayDoc(
    packageBasename,
    documents.locations,
    '.cinelocations',
    '.cinelocations schema: array of location records',
    'id'
  );
  const breakdown = loadOptionalArrayDoc(
    packageBasename,
    documents.breakdown,
    '.cinebreakdown',
    '.cinebreakdown schema: array of breakdown records'
  );
  const shotLibrary = loadOptionalArrayDoc(
    packageBasename,
    documents.shotLibrary,
    '.cineshotlibrary',
    '.cineshotlibrary schema: array of shot setup records',
    'id'
  );
  const cameraPresets = loadOptionalArrayDoc(
    packageBasename,
    documents.cameraPresets,
    '.cinecamerapresets',
    '.cinecamerapresets schema: array of camera preset records',
    'id'
  );
  const referenceImages = documents.referenceImages
    ? loadJsonDoc(packageBasename, documents.referenceImages)
    : undefined;
  const motionReferences = loadOptionalArrayDoc(
    packageBasename,
    documents.motionReferences,
    '.cinemotionreferences',
    '.cinemotionreferences schema: array of motion reference records',
    'id'
  );
  const spatialAnnotations = documents.spatialAnnotations
    ? loadJsonDoc(packageBasename, documents.spatialAnnotations)
    : undefined;
  const productionSound = loadOptionalArrayDoc(
    packageBasename,
    documents.productionSound,
    '.cineproductionsound',
    '.cineproductionsound schema: array of production sound clip records',
    'id'
  );
  const adr = loadOptionalArrayDoc(
    packageBasename,
    documents.adr,
    '.cineadr',
    '.cineadr schema: array of ADR line records',
    'id'
  );
  const foley = loadOptionalArrayDoc(
    packageBasename,
    documents.foley,
    '.cinefoley',
    '.cinefoley schema: array of foley event records',
    'id'
  );
  const sfx = loadOptionalArrayDoc(
    packageBasename,
    documents.sfx,
    '.cinesfx',
    '.cinesfx schema: array of sound effect records',
    'id'
  );
  const music = loadOptionalArrayDoc(
    packageBasename,
    documents.music,
    '.cinemusic',
    '.cinemusic schema: array of music cue records',
    'id'
  );
  const tempMix = documents.tempMix
    ? loadJsonDoc(packageBasename, documents.tempMix)
    : undefined;
  const sets = loadOptionalArrayDoc(
    packageBasename,
    documents.sets,
    '.cinesets',
    '.cinesets schema: array of set design records',
    'id'
  );
  const colorPresets = loadOptionalArrayDoc(
    packageBasename,
    documents.colorPresets,
    '.cinecolorpresets',
    '.cinecolorpresets schema: array of color preset records',
    'id'
  );
  const sequences = loadOptionalArrayDoc(
    packageBasename,
    documents.sequences,
    '.cinesequences',
    '.cinesequences schema: array of sequence records',
    'id'
  );
  const vfx = loadOptionalArrayDoc(
    packageBasename,
    documents.vfx,
    '.cinevfx',
    '.cinevfx schema: array of VFX records',
    'id'
  );
  const generationQueue = loadOptionalArrayDoc(
    packageBasename,
    documents.generationQueue,
    '.cinegenerationqueue',
    '.cinegenerationqueue schema: array of generation job records',
    'id'
  );
  const reviewQueue = loadOptionalArrayDoc(
    packageBasename,
    documents.reviewQueue,
    '.cinereviewqueue',
    '.cinereviewqueue schema: array of review item records',
    'id'
  );
  const costTracking = loadOptionalArrayDoc(
    packageBasename,
    documents.costTracking,
    '.cinecosttracking',
    '.cinecosttracking schema: array of cost tracking records',
    'id'
  );
  const modelRoutingRules = documents.modelRoutingRules
    ? loadJsonDoc(packageBasename, documents.modelRoutingRules)
    : undefined;
  const agentLog = loadOptionalArrayDoc(
    packageBasename,
    documents.agentLog,
    '.cineagentlog',
    '.cineagentlog schema: array of agent log records',
    'id'
  );
  if (documents.assetDetails) {
    assertDocExtension(
      documents.assetDetails,
      '.cineassetdetails',
      `${packageBasename}/${documents.assetDetails}`
    );
  }
  const assetDetails = documents.assetDetails
    ? loadJsonDoc(packageBasename, documents.assetDetails)
    : undefined;

  const storyboard = loadStoryboardDoc(packageBasename, documents.storyboard);

  validateCrossFileIntegrity({
    packageBasename,
    scenePath: documents.scenes,
    locationsPath: documents.locations,
    charactersPath: documents.characters,
    propsPath: documents.props,
    wardrobePath: documents.wardrobe,
    vehiclesPath: documents.vehicles,
    effectsPath: documents.effects,
    setsPath: documents.sets,
    adrPath: documents.adr,
    foleyPath: documents.foley,
    generatedPath: documents.generatedAssets,
    importedPath: documents.importedAssets,
    outputsPath: documents.outputs,
    treePath: documents.tree,
    storyboardPath: documents.storyboard,
    tree,
    scenes,
    storyboard,
    locations,
    characters,
    props,
    wardrobe,
    vehicles,
    effects,
    sets,
    adr,
    foley,
    generatedAssets,
    importedAssets,
    outputs,
    assetDetails,
  });

  return {
    ...rest,
    tree,
    scenes,
    timeline,
    locations,
    breakdown,
    assetDetails,
    shotLibrary,
    cameraPresets,
    referenceImages,
    motionReferences,
    spatialAnnotations,
    productionSound,
    adr,
    foley,
    sfx,
    music,
    tempMix,
    sets,
    colorPresets,
    sequences,
    vfx,
    generationQueue,
    reviewQueue,
    costTracking,
    modelRoutingRules,
    agentLog,
    screenplay: loadScreenplayDoc(packageBasename, documents.screenplay),
    treatment: loadTreatmentDoc(packageBasename, documents.treatment),
    storyboard,
    assets: assetLibrary,
  };
}

export function buildRegistryFromCineFiles(): ProjectRegistryEntry[] {
  return [...cineByBasename.entries()]
    .sort(([, a], [, b]) => a.name.localeCompare(b.name))
    .map(([file, doc]) => ({
      id: doc.id,
      name: doc.name,
      settings: (doc.settings && typeof doc.settings === 'object' ? doc.settings : {}) as Record<
        string,
        unknown
      >,
      file,
    }));
}

export type AppliedCineProject = {
  projectData: Record<string, unknown>;
  projectTreatment: Record<string, unknown>;
  currentSceneData: Record<string, unknown>;
  storyboardFrames: unknown[];
  deletedStoryboardFrames: unknown[];
  selectedStoryboardFrameId: string | number | null;
  storyboardVisibility: { scene: boolean; frame: boolean; notes: boolean };
  storyboardReferenceBank: Record<string, unknown>;
  sceneReferenceOverrides: Record<string, unknown>;
  referenceGenerationStatus: string;
  previsSelectionState: {
    sceneId: string | null;
    shotId: number | null;
    frameId: number | null;
    scriptRange: { start: number; end: number } | null;
    timelineItemId: string | null;
  };
  timelineClips: unknown[];
  locationLibrary: unknown[];
  assetLibrary: Record<string, unknown>;
  breakdownData: unknown[];
  assetDetailData: Record<string, unknown>;
  projectScreenplay: CineProjectScreenplay;
  shotLibrary?: Record<string, unknown>[];
  cameraPresets?: Record<string, unknown>[];
  referenceImages?: Record<string, unknown>;
  motionReferences?: Record<string, unknown>[];
  spatialAnnotations?: Record<string, unknown>;
  productionSound?: Record<string, unknown>[];
  adr?: Record<string, unknown>[];
  foley?: Record<string, unknown>[];
  sfx?: Record<string, unknown>[];
  music?: Record<string, unknown>[];
  tempMix?: Record<string, unknown>;
  sets?: Record<string, unknown>[];
  colorPresets?: Record<string, unknown>[];
  sequences?: Record<string, unknown>[];
  vfx?: Record<string, unknown>[];
  generationQueue?: Record<string, unknown>[];
  reviewQueue?: Record<string, unknown>[];
  costTracking?: Record<string, unknown>[];
  modelRoutingRules?: Record<string, unknown>;
  agentLog?: Record<string, unknown>[];
  styleGuide?: Record<string, unknown>;
  projectFeatures?: import('@/services/project-features-service').ProjectFeaturesConfig;
  projectAnnotations?: import('@/data/project-data').CineAnnotationsDoc;
};

function screenplayFrom(doc: CineProjectFile): CineProjectScreenplay {
  const sp = doc.screenplay;
  if (sp?.format === 'fountain' && typeof sp.text === 'string') {
    return { format: 'fountain', text: sp.text };
  }
  return { format: 'fountain', text: DEFAULT_FOUNTAIN_SCRIPT };
}

/** Map a parsed `.cine` document onto the mutable module fields used by the app. */
export function applyCineProject(doc: CineProjectFile): AppliedCineProject {
  const sb = doc.storyboard;
  const assets = doc.assets && typeof doc.assets === 'object' ? { ...doc.assets } : {};
  if (doc.locations && !assets.locations) {
    assets.locations = doc.locations;
  }

  return {
    projectScreenplay: screenplayFrom(doc),
    projectData: (doc.tree && typeof doc.tree === 'object'
      ? doc.tree
      : { name: doc.name, type: 'project', children: [] }) as Record<string, unknown>,
    projectTreatment: (doc.treatment && typeof doc.treatment === 'object'
      ? doc.treatment
      : { workingTitle: doc.name }) as Record<string, unknown>,
    currentSceneData: (doc.scenes && typeof doc.scenes === 'object' ? doc.scenes : {}) as Record<string, unknown>,
    storyboardFrames: sb?.frames ?? [],
    deletedStoryboardFrames: sb?.deletedFrames ?? [],
    selectedStoryboardFrameId: sb?.selectedFrameId ?? null,
    storyboardVisibility: sb?.visibility ?? { scene: true, frame: true, notes: true },
    storyboardReferenceBank: (sb?.referenceBank && typeof sb.referenceBank === 'object'
      ? sb.referenceBank
      : { characters: [], locations: [], interiors: [], exteriors: [] }) as Record<string, unknown>,
    sceneReferenceOverrides: (sb?.sceneReferenceOverrides && typeof sb.sceneReferenceOverrides === 'object'
      ? sb.sceneReferenceOverrides
      : {}) as Record<string, unknown>,
    referenceGenerationStatus: typeof sb?.referenceGenerationStatus === 'string' ? sb.referenceGenerationStatus : 'idle',
    previsSelectionState: {
      sceneId:
        sb?.previsSelection && typeof sb.previsSelection.sceneId === 'string'
          ? sb.previsSelection.sceneId
          : null,
      shotId:
        sb?.previsSelection && typeof sb.previsSelection.shotId === 'number'
          ? sb.previsSelection.shotId
          : null,
      frameId:
        sb?.previsSelection && typeof sb.previsSelection.frameId === 'number'
          ? sb.previsSelection.frameId
          : null,
      scriptRange:
        sb?.previsSelection &&
        sb.previsSelection.scriptRange &&
        typeof sb.previsSelection.scriptRange === 'object' &&
        typeof sb.previsSelection.scriptRange.start === 'number' &&
        typeof sb.previsSelection.scriptRange.end === 'number'
          ? {
              start: sb.previsSelection.scriptRange.start,
              end: sb.previsSelection.scriptRange.end,
            }
          : null,
      timelineItemId:
        sb?.previsSelection && typeof sb.previsSelection.timelineItemId === 'string'
          ? sb.previsSelection.timelineItemId
          : null,
    },
    timelineClips: doc.timeline ?? [],
    locationLibrary: doc.locations ?? [],
    assetLibrary: assets,
    breakdownData: doc.breakdown ?? [],
    assetDetailData: (doc.assetDetails && typeof doc.assetDetails === 'object' ? doc.assetDetails : {}) as Record<string, unknown>,
    shotLibrary: doc.shotLibrary ?? [],
    cameraPresets: doc.cameraPresets ?? [],
    referenceImages: doc.referenceImages ?? {},
    motionReferences: doc.motionReferences ?? [],
    spatialAnnotations: doc.spatialAnnotations ?? {},
    productionSound: doc.productionSound ?? [],
    adr: doc.adr ?? [],
    foley: doc.foley ?? [],
    sfx: doc.sfx ?? [],
    music: doc.music ?? [],
    tempMix: doc.tempMix ?? {},
    sets: doc.sets ?? [],
    colorPresets: doc.colorPresets ?? [],
    sequences: doc.sequences ?? [],
    vfx: doc.vfx ?? [],
    generationQueue: doc.generationQueue ?? [],
    reviewQueue: doc.reviewQueue ?? [],
    costTracking: doc.costTracking ?? [],
    modelRoutingRules: doc.modelRoutingRules ?? {},
    agentLog: doc.agentLog ?? [],
    projectAnnotations: (doc.annotations && typeof doc.annotations === 'object'
      ? (doc.annotations as unknown as import('@/data/project-data').CineAnnotationsDoc)
      : { format: 'cine-annotations', version: 1, marks: [] }),
  };
}

export function loadAndApplyCineFile(filename: string): AppliedCineProject {
  return applyCineProject(loadCineProjectByFile(filename));
}
