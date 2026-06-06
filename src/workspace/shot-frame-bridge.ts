import { currentSceneData, previsSelectionState, projectScreenplay, storyboardFrames, timelineClips } from '@/data/project-data';
import { workspaceState } from '@/workspace/workspace-state';
import type { SceneDetail, SceneShot } from '@/workspace/scene-types';
import type { StoryboardFrame } from '@/storyboard/storyboard-types';
import { updateInspector } from '@/components/panels/cinegen-inspector';
import { emitStoryboardFrameSelected } from '@/events/shell-events';
import { maybeAdvanceShotToStoryboarded } from '@/workspace/shot-lifecycle';

export type ShotListRowKind = 'coverage' | 'master' | 'broll' | 'pickup';

export type ShotListRow = {
  kind: ShotListRowKind;
  sceneId: string;
  sceneLabel: string;
  sceneNumber: number;
  shotNumber?: number;
  globalShotNumber?: number;
  type: string;
  label: string;
  duration: string;
  status: string;
  shotId?: number;
  frameCount?: number;
  frameLabels?: string[];
};

export type PrevisTimelineItem = {
  id: string;
  sceneId: string;
  shotId?: number;
  frameId?: number;
  label: string;
  durationSeconds: number;
  startSeconds: number;
  endSeconds: number;
};

export type PrevisTimelineTracks = {
  script: PrevisTimelineItem[];
  dialogue: PrevisTimelineItem[];
  storyboard: PrevisTimelineItem[];
  sfx: PrevisTimelineItem[];
  music: PrevisTimelineItem[];
  custom: PrevisTimelineItem[];
  totalRuntimeSeconds: number;
};

export const DEFAULT_SHOT_DURATION_SECONDS = 8;
const DEFAULT_FRAME_DURATION_SECONDS = 3;
const MIN_DURATION_SECONDS = 1;

/** storyboard `scene: "2"` → production `scene02`. */
export function sceneIdFromStoryboardFrame(frame: { scene?: string }): string {
  const num = String(frame.scene || '1').replace(/\D/g, '') || '1';
  return `scene${num.padStart(2, '0')}`;
}

export function sceneNumberFromSceneId(sceneId: string): number {
  const m = sceneId.match(/^scene(\d+)$/i);
  return m ? parseInt(m[1], 10) : 1;
}

export function formatShotDisplayLabel(sceneNumber: number, shotNumber: number): string {
  return `${sceneNumber}.${shotNumber}`;
}

export function parsePrevisDurationSeconds(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(MIN_DURATION_SECONDS, Math.round(value));
  }
  const text = String(value ?? '').trim().toLowerCase();
  if (!text || text === '—') return 0;
  const minSecMatch = text.match(/(?:(\d+)\s*m(?:in)?)?\s*(?:(\d+)\s*s(?:ec)?)?$/i);
  if (minSecMatch && (minSecMatch[1] || minSecMatch[2])) {
    const mins = parseInt(minSecMatch[1] || '0', 10);
    const secs = parseInt(minSecMatch[2] || '0', 10);
    return Math.max(MIN_DURATION_SECONDS, mins * 60 + secs);
  }
  const numeric = parseInt(text.replace(/[^\d]/g, ''), 10);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  return 0;
}

export function formatPrevisDuration(seconds: number): string {
  const safe = Math.max(MIN_DURATION_SECONDS, Math.round(seconds || 0));
  if (safe < 60) return `${safe}s`;
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return secs ? `${mins}m ${secs}s` : `${mins}m`;
}

export function getShotDurationSeconds(shot: SceneShot | null | undefined): number {
  if (!shot) return 0;
  const explicit = parsePrevisDurationSeconds(shot.durationSeconds);
  if (explicit) return explicit;
  const parsed = parsePrevisDurationSeconds(shot.duration);
  if (parsed) return parsed;
  return DEFAULT_SHOT_DURATION_SECONDS;
}

export function getFrameDurationSeconds(frame: StoryboardFrame): number {
  const parsed = parsePrevisDurationSeconds(frame.durationSeconds);
  if (parsed) return parsed;
  return DEFAULT_FRAME_DURATION_SECONDS;
}

