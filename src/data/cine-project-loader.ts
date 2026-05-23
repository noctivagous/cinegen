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

/** Raw `.cine/` package files — loaded on demand (not at app boot). */
const packageFileLoaders = import.meta.glob('./project-files/*.cine/**', {
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

function parseJsonValue(raw: string, sourceLabel: string): unknown {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid .cine package file (${sourceLabel}): not valid JSON`);
  }
  return value;
}

function assertObject(value: unknown, sourceLabel: string, schemaHint: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid .cine package file (${sourceLabel}): expected object (${schemaHint})`);
  }
  return value as Record<string, unknown>;
}

function assertArray(value: unknown, sourceLabel: string, schemaHint: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid .cine package file (${sourceLabel}): expected array (${schemaHint})`);
  }
  return value;
}

function assertStringField(
  obj: Record<string, unknown>,
  field: string,
  sourceLabel: string,
  schemaHint: string
): string {
  const value = obj[field];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Invalid .cine package file (${sourceLabel}): "${field}" must be a non-empty string (${schemaHint})`);
  }
  return value;
}

function optionalStringArrayField(
  obj: Record<string, unknown>,
  field: string,
  sourceLabel: string,
  schemaHint: string
): string[] | undefined {
  const value = obj[field];
  if (value == null) return undefined;
  if (!Array.isArray(value)) {
    throw new Error(`Invalid .cine package file (${sourceLabel}): "${field}" must be an array (${schemaHint})`);
  }
  return value.map((item, index) => {
    if (typeof item !== 'string' || !item.trim()) {
      throw new Error(
        `Invalid .cine package file (${sourceLabel}): "${field}[${index}]" must be a non-empty string (${schemaHint})`
      );
    }
    return item;
  });
}

function validateArrayOfRecords(
  arr: unknown[],
  sourceLabel: string,
  schemaHint: string,
  requiredField: string
): Record<string, unknown>[] {
  return arr.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(
        `Invalid .cine package file (${sourceLabel}): item ${index} must be an object (${schemaHint})`
      );
    }
    const obj = item as Record<string, unknown>;
    if (requiredField) assertStringField(obj, requiredField, sourceLabel, schemaHint);
    return obj;
  });
}

function assertDocExtension(relativePath: string, extension: string, sourceLabel: string): void {
  if (!relativePath.endsWith(extension)) {
    throw new Error(
      `Invalid .cine package file (${sourceLabel}): expected "${extension}" file path, got "${relativePath}"`
    );
  }
}

