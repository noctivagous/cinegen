import { generationQueue, storyboardFrames } from '@/data/project-data';
import { getFramesForShot } from '@/workspace/shot-frame-bridge';
import type { GenerationJobRecord } from '@/services/generation-queue-service';
import type { StoryboardFrame } from '@/storyboard/storyboard-types';

export function getStoryboardFrameForShot(sceneId: string, shotId: number, frameId?: number | null): StoryboardFrame | null {
  if (frameId != null) {
    const direct = (storyboardFrames as StoryboardFrame[]).find((f) => f.id === frameId);
    if (direct) return direct;
  }
  const frames = getFramesForShot(sceneId, shotId);
  if (!frames.length) return null;
  return frames.find((f) => f.imageUrl) ?? frames[frames.length - 1];
}

export function getLatestVideoOutputForShot(sceneId: string, shotId: number): string | undefined {
  const jobs = (generationQueue as GenerationJobRecord[]).filter(
    (j) =>
      j.sceneId === sceneId &&
      Number(j.shotId) === shotId &&
      j.modality === 'video' &&
      j.status === 'complete' &&
      j.outputUrl
  );
  return jobs[jobs.length - 1]?.outputUrl;
}

export function getLatestImageJobForShot(sceneId: string, shotId: number): GenerationJobRecord | undefined {
  const jobs = (generationQueue as GenerationJobRecord[]).filter(
    (j) =>
      j.sceneId === sceneId &&
      Number(j.shotId) === shotId &&
      j.modality === 'image'
  );
  return jobs[jobs.length - 1];
}
