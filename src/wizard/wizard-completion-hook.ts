/**
 * Shared wizard completion hook.
 *
 * After any wizard completes, this orchestrates:
 *  - syncFountainToProject() (if screenplay text changed)
 *  - enableFeatureBranch() for departments the wizard touched
 *  - mark dirty docs
 *  - autosave
 *  - tree refresh
 *  - navigate to the first enabled scene or mood board
 *
 * No wizard should end on a blank screen.
 */

import { markProjectDirty, persistActiveProjectSnapshot } from '@/services/project-service';
import {
  enableFeatureBranch,
  getFirstEnabledTreeNodeName,
} from '@/services/project-features-service';
import { requestProjectTreeRefresh } from '@/tree/project-tree-service';
import { applyWorkspaceViewDom } from '@/workspace/view-routing';
import type { WizardOutput } from '@/wizard/wizard-output-types';

export interface WizardCompletionOptions {
  /** Project ID the wizard operated on */
  projectId: string;
  /** Feature branch IDs to enable. */
  featureBranches?: string[];
  /** Dirty document keys to mark for incremental autosave. */
  dirtyDocs?: string[];
  /** If the wizard mutated the screenplay, pass the new text here. */
  fountainText?: string;
  /** If true, flush all dirty docs to the server immediately. */
  flushSnapshot?: boolean;
  /** View to navigate to after completion. */
  targetView?: { viewName: string; label: string; sectionKey?: string | null };
}

/** Run the common post-wizard completion sequence. */
export function runWizardCompletion(opts: WizardCompletionOptions): void {
  const {
    projectId,
    featureBranches = [],
    dirtyDocs = ['features'],
    fountainText,
    flushSnapshot = true,
    targetView,
  } = opts;

  if (fountainText?.trim()) {
    const { syncFountainToProject } = require('@/script/script-to-project') as typeof import('@/script/script-to-project');
    syncFountainToProject(fountainText, projectId);
    if (!dirtyDocs.includes('screenplay')) dirtyDocs.push('screenplay');
    if (!dirtyDocs.includes('scenes')) dirtyDocs.push('scenes');
    if (!dirtyDocs.includes('breakdown')) dirtyDocs.push('breakdown');
    if (!dirtyDocs.includes('characters')) dirtyDocs.push('characters');
    if (!dirtyDocs.includes('locations')) dirtyDocs.push('locations');
  }

  for (const branch of featureBranches) {
    enableFeatureBranch(branch);
  }

  markProjectDirty(dirtyDocs);
  requestProjectTreeRefresh();

  if (flushSnapshot) {
    persistActiveProjectSnapshot();
  }

  if (targetView) {
    applyWorkspaceViewDom(targetView.viewName, targetView.label, targetView.sectionKey ?? null);
  } else {
    navigateToFirstEnabledView();
  }
}

/**
 * Canonical apply function for WizardOutput.
 *
 * Handles every field in the contract: fountain sync, asset additions,
 * style guide delta, per-scene overrides, mood board items, feature
 * branches, and navigation.
 */
