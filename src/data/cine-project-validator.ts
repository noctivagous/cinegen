/**
 * Shared cross-file integrity validator for .cine packages.
 *
 * Accepts parsed document objects and an optional Set of package-relative
 * file paths. When packageFileSet is omitted, file-existence checks
 * (media paths, output paths) are skipped so the validator can be run on
 * server-resident projects that do not bundle binary assets.
 *
 * Used by:
 * - cine-project-loader.ts (bundled Vite packages)
 * - project-serializer.ts (write-time validation before POST)
 */

import { PREPROD_MODES, SUPPORTED_TREE_VIEWS, TREE_VIEW_REQUIREMENTS } from '@/tree/tree-view-contract';

export function parseJsonValue(raw: string, sourceLabel: string): unknown {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid .cine package file (${sourceLabel}): not valid JSON`);
  }
  return value;
}

export function assertObject(value: unknown, sourceLabel: string, schemaHint: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid .cine package file (${sourceLabel}): expected object (${schemaHint})`);
  }
  return value as Record<string, unknown>;
}

export function assertArray(value: unknown, sourceLabel: string, schemaHint: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid .cine package file (${sourceLabel}): expected array (${schemaHint})`);
  }
  return value;
}

export function assertStringField(
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

export function optionalStringArrayField(
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

export function validateArrayOfRecords(
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

export function assertDocExtension(relativePath: string, extension: string, sourceLabel: string): void {
  if (!relativePath.endsWith(extension)) {
    throw new Error(
      `Invalid .cine package file (${sourceLabel}): expected "${extension}" file path, got "${relativePath}"`
    );
  }
}

export function buildIdSet(
  rows: Record<string, unknown>[] | undefined,
  sourceLabel: string,
  schemaHint: string
): Set<string> {
  const ids = new Set<string>();
  if (!rows) return ids;
  for (const row of rows) ids.add(assertStringField(row, 'id', sourceLabel, schemaHint));
  return ids;
}

export function validateSceneRefs(
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

export function validateUsageRefs(
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

export function validateRelatedIds(
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

export function isSafeRelativePath(path: string): boolean {
  return !!path && !path.startsWith('/') && !path.includes('..');
}

export function assertKnownPackagePath(
  path: string,
  sourceLabel: string,
  fieldLabel: string,
  packageFileSet: Set<string>,
  allowMissing: boolean
): void {
  if (!isSafeRelativePath(path)) {
    throw new Error(
      `Invalid .cine package file (${sourceLabel}): "${fieldLabel}" must be a safe relative path, got "${path}"`
    );
  }
  if (!allowMissing && !packageFileSet.has(path)) {
    throw new Error(
      `Invalid .cine package file (${sourceLabel}): referenced path "${path}" in "${fieldLabel}" does not exist in package`
    );
  }
}

export function validateMediaRefObject(
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
      assertKnownPackagePath(value, sourceLabel, `${rowId}.${field}.${bucket}[${index}]`, packageFileSet, false);
    });
  }
}

export function validateCatalogMediaPaths(
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

export function validatePathBackedRows(
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

export function validateSceneOutputPaths(
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

export function validateTreeNodeSchema(
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

export function sceneIdFromStoryboardSceneNumber(sceneNum: string): string {
  const num = String(sceneNum || '1').replace(/\D/g, '') || '1';
  return `scene${num.padStart(2, '0')}`;
}

export function validateShotFrameLinks(params: {
  scenes?: Record<string, unknown>;
  storyboard?: { frames?: unknown[] };
  sourceLabel: string;
}): void {
  const scenes = params.scenes ?? {};
  const frames = Array.isArray(params.storyboard?.frames) ? params.storyboard.frames : [];
  const frameById = new Map<number, Record<string, unknown>>();
  for (const raw of frames) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const row = raw as Record<string, unknown>;
    const id = row.id;
    if (typeof id !== 'number') continue;
    frameById.set(id, row);
  }

  const shotIdsByScene = new Map<string, Set<number>>();
  for (const [sceneId, rawScene] of Object.entries(scenes)) {
    if (!rawScene || typeof rawScene !== 'object' || Array.isArray(rawScene)) continue;
    const coverage = (rawScene as Record<string, unknown>).coverage;
    if (!Array.isArray(coverage)) continue;
    const ids = new Set<number>();
    for (const rawShot of coverage) {
      if (!rawShot || typeof rawShot !== 'object' || Array.isArray(rawShot)) continue;
      const shot = rawShot as Record<string, unknown>;
      const shotId = shot.id;
      if (typeof shotId !== 'number') {
        throw new Error(
          `Invalid .cine package file (${params.sourceLabel}): "${sceneId}.coverage[]" entries require numeric "id"`
        );
      }
      ids.add(shotId);
      const frameIds = shot.frameIds;
      if (!frameIds) continue;
      if (!Array.isArray(frameIds)) {
        throw new Error(
          `Invalid .cine package file (${params.sourceLabel}): "${sceneId}.coverage" shot ${shotId} "frameIds" must be an array`
        );
      }
      for (const frameId of frameIds) {
        if (typeof frameId !== 'number') {
          throw new Error(
            `Invalid .cine package file (${params.sourceLabel}): "${sceneId}.coverage" shot ${shotId} "frameIds" must contain numbers`
          );
        }
        const frame = frameById.get(frameId);
        if (!frame) {
          throw new Error(
            `Invalid .cine package file (${params.sourceLabel}): "${sceneId}.coverage" shot ${shotId} references missing storyboard frame id ${frameId}`
          );
        }
        const frameSceneId = sceneIdFromStoryboardSceneNumber(String(frame.scene ?? '1'));
        if (frameSceneId !== sceneId) {
          throw new Error(
            `Invalid .cine package file (${params.sourceLabel}): frame ${frameId} belongs to ${frameSceneId}, not ${sceneId}`
          );
        }
        if (frame.shotId != null && frame.shotId !== shotId) {
          throw new Error(
            `Invalid .cine package file (${params.sourceLabel}): frame ${frameId} shotId ${frame.shotId} disagrees with shot ${shotId} frameIds`
          );
        }
      }
    }
    shotIdsByScene.set(sceneId, ids);
  }

  for (const raw of frames) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const frame = raw as Record<string, unknown>;
    const frameId = frame.id;
    const shotId = frame.shotId;
    if (typeof frameId !== 'number' || shotId == null) continue;
    if (typeof shotId !== 'number') {
      throw new Error(
        `Invalid .cine package file (${params.sourceLabel}): frame ${frameId} "shotId" must be a number`
      );
    }
    const sceneId = sceneIdFromStoryboardSceneNumber(String(frame.scene ?? '1'));
    const shotIds = shotIdsByScene.get(sceneId);
    if (!shotIds?.has(shotId)) {
      throw new Error(
        `Invalid .cine package file (${params.sourceLabel}): frame ${frameId} references missing coverage shot ${shotId} in ${sceneId}`
      );
    }
  }
}

export type ValidateCrossFileIntegrityParams = {
  packageBasename: string;
  scenePath?: string;
  storyboardPath?: string;
  locationsPath?: string;
  charactersPath?: string;
  propsPath?: string;
  wardrobePath?: string;
  vehiclesPath?: string;
  effectsPath?: string;
  setsPath?: string;
  adrPath?: string;
  foleyPath?: string;
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
  sets?: Record<string, unknown>[];
  adr?: Record<string, unknown>[];
  foley?: Record<string, unknown>[];
  generatedAssets?: Record<string, unknown>[];
  importedAssets?: Record<string, unknown>[];
  outputs?: Record<string, unknown>[];
  assetDetails?: Record<string, unknown>;
  storyboard?: { frames?: unknown[] };
  /** If provided, file-existence checks (media paths, output paths) are enforced. Omit for server-resident projects. */
  packageFileSet?: Set<string>;
};

export function validateCrossFileIntegrity(params: ValidateCrossFileIntegrityParams): void {
  const hasFileSet = params.packageFileSet != null;
  const packageFileSet = params.packageFileSet ?? new Set<string>();

  const locationsLabel = `${params.packageBasename}/${params.locationsPath ?? 'locations'}`;
  const charactersLabel = `${params.packageBasename}/${params.charactersPath ?? 'characters'}`;
  const propsLabel = `${params.packageBasename}/${params.propsPath ?? 'props'}`;
  const wardrobeLabel = `${params.packageBasename}/${params.wardrobePath ?? 'wardrobe'}`;
  const vehiclesLabel = `${params.packageBasename}/${params.vehiclesPath ?? 'vehicles'}`;
  const effectsLabel = `${params.packageBasename}/${params.effectsPath ?? 'effects'}`;
  const scenesLabel = `${params.packageBasename}/${params.scenePath ?? 'scenes'}`;
  const setsLabel = `${params.packageBasename}/${params.setsPath ?? 'sets'}`;
  const adrLabel = `${params.packageBasename}/${params.adrPath ?? 'adr'}`;
  const foleyLabel = `${params.packageBasename}/${params.foleyPath ?? 'foley'}`;
  const generatedLabel = `${params.packageBasename}/${params.generatedPath ?? 'generated'}`;
  const importedLabel = `${params.packageBasename}/${params.importedPath ?? 'imported'}`;
  const outputsLabel = `${params.packageBasename}/${params.outputsPath ?? 'outputs'}`;
  const treeLabel = `${params.packageBasename}/${params.treePath ?? 'tree'}`;

  const sceneIds = new Set<string>(Object.keys(params.scenes ?? {}));

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

  if (params.sets) {
    const setIds = buildIdSet(params.sets, setsLabel, '.cinesets schema');
    for (const row of params.sets) {
      const setId = assertStringField(row, 'id', setsLabel, '.cinesets schema');
      const locationId = row.locationId;
      if (locationId == null) continue;
      if (typeof locationId !== 'string' || !locationId.trim()) {
        throw new Error(
          `Invalid .cine package file (${setsLabel}): "${setId}.locationId" must be a non-empty string (.cinesets schema)`
        );
      }
      if (!locationIds.has(locationId)) {
        throw new Error(
          `Invalid .cine package file (${setsLabel}): "${setId}" references missing locationId "${locationId}" (.cinesets schema)`
        );
      }
    }
  }

  if (params.adr) {
    for (const row of params.adr) {
      const adrId = assertStringField(row, 'id', adrLabel, '.cineadr schema');
      const characterId = row.characterId;
      if (characterId == null) continue;
      if (typeof characterId !== 'string' || !characterId.trim()) {
        throw new Error(
          `Invalid .cine package file (${adrLabel}): "${adrId}.characterId" must be a non-empty string (.cineadr schema)`
        );
      }
      if (!characterIds.has(characterId)) {
        throw new Error(
          `Invalid .cine package file (${adrLabel}): "${adrId}" references missing characterId "${characterId}" (.cineadr schema)`
        );
      }
    }
  }

  if (params.foley) {
    for (const row of params.foley) {
      const foleyId = assertStringField(row, 'id', foleyLabel, '.cinefoley schema');
      const characterId = row.characterId;
      if (characterId == null) continue;
      if (typeof characterId !== 'string' || !characterId.trim()) {
        throw new Error(
          `Invalid .cine package file (${foleyLabel}): "${foleyId}.characterId" must be a non-empty string (.cinefoley schema)`
        );
      }
      if (!characterIds.has(characterId)) {
        throw new Error(
          `Invalid .cine package file (${foleyLabel}): "${foleyId}" references missing characterId "${characterId}" (.cinefoley schema)`
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

  // File-existence checks only meaningful for bundled packages with embedded media
  if (hasFileSet) {
    validateCatalogMediaPaths(params.locations, locationsLabel, packageFileSet);
    validateCatalogMediaPaths(params.props, propsLabel, packageFileSet);
    validateCatalogMediaPaths(params.wardrobe, wardrobeLabel, packageFileSet);
    if (params.sets) {
      validateCatalogMediaPaths(params.sets, setsLabel, packageFileSet);
    }

    validatePathBackedRows(params.generatedAssets, generatedLabel, 'status', packageFileSet);
    validatePathBackedRows(params.importedAssets, importedLabel, 'status', packageFileSet);
    validatePathBackedRows(params.outputs, outputsLabel, 'status', packageFileSet);
    validateSceneOutputPaths(params.scenes, scenesLabel, packageFileSet);
  }

  const assetDetailKeys = new Set(Object.keys(params.assetDetails ?? {}));
  if (params.tree) {
    validateTreeNodeSchema(params.tree, treeLabel, String(params.tree.name ?? 'root'), sceneIds, assetDetailKeys);
  }

  if (params.scenes && params.storyboard) {
    validateShotFrameLinks({
      scenes: params.scenes,
      storyboard: params.storyboard,
      sourceLabel: `${params.packageBasename}/${params.storyboardPath ?? 'storyboard'}`,
    });
  }
}
