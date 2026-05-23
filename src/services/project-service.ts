/**
 * ── NOTE ──
 * Project metadata (id, name, timestamps) is persisted via the abstracted
 * storageService. In local mode this uses localStorage; in collaborative
 * deployments, use server mode so project records sync across users.
 * This file stores project metadata ONLY — no API keys or auth tokens.
 * ─────────
 */

import type { AppliedCineProject } from '@/data/cine-project-loader';
import { DEFAULT_FOUNTAIN_SCRIPT } from '@/data/default-fountain-script';
import {
  DEFAULT_PROJECT_SETTINGS,
  applyProjectSnapshot,
  projectRegistry,
} from '@/data/project-data';
import { LOCAL_PROJECTS_STORAGE_KEY } from '@/constants/storage-keys';
import { storageService } from '@/services/persistence';

export type ProjectPersistenceMode = 'local' | 'server';

export type CreateBlankProjectResult = {
  id: string;
  name: string;
};

type PersistedProjectRecord = {
  id: string;
  name: string;
  settings: Record<string, unknown>;
  snapshot: AppliedCineProject;
  updatedAt: string;
};

function resolveProjectPersistenceMode(): ProjectPersistenceMode {
  const env = (
    import.meta as ImportMeta & { env?: Record<string, string | boolean | undefined> }
  ).env;
  const rawMode = String(env?.VITE_PROJECT_PERSISTENCE_MODE ?? 'local').trim().toLowerCase();
  return rawMode === 'server' ? 'server' : 'local';
}

function buildNextUntitledName(): string {
  const base = 'Untitled Production';
  const taken = new Set(
    projectRegistry.map((project) => String(project.name || '').trim().toLowerCase()).filter(Boolean)
  );
  if (!taken.has(base.toLowerCase())) return base;
  let idx = 2;
  while (taken.has(`${base} ${idx}`.toLowerCase())) idx += 1;
  return `${base} ${idx}`;
}

function generateLocalProjectId(): string {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `proj-local-${stamp}-${rand}`;
}