export function setShotDurationSeconds(sceneId: string, shotId: number, durationSeconds: number): number {
  const shot = getShotById(sceneId, shotId);
  if (!shot) return 0;
  const safe = Math.max(MIN_DURATION_SECONDS, Math.round(durationSeconds || 0));
  shot.durationSeconds = safe;
  shot.duration = formatPrevisDuration(safe);
  return safe;
}

export function setFrameDurationSeconds(frameId: number, durationSeconds: number): number {
  const frame = (storyboardFrames as StoryboardFrame[]).find((candidate) => candidate.id === frameId);
  if (!frame) return 0;
  const safe = Math.max(MIN_DURATION_SECONDS, Math.round(durationSeconds || 0));
  frame.durationSeconds = safe;
  return safe;
}

export function getSceneDetail(sceneId: string): SceneDetail | null {
  const scenes = currentSceneData as Record<string, SceneDetail>;
  return scenes[sceneId] ?? null;
}

/** Scene for shot designer / camera presets when previs selection is unset. */
export function resolveActiveSceneId(): string | null {
  if (previsSelectionState.sceneId) return previsSelectionState.sceneId;
  if (workspaceState.currentSceneId) return workspaceState.currentSceneId;
  const w = window as { currentSceneId?: string | null };
  if (w.currentSceneId) return w.currentSceneId;

  const scenes = currentSceneData as Record<string, SceneDetail>;
  const ids = Object.keys(scenes).sort();
  for (const id of ids) {
    if (scenes[id]?.coverage?.length) return id;
  }
  return ids[0] ?? null;
}

export function getShotsForScene(sceneId: string): SceneShot[] {
  return getSceneDetail(sceneId)?.coverage ?? [];
}

export function getShotById(sceneId: string, shotId: number): SceneShot | null {
  return getShotsForScene(sceneId).find((s) => s.id === shotId) ?? null;
}

export function getFramesForScene(sceneId: string): StoryboardFrame[] {
  const sceneNum = String(sceneNumberFromSceneId(sceneId));
  return (storyboardFrames as StoryboardFrame[]).filter(
    (f) => String(f.scene || '1').replace(/\D/g, '') === sceneNum.replace(/\D/g, '')
  );
}

export function getFramesForShot(sceneId: string, shotId: number): StoryboardFrame[] {
  const shot = getShotById(sceneId, shotId);
  if (!shot?.frameIds?.length) {
    return (storyboardFrames as StoryboardFrame[]).filter(
      (f) => sceneIdFromStoryboardFrame(f) === sceneId && f.shotId === shotId
    );
  }
  const byId = new Map(
    (storyboardFrames as StoryboardFrame[]).map((f) => [f.id, f] as const)
  );
  return shot.frameIds.map((id) => byId.get(id)).filter((f): f is StoryboardFrame => !!f);
}

export function estimateShotRuntimeSeconds(sceneId: string, shotId: number): number {
  const shot = getShotById(sceneId, shotId);
  if (!shot) return 0;
  const frames = getFramesForShot(sceneId, shotId);
  if (frames.length) {
    const frameSum = frames.reduce((acc, frame) => acc + getFrameDurationSeconds(frame), 0);
    if (frameSum > 0) return frameSum;
  }
  return getShotDurationSeconds(shot);
}

export function estimateSceneRuntimeSeconds(sceneId: string): number {
  const scene = getSceneDetail(sceneId);
  if (!scene) return 0;
  let total = 0;
  for (const shot of scene.coverage ?? []) {
    total += estimateShotRuntimeSeconds(sceneId, shot.id);
  }
  for (const item of scene.broll ?? []) {
    total += parsePrevisDurationSeconds(item.duration) || DEFAULT_FRAME_DURATION_SECONDS;
  }
  for (const item of scene.pickups ?? []) {
    total += parsePrevisDurationSeconds(item.duration) || DEFAULT_FRAME_DURATION_SECONDS;
  }
  return total;
}

export function estimateProjectRuntimeSeconds(): number {
  const scenes = currentSceneData as Record<string, SceneDetail>;
  return Object.keys(scenes).reduce((acc, sceneId) => acc + estimateSceneRuntimeSeconds(sceneId), 0);
}

