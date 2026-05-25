import {
  createEmptyAssetWizardState,
  type AssetWizardState,
  type LibrarySourceProject,
  type ImportedCharacter,
  type ImportedLocation,
  type ImportedProp,
  generateImportId,
} from '@/wizard/asset-wizard-state';

import { storageService } from '@/services/persistence';
import { LOCAL_PROJECTS_STORAGE_KEY } from '@/constants/storage-keys';
import { listCineProjectFiles, loadCineProjectByFile } from '@/data/cine-project-loader';

let _state: AssetWizardState = createEmptyAssetWizardState();

export function getAssetWizardState(): AssetWizardState {
  return _state;
}

export function resetAssetWizardState(): void {
  _state = createEmptyAssetWizardState();
}

export function setAssetWizardProjectId(id: string): void {
  _state.projectId = id;
}

function extractAssetCounts(snapshot: Record<string, unknown>): { characters: number; locations: number; props: number } {
  const lib = (snapshot?.assetLibrary ?? {}) as Record<string, unknown>;
  const chars = Array.isArray(lib.characters) ? lib.characters : [];
  const locs = Array.isArray(lib.locations) ? lib.locations : [];
  const props = Array.isArray(lib.props) ? lib.props : [];
  return { characters: chars.length, locations: locs.length, props: props.length };
}

type PersistedProjectRecord = {
  id: string;
  name: string;
  updatedAt: string;
  snapshot: Record<string, unknown>;
};

function readLocalProjects(): LibrarySourceProject[] {
  try {
    const raw = storageService.getItem(LOCAL_PROJECTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as PersistedProjectRecord[])
      .filter((r) => r.snapshot?.assetLibrary)
      .map((r) => ({
        id: r.id,
        name: r.name || 'Untitled',
        source: 'local' as const,
        updatedAt: r.updatedAt || '',
        assetCounts: extractAssetCounts(r.snapshot),
      }));
  } catch {
    return [];
  }
}

function readCineProjects(): LibrarySourceProject[] {
  try {
    const files = listCineProjectFiles();
  const result: LibrarySourceProject[] = [];
  for (const f of files) {
    try {
      const doc = loadCineProjectByFile(f);
      result.push({
        id: doc.id || f,
        name: doc.name || f.replace('.cine', ''),
        source: 'cine' as const,
        updatedAt: '',
        assetCounts: extractAssetCounts(doc as unknown as Record<string, unknown>),
      });
    } catch {
      // skip invalid .cine files
    }
  }
  return result;
  } catch {
    return [];
  }
}

export function refreshProjectList(): void {
  _state.sourceProjects = [...readLocalProjects(), ...readCineProjects()];
}

function extractCharacter(raw: unknown): ImportedCharacter | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const name = String(r.name || r.Name || '');
  if (!name) return null;
  return {
    id: generateImportId('char'),
    srcId: String(r.id || ''),
    name,
    role: String(r.role || r.Role || r.type || 'supporting'),
    description: String(r.desc || r.Desc || r.description || ''),
    selected: true,
  };
}

function extractLocation(raw: unknown): ImportedLocation | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const name = String(r.name || r.Name || '');
  if (!name) return null;
  const tags = String(r.tags || '');
  const isExt = tags.toLowerCase().includes('exterior');
  const isInt = tags.toLowerCase().includes('interior');
  let intExt = 'INT/EXT';
  if (isExt && !isInt) intExt = 'EXT';
  else if (isInt && !isExt) intExt = 'INT';
  return {
    id: generateImportId('loc'),
    srcId: String(r.id || ''),
    name,
    intExt,
    description: String(r.desc || r.Desc || r.description || tags),
    selected: true,
  };
}

function extractProp(raw: unknown): ImportedProp | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const name = String(r.name || r.Name || '');
  if (!name) return null;
  return {
    id: generateImportId('prop'),
    srcId: String(r.id || ''),
    name,
    description: String(r.desc || r.Desc || r.description || ''),
    selected: true,
  };
}

function loadAssetLibraryFromSource(sourceId: string): {
  characters: ImportedCharacter[];
  locations: ImportedLocation[];
  props: ImportedProp[];
} {
  let assetLib: Record<string, unknown> | null = null;

  const localRaw = storageService.getItem(LOCAL_PROJECTS_STORAGE_KEY);
  if (localRaw) {
    try {
      const records = JSON.parse(localRaw) as PersistedProjectRecord[];
      const match = records.find((r) => r.id === sourceId);
      if (match?.snapshot?.assetLibrary) {
        assetLib = match.snapshot.assetLibrary as Record<string, unknown>;
      }
    } catch { }
  }

  if (!assetLib) {
    try {
      const cineFiles = listCineProjectFiles();
      for (const f of cineFiles) {
        const doc = loadCineProjectByFile(f);
        if (doc.id === sourceId || f === sourceId) {
          assetLib = (doc as unknown as Record<string, unknown>).assetLibrary as Record<string, unknown>;
          break;
        }
      }
    } catch { }
  }

  if (!assetLib) return { characters: [], locations: [], props: [] };

  const chars = Array.isArray(assetLib.characters) ? assetLib.characters.map(extractCharacter).filter(Boolean) as ImportedCharacter[] : [];
  const locs = Array.isArray(assetLib.locations) ? assetLib.locations.map(extractLocation).filter(Boolean) as ImportedLocation[] : [];
  const props = Array.isArray(assetLib.props) ? assetLib.props.map(extractProp).filter(Boolean) as ImportedProp[] : [];

  return { characters: chars, locations: locs, props: props };
}