const DEFAULT_BLANK_PROJECT_TREE = [
  {
    name: 'Pre-Production',
    type: 'folder',
    icon: 'fa-folder',
    view: 'overview',
    desc: 'Script, storyboard, scene breakdowns, and casting',
    expanded: true,
    children: [
      {
        type: 'group',
        children: [
          { name: 'Script', type: 'script', icon: 'fa-scroll', view: 'preprod-workspace', preprodMode: 'script', desc: 'Fountain screenplay editor' },
          { name: 'Storyboard', type: 'storyboard', icon: 'fa-images', view: 'preprod-workspace', preprodMode: 'storyboard', desc: 'Frame-by-frame visual sequence' },
          { name: 'Script + Storyboard', type: 'scriptboard', icon: 'fa-columns', view: 'preprod-workspace', preprodMode: 'both', desc: 'Side-by-side writing and boarding' },
        ],
      },
      { name: 'Breakdown Sheets', type: 'breakdown', icon: 'fa-table-list', view: 'breakdown', desc: 'Scene-by-scene element analysis' },
      { name: 'Virtual Location Scout', type: 'location-scout', icon: 'fa-map', view: 'location-scout', desc: 'Browse and generate shooting environments' },
      { name: 'Shot List', type: 'list', icon: 'fa-list-check', view: 'asset-detail', detailKey: 'shot-list', desc: 'All production shots across every scene' },
      { name: 'Casting / Characters', type: 'casting', icon: 'fa-users', view: 'casting', desc: 'Character profiles, actor references, and voice data' },
    ],
  },
  {
    name: 'Production Design',
    type: 'folder',
    icon: 'fa-clapperboard',
    view: 'overview',
    desc: 'Locations, props, wardrobe, vehicles, and visual style',
    expanded: true,
    children: [
      {
        name: 'Props',
        type: 'folder',
        icon: 'fa-box-open',
        view: 'overview',
        desc: 'Physical and digital props tracked across all scenes',
        expanded: true,
        children: [
          { name: 'Prop Library', type: 'production', icon: 'fa-boxes-stacked', view: 'asset-detail', detailKey: 'prop-library', desc: 'Full catalogue of production props' },
          { name: 'Set Dressing', type: 'production', icon: 'fa-couch', view: 'asset-detail', detailKey: 'set-dressing', desc: 'Background elements and environmental dressing' },
          { name: 'Interactive / Hero Props', type: 'production', icon: 'fa-star', view: 'asset-detail', detailKey: 'hero-props', desc: 'Scripted props requiring close-up shots and continuity' },
        ],
      },
      {
        name: 'Wardrobe',
        type: 'folder',
        icon: 'fa-shirt',
        view: 'overview',
        desc: 'Character costumes, accessories, and hairstyles',
        expanded: true,
        children: [
          { name: 'Outfit Sets', type: 'production', icon: 'fa-vest', view: 'asset-detail', detailKey: 'outfit-sets', desc: 'Complete costume looks per character per scene range' },
          { name: 'Clothing Items', type: 'production', icon: 'fa-shirt', view: 'asset-detail', detailKey: 'clothing-items', desc: 'Individual garments available for outfit assembly' },
          { name: 'Accessories', type: 'production', icon: 'fa-hat-cowboy', view: 'asset-detail', detailKey: 'accessories', desc: 'Hats, bags, holsters, and character-specific items' },
          { name: 'Hairstyles', type: 'production', icon: 'fa-scissors', view: 'asset-detail', detailKey: 'hairstyles', desc: 'Character hair references for AI generation consistency' },
          { name: 'Wardrobe Continuity', type: 'production', icon: 'fa-link', view: 'asset-detail', detailKey: 'wardrobe-continuity', desc: 'Scene-by-scene wardrobe state for each character' },
        ],
      },
      {
        name: 'Locations',
        type: 'folder',
        icon: 'fa-map-location-dot',
        view: 'overview',
        desc: 'Real and virtual shooting environments',
        expanded: true,
        children: [
          { name: 'Location Library', type: 'production', icon: 'fa-map', view: 'location-scout', desc: 'Browse and search all shooting locations' },
          { name: 'Set Builds & Stages', type: 'production', icon: 'fa-building', view: 'asset-detail', detailKey: 'set-builds', desc: 'Sound stage builds and constructed interior sets' },
          { name: 'Location Continuity', type: 'production', icon: 'fa-link', view: 'asset-detail', detailKey: 'location-continuity', desc: 'Scene-by-scene environmental and time-of-day continuity' },
        ],
      },
      {
        name: 'Vehicles',
        type: 'folder',
        icon: 'fa-car',
        view: 'overview',
        desc: 'All vehicles and their appearance states',
        expanded: true,
        children: [
          { name: 'Cars, Aircraft, Boats, etc.', type: 'production', icon: 'fa-car', view: 'asset-detail', detailKey: 'vehicles', desc: 'Full vehicle catalogue with reference descriptions' },
          { name: 'Vehicle States', type: 'production', icon: 'fa-gears', view: 'asset-detail', detailKey: 'vehicle-states', desc: 'Per-scene appearance states for continuity' },
        ],
      },
      {
        name: 'Art Direction & Design',
        type: 'folder',
        icon: 'fa-palette',
        view: 'overview',
        desc: 'Visual properties, palettes, and look guidelines',
        expanded: true,
        children: [
          { name: 'Color Palette / Grading LUTs', type: 'production', icon: 'fa-droplet', view: 'asset-detail', detailKey: 'color-palettes', desc: 'Named color palettes and LUT files for the production' },
          { name: 'Overall Visual Style / Look Library', type: 'production', icon: 'fa-eye', view: 'asset-detail', detailKey: 'visual-style', desc: 'Visual properties, rules, and look guidelines' },
          { name: 'Texture & Material Library', type: 'production', icon: 'fa-layer-group', view: 'asset-detail', detailKey: 'textures', desc: 'Surface texture references for AI generation accuracy' },
          { name: 'Architectural / Historical References', type: 'production', icon: 'fa-landmark', view: 'asset-detail', detailKey: 'arch-refs', desc: 'Period and architecture references for environments' },
        ],
      },
      {
        name: 'Camera, Lighting & Atmosphere',
        type: 'folder',
        icon: 'fa-camera',
        view: 'camera-lighting',
        desc: 'Shot types, angles, movement, and lighting presets',
        expanded: true,
        children: [
          { name: 'Shot Types & Framing', type: 'production', icon: 'fa-expand', view: 'camera-lighting', clSection: 'shot-types', desc: 'Field size from ECU to ELS' },
          { name: 'Camera Angles', type: 'production', icon: 'fa-arrows-to-dot', view: 'camera-lighting', clSection: 'angles', desc: 'Eye-level, high, low, dutch, POV' },
          { name: 'Frame Composition', type: 'production', icon: 'fa-crop', view: 'camera-lighting', clSection: 'composition', desc: 'Rule of thirds, leading lines, symmetry' },
          { name: 'Camera Movements', type: 'production', icon: 'fa-arrows-left-right', view: 'camera-lighting', clSection: 'movements', desc: 'Dolly, pan, tilt, crane, handheld' },
          { name: 'Lighting Techniques', type: 'production', icon: 'fa-lightbulb', view: 'camera-lighting', clSection: 'lighting', desc: 'Three-point, low-key, practical, golden hour' },
          { name: 'Atmospheric Effects', type: 'production', icon: 'fa-cloud-rain', view: 'camera-lighting', clSection: 'atmosphere', desc: 'Rain, fog, dust, god rays, haze' },
        ],
      },
    ],
  },
  {
    name: 'Sound Department',
    type: 'folder',
    icon: 'fa-headphones',
    view: 'overview',
    desc: 'Production audio, ADR, foley, SFX, music, and mixing',
    expanded: true,
    children: [
      { name: 'Production Sound', type: 'audio', icon: 'fa-microphone', view: 'asset-detail', detailKey: 'prod-sound', desc: 'On-set and location sound recordings' },
      { name: 'ADR / Loop Group', type: 'audio', icon: 'fa-user', view: 'asset-detail', detailKey: 'adr-loop-group', desc: 'Automated dialogue replacement and loop group pickups' },
      { name: 'Foley', type: 'audio', icon: 'fa-shoe-prints', view: 'asset-detail', detailKey: 'foley', desc: 'Movement, prop, and cloth foley recordings' },
      { name: 'Sound Design & SFX', type: 'audio', icon: 'fa-bolt', view: 'asset-detail', detailKey: 'sound-design-sfx', desc: 'Environmental and action sound effects' },
      { name: 'Music / Score', type: 'audio', icon: 'fa-music', view: 'asset-detail', detailKey: 'music-score', desc: 'Original score cues and temp music references' },
      { name: 'Temp Mix / Stems', type: 'audio', icon: 'fa-sliders', view: 'asset-detail', detailKey: 'temp-mix-stems', desc: 'Assembly mix passes and stem exports' },
    ],
  },
  {
    name: 'Scenes',
    type: 'folder',
    icon: 'fa-video',
    view: 'overview',
    expanded: true,
    children: [],
  },
  {
    name: 'Assembly',
    type: 'folder',
    icon: 'fa-film',
    view: 'overview',
    expanded: true,
    children: [
      { name: 'Rough Cut', type: 'sequence', icon: 'fa-film', view: 'timeline', desc: 'Drag shots onto timeline to assemble the cut' },
      { name: 'Audio Mix', type: 'audio', icon: 'fa-wave-square', view: 'asset-detail', detailKey: 'audio-mix', desc: 'Dialogue, music, and effects mix sessions' },
      { name: 'Color Grade', type: 'color', icon: 'fa-palette', view: 'asset-detail', detailKey: 'color-grade', desc: 'Look development and final grade deliverables' },
    ],
  },
  { type: 'tree-divider' },
  {
    name: 'Global Assets',
    type: 'folder',
    icon: 'fa-cube',
    view: 'overview',
    expanded: true,
    children: [
      { name: 'Footage', type: 'bin', icon: 'fa-photo-film', view: 'asset-detail', detailKey: 'footage-bin', desc: 'Generated and imported footage by scene' },
      { name: 'Audio', type: 'bin', icon: 'fa-music', view: 'asset-detail', detailKey: 'audio-bin', desc: 'Production sound, SFX, ADR, and score' },
      { name: 'Graphics', type: 'bin', icon: 'fa-image', view: 'asset-detail', detailKey: 'graphics-bin', desc: 'Title cards, lower thirds, and graphics' },
      { name: 'Library Browser', type: 'assets', icon: 'fa-cube', view: 'assets', desc: 'Characters, locations, props, and effects' },
      { name: 'Scrap Bin', type: 'scrap', icon: 'fa-trash-can', view: 'default', desc: 'Deleted storyboard frames and discarded takes' },
    ],
  },
];

