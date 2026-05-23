/** Wave C workspace modules (split by concern; implementation in workspace-bundle). */
export { initWorkspace } from '@/workspace/init-workspace';
export { workspaceState } from '@/workspace/workspace-state';
export {
  switchView,
  setPreprodMode,
  selectTreeNode,
  renderSceneDetail,
  renderOverviewPanel,
  renderAssetDetailPanel,
} from '@/workspace/workspace-bundle';
