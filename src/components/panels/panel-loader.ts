/**
 * Lazy-loads panel custom-element modules by workspace view name.
 * Called from switchView before showing a view that needs its components defined.
 */

const VIEW_CHUNK: Record<string, string> = {
  'preprod-workspace': 'preprod',
  default: 'preprod',
  breakdown: 'production',
  'scene-detail': 'production',
  timeline: 'production',
  'location-scout': 'production',
  'camera-lighting': 'production',
  casting: 'production',
  assets: 'assets',
  'asset-detail': 'assets',
  overview: 'assets',
  'project-overview': 'assets',
  'review-queue': 'assets',
  'chip-global': 'global',
  moodboards: 'moodboards',
  'moodboard-detail': 'moodboards',
  scratchpad: 'scratchpad',
  drafts: 'drafts',
  'beat-board': 'beatboard',
};

/** Custom element tag for each workspace view host (index.html light DOM). */
export const VIEW_HOST_TAG: Record<string, string> = {
  'preprod-workspace': 'cinegen-preprod-workspace',
  breakdown: 'cinegen-breakdown-view',
  'scene-detail': 'cinegen-scene-detail-view',
  timeline: 'cinegen-timeline-view',
  'location-scout': 'cinegen-location-scout-view',
  assets: 'cinegen-assets-view',
  'camera-lighting': 'cinegen-camera-lighting-view',
  casting: 'cinegen-casting-view',
  'chip-global': 'cinegen-chip-global-view',
  overview: 'cinegen-overview-view',
  'project-overview': 'cinegen-project-overview-view',
  'asset-detail': 'cinegen-asset-detail-view',
  'review-queue': 'cinegen-review-queue-view',
  moodboards: 'cinegen-moodboards-view',
  'moodboard-detail': 'cinegen-moodboard-item-detail',
  scratchpad: 'cinegen-scratchpad-panel',
  drafts: 'cinegen-drafts-panel',
  'beat-board': 'cinegen-beatboard-placeholder',
  default: 'cinegen-workspace-empty',
};

const chunkLoaders: Record<string, () => Promise<unknown>> = {
  preprod: () => import('@/components/panels/chunk-preprod'),
  production: () => import('@/components/panels/chunk-production'),
  assets: () => import('@/components/panels/chunk-assets'),
  global: () => import('@/components/panels/chunk-global'),
  moodboards: () => import('@/components/panels/chunk-moodboards'),
  scratchpad: () => import('@/components/panels/chunk-scratchpad'),
  drafts: () => import('@/components/panels/chunk-drafts'),
  beatboard: () => import('@/components/panels/chunk-beatboard-placeholder'),
};

const loadedChunks = new Set<string>(['preprod']);

export function markPanelChunkLoaded(key: string): void {
  loadedChunks.add(key);
}

function chunkKeyForView(viewName: string): string | null {
  return VIEW_CHUNK[viewName] ?? null;
}

export function isPanelChunkLoaded(viewName: string): boolean {
  const key = chunkKeyForView(viewName);
  return !key || loadedChunks.has(key);
}

export async function ensurePanelForView(viewName: string): Promise<void> {
  const key = chunkKeyForView(viewName);
  if (!key || loadedChunks.has(key)) return;
  const load = chunkLoaders[key];
  if (!load) return;
  await load();
  loadedChunks.add(key);
}

/** Warm secondary panel chunks after first paint (non-blocking). */
export function preloadPanelChunksIdle(): void {
  const run = () => {
    void chunkLoaders.production?.();
    void chunkLoaders.assets?.();
  };
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: 4000 });
  } else {
    setTimeout(run, 1500);
  }
}