export function getShotForFrame(frame: StoryboardFrame): SceneShot | null {
  const sceneId = sceneIdFromStoryboardFrame(frame);
  if (frame.shotId == null) return null;
  return getShotById(sceneId, frame.shotId);
}

export function nextShotNumber(sceneId: string): number {
  const shots = getShotsForScene(sceneId);
  const max = shots.reduce((m, s) => Math.max(m, s.number ?? 0), 0);
  return max + 1;
}

export function nextGlobalShotNumber(): number {
  const scenes = currentSceneData as Record<string, SceneDetail>;
  let total = 0;
  const keys = Object.keys(scenes).sort();
  for (const sceneId of keys) {
    total += (scenes[sceneId]?.coverage?.length ?? 0);
  }
  return total + 1;
}

/** Keep `frameIds` on shots and `shotId` on frames in sync. */
export function assignFrameToShot(
  sceneId: string,
  frameId: number,
  shotId: number | null
): void {
  const scenes = currentSceneData as Record<string, SceneDetail>;
  const scene = scenes[sceneId];
  if (!scene) return;

  const frames = storyboardFrames as StoryboardFrame[];
  const frame = frames.find((f) => f.id === frameId);
  if (!frame || sceneIdFromStoryboardFrame(frame) !== sceneId) return;

  for (const shot of scene.coverage ?? []) {
    if (!shot.frameIds) continue;
    const idx = shot.frameIds.indexOf(frameId);
    if (idx >= 0) shot.frameIds.splice(idx, 1);
  }

  if (shotId == null) {
    delete frame.shotId;
    return;
  }

  const shot = scene.coverage?.find((s) => s.id === shotId);
  if (!shot) return;

  frame.shotId = shotId;
  if (!shot.frameIds) shot.frameIds = [];
  if (!shot.frameIds.includes(frameId)) shot.frameIds.push(frameId);
  maybeAdvanceShotToStoryboarded(shot);
}

/** Repair drift between shot.frameIds and frame.shotId. */
export function reconcileShotFrameLinks(sceneId?: string): void {
  const scenes = currentSceneData as Record<string, SceneDetail>;
  const sceneIds = sceneId ? [sceneId] : Object.keys(scenes);
  const frames = storyboardFrames as StoryboardFrame[];

  for (const sid of sceneIds) {
    const scene = scenes[sid];
    if (!scene?.coverage) continue;
    for (const shot of scene.coverage) {
      if (!shot.frameIds) shot.frameIds = [];
      for (const frameId of [...shot.frameIds]) {
        const frame = frames.find((f) => f.id === frameId);
        if (!frame || sceneIdFromStoryboardFrame(frame) !== sid) {
          shot.frameIds = shot.frameIds.filter((id) => id !== frameId);
          continue;
        }
        frame.shotId = shot.id;
      }
    }
    for (const frame of getFramesForScene(sid)) {
      if (frame.shotId == null) continue;
      const shot = scene.coverage.find((s) => s.id === frame.shotId);
      if (!shot) {
        delete frame.shotId;
        continue;
      }
      if (!shot.frameIds) shot.frameIds = [];
      if (!shot.frameIds.includes(frame.id)) shot.frameIds.push(frame.id);
    }
  }
}

/**
 * Create one coverage shot per orphan frame in a scene (1:1).
 * Does not merge frames by scriptLink (per plan).
 */
export function migrateOrphanFrames(sceneId: string): number {
  const scenes = currentSceneData as Record<string, SceneDetail>;
  const scene = scenes[sceneId];
  if (!scene) return 0;

  scene.coverage ??= [];
  const orphans = getFramesForScene(sceneId).filter((f) => f.shotId == null);
  let created = 0;

  for (const frame of orphans) {
    const shotId = Date.now() + created;
    const number = nextShotNumber(sceneId);
    const shot: SceneShot = {
      id: shotId,
      number,
      type: 'Coverage',
      previsRole: 'coverage',
      label: frame.label,
      duration: formatPrevisDuration(DEFAULT_SHOT_DURATION_SECONDS),
      durationSeconds: DEFAULT_SHOT_DURATION_SECONDS,
      scriptLink: frame.scriptLink,
      frameIds: [frame.id],
    };
    scene.coverage.push(shot);
    frame.shotId = shotId;
    created++;
  }

  if (created) reconcileShotFrameLinks(sceneId);
  return created;
}