export function parseCineManifest(raw: string, sourceLabel = 'project'): CineProjectManifest {
  const doc = assertObject(parseJsonValue(raw, sourceLabel), sourceLabel, '.manifest root');
  const file = doc as CineProjectManifest;
  if (file.format !== CINE_PROJECT_FORMAT) {
    throw new Error(
      `Invalid .cine package (${sourceLabel}): expected format "${CINE_PROJECT_FORMAT}", got "${String((file as { format?: unknown }).format)}"`
    );
  }
  if (file.version !== CINE_PROJECT_VERSION) {
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

function buildIdSet(
  rows: Record<string, unknown>[] | undefined,
  sourceLabel: string,
  schemaHint: string
): Set<string> {
  const ids = new Set<string>();
  if (!rows) return ids;
  for (const row of rows) ids.add(assertStringField(row, 'id', sourceLabel, schemaHint));
  return ids;
}

function validateSceneRefs(
  scenes: Record<string, unknown> | undefined,
  sceneSourceLabel: string,
  field: string,
  validIds: Set<string>,
  targetLabel: string
): void {
  if (!scenes) return;
  for (const [sceneId, rawScene] of Object.entries(scenes)) {
    if (!rawScene || typeof rawScene !== 'object' || Array.isArray(rawScene)) {
      throw new Error(
        `Invalid .cine package file (${sceneSourceLabel}): scene "${sceneId}" must be an object (.cinescenes schema)`
      );
    }
    const scene = rawScene as Record<string, unknown>;
    const refs = optionalStringArrayField(scene, field, sceneSourceLabel, '.cinescenes schema');
    if (!refs) continue;
    for (const refId of refs) {
      if (!validIds.has(refId)) {
        throw new Error(
          `Invalid .cine package file (${sceneSourceLabel}): scene "${sceneId}" references missing ${targetLabel} id "${refId}" via "${field}"`
        );
      }
    }
  }
}

function validateUsageRefs(
  rows: Record<string, unknown>[] | undefined,
  sourceLabel: string,
  schemaHint: string,
  sceneIds: Set<string>
): void {
  if (!rows) return;
  for (const row of rows) {
    const itemId = assertStringField(row, 'id', sourceLabel, schemaHint);
    const usageRefs = optionalStringArrayField(row, 'usageRefs', sourceLabel, schemaHint);
    if (!usageRefs) continue;
    for (const sceneId of usageRefs) {
      if (!sceneIds.has(sceneId)) {
        throw new Error(
          `Invalid .cine package file (${sourceLabel}): "${itemId}" has unknown scene usageRefs id "${sceneId}" (${schemaHint})`
        );
      }
    }
  }
}

function validateRelatedIds(
  rows: Record<string, unknown>[] | undefined,
  sourceLabel: string,
  schemaHint: string,
  validSets: Record<string, Set<string>>
): void {
  if (!rows) return;
  for (const row of rows) {
    const itemId = assertStringField(row, 'id', sourceLabel, schemaHint);
    const relatedRaw = row.related;
    if (relatedRaw == null) continue;
    if (!relatedRaw || typeof relatedRaw !== 'object' || Array.isArray(relatedRaw)) {
      throw new Error(
        `Invalid .cine package file (${sourceLabel}): "${itemId}.related" must be an object (${schemaHint})`
      );
    }
    const related = relatedRaw as Record<string, unknown>;
    for (const [field, validIds] of Object.entries(validSets)) {
      const relatedId = related[field];
      if (relatedId == null) continue;
      if (typeof relatedId !== 'string' || !relatedId.trim()) {
        throw new Error(
          `Invalid .cine package file (${sourceLabel}): "${itemId}.related.${field}" must be a non-empty string (${schemaHint})`
        );
      }
      if (!validIds.has(relatedId)) {
        throw new Error(
          `Invalid .cine package file (${sourceLabel}): "${itemId}" references missing related ${field} "${relatedId}" (${schemaHint})`
        );
      }
    }
  }
}

function isSafeRelativePath(path: string): boolean {
  return !!path && !path.startsWith('/') && !path.includes('..');
}

function assertKnownPackagePath(
  path: string,
  sourceLabel: string,
  fieldLabel: string,
  packageFileSet: Set<string>,
  allowMissing: boolean
): void {
  if (!isSafeRelativePath(path)) {
    _packageErrors.push(`Invalid .cine package file (${sourceLabel}): "${fieldLabel}" must be a safe relative path, got "${path}"`);
    return;
  }
  if (!allowMissing && !packageFileSet.has(path)) {
    _packageErrors.push(`Invalid .cine package file (${sourceLabel}): referenced path "${path}" in "${fieldLabel}" does not exist in package`);
  }
}

function validateMediaRefObject(
  row: Record<string, unknown>,
  rowId: string,
  sourceLabel: string,
  field: 'mediaRefs' | 'generatedRefs',
  packageFileSet: Set<string>
): void {
  const raw = row[field];
  if (raw == null) return;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`Invalid .cine package file (${sourceLabel}): "${rowId}.${field}" must be an object`);
  }
  const refs = raw as Record<string, unknown>;
  for (const [bucket, values] of Object.entries(refs)) {
    if (!Array.isArray(values)) {
      throw new Error(
        `Invalid .cine package file (${sourceLabel}): "${rowId}.${field}.${bucket}" must be an array of paths`
      );
    }
    values.forEach((value, index) => {
      if (typeof value !== 'string' || !value.trim()) {
        throw new Error(
          `Invalid .cine package file (${sourceLabel}): "${rowId}.${field}.${bucket}[${index}]" must be a non-empty string`
        );
      }
      assertKnownPackagePath(
        value,
        sourceLabel,
        `${rowId}.${field}.${bucket}[${index}]`,
        packageFileSet,
        false
      );
    });
  }
}

function validateSceneOutputPaths(
  scenes: Record<string, unknown> | undefined,
  sourceLabel: string,
  packageFileSet: Set<string>
): void {
  if (!scenes) return;
  for (const [sceneId, rawScene] of Object.entries(scenes)) {
    if (!rawScene || typeof rawScene !== 'object' || Array.isArray(rawScene)) continue;
    const scene = rawScene as Record<string, unknown>;
    const masterRaw = scene.master;
    if (!masterRaw || typeof masterRaw !== 'object' || Array.isArray(masterRaw)) continue;
    const master = masterRaw as Record<string, unknown>;
    const outputPath = master.outputPath;
    if (outputPath == null) continue;
    if (typeof outputPath !== 'string' || !outputPath.trim()) {
      throw new Error(
        `Invalid .cine package file (${sourceLabel}): scene "${sceneId}" master.outputPath must be a non-empty string`
      );
    }
    const status = typeof master.status === 'string' ? master.status : '';
    const allowMissing = status === 'queued' || status === 'placeholder';
    assertKnownPackagePath(outputPath, sourceLabel, `${sceneId}.master.outputPath`, packageFileSet, allowMissing);
  }
}

