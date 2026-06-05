import { classifyFountainDocument } from '@/script/fountain-bundle';
import {
  activeProjectId,
  assetLibrary,
  breakdownData,
  currentSceneData,
  getProjectFountainText,
  projectData,
  sceneReferenceOverrides,
} from '@/data/project-data';
import { alertCG } from '@/utils/alert-cg';
import { markProjectDirty } from '@/services/project-service';
import { requestProjectTreeRefresh } from '@/tree/project-tree-service';
import { CG_PROJECT_NAME_CHANGED } from '@/events/shell-events';
import { formatPrevisDuration, DEFAULT_SHOT_DURATION_SECONDS } from '@/workspace/shot-frame-bridge';
import type { SceneDetail, SceneShot } from '@/workspace/scene-types';
import type { TreeNode } from '@/tree/tree-types';

export type ScriptSyncResult = {
  sceneCount: number;
  scenes: string[]; // sceneIds
  characters: string[];
  locations: string[];
  shotsCreated: number;
};

/* ── Local helpers (avoid globals from utils-bundle) ── */
function normalizeEntityName(value: string): string {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function uniqueByName(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const v of values) {
    const n = normalizeEntityName(v);
    if (!n) continue;
    const key = n.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(n);
  }
  return result;
}

function normalizeFountainCharacterCue(line: string): string {
  return normalizeEntityName(line.replace(/^@\s*/, '').replace(/\s*\([^)]*\)\s*$/, ''));
}

/* ── Scene parsing ── */
interface ParsedScene {
  sceneId: string;
  sceneNumber: number;
  heading: string;
  intExt: string;
  location: string;
  time: string;
  characters: string[];
  lines: string[];
  lineStart: number;
  lineEnd: number;
}

function parseScenesFromFountain(text: string): ParsedScene[] {
  const lines = text.split('\n');
  const types = classifyFountainDocument(lines);
  const scenes: ParsedScene[] = [];
  let current: ParsedScene | null = null;
  let sceneCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (types[i] === 'scene' && trimmed) {
      if (current) {
        current.lineEnd = i - 1;
        scenes.push(current);
      }
      sceneCounter++;
      const heading = trimmed;
      const match = heading.match(/^(INT\.?|EXT\.?|EST\.?|INT\/EXT\.?|I\/E\.?)\s*(.+)/i);
      const intExt = match ? match[1].toUpperCase().replace(/\.$/, '') : 'INT';
      const rest = match ? match[2].trim() : heading;
      const locationTime = rest.split(/\s+-\s+/);
      const location = locationTime[0].trim();
      const time = (locationTime[1] || 'DAY').trim().toUpperCase();
      current = {
        sceneId: `scene${String(sceneCounter).padStart(2, '0')}`,
        sceneNumber: sceneCounter,
        heading,
        intExt,
        location,
        time,
        characters: [],
        lines: [],
        lineStart: i,
        lineEnd: lines.length - 1,
      };
      continue;
    }
    if (!current) continue;
    current.lines.push(trimmed);
    if (types[i] === 'character') {
      current.characters.push(normalizeFountainCharacterCue(trimmed));
    }
  }
  if (current) scenes.push(current);
  return scenes;
}

/* ── Scene classification heuristic ── */
type SceneKind = 'dialogue' | 'action' | 'single-character';

function classifySceneKind(scene: ParsedScene): SceneKind {
  const uniqueChars = uniqueByName(scene.characters);
  if (uniqueChars.length >= 2) return 'dialogue';
  if (uniqueChars.length === 1) return 'single-character';
  return 'action';
}

/* ── Starter shot heuristics ── */
function buildMasterShot(scene: ParsedScene, scriptLink: string): SceneShot {
  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    number: 1,
    type: 'Master Shot',
    previsRole: 'master',
    label: `${scene.location} — Master`,
    duration: formatPrevisDuration(DEFAULT_SHOT_DURATION_SECONDS),
    durationSeconds: DEFAULT_SHOT_DURATION_SECONDS,
    scriptLink,
    shotType: 'LS/WS',
    cameraAngle: 'Eye-Level',
    cameraMovement: 'Static',
    lens: 'Standard (35–50mm)',
    lightingTechnique: '3-Point',
    composition: 'Rule of Thirds',
    status: 'planned',
  };
}