/** Run reconcile + optional orphan migration for all scenes. */
export function syncProjectShotFrameLinks(opts?: { migrateOrphans?: boolean }): void {
  const scenes = currentSceneData as Record<string, SceneDetail>;
  for (const sceneId of Object.keys(scenes)) {
    if (opts?.migrateOrphans) migrateOrphanFrames(sceneId);
    reconcileShotFrameLinks(sceneId);
  }
}

export function buildShotListRows(): ShotListRow[] {
  const scenes = currentSceneData as Record<string, SceneDetail>;
  const rows: ShotListRow[] = [];
  let globalShot = 0;

  const sceneIds = Object.keys(scenes).sort((a, b) => sceneNumberFromSceneId(a) - sceneNumberFromSceneId(b));

  for (const sceneId of sceneIds) {
    const scene = scenes[sceneId];
    const sceneLabel = (scene.title || '').split(' - ')[0] || '?';
    const sceneNumber = sceneNumberFromSceneId(sceneId);

    if (scene.master) {
      rows.push({
        kind: 'master',
        sceneId,
        sceneLabel,
        sceneNumber,
        type: 'Master Shot',
        label: scene.master.label,
        duration: scene.master.duration,
        status: scene.master.status || '—',
      });
    }

    const coverage = [...(scene.coverage ?? [])].sort(
      (a, b) => (a.number ?? 0) - (b.number ?? 0) || a.id - b.id
    );

    for (const shot of coverage) {
      globalShot++;
      const linked = getFramesForShot(sceneId, shot.id);
      rows.push({
        kind: 'coverage',
        sceneId,
        sceneLabel,
        sceneNumber,
        shotNumber: shot.number ?? globalShot,
        globalShotNumber: globalShot,
        type: shot.type || 'Coverage',
        label: shot.label,
        duration: formatPrevisDuration(estimateShotRuntimeSeconds(sceneId, shot.id)),
        status: shot.bestTake ? 'best take' : 'take',
        shotId: shot.id,
        frameCount: linked.length,
        frameLabels: linked.map((f) => f.label),
      });
    }

    for (const b of scene.broll ?? []) {
      rows.push({
        kind: 'broll',
        sceneId,
        sceneLabel,
        sceneNumber,
        type: 'B-Roll',
        label: b.label,
        duration: b.duration,
        status: '—',
      });
    }

    for (const p of scene.pickups ?? []) {
      rows.push({
        kind: 'pickup',
        sceneId,
        sceneLabel,
        sceneNumber,
        type: 'Pickup',
        label: p.label,
        duration: p.duration,
        status: '—',
      });
    }
  }

  return rows;
}

export function highlightScriptForShot(sceneId: string, shot: SceneShot): void {
  const link = shot.scriptLink || getFramesForShot(sceneId, shot.id)[0]?.scriptLink;
  if (!link) return;
  const frame = { scene: String(sceneNumberFromSceneId(sceneId)), scriptLink: link } as StoryboardFrame;
  if (typeof window.highlightScriptForFrame === 'function') {
    window.highlightScriptForFrame(frame);
  }
}

/** Create a coverage shot linked 1:1 to a new storyboard frame. */
export function createCoverageShotForFrame(
  frame: Pick<StoryboardFrame, 'id' | 'label'> & { scene?: string; scriptLink?: string; shotId?: number },
  shotIdOverride?: number,
  cinematography?: Partial<Pick<SceneShot, 'shotType' | 'cameraAngle' | 'cameraMovement' | 'lens' | 'lightingTechnique' | 'composition' | 'expression' | 'emotion'>>,
): SceneShot | null {
  const sceneId = sceneIdFromStoryboardFrame(frame);
  const scenes = currentSceneData as Record<string, SceneDetail>;
  const scene = scenes[sceneId];
  if (!scene) return null;

  scene.coverage ??= [];
  const id = shotIdOverride ?? Date.now();
  const shot: SceneShot = {
    id,
    number: nextShotNumber(sceneId),
    type: 'Coverage',
    previsRole: 'coverage',
    label: frame.label,
    duration: formatPrevisDuration(DEFAULT_SHOT_DURATION_SECONDS),
    durationSeconds: DEFAULT_SHOT_DURATION_SECONDS,
    scriptLink: frame.scriptLink,
    frameIds: [frame.id],
    ...cinematography,
  };
  scene.coverage.push(shot);
  frame.shotId = id;
  return shot;
}

