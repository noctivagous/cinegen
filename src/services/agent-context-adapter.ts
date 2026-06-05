/**
 * ProductionContext → UI project state adapter
 *
 * Converts Mastra agent outputs (ProductionContext) into the in-memory
 * project structures the UI consumes: currentSceneData, assetLibrary,
 * breakdownData, styleGuide, and colorState.
 */

import type {
  ProductionContext,
  CharacterGuideEntry,
  LocationGuideEntry,
  Shot as AgentShot,
} from '@/services/ai/agents-service';
import type { SceneShot, SceneDetail } from '@/workspace/scene-types';
import { currentSceneData, assetLibrary, styleGuide } from '@/data/project-data';
import { colorState } from '@/color/color-state';

/* ── Public API ─────────────────────────────────────────────────────────────── */

export interface AdapterResult {
  scenesUpdated: number;
  shotsAdded: number;
  shotsUpdated: number;
  charactersEnriched: number;
  locationsEnriched: number;
  styleGuideUpdated: boolean;
}

/**
 * Merge a full ProductionContext into the live UI project state.
 * Non-destructive: preserves existing user edits where they exist.
 */
export function applyProductionContext(ctx: ProductionContext): AdapterResult {
  const result: AdapterResult = {
    scenesUpdated: 0,
    shotsAdded: 0,
    shotsUpdated: 0,
    charactersEnriched: 0,
    locationsEnriched: 0,
    styleGuideUpdated: false,
  };

  // 1. Style guide & color palette
  if (ctx.styleGuide) {
    result.styleGuideUpdated = applyStyleGuide(ctx.styleGuide);
  }

  // 2. Characters → assetLibrary.characters
  if (Array.isArray(ctx.characterGuide)) {
    result.charactersEnriched = applyCharacterGuides(ctx.characterGuide);
  }

  // 3. Locations → assetLibrary.locations
  if (Array.isArray(ctx.locationGuide)) {
    result.locationsEnriched = applyLocationGuides(ctx.locationGuide);
  }

  // 4. Shots → currentSceneData coverage
  if (Array.isArray(ctx.shotList)) {
    const shotStats = applyAgentShots(ctx.shotList);
    result.scenesUpdated = shotStats.scenesUpdated;
    result.shotsAdded = shotStats.shotsAdded;
    result.shotsUpdated = shotStats.shotsUpdated;
  }

  return result;
}

/* ── Style Guide ────────────────────────────────────────────────────────────── */

function applyStyleGuide(agentSg: ProductionContext['styleGuide']): boolean {
  let changed = false;

  if (agentSg.colorPalette?.length) {
    const palette = agentSg.colorPalette.split(/[,;]/).map((c) => c.trim()).filter(Boolean);
    styleGuide.colorPalette = palette;
    colorState.setPalette(palette);
    changed = true;
  }
  if (agentSg.lightingMood) {
    styleGuide.lightingMood = agentSg.lightingMood;
    changed = true;
  }
  if (agentSg.lensStyle) {
    styleGuide.lensStyle = agentSg.lensStyle;
    changed = true;
  }
  if (agentSg.visualTone) {
    styleGuide.visualTone = agentSg.visualTone;
    changed = true;
  }
  if (agentSg.styleReference) {
    styleGuide.styleReference = agentSg.styleReference;
    changed = true;
  }

  return changed;
}

/* ── Characters ─────────────────────────────────────────────────────────────── */

function applyCharacterGuides(guides: CharacterGuideEntry[]): number {
  if (!Array.isArray(assetLibrary.characters)) return 0;
  const bucket = assetLibrary.characters as Array<Record<string, unknown>>;
  let enriched = 0;

  for (const guide of guides) {
    const existing = bucket.find(
      (c) => typeof c.name === 'string' && normalizeName(c.name) === normalizeName(guide.name),
    );
    if (existing) {
      // Merge guide data into existing asset entry
      existing.role = guide.role;
      existing.physicalDescription = guide.physicalDescription;
      existing.performanceNotes = guide.performanceNotes;
      existing.sceneAppearances = guide.sceneAppearances;
      existing.references = guide.references;
      existing.voice = guide.voice;
      enriched++;
    } else {
      // Create new asset entry from guide
      bucket.push({
        name: guide.name,
        icon: 'fa-user',
        desc: guide.physicalDescription || `${guide.role} character`,
        role: guide.role,
        physicalDescription: guide.physicalDescription,
        performanceNotes: guide.performanceNotes,
        sceneAppearances: guide.sceneAppearances,
        references: guide.references,
        voice: guide.voice,
      });
      enriched++;
    }
  }

  return enriched;
}

