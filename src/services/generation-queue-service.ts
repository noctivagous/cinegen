/**
 * Runtime generation queue + shot lifecycle sync for AI Director jobs.
 */

import * as projectData from '@/data/project-data';
import type { SceneShot } from '@/workspace/scene-types';
import { markProjectDirty } from '@/services/project-service';
import {
  normalizeShotStatus,
  setShotStatus,
  type ShotLifecycleStatus,
} from '@/workspace/shot-lifecycle';

/** Lazy access avoids TDZ when project-data is still initializing (import cycle via storyboard bundle). */
function mutableQueue(): GenerationJobRecord[] {
  return projectData.generationQueue as GenerationJobRecord[];
}

export type GenerationJobStatus = 'queued' | 'running' | 'complete' | 'failed';

export type GenerationJobModality = 'image' | 'video' | 'audio';

export type GenerationJobRecord = {
  id: string;
  shotId: string;
  sceneId?: string;
  modality: GenerationJobModality;
  provider: string;
  model: string;
  prompt: string;
  status: GenerationJobStatus;
  cost?: number;
  outputUrl?: string;
  error?: string;
  createdAt: string;
};

function jobId(): string {
  return `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getGenerationQueue(): GenerationJobRecord[] {
  return mutableQueue();
}

export function findSceneShot(sceneId: string, shotId: number): SceneShot | null {
  const scene = projectData.currentSceneData[sceneId];
  if (!scene?.coverage?.length) return null;
  return (scene.coverage as SceneShot[]).find((s) => s.id === shotId) ?? null;
}

/** Chain silent lifecycle transitions (storyboarded → prompted → queued). */
function advanceShotToQueued(shot: SceneShot): void {
  const status = normalizeShotStatus(shot.status);
  if (status === 'planned') {
    setShotStatus(shot, 'storyboarded', { silent: true });
  }
  if (normalizeShotStatus(shot.status) === 'storyboarded') {
    setShotStatus(shot, 'prompted', { silent: true });
  }
  if (normalizeShotStatus(shot.status) === 'prompted') {
    setShotStatus(shot, 'queued', { silent: true });
  }
}

function completeShotLifecycle(shot: SceneShot, modality: GenerationJobModality): void {
  const status = normalizeShotStatus(shot.status);
  if (status !== 'queued' && status !== 'prompted') return;

  if (modality === 'video') {
    setShotStatus(shot, 'generated', { silent: true });
    return;
  }

  // Still / storyboard jobs return to storyboarded after queue
  setShotStatus(shot, 'storyboarded', { silent: true });
}

function failShotLifecycle(shot: SceneShot): void {
  const status = normalizeShotStatus(shot.status);
  if (status === 'queued') {
    setShotStatus(shot, 'prompted', { silent: true });
  }
}

export function enqueueGenerationJob(input: {
  sceneId: string;
  shotId: number;
  modality: GenerationJobModality;
  provider: string;
  model: string;
  prompt: string;
}): GenerationJobRecord {
  const record: GenerationJobRecord = {
    id: jobId(),
    shotId: String(input.shotId),
    sceneId: input.sceneId,
    modality: input.modality,
    provider: input.provider,
    model: input.model,
    prompt: input.prompt,
    status: 'queued',
    createdAt: new Date().toISOString(),
  };

  mutableQueue().push(record);

  const shot = findSceneShot(input.sceneId, input.shotId);
  if (shot) advanceShotToQueued(shot);

  markProjectDirty(['generationQueue', 'scenes']);
  return record;
}

export function updateGenerationJob(
  id: string,
  patch: Partial<Pick<GenerationJobRecord, 'status' | 'outputUrl' | 'error' | 'cost' | 'provider' | 'model'>>
): GenerationJobRecord | null {
  const job = mutableQueue().find((j) => j.id === id);
  if (!job) return null;

  Object.assign(job, patch);

  const sceneId = job.sceneId;
  const shotId = Number(job.shotId);
  if (sceneId && Number.isFinite(shotId)) {
    const shot = findSceneShot(sceneId, shotId);
    if (shot && patch.status === 'running') {
      advanceShotToQueued(shot);
    }
    if (shot && patch.status === 'complete') {
      completeShotLifecycle(shot, job.modality);
    }
    if (shot && patch.status === 'failed') {
      failShotLifecycle(shot);
    }
  }

  markProjectDirty(['generationQueue', 'scenes']);
  return job;
}

/** Mark active shot as prompted after a prompt is built (Camera / agent path). */
export function markActiveShotPrompted(sceneId: string | null, shotId: number | null): void {
  if (!sceneId || shotId == null) return;
  const shot = findSceneShot(sceneId, shotId);
  if (!shot) return;
  const status = normalizeShotStatus(shot.status);
  if (status === 'planned') {
    setShotStatus(shot, 'storyboarded', { silent: true });
  }
  if (normalizeShotStatus(shot.status) === 'storyboarded') {
    setShotStatus(shot, 'prompted', { silent: true });
  }
  markProjectDirty(['scenes']);
}

export function shotLifecycleLabel(status: ShotLifecycleStatus | undefined): string {
  return normalizeShotStatus(status);
}
