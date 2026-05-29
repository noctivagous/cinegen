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
  getProjectFeaturesConfig,
  getFirstEnabledTreeNodeName,
} from '@/services/project-features-service';
import { requestProjectTreeRefresh } from '@/tree/project-tree-service';
import { applyWorkspaceViewDom } from '@/workspace/view-routing';

export interface WizardCompletionOptions {
  /** Project ID the wizard operated on */
  projectId: string;
  /**
   * Feature branch IDs to enable. Each is passed to
   * `enableFeatureBranch()` (idempotent).
   */
  featureBranches?: string[];
  /**
   * Dirty document keys to mark for incremental autosave.
   * Defaults to `['features']`.
   */
  dirtyDocs?: string[];
  /**
   * If the wizard mutated the screenplay, pass the new text here
   * and the hook will call `syncFountainToProject()` for you.
   */
  fountainText?: string;
  /**
   * If true, the hook will also call `persistActiveProjectSnapshot()`
   * to flush all dirty docs to the server immediately.
   */
  flushSnapshot?: boolean;
  /**
   * View to navigate to after completion. If omitted, the hook
   * attempts to land on the first enabled scene or mood board.
   */
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

  // 1. Sync fountain if text changed
  if (fountainText?.trim()) {
    const { syncFountainToProject } = require('@/script/script-to-project') as typeof import('@/script/script-to-project');
    syncFountainToProject(fountainText, projectId);
    if (!dirtyDocs.includes('screenplay')) dirtyDocs.push('screenplay');
    if (!dirtyDocs.includes('scenes')) dirtyDocs.push('scenes');
    if (!dirtyDocs.includes('breakdown')) dirtyDocs.push('breakdown');
    if (!dirtyDocs.includes('characters')) dirtyDocs.push('characters');
    if (!dirtyDocs.includes('locations')) dirtyDocs.push('locations');
  }

  // 2. Enable feature branches
  for (const branch of featureBranches) {
    enableFeatureBranch(branch);
  }

  // 3. Mark dirty docs
  markProjectDirty(dirtyDocs);

  // 4. Refresh UI
  requestProjectTreeRefresh();

  // 5. Flush snapshot if requested
  if (flushSnapshot) {
    persistActiveProjectSnapshot();
  }

  // 6. Navigate to target view
  if (targetView) {
    applyWorkspaceViewDom(targetView.viewName, targetView.label, targetView.sectionKey ?? null);
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