/* ── Locations ──────────────────────────────────────────────────────────────── */

function applyLocationGuides(guides: LocationGuideEntry[]): number {
  if (!Array.isArray(assetLibrary.locations)) return 0;
  const bucket = assetLibrary.locations as Array<Record<string, unknown>>;
  let enriched = 0;

  for (const guide of guides) {
    const existing = bucket.find(
      (l) => typeof l.name === 'string' && normalizeName(l.name) === normalizeName(guide.name),
    );
    if (existing) {
      existing.intExt = guide.intExt;
      existing.description = guide.description;
      existing.atmosphere = guide.atmosphere;
      existing.references = guide.references;
      existing.sceneAppearances = guide.sceneAppearances;
      enriched++;
    } else {
      bucket.push({
        name: guide.name,
        icon: 'fa-map-location-dot',
        desc: guide.description || `${guide.intExt} location`,
        intExt: guide.intExt,
        description: guide.description,
        atmosphere: guide.atmosphere,
        references: guide.references,
        sceneAppearances: guide.sceneAppearances,
      });
      enriched++;
    }
  }

  return enriched;
}

/* ── Shots ───────────────────────────────────────────────────────────────────── */

function applyAgentShots(agentShots: AgentShot[]): {
  scenesUpdated: number;
  shotsAdded: number;
  shotsUpdated: number;
} {
  const scenesUpdated = new Set<string>();
  let shotsAdded = 0;
  let shotsUpdated = 0;

  for (const agentShot of agentShots) {
    const sceneId = agentShot.sceneId;
    const scene = currentSceneData[sceneId];
    if (!scene) continue;

    scenesUpdated.add(sceneId);

    // Map agent shot type to SceneShot shape
    const mapped = mapAgentShotToSceneShot(agentShot);

    // Try to find existing shot by id or by matching description/scriptLink
    const existingIdx = scene.coverage.findIndex(
      (s: SceneShot) =>
        String(s.id) === agentShot.id ||
        (s.scriptLink && s.scriptLink === agentShot.description),
    );

    if (existingIdx >= 0) {
      const existing = scene.coverage[existingIdx];
      // Merge: preserve user-edited cinematography fields if they exist
      scene.coverage[existingIdx] = {
        ...existing,
        ...mapped,
        // Keep user overrides
        shotType: existing.shotType || mapped.shotType,
        cameraAngle: existing.cameraAngle || mapped.cameraAngle,
        cameraMovement: existing.cameraMovement || mapped.cameraMovement,
        lens: existing.lens || mapped.lens,
        lightingTechnique: existing.lightingTechnique || mapped.lightingTechnique,
        composition: existing.composition || mapped.composition,
        sfxSelections: existing.sfxSelections || mapped.sfxSelections,
        status: existing.status || mapped.status,
      };
      shotsUpdated++;
    } else {
      // Append as new shot
      scene.coverage.push(mapped);
      shotsAdded++;
    }
  }

  return { scenesUpdated: scenesUpdated.size, shotsAdded, shotsUpdated };
}

function mapAgentShotToSceneShot(shot: AgentShot): SceneShot {
  return {
    id: Number(shot.id) || Date.now() + Math.floor(Math.random() * 1000),
    number: shot.number,
    type: shot.type,
    previsRole: shot.type === 'Master Shot' ? 'master' : 'coverage',
    label: shot.description || `${shot.type} ${shot.number}`,
    duration: '0:00',
    durationSeconds: 0,
    scriptLink: shot.description,
    shotType: undefined,
    cameraAngle: shot.cameraAngle,
    cameraMovement: shot.cameraMovement,
    lens: shot.lens,
    status: mapAgentStatus(shot.status),
  };
}

function mapAgentStatus(
  s: AgentShot['status'],
): SceneShot['status'] {
  switch (s) {
    case 'approved':
      return 'approved';
    case 'rejected':
      return 'rejected';
    case 'generated':
      return 'generated';
    case 'generating':
      return 'queued';
    default:
      return 'planned';
  }
}

/* ── Helpers ──────────────────────────────────────────────────────────────────── */

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}