export function applyWizardOutput(output: WizardOutput): void {
  const {
    projectId,
  } = { projectId: require('@/data/project-data').activeProjectId as string };

  const dirtyDocs: string[] = ['features'];

  // 1. Fountain sync
  if (output.fountainText?.trim()) {
    const { syncFountainToProject } = require('@/script/script-to-project') as typeof import('@/script/script-to-project');
    syncFountainToProject(output.fountainText, projectId);
    dirtyDocs.push('screenplay', 'scenes', 'breakdown', 'characters', 'locations');
  }

  // 2. Per-scene overrides
  if (output.sceneOverrides) {
    const cd = require('@/data/project-data').currentSceneData as Record<string, Record<string, unknown>>;
    for (const [sceneId, override] of Object.entries(output.sceneOverrides)) {
      const scene = cd[sceneId];
      if (!scene) continue;
      if (override.colorOverride) scene.colorOverride = override.colorOverride;
      if (override.lightingMood) scene.lightingOverride = override.lightingMood;
      if (override.visualTone) scene.visualToneOverride = override.visualTone;
      if (override.beatTitle) scene.beatTitle = override.beatTitle;
      if (override.beatDuration !== undefined) scene.beatDuration = override.beatDuration;
      if (override.cameraNotes) scene.cameraNotes = override.cameraNotes;
      dirtyDocs.push('scenes');
    }

    // Camera-notes shot enrichment (Beat Board extra shots)
    for (const [sceneId, override] of Object.entries(output.sceneOverrides)) {
      if (!override.cameraNotes) continue;
      const scene = cd[sceneId] as { coverage?: unknown[] };
      if (!scene || !Array.isArray(scene.coverage)) continue;
      const keywords = override.cameraNotes.toLowerCase();
      const baseId = Date.now() + Math.floor(Math.random() * 1000);
      const newShots: unknown[] = [];
      const shotCount = scene.coverage.length + 1;

      if (/close|detail/.test(keywords)) {
        newShots.push({
          id: baseId + 1, number: shotCount, type: 'Coverage', previsRole: 'coverage',
          label: `${sceneId} — CU Insert`, duration: '3.0s', durationSeconds: 3,
          shotType: 'CU', cameraAngle: 'Eye-Level', cameraMovement: 'Static',
          lens: 'Portrait (85mm)', lightingTechnique: 'Practical', composition: 'Depth of Field',
          status: 'planned',
        });
      }
      if (/wide|establish/.test(keywords)) {
        newShots.push({
          id: baseId + 2, number: shotCount + newShots.length, type: 'Coverage', previsRole: 'coverage',
          label: `${sceneId} — WS Coverage`, duration: '5.0s', durationSeconds: 5,
          shotType: 'WS', cameraAngle: 'High Angle', cameraMovement: 'Static',
          lens: 'Wide (14-24mm)', lightingTechnique: 'Hard', composition: 'Leading Lines',
          status: 'planned',
        });
      }
      if (/move|track|dolly/.test(keywords)) {
        newShots.push({
          id: baseId + 3, number: shotCount + newShots.length, type: 'Coverage', previsRole: 'coverage',
          label: `${sceneId} — MS Tracking`, duration: '4.0s', durationSeconds: 4,
          shotType: 'MS', cameraAngle: 'Eye-Level', cameraMovement: 'Tracking',
          lens: 'Standard (35mm)', lightingTechnique: 'Mixed', composition: 'Rule of Thirds',
          status: 'planned',
        });
      }

      if (!newShots.length) {
        newShots.push({
          id: baseId + 1, number: shotCount, type: 'Coverage', previsRole: 'coverage',
          label: `${sceneId} — Coverage`, duration: '3.0s', durationSeconds: 3,
          shotType: 'MS', cameraAngle: 'Eye-Level', cameraMovement: 'Static',
          lens: 'Standard (35mm)', lightingTechnique: 'Mixed', composition: 'Rule of Thirds',
          status: 'planned',
        });
      }

      scene.coverage = [...scene.coverage, ...newShots];
    }
  }

  // 3. Beat Board data — persist scene metadata (full .cine doc deferred to Beat Board section)
  if (output.beatBoard?.entries?.length) {
    const cd = require('@/data/project-data').currentSceneData as Record<string, Record<string, unknown>>;
    for (const entry of output.beatBoard.entries) {
      if (!entry.sceneId) continue;
      const scene = cd[entry.sceneId];
      if (!scene) continue;
      scene.beatTitle = entry.title;
      scene.beatDuration = entry.durationSeconds;
      if (entry.cameraNotes) scene.cameraNotes = entry.cameraNotes;
      dirtyDocs.push('scenes');
    }
  }

  // 4. Asset library additions
  if (output.characters?.length || output.locations?.length || output.props?.length) {
    const lib = require('@/data/project-data').assetLibrary as Record<string, unknown[]>;
    const pushUnique = (bucket: unknown[], entries: unknown[], key: string) => {
      const existing = new Set((bucket as Array<Record<string, string>>).map((e) => e.name?.toLowerCase()));
      for (const entry of entries as Array<Record<string, string>>) {
        if (existing.has(entry.name?.toLowerCase())) continue;
        bucket.push(entry);
        existing.add(entry.name?.toLowerCase());
      }
    };
    if (output.characters?.length) {
      if (!lib.characters) lib.characters = [];
      pushUnique(lib.characters, output.characters, 'name');
      dirtyDocs.push('characters');
    }
    if (output.locations?.length) {
      if (!lib.locations) lib.locations = [];
      pushUnique(lib.locations, output.locations, 'name');
      dirtyDocs.push('locations');
    }
    if (output.props?.length) {
      if (!lib.props) lib.props = [];
      pushUnique(lib.props, output.props, 'name');
      dirtyDocs.push('props');
    }
  }

  // 5. Style guide delta (merge, not replace)
  if (output.styleGuide) {
    const sg = require('@/data/project-data').styleGuide as Record<string, unknown>;
    const delta = output.styleGuide;
    if (delta.colorPalette) sg.colorPalette = [...delta.colorPalette];
    if (delta.lightingMood) sg.lightingMood = delta.lightingMood;
    if (delta.visualTone) sg.visualTone = delta.visualTone;
    if (delta.lensStyle) sg.lensStyle = delta.lensStyle;
    if (delta.styleReference) sg.styleReference = delta.styleReference;
    if (delta.colorPalette) {
      const { colorState } = require('@/color/color-state') as typeof import('@/color/color-state');
      colorState.setPalette(delta.colorPalette);
    }
    dirtyDocs.push('style');
  }

  // 6. Mood board items
  if (output.moodBoardItems?.length) {
    const pd = require('@/data/project-data') as typeof import('@/data/project-data');
    const boardId = pd.activeMoodBoardId;
    const targetBoard = boardId || (Array.isArray(pd.moodBoards) && pd.moodBoards[0]?.id);
    if (targetBoard) {
      for (const item of output.moodBoardItems) {
        pd.addMoodBoardItem(targetBoard, {
          type: item.type,
          label: item.label,
          source: item.source,
          notes: item.notes ?? '',
          active: false,
          order: 0,
          metadata: {},
        });
      }
    }
    dirtyDocs.push('referenceImages');
  }

  // 7. Feature branches
  for (const branch of output.featureBranches) {
    enableFeatureBranch(branch);
  }

  // 8. Finalize
  markProjectDirty(dirtyDocs);
  requestProjectTreeRefresh();
  persistActiveProjectSnapshot();

  if (output.targetView) {
    applyWorkspaceViewDom(output.targetView.viewName, output.targetView.label, output.targetView.sectionKey ?? null);
  } else {
    navigateToFirstEnabledView();
  }
}

/** Attempt to land on the first enabled scene view, or fall back to mood boards / default. */
function navigateToFirstEnabledView(): void {
  const name = getFirstEnabledTreeNodeName();

  // Map common top-level branch names to views
  const viewMap: Record<string, { viewName: string; label: string; sectionKey: string | null }> = {
    scenes: { viewName: 'scene-workspace', label: 'Scenes', sectionKey: 'scenes' },
    'mood-boards': { viewName: 'mood-boards', label: 'Mood Boards', sectionKey: 'mood-boards' },
    'production-office': { viewName: 'preprod-workspace', label: 'Production Office', sectionKey: 'production-office' },
  };

  for (const key of Object.keys(viewMap)) {
    if (name?.toLowerCase().includes(key.toLowerCase().replace(/-/g, ' '))) {
      const v = viewMap[key];
      applyWorkspaceViewDom(v.viewName, v.label, v.sectionKey);
      return;
    }
  }

  // Absolute fallback
  applyWorkspaceViewDom('default', 'Workspace', null);
}
