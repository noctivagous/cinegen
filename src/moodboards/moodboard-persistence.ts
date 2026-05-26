/**
 * Autosave mood boards: local projects via project snapshot; bundled `.cine` via overlay store.
 */
import { MOOD_BOARDS_STORAGE_KEY } from '@/constants/storage-keys';
import { storageService } from '@/services/persistence';

export type MoodBoardPersistPayload = {
  moodBoards: unknown[];
  activeMoodBoardId: string | null;
};

type MoodBoardStore = Record<string, MoodBoardPersistPayload>;

function readMoodBoardStore(): MoodBoardStore {
  try {
    const raw = storageService.getItem(MOOD_BOARDS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as MoodBoardStore)
      : {};
  } catch (error) {
    console.warn('CineGen: failed to read mood boards store.', error);
    return {};
  }
}

function writeMoodBoardStore(store: MoodBoardStore): void {
  try {
    storageService.setItem(MOOD_BOARDS_STORAGE_KEY, JSON.stringify(store));
  } catch (error) {
    console.warn('CineGen: failed to persist mood boards store.', error);
  }
}

export function loadMoodBoardsOverlay(projectId: string): MoodBoardPersistPayload | null {
  if (!projectId) return null;
  const saved = readMoodBoardStore()[projectId];
  if (!saved || !Array.isArray(saved.moodBoards)) return null;
  return {
    moodBoards: saved.moodBoards,
    activeMoodBoardId:
      typeof saved.activeMoodBoardId === 'string' ? saved.activeMoodBoardId : null,
  };
}

export function saveMoodBoardsOverlay(projectId: string, payload: MoodBoardPersistPayload): void {
  if (!projectId) return;
  const store = readMoodBoardStore();
  store[projectId] = {
    moodBoards: structuredClone(payload.moodBoards),
    activeMoodBoardId: payload.activeMoodBoardId,
  };
  writeMoodBoardStore(store);
}

export function persistMoodBoardsAutosave(opts: {
  projectId: string;
  moodBoards: unknown[];
  activeMoodBoardId: string | null;
  isBundledCine: boolean;
}): void {
  if (!opts.projectId) return;

  if (opts.isBundledCine) {
    saveMoodBoardsOverlay(opts.projectId, {
      moodBoards: opts.moodBoards,
      activeMoodBoardId: opts.activeMoodBoardId,
    });
    return;
  }

  void import('@/services/project-service').then(({ persistActiveProjectSnapshot }) => {
    persistActiveProjectSnapshot(opts.projectId);
  });
}