function validateCatalogMediaPaths(
  rows: Record<string, unknown>[] | undefined,
  sourceLabel: string,
  packageFileSet: Set<string>
): void {
  if (!rows) return;
  for (const row of rows) {
    const rowId = assertStringField(row, 'id', sourceLabel, 'catalog item id');
    validateMediaRefObject(row, rowId, sourceLabel, 'mediaRefs', packageFileSet);
    validateMediaRefObject(row, rowId, sourceLabel, 'generatedRefs', packageFileSet);
  }
}

function validatePathBackedRows(
  rows: Record<string, unknown>[] | undefined,
  sourceLabel: string,
  statusField: string,
  packageFileSet: Set<string>
): void {
  if (!rows) return;
  for (const row of rows) {
    const rowId = assertStringField(row, 'id', sourceLabel, 'path-backed row id');
    const path = row.path;
    if (typeof path !== 'string' || !path.trim()) {
      throw new Error(
        `Invalid .cine package file (${sourceLabel}): "${rowId}.path" must be a non-empty string`
      );
    }
    const status = typeof row[statusField] === 'string' ? String(row[statusField]) : '';
    const allowMissing = status === 'placeholder' || status === 'queued';
    assertKnownPackagePath(path, sourceLabel, `${rowId}.path`, packageFileSet, allowMissing);
  }
}

function validateTreeNodeSchema(
  node: Record<string, unknown>,
  sourceLabel: string,
  pathLabel: string,
  sceneIds: Set<string>,
  assetDetailKeys: Set<string>
): void {
  const nodeType = typeof node.type === 'string' ? node.type : '';
  if (!nodeType) {
    throw new Error(`Invalid .cine package file (${sourceLabel}): node "${pathLabel}" missing required "type"`);
  }
  if (nodeType !== 'tree-divider' && nodeType !== 'group') {
    assertStringField(node, 'name', sourceLabel, '.cinetree schema');
  }

  const view = node.view;
  if (view != null) {
    if (typeof view !== 'string' || !view.trim()) {
      throw new Error(
        `Invalid .cine package file (${sourceLabel}): node "${pathLabel}" has invalid "view" (must be non-empty string)`
      );
    }
    if (!SUPPORTED_TREE_VIEWS.has(view)) {
      throw new Error(
        `Invalid .cine package file (${sourceLabel}): node "${pathLabel}" uses unsupported view "${view}"`
      );
    }
    const req = TREE_VIEW_REQUIREMENTS[view]?.requiredFields ?? [];
    for (const requiredField of req) {
      const requiredValue = node[requiredField];
      if (typeof requiredValue !== 'string' || !requiredValue.trim()) {
        throw new Error(
          `Invalid .cine package file (${sourceLabel}): node "${pathLabel}" missing required "${requiredField}" for view "${view}"`
        );
      }
    }
    if (view === 'asset-detail') {
      const detailKey = String(node.detailKey ?? '');
      if (!assetDetailKeys.has(detailKey)) {
        throw new Error(
          `Invalid .cine package file (${sourceLabel}): node "${pathLabel}" references unknown detailKey "${detailKey}"`
        );
      }
    }
  }

  if (nodeType === 'scene') {
    const sceneId = assertStringField(node, 'sceneId', sourceLabel, '.cinetree scene node schema');
    if (!sceneIds.has(sceneId)) {
      throw new Error(
        `Invalid .cine package file (${sourceLabel}): scene node "${pathLabel}" references missing sceneId "${sceneId}"`
      );
    }
  }

  const preprodMode = node.preprodMode;
  if (preprodMode != null) {
    if (typeof preprodMode !== 'string' || !PREPROD_MODES.has(preprodMode)) {
      throw new Error(
        `Invalid .cine package file (${sourceLabel}): node "${pathLabel}" has invalid preprodMode "${String(preprodMode)}"`
      );
    }
  }
  if (
    (nodeType === 'script' || nodeType === 'storyboard' || nodeType === 'scriptboard') &&
    (!preprodMode || typeof preprodMode !== 'string')
  ) {
    throw new Error(
      `Invalid .cine package file (${sourceLabel}): node "${pathLabel}" requires preprodMode for type "${nodeType}"`
    );
  }

  const children = node.children;
  if (children != null) {
    if (!Array.isArray(children)) {
      throw new Error(
        `Invalid .cine package file (${sourceLabel}): node "${pathLabel}" has non-array "children"`
      );
    }
    for (let i = 0; i < children.length; i += 1) {
      const child = children[i];
      if (!child || typeof child !== 'object' || Array.isArray(child)) {
        throw new Error(
          `Invalid .cine package file (${sourceLabel}): node "${pathLabel}.children[${i}]" must be an object`
        );
      }
      const childName = typeof (child as Record<string, unknown>).name === 'string'
        ? String((child as Record<string, unknown>).name)
        : `index-${i}`;
      validateTreeNodeSchema(
        child as Record<string, unknown>,
        sourceLabel,
        `${pathLabel}/${childName}`,
        sceneIds,
        assetDetailKeys
      );
    }
  }
}