function createBlankSnapshot(projectName: string): AppliedCineProject {
  return {
    projectScreenplay: { format: 'fountain', text: DEFAULT_FOUNTAIN_SCRIPT },
    projectData: { name: projectName, type: 'project', icon: 'fa-film', expanded: true, children: DEFAULT_BLANK_PROJECT_TREE },
    projectTreatment: { workingTitle: projectName },
    currentSceneData: {},
    storyboardFrames: [],
    deletedStoryboardFrames: [],
    selectedStoryboardFrameId: null,
    storyboardVisibility: { scene: true, frame: true, notes: true },
    storyboardReferenceBank: { characters: [], locations: [], interiors: [], exteriors: [] },
    sceneReferenceOverrides: {},
    referenceGenerationStatus: 'idle',
    timelineClips: [],
    locationLibrary: [],
    assetLibrary: {
      characters: [],
      locations: [],
      props: [],
      wardrobe: [],
      vehicles: [],
      effects: [],
      media: { generated: [], imported: [] },
    },
    breakdownData: [],
    assetDetailData: {},
  };
}

function readPersistedLocalProjects(): PersistedProjectRecord[] {
  try {
    const raw = storageService.getItem(LOCAL_PROJECTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as PersistedProjectRecord[]) : [];
  } catch (error) {
    console.warn('CineGen: failed to read local project store.', error);
    return [];
  }
}

