import { projectData } from '@/data/project-data';
import { getCinegenOverviewPanel } from '@/panels/panel-hosts';
import { overviewVisibleChildren } from '@/workspace/overview-helpers';
import { switchView } from '@/workspace/view-routing';
import { workspaceState } from '@/workspace/workspace-state';
import type { TreeNode } from '@/tree/tree-types';
import { escHtml } from '@/utils/html';

function projectRootNode(): TreeNode {
  return projectData as unknown as TreeNode;
}

/** Populate the project overview workspace from the live project tree root. */
export function renderProjectOverviewPanel(): void {
  const node = projectRootNode();
  const titleEl = document.getElementById('project-overview-panel-title');
  if (!titleEl) return;

  workspaceState.overviewNodeRefs = [];
  workspaceState.overviewCurrentNode = node;
  workspaceState.overviewSectionKey = null;
  workspaceState.overviewSelectedCardIdx = -1;

  const icon = node.icon || 'fa-film';
  titleEl.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i> ${escHtml(String(node.name || 'Project').toUpperCase())}`;

  overviewVisibleChildren(node).forEach((child) => workspaceState.overviewNodeRefs.push(child));
  getCinegenOverviewPanel()?.syncFromWorkspace();
}

/** Open the project overview workspace view in the main area. */
export async function openProjectOverview(): Promise<void> {
  await switchView('project-overview', 'Project Overview', null);
  renderProjectOverviewPanel();
}