function validateCrossFileIntegrity(params: {
  packageBasename: string;
  scenePath?: string;
  locationsPath?: string;
  charactersPath?: string;
  propsPath?: string;
  wardrobePath?: string;
  vehiclesPath?: string;
  effectsPath?: string;
  generatedPath?: string;
  importedPath?: string;
  outputsPath?: string;
  treePath?: string;
  scenes?: Record<string, unknown>;
  tree?: Record<string, unknown>;
  locations?: Record<string, unknown>[];
  characters?: Record<string, unknown>[];
  props?: Record<string, unknown>[];
  wardrobe?: Record<string, unknown>[];
  vehicles?: Record<string, unknown>[];
  effects?: Record<string, unknown>[];
  generatedAssets?: Record<string, unknown>[];
  importedAssets?: Record<string, unknown>[];
  outputs?: Record<string, unknown>[];
  assetDetails?: Record<string, unknown>;
}): void {
  const packagePrefix = `./project-files/${params.packageBasename}/`;
  const packageFileSet = new Set(
    Object.keys(packageRawByPath)
      .filter((k) => k.startsWith(packagePrefix))
      .map((k) => k.slice(packagePrefix.length))
  );

  const sceneIds = new Set<string>(Object.keys(params.scenes ?? {}));
  const locationsLabel = `${params.packageBasename}/${params.locationsPath ?? 'locations'}`;
  const charactersLabel = `${params.packageBasename}/${params.charactersPath ?? 'characters'}`;
  const propsLabel = `${params.packageBasename}/${params.propsPath ?? 'props'}`;
  const wardrobeLabel = `${params.packageBasename}/${params.wardrobePath ?? 'wardrobe'}`;
  const vehiclesLabel = `${params.packageBasename}/${params.vehiclesPath ?? 'vehicles'}`;
  const effectsLabel = `${params.packageBasename}/${params.effectsPath ?? 'effects'}`;
  const scenesLabel = `${params.packageBasename}/${params.scenePath ?? 'scenes'}`;
  const generatedLabel = `${params.packageBasename}/${params.generatedPath ?? 'generated'}`;
  const importedLabel = `${params.packageBasename}/${params.importedPath ?? 'imported'}`;
  const outputsLabel = `${params.packageBasename}/${params.outputsPath ?? 'outputs'}`;
  const treeLabel = `${params.packageBasename}/${params.treePath ?? 'tree'}`;

  const locationIds = buildIdSet(params.locations, locationsLabel, '.cinelocations schema');
  const characterIds = buildIdSet(params.characters, charactersLabel, '.cinecharacters schema');
  const propIds = buildIdSet(params.props, propsLabel, '.cineprops schema');
  const wardrobeIds = buildIdSet(params.wardrobe, wardrobeLabel, '.cinewardrobe schema');
  const vehicleIds = buildIdSet(params.vehicles, vehiclesLabel, '.cinevehicles schema');
  const effectIds = buildIdSet(params.effects, effectsLabel, '.cineeffects schema');

  validateSceneRefs(params.scenes, scenesLabel, 'locationIds', locationIds, 'location');
  validateSceneRefs(params.scenes, scenesLabel, 'characterIds', characterIds, 'character');
  validateSceneRefs(params.scenes, scenesLabel, 'propIds', propIds, 'prop');
  validateSceneRefs(params.scenes, scenesLabel, 'wardrobeIds', wardrobeIds, 'wardrobe');
  validateSceneRefs(params.scenes, scenesLabel, 'vehicleIds', vehicleIds, 'vehicle');
  validateSceneRefs(params.scenes, scenesLabel, 'effectIds', effectIds, 'effect');

  validateUsageRefs(params.locations, locationsLabel, '.cinelocations schema', sceneIds);
  validateUsageRefs(params.characters, charactersLabel, '.cinecharacters schema', sceneIds);
  validateUsageRefs(params.props, propsLabel, '.cineprops schema', sceneIds);
  validateUsageRefs(params.wardrobe, wardrobeLabel, '.cinewardrobe schema', sceneIds);

  if (params.wardrobe) {
    for (const row of params.wardrobe) {
      const wardrobeId = assertStringField(row, 'id', wardrobeLabel, '.cinewardrobe schema');
      const characterId = row.characterId;
      if (characterId == null) continue;
      if (typeof characterId !== 'string' || !characterId.trim()) {
        throw new Error(
          `Invalid .cine package file (${wardrobeLabel}): "${wardrobeId}.characterId" must be a non-empty string (.cinewardrobe schema)`
        );
      }
      if (!characterIds.has(characterId)) {
        throw new Error(
          `Invalid .cine package file (${wardrobeLabel}): "${wardrobeId}" references missing characterId "${characterId}" (.cinewardrobe schema)`
        );
      }
    }
  }

  const relatedSets = {
    sceneId: sceneIds,
    locationId: locationIds,
    characterId: characterIds,
    propId: propIds,
    wardrobeId: wardrobeIds,
    vehicleId: vehicleIds,
    effectId: effectIds,
  };
  validateRelatedIds(params.generatedAssets, generatedLabel, '.cinegenerated schema', relatedSets);
  validateRelatedIds(params.importedAssets, importedLabel, '.cineimported schema', relatedSets);

  validateCatalogMediaPaths(params.locations, locationsLabel, packageFileSet);
  validateCatalogMediaPaths(params.props, propsLabel, packageFileSet);
  validateCatalogMediaPaths(params.wardrobe, wardrobeLabel, packageFileSet);

  validatePathBackedRows(params.generatedAssets, generatedLabel, 'status', packageFileSet);
  validatePathBackedRows(params.importedAssets, importedLabel, 'status', packageFileSet);
  validatePathBackedRows(params.outputs, outputsLabel, 'status', packageFileSet);
  validateSceneOutputPaths(params.scenes, scenesLabel, packageFileSet);

  const assetDetailKeys = new Set(Object.keys(params.assetDetails ?? {}));
  if (params.tree) {
    validateTreeNodeSchema(params.tree, treeLabel, String(params.tree.name ?? 'root'), sceneIds, assetDetailKeys);
  }
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

  validateCrossFileIntegrity({
    packageBasename,
    scenePath: documents.scenes,
    locationsPath: documents.locations,
    charactersPath: documents.characters,
    propsPath: documents.props,
    wardrobePath: documents.wardrobe,
    vehiclesPath: documents.vehicles,
    effectsPath: documents.effects,
    generatedPath: documents.generatedAssets,
    importedPath: documents.importedAssets,
    outputsPath: documents.outputs,
    treePath: documents.tree,
    tree,
    scenes,
    locations,
    characters,
    props,
    wardrobe,
    vehicles,
    effects,
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
    screenplay: loadScreenplayDoc(packageBasename, documents.screenplay),
    treatment: loadTreatmentDoc(packageBasename, documents.treatment),
    storyboard: loadStoryboardDoc(packageBasename, documents.storyboard),
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
  timelineClips: unknown[];
  locationLibrary: unknown[];
  assetLibrary: Record<string, unknown>;
  breakdownData: unknown[];
  assetDetailData: Record<string, unknown>;
  projectScreenplay: CineProjectScreenplay;
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
    timelineClips: doc.timeline ?? [],
    locationLibrary: doc.locations ?? [],
    assetLibrary: assets,
    breakdownData: doc.breakdown ?? [],
    assetDetailData: (doc.assetDetails && typeof doc.assetDetails === 'object' ? doc.assetDetails : {}) as Record<string, unknown>,
  };
}

export function loadAndApplyCineFile(filename: string): AppliedCineProject {
  return applyCineProject(loadCineProjectByFile(filename));
}