function writePersistedLocalProjects(records: PersistedProjectRecord[]): void {
  try {
    storageService.setItem(LOCAL_PROJECTS_STORAGE_KEY, JSON.stringify(records));
  } catch (error) {
    console.warn('CineGen: failed to persist local projects.', error);
  }
}

function persistLocalProject(record: PersistedProjectRecord): void {
  const current = readPersistedLocalProjects();
  const next = current.filter((item) => item.id !== record.id);
  next.push(record);
  writePersistedLocalProjects(next);
}

function createBlankProjectLocal(projectName?: string): CreateBlankProjectResult {
  const name = String(projectName || '').trim() || buildNextUntitledName();
  const id = generateLocalProjectId();
  const settings = { ...DEFAULT_PROJECT_SETTINGS };
  const snapshot = createBlankSnapshot(name);

  applyProjectSnapshot(snapshot, { id, name, settings });
  persistLocalProject({
    id,
    name,
    settings,
    snapshot,
    updatedAt: new Date().toISOString(),
  });

  return { id, name };
}

function createBlankProjectServer(): never {
  throw new Error('Backend project creation is not wired yet.');
}

export function createBlankProject(projectName?: string): CreateBlankProjectResult {
  const mode = resolveProjectPersistenceMode();
  if (mode === 'server') return createBlankProjectServer();
  return createBlankProjectLocal(projectName);
}

function hydrateLocalProjectRegistry(): void {
  const records = readPersistedLocalProjects();
  if (!records.length) return;
  const knownIds = new Set(projectRegistry.map((project) => project.id));
  for (const record of records) {
    if (knownIds.has(record.id)) continue;
    projectRegistry.push({
      id: record.id,
      name: record.name,
      settings: { ...DEFAULT_PROJECT_SETTINGS, ...(record.settings || {}) },
    });
    knownIds.add(record.id);
  }
}

function openProjectLocal(projectId: string): CreateBlankProjectResult | null {
  const record = readPersistedLocalProjects().find((item) => item.id === projectId);
  if (!record) return null;
  applyProjectSnapshot(record.snapshot, {
    id: record.id,
    name: record.name,
    settings: record.settings,
  });
  return { id: record.id, name: record.name };
}

function openProjectServer(): never {
  throw new Error('Backend project opening is not wired yet.');
}

export function openProject(projectId: string): CreateBlankProjectResult | null {
  const mode = resolveProjectPersistenceMode();
  if (mode === 'server') return openProjectServer();
  return openProjectLocal(projectId);
}

export function hydrateProjectRegistryFromPersistence(): void {
  const mode = resolveProjectPersistenceMode();
  if (mode === 'server') return;
  hydrateLocalProjectRegistry();
}