export function selectSourceProject(sourceId: string): void {
  _state.selectedSourceId = sourceId;
  const assets = loadAssetLibraryFromSource(sourceId);
  _state.sourceCharacters = assets.characters;
  _state.sourceLocations = assets.locations;
  _state.sourceProps = assets.props;
  _state.pendingCharacters = assets.characters.map((c) => ({ ...c }));
  _state.pendingLocations = assets.locations.map((l) => ({ ...l }));
  _state.pendingProps = assets.props.map((p) => ({ ...p }));
  _state.sourceStyleNotes = '';
  _state.sourceColorPalette = [];
  _state.sourceLightingMood = '';
}

export function toggleCharacter(id: string): void {
  const c = _state.pendingCharacters.find((x) => x.id === id);
  if (c) c.selected = !c.selected;
}

export function toggleLocation(id: string): void {
  const l = _state.pendingLocations.find((x) => x.id === id);
  if (l) l.selected = !l.selected;
}

export function toggleProp(id: string): void {
  const p = _state.pendingProps.find((x) => x.id === id);
  if (p) p.selected = !p.selected;
}

export function updateCharacter(id: string, partial: Partial<ImportedCharacter>): void {
  const c = _state.pendingCharacters.find((x) => x.id === id);
  if (c) Object.assign(c, partial);
}

export function updateLocation(id: string, partial: Partial<ImportedLocation>): void {
  const l = _state.pendingLocations.find((x) => x.id === id);
  if (l) Object.assign(l, partial);
}

export function updateProp(id: string, partial: Partial<ImportedProp>): void {
  const p = _state.pendingProps.find((x) => x.id === id);
  if (p) Object.assign(p, partial);
}

export function removeCharacter(id: string): void {
  _state.pendingCharacters = _state.pendingCharacters.filter((x) => x.id !== id);
}

export function removeLocation(id: string): void {
  _state.pendingLocations = _state.pendingLocations.filter((x) => x.id !== id);
}

export function removeProp(id: string): void {
  _state.pendingProps = _state.pendingProps.filter((x) => x.id !== id);
}

export function setStyleAdopted(v: boolean): void {
  _state.styleAdopted = v;
}

export function runGapAnalysis(scriptText: string): void {
  const lower = scriptText.toLowerCase();
  const missingChars: string[] = [];
  const missingLocs: string[] = [];
  const selectedChars = _state.pendingCharacters.filter((c) => c.selected).map((c) => c.name.toLowerCase());
  const selectedLocs = _state.pendingLocations.filter((l) => l.selected).map((l) => l.name.toLowerCase());

  for (const c of _state.sourceCharacters) {
    if (!selectedChars.includes(c.name.toLowerCase()) && lower.includes(c.name.toLowerCase().split(' ')[0])) {
      missingChars.push(c.name);
    }
  }

  const intExtPattern = /\.\s*(INT|EXT|INT\/EXT)\./gi;
  let m;
  while ((m = intExtPattern.exec(lower)) !== null) {
    const context = lower.slice(Math.max(0, m.index - 40), m.index + 40);
    for (const loc of _state.sourceLocations) {
      if (!selectedLocs.includes(loc.name.toLowerCase()) && context.includes(loc.name.toLowerCase().split(' ')[0])) {
        if (!missingLocs.includes(loc.name)) missingLocs.push(loc.name);
      }
    }
  }

  _state.gapAnalysis = { missingChars, missingLocs };
}

export function setScriptGenerated(): void {
  _state.scriptGenerated = true;
}

export function setSceneKitBuilt(): void {
  _state.sceneKitBuilt = true;
}

export function buildOutlinePayload():
  | { characters: Array<{ name: string; role: string; description: string }>; locations: Array<{ name: string; intExt: string; description: string }>; style: { palette: string[]; mood: string; notes: string } }
  | null {
  const chars = _state.pendingCharacters.filter((c) => c.selected).map((c) => ({
    name: c.name,
    role: c.role,
    description: c.description,
  }));
  const locs = _state.pendingLocations.filter((l) => l.selected).map((l) => ({
    name: l.name,
    intExt: l.intExt,
    description: l.description,
  }));
  if (!chars.length && !locs.length) return null;
  return {
    characters: chars,
    locations: locs,
    style: {
      palette: _state.sourceColorPalette,
      mood: _state.sourceLightingMood,
      notes: _state.sourceStyleNotes,
    },
  };
}

export function buildImportPayload(): {
  characters: ImportedCharacter[];
  locations: ImportedLocation[];
  props: ImportedProp[];
} {
  return {
    characters: _state.pendingCharacters.filter((c) => c.selected),
    locations: _state.pendingLocations.filter((l) => l.selected),
    props: _state.pendingProps.filter((p) => p.selected),
  };
}
