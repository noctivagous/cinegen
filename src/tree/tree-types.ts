/** Project hierarchy node (mutable `expanded` lives on legacy projectData). */
export interface TreeNode {
  name: string;
  type: string;
  icon?: string;
  view?: string;
  sceneId?: string;
  /** Coverage shot id when `type` is `scene-shot`. */
  shotId?: number;
  /** Storyboard frame id when `type` is `storyboard-frame`. */
  frameId?: number;
  preprodMode?: string;
  clSection?: string;
  desc?: string;
  detailKey?: string;
  expanded?: boolean;
  /** Stable id from project-feature-catalog (static nodes only). */
  featureId?: string;
  children?: TreeNode[];
  [key: string]: unknown;
}

export interface TreeProjectRoot extends TreeNode {
  type: 'project';
  children?: TreeNode[];
}
