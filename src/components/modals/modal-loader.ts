/**
 * Lazy-loads modal custom elements and markup before first open.
 */

const MODAL_CHUNKS: Record<string, () => Promise<unknown>> = {
  'setup-assistant-modal': () => import('@/components/modals/cinegen-setup-assistant-modal'),
  'debug-modal': () => import('@/components/modals/debug-modal-mount'),
  'guide-modal': () => import('@/components/modals/chunk-guide'),
  'projects-modal': () => import('@/components/modals/chunk-projects'),
  'settings-modal': () => import('@/components/modals/chunk-settings'),
  'ai-assist-modal': () => import('@/components/modals/cinegen-ai-assist-modal-lead'),
  'project-settings-modal': () => import('@/components/modals/chunk-project-settings'),
  'ai-providers-modal': () => import('@/components/modals/chunk-ai-providers'),
  'ai-provider-info-modal': () => import('@/components/modals/chunk-ai-provider-info'),
  'section-settings-modal': () => import('@/components/modals/chunk-section-settings'),
};

const loaded = new Set<string>();

export async function ensureModalReady(modalId: string): Promise<void> {
  if (loaded.has(modalId)) return;
  const load = MODAL_CHUNKS[modalId];
  if (!load) return;
  await load();
  loaded.add(modalId);
}
