import { PREPROD_MODES } from '@/tree/tree-view-contract';
import type { TreeNode } from '@/tree/tree-types';

export type PreprodLayoutMode = 'script' | 'storyboard' | 'both';

export const PREPROD_LAYOUT_CHROME: Record<PreprodLayoutMode, { icon: string; label: string }> = {
  script: { icon: 'fa-scroll', label: 'SCRIPT' },
  storyboard: { icon: 'fa-images', label: 'STORYBOARD' },
  both: { icon: 'fa-columns', label: 'SCRIPT + STORYBOARD' },
};

export function normalizePreprodLayoutMode(mode: unknown): PreprodLayoutMode {
  const next = typeof mode === 'string' ? mode : '';
  return PREPROD_MODES.has(next) ? (next as PreprodLayoutMode) : 'both';
}

export function preprodModeForTreeNode(node: TreeNode | null | undefined): PreprodLayoutMode {
  if (node?.preprodMode) return normalizePreprodLayoutMode(node.preprodMode);
  if (node?.name === 'Script') return 'script';
  if (node?.name === 'Storyboard') return 'storyboard';
  return 'both';
}

/** Apply script / storyboard / split layout to live preprod workspace chrome. */
export function applyPreprodLayoutToDom(mode: PreprodLayoutMode): void {
  const m = normalizePreprodLayoutMode(mode);
  const body = document.getElementById('preprod-body');
  if (!body) return;
  body.classList.remove('mode-script', 'mode-storyboard', 'mode-both');
  body.classList.add(`mode-${m}`);
  const titleEl = document.getElementById('preprod-panel-title');
  if (titleEl) {
    const chrome = PREPROD_LAYOUT_CHROME[m];
    titleEl.innerHTML = `<i class="fa-solid ${chrome.icon}"></i> ${chrome.label}`;
  }
  const toggles = document.getElementById('storyboard-vis-toggles');
  if (toggles) toggles.hidden = m !== 'both' && m !== 'storyboard';
}
