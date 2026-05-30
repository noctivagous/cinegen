import type { SceneShot } from '@/workspace/scene-types';
import { alertCG } from '@/utils/alert-cg';

export type ShotLifecycleStatus = NonNullable<SceneShot['status']>;

const ORDER: ShotLifecycleStatus[] = [
  'planned',
  'storyboarded',
  'prompted',
  'queued',
  'generated',
  'reviewed',
  'approved',
  'rejected',
  'locked',
];

const ALLOWED: Record<ShotLifecycleStatus, ShotLifecycleStatus[]> = {
  planned: ['storyboarded', 'planned'],
  storyboarded: ['planned', 'prompted', 'storyboarded'],
  prompted: ['storyboarded', 'queued', 'prompted'],
  queued: ['prompted', 'generated', 'queued'],
  generated: ['queued', 'reviewed', 'generated'],
  reviewed: ['generated', 'approved', 'rejected', 'reviewed'],
  approved: ['reviewed', 'locked', 'approved'],
  rejected: ['planned', 'storyboarded', 'prompted', 'rejected'],
  locked: ['locked'],
};

export function normalizeShotStatus(value: unknown): ShotLifecycleStatus {
  if (typeof value === 'string' && (ORDER as string[]).includes(value)) {
    return value as ShotLifecycleStatus;
  }
  return 'planned';
}

export function canTransitionShotStatus(
  from: ShotLifecycleStatus | undefined,
  to: ShotLifecycleStatus
): boolean {
  const current = normalizeShotStatus(from);
  return ALLOWED[current]?.includes(to) ?? false;
}

export function allowedNextShotStatuses(from: ShotLifecycleStatus | undefined): ShotLifecycleStatus[] {
  const current = normalizeShotStatus(from);
  return ALLOWED[current] ?? ['planned'];
}

export type SetShotStatusResult =
  | { ok: true; status: ShotLifecycleStatus }
  | { ok: false; error: string };

/**
 * Apply a lifecycle status change with transition rules.
 * @param opts.silent — skip alert on failure (for automatic transitions)
 */
export function setShotStatus(
  shot: SceneShot,
  next: ShotLifecycleStatus,
  opts?: { silent?: boolean }
): SetShotStatusResult {
  const from = normalizeShotStatus(shot.status);
  if (from === next) {
    shot.status = next;
    return { ok: true, status: next };
  }
  if (!canTransitionShotStatus(from, next)) {
    const error = `Cannot move shot from "${from}" to "${next}". Complete the prior step first.`;
    if (!opts?.silent) alertCG(error);
    return { ok: false, error };
  }
  shot.status = next;
  return { ok: true, status: next };
}

/** After linking a frame, advance planned → storyboarded when appropriate. */
export function maybeAdvanceShotToStoryboarded(shot: SceneShot): void {
  if (!shot.frameIds?.length) return;
  setShotStatus(shot, 'storyboarded', { silent: true });
}
