/**
 * One-shot: serialize current project-data seed into project-files/ascension-stream.cine
 * Run from source/: npx tsx scripts/export-default-cine.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CINE_PROJECT_FORMAT,
  CINE_PROJECT_VERSION,
} from '../src/data/cine-project-types.ts';
import {
  projectData,
  projectTreatment,
  currentSceneData,
  storyboardFrames,
  deletedStoryboardFrames,
  selectedStoryboardFrameId,
  storyboardVisibility,
  timelineClips,
  locationLibrary,
  assetLibrary,
  breakdownData,
  assetDetailData,
  projectScreenplay,
  getActiveProjectSettings,
} from '../src/data/project-data.ts';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(appRoot, 'src/data/project-files');
mkdirSync(outDir, { recursive: true });

const payload = {
  format: CINE_PROJECT_FORMAT,
  version: CINE_PROJECT_VERSION,
  id: 'proj-001',
  name: projectData.name ?? 'ASCENSION_STREAM',
  settings: getActiveProjectSettings(),
  screenplay: projectScreenplay,
  treatment: projectTreatment,
  tree: projectData,
  scenes: currentSceneData,
  storyboard: {
    frames: storyboardFrames,
    deletedFrames: deletedStoryboardFrames,
    selectedFrameId: selectedStoryboardFrameId,
    visibility: storyboardVisibility,
  },
  timeline: timelineClips,
  locations: locationLibrary,
  assets: {
    characters: assetLibrary.characters,
    props: assetLibrary.props,
    vehicles: assetLibrary.vehicles,
    effects: assetLibrary.effects,
  },
  breakdown: breakdownData,
  assetDetails: assetDetailData,
};

const outPath = join(outDir, 'ascension-stream.cine');
writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`Wrote ${outPath} (${(JSON.stringify(payload).length / 1024).toFixed(1)} KB)`);
