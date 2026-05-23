/** Project hierarchy node (mutable `expanded` lives on legacy projectData). */
export interface TreeNode {
  name: string;
  type: string;
  icon?: string;
  view?: string;
  sceneId?: string;
  preprodMode?: string;
  clSection?: string;
  desc?: string;
  detailKey?: string;
  expanded?: boolean;
  children?: TreeNode[];
  [key: string]: unknown;
}

export interface TreeProjectRoot extends TreeNode {
  type: 'project';
  children?: TreeNode[];
}