export function removeFrameFromAllShots(frameId: number): void {
  const scenes = currentSceneData as Record<string, SceneDetail>;
  for (const scene of Object.values(scenes)) {
    for (const shot of scene.coverage ?? []) {
      if (!shot.frameIds) continue;
      shot.frameIds = shot.frameIds.filter((id) => id !== frameId);
    }
  }
}

export function reorderShotFrameIds(sceneId: string, shotId: number): void {
  const shot = getShotById(sceneId, shotId);
  if (!shot) return;
  const ordered = (storyboardFrames as StoryboardFrame[])
    .filter((f) => sceneIdFromStoryboardFrame(f) === sceneId && f.shotId === shotId)
    .map((f) => f.id);
  shot.frameIds = ordered;
}

export type StoryboardShotGroup = {
  key: string;
  sceneId: string;
  sceneNum: string;
  shotId: number | null;
  shot: SceneShot | null;
  label: string;
  frames: StoryboardFrame[];
};

export function groupStoryboardFramesByShot(): StoryboardShotGroup[] {
  const frames = storyboardFrames as StoryboardFrame[];
  const keyOrder: string[] = [];
  const map = new Map<string, StoryboardFrame[]>();

  for (const frame of frames) {
    const sceneId = sceneIdFromStoryboardFrame(frame);
    const shotId = frame.shotId ?? null;
    const key = `${sceneId}:${shotId ?? 'unassigned'}`;
    if (!map.has(key)) {
      map.set(key, []);
      keyOrder.push(key);
    }
    map.get(key)!.push(frame);
  }

  return keyOrder.map((key) => {
    const groupFrames = map.get(key)!;
    const frame = groupFrames[0];
    const sceneId = sceneIdFromStoryboardFrame(frame);
    const shotId = frame.shotId ?? null;
    const shot = shotId != null ? getShotById(sceneId, shotId) : null;
    const sceneNum = String(frame.scene || '1');
    const label =
      shot != null
        ? `Shot ${formatShotDisplayLabel(sceneNumberFromSceneId(sceneId), shot.number ?? 1)} — ${shot.label}`
        : `Scene ${sceneNum} — Unassigned`;

    return { key, sceneId, sceneNum, shotId, shot, label, frames: groupFrames };
  });
}

function buildScriptTrack(totalRuntimeSeconds: number): PrevisTimelineItem[] {
  const text = projectScreenplay?.text || '';
  const lines = text.split('\n');
  const sceneLineIndices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (/^(INT|EXT|EST|INT\/EXT|I\/E)[. \t\/]/i.test(trimmed) || trimmed.startsWith('.')) {
      sceneLineIndices.push(i);
    }
  }
  if (!sceneLineIndices.length) return [];
  const secPerScene = Math.max(1, Math.round(totalRuntimeSeconds / sceneLineIndices.length));
  let start = 0;
  return sceneLineIndices.map((line, idx) => {
    const durationSeconds = secPerScene;
    const item: PrevisTimelineItem = {
      id: `script-scene-${idx + 1}`,
      sceneId: `scene${String(idx + 1).padStart(2, '0')}`,
      label: lines[line].trim() || `Scene ${idx + 1}`,
      durationSeconds,
      startSeconds: start,
      endSeconds: start + durationSeconds,
    };
    start += durationSeconds;
    return item;
  });
}