function buildCoverageShots(scene: ParsedScene, kind: SceneKind, startNumber: number): SceneShot[] {
  const shots: SceneShot[] = [];
  const baseId = Date.now() + Math.floor(Math.random() * 1000);

  if (kind === 'dialogue') {
    shots.push({
      id: baseId + 1,
      number: startNumber,
      type: 'Coverage',
      previsRole: 'coverage',
      label: `${scene.location} — OTS Coverage`,
      duration: formatPrevisDuration(DEFAULT_SHOT_DURATION_SECONDS),
      durationSeconds: DEFAULT_SHOT_DURATION_SECONDS,
      scriptLink: scene.heading,
      shotType: 'MCU',
      cameraAngle: 'OTS',
      cameraMovement: 'Static',
      lens: 'Standard (35–50mm)',
      lightingTechnique: 'Soft',
      composition: 'Rule of Thirds',
      status: 'planned',
    });
  } else if (kind === 'single-character') {
    shots.push(
      {
        id: baseId + 1,
        number: startNumber,
        type: 'Coverage',
        previsRole: 'coverage',
        label: `${scene.location} — Medium Shot`,
        duration: formatPrevisDuration(DEFAULT_SHOT_DURATION_SECONDS),
        durationSeconds: DEFAULT_SHOT_DURATION_SECONDS,
        scriptLink: scene.heading,
        shotType: 'MS',
        cameraAngle: 'Eye-Level',
        cameraMovement: 'Static',
        lens: 'Standard (35–50mm)',
        lightingTechnique: 'Soft',
        composition: 'Centered',
        status: 'planned',
      },
      {
        id: baseId + 2,
        number: startNumber + 1,
        type: 'Coverage',
        previsRole: 'coverage',
        label: `${scene.location} — Close-Up`,
        duration: formatPrevisDuration(DEFAULT_SHOT_DURATION_SECONDS),
        durationSeconds: DEFAULT_SHOT_DURATION_SECONDS,
        scriptLink: scene.heading,
        shotType: 'CU',
        cameraAngle: 'Eye-Level',
        cameraMovement: 'Static',
        lens: 'Portrait (85mm)',
        lightingTechnique: 'Soft',
        composition: 'Centered',
        status: 'planned',
      }
    );
  } else {
    // action
    shots.push(
      {
        id: baseId + 1,
        number: startNumber,
        type: 'Coverage',
        previsRole: 'coverage',
        label: `${scene.location} — Wide Action`,
        duration: formatPrevisDuration(DEFAULT_SHOT_DURATION_SECONDS),
        durationSeconds: DEFAULT_SHOT_DURATION_SECONDS,
        scriptLink: scene.heading,
        shotType: 'MLS',
        cameraAngle: 'Low Angle',
        cameraMovement: 'Handheld',
        lens: 'Wide (14–24mm)',
        lightingTechnique: 'Hard',
        composition: 'Leading Lines',
        status: 'planned',
      },
      {
        id: baseId + 2,
        number: startNumber + 1,
        type: 'Insert',
        previsRole: 'coverage',
        label: `${scene.location} — Detail Insert`,
        duration: formatPrevisDuration(DEFAULT_SHOT_DURATION_SECONDS),
        durationSeconds: DEFAULT_SHOT_DURATION_SECONDS,
        scriptLink: scene.heading,
        shotType: 'CU',
        cameraAngle: 'Eye-Level',
        cameraMovement: 'Static',
        lens: 'Macro',
        lightingTechnique: 'Practical',
        composition: 'Depth of Field',
        status: 'planned',
      }
    );
  }
  return shots;
}

/* ── Tree node helpers ── */
function ensureScenesFolder(projectDataRoot: Record<string, unknown>): TreeNode {
  const children = (projectDataRoot.children as TreeNode[]) ?? [];
  let folder = children.find((n) => n.type === 'folder' && n.name === 'Scenes');
  if (!folder) {
    folder = {
      name: 'Scenes',
      type: 'folder',
      icon: 'fa-film',
      view: 'scene-list',
      expanded: true,
      children: [],
    };
    children.push(folder);
    projectDataRoot.children = children;
  }
  return folder;
}

function upsertSceneNode(scenesFolder: TreeNode, scene: ParsedScene): TreeNode {
  const children = scenesFolder.children ?? [];
  const existing = children.find((n) => n.type === 'scene' && n.sceneId === scene.sceneId);
  const title = `${scene.intExt}. ${scene.location} — ${scene.time}`;
  if (existing) {
    existing.name = title;
    return existing;
  }
  const node: TreeNode = {
    name: title,
    type: 'scene',
    icon: 'fa-clapperboard',
    view: 'scene-detail',
    sceneId: scene.sceneId,
    expanded: false,
    children: [],
  };
  scenesFolder.children = [...children, node];
  return node;
}

/* ── Asset library helpers ── */
function addAssetPlaceholders(type: 'characters' | 'locations', values: string[]): void {
  if (!Array.isArray(assetLibrary[type])) return;
  const bucket = assetLibrary[type] as Array<{ name: string; icon: string; desc: string }>;
  const existing = new Set(bucket.map((item) => normalizeEntityName(item.name).toLowerCase()));
  const icon = type === 'characters' ? 'fa-user' : 'fa-map-location-dot';
  for (const name of uniqueByName(values)) {
    const key = name.toLowerCase();
    if (existing.has(key)) continue;
    bucket.push({ name, icon, desc: 'Detected in script' });
    existing.add(key);
  }
}

