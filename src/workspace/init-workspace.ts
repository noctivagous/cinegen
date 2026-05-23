import { installWorkspaceBundleGlobals, initScriptPaneSegmentedControl } from '@/workspace/workspace-bundle';
import { wireWorkspaceDelegation } from '@/workspace/wire-workspace-delegation';
import { wireWorkspaceStaticActions } from '@/workspace/wire-workspace-actions';

export function initWorkspace(): void {
  installWorkspaceBundleGlobals();
  wireWorkspaceDelegation();
  wireWorkspaceStaticActions();
  initScriptPaneSegmentedControl();
}