function buildDialogueTrack(storyboardItems: PrevisTimelineItem[]): PrevisTimelineItem[] {
  const text = projectScreenplay?.text || '';
  const lines = text.split('\n');
  const dialogueLines = lines
    .map((raw, i) => ({ raw, i }))
    .filter(({ raw }) => /^\s{2,}\S/.test(raw) || /^[A-Z][A-Z0-9\s.'"-]{2,}$/.test(raw.trim()));
  if (!dialogueLines.length || !storyboardItems.length) return [];
  let cursor = 0;
  return dialogueLines.map(({ raw, i }, idx) => {
    const words = raw.trim().split(/\s+/).filter(Boolean).length;
    const durationSeconds = Math.max(1, Math.round(words * 0.45));
    const anchor = storyboardItems[idx % storyboardItems.length];
    const startSeconds = Math.min(anchor.endSeconds, cursor);
    const item: PrevisTimelineItem = {
      id: `dialogue-${i}-${idx}`,
      sceneId: anchor.sceneId,
      shotId: anchor.shotId,
      frameId: anchor.frameId,
      label: raw.trim().slice(0, 60) || 'Dialogue',
      durationSeconds,
      startSeconds,
      endSeconds: startSeconds + durationSeconds,
    };
    cursor = item.endSeconds;
    return item;
  });
}

export function buildPrevisTimelineTracks(): PrevisTimelineTracks {
  const storyboard: PrevisTimelineItem[] = [];
  let cursor = 0;
  for (const group of groupStoryboardFramesByShot()) {
    if (!group.frames.length) continue;
    for (const frame of group.frames) {
      const durationSeconds = getFrameDurationSeconds(frame);
      storyboard.push({
        id: `frame-${frame.id}`,
        sceneId: group.sceneId,
        shotId: group.shotId ?? undefined,
        frameId: frame.id,
        label: frame.label,
        durationSeconds,
        startSeconds: cursor,
        endSeconds: cursor + durationSeconds,
      });
      cursor += durationSeconds;
    }
  }
  const totalRuntimeSeconds = cursor;
  const script = buildScriptTrack(totalRuntimeSeconds);
  const dialogue = buildDialogueTrack(storyboard);
  const sfx = storyboard
    .filter((item, idx) => idx % 3 === 0)
    .map((item, idx) => ({
      ...item,
      id: `sfx-${item.id}`,
      label: idx % 2 ? 'Env Ambience' : 'Pulse Tone',
      durationSeconds: Math.max(1, Math.round(item.durationSeconds * 0.65)),
      endSeconds: item.startSeconds + Math.max(1, Math.round(item.durationSeconds * 0.65)),
    }));
  const music = storyboard.length
    ? [
        {
          id: 'music-bed-main',
          sceneId: storyboard[0].sceneId,
          label: 'Atmos Bed',
          durationSeconds: Math.max(1, totalRuntimeSeconds),
          startSeconds: 0,
          endSeconds: Math.max(1, totalRuntimeSeconds),
        },
      ]
    : [];
  const tracks: PrevisTimelineTracks = {
    script,
    dialogue,
    storyboard,
    sfx,
    music,
    custom: [],
    totalRuntimeSeconds,
  };
  timelineClips.length = 0;
  timelineClips.push(
    ...storyboard.map((item, idx) => ({
      id: idx + 1,
      scene: String(sceneNumberFromSceneId(item.sceneId)).padStart(2, '0'),
      label: item.label,
      duration: formatPrevisDuration(item.durationSeconds),
      durationSeconds: item.durationSeconds,
      track: 'storyboard',
      shotId: item.shotId,
      frameId: item.frameId,
      startSeconds: item.startSeconds,
      endSeconds: item.endSeconds,
    }))
  );
  return tracks;
}

export function clearStoryboardFrameSelection(): void {
  window.selectedStoryboardFrameId = null;
  window.renderStoryboard?.();
  emitStoryboardFrameSelected(null);
}

export function selectStoryboardFrameById(frameId: number): void {
  const frames = storyboardFrames as StoryboardFrame[];
  const frame = frames.find((f) => f.id === frameId);
  if (!frame) return;
  window.selectedStoryboardFrameId = frameId;
  window.renderStoryboard?.();
  window.highlightScriptForFrame?.(frame);
  updateInspector('storyboard-frame', frame);
  emitStoryboardFrameSelected(frameId);
  requestAnimationFrame(() => {
    const frameEl = document.querySelector(
      `cinegen-storyboard .storyboard-frame[data-frame-id="${frameId}"]`
    );
    frameEl?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}