/* ── Main sync function ── */
export function syncFountainToProject(text: string, _projectId?: string): ScriptSyncResult {
  const scenes = parseScenesFromFountain(text);
  if (!scenes.length) {
    return { sceneCount: 0, scenes: [], characters: [], locations: [], shotsCreated: 0 };
  }

  const allCharacters: string[] = [];
  const allLocations: string[] = [];
  let shotsCreated = 0;
  const sceneIds: string[] = [];

  // Ensure Scenes folder exists in project tree
  const scenesFolder = ensureScenesFolder(projectData);

  for (const parsed of scenes) {
    sceneIds.push(parsed.sceneId);
    allCharacters.push(...parsed.characters);
    allLocations.push(parsed.location);

    const kind = classifySceneKind(parsed);
    const scriptLink = parsed.heading;

    const master = buildMasterShot(parsed, scriptLink);
    const coverage = buildCoverageShots(parsed, kind, master.number! + 1);
    const shots: SceneShot[] = [master, ...coverage];
    shotsCreated += shots.length;

    const sceneDetail: SceneDetail = {
      title: `${parsed.intExt}. ${parsed.location} — ${parsed.time}`,
      master: {
        label: `${parsed.location} — Master`,
        duration: master.duration,
        status: 'planned',
        prompt: '',
      },
      coverage: shots.filter((s) => s.previsRole !== 'master'),
      broll: [],
      pickups: [],
      notes: '',
    };

    // Merge into currentSceneData, preserving existing scene IDs if heading matches
    const existingScene = (currentSceneData as Record<string, SceneDetail>)[parsed.sceneId];
    if (existingScene) {
      // Preserve user-edited fields; overwrite only deterministic baseline
      existingScene.title = sceneDetail.title;
      existingScene.master = { ...existingScene.master, ...sceneDetail.master };
      // Append new shots only if none exist, to avoid destructive replacement
      if (!existingScene.coverage?.length) {
        existingScene.coverage = sceneDetail.coverage;
      }
    } else {
      (currentSceneData as Record<string, SceneDetail>)[parsed.sceneId] = sceneDetail;
    }

    // Upsert breakdown row
    const row = {
      scene: String(parsed.sceneNumber),
      int_ext: parsed.intExt,
      location: parsed.location,
      time: parsed.time,
    };
    const existingRowIndex = (breakdownData as Array<Record<string, string>>).findIndex(
      (r) => r.scene === row.scene || r.scene === row.scene.padStart(2, '0')
    );
    if (existingRowIndex >= 0) {
      breakdownData[existingRowIndex] = { ...breakdownData[existingRowIndex], ...row };
    } else {
      breakdownData.push(row);
    }

    // Upsert tree node
    upsertSceneNode(scenesFolder, parsed);

    // Initialize mood-board attachment point for this scene (empty override bank)
    if (!sceneReferenceOverrides[parsed.sceneId]) {
      sceneReferenceOverrides[parsed.sceneId] = {};
    }
  }

  // Add asset placeholders
  addAssetPlaceholders('characters', allCharacters);
  addAssetPlaceholders('locations', allLocations);

  // Notify status bar to refresh
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CG_PROJECT_NAME_CHANGED));
  }

  return {
    sceneCount: scenes.length,
    scenes: sceneIds,
    characters: uniqueByName(allCharacters),
    locations: uniqueByName(allLocations),
    shotsCreated,
  };
}

/** Silent re-sync from Fountain text (debounced editor changes, hydration). */
export function syncBreakdownFromScript(): ScriptSyncResult | null {
  const text = getProjectFountainText();
  if (!text.trim()) return null;
  const result = syncFountainToProject(text, activeProjectId || undefined);
  markProjectDirty(['screenplay', 'scenes', 'breakdown', 'characters', 'locations']);
  requestProjectTreeRefresh();
  const renderBreakdown = (window as unknown as { renderBreakdownTable?: () => void }).renderBreakdownTable;
  if (typeof renderBreakdown === 'function') renderBreakdown();
  return result;
}

/** Manual toolbar action — syncs and confirms with alertCG. */
export function refreshBreakdownFromScript(): ScriptSyncResult | null {
  const text = getProjectFountainText();
  if (!text.trim()) {
    alertCG('Paste or import screenplay text before refreshing the breakdown.');
    return null;
  }
  const result = syncBreakdownFromScript();
  if (!result) return null;
  alertCG(
    `Breakdown refreshed: ${result.sceneCount} scene(s), ${result.shotsCreated} shot(s) in sync. Existing shot lists were kept where scenes already had coverage.`
  );
  return result;
}
