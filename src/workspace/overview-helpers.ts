import { assetDetailData, projectData } from '@/data/project-data';
import type { TreeNode } from '@/tree/tree-types';
import { isNodeVisible } from '@/services/section-visibility-service';

export type OverviewListItem = {
  name: string;
  icon?: string;
  status?: string | null;
  desc?: string;
  tags?: string[];
};

const SECTION_NAME_KEY: Record<string, string> = {
  'Pre-Production': 'preprod',
  'Production Design': 'design',
  'Sound Department': 'sound',
  Scenes: 'scenes',
  Assembly: 'assembly',
  'Global Assets': 'global',
};

export function overviewVisibleChildren(node: TreeNode): TreeNode[] {
  const result: TreeNode[] = [];
  const sectionKey = overviewSectionKeyForNode(node);
  (node.children || []).forEach((child) => {
    if (child.type === 'group') {
      (child.children || []).forEach((gc) => {
        if (isNodeVisible(sectionKey, gc.name)) result.push(gc);
      });
    } else if (child.type !== 'tree-divider' && isNodeVisible(sectionKey, child.name)) {
      result.push(child);
    }
  });
  return result;
}

function nodeContains(parent: TreeNode, target: TreeNode): boolean {
  if (parent === target) return true;
  for (const child of parent.children || []) {
    if (nodeContains(child, target)) return true;
  }
  return false;
}

export function overviewSectionKeyForNode(node: TreeNode | null): string | null {
  if (!node) return null;
  if (SECTION_NAME_KEY[node.name]) return SECTION_NAME_KEY[node.name];
  for (const top of (projectData.children || []) as TreeNode[]) {
    if (top.type === 'tree-divider') continue;
    if (nodeContains(top, node)) return SECTION_NAME_KEY[top.name] || null;
  }
  return null;
}

export function overviewAccentClass(node: TreeNode, sectionKey?: string | null): string {
  const key = sectionKey ?? overviewSectionKeyForNode(node);
  return key ? ` overview-card--section-${key}` : '';
}

export function overviewChildItems(child: TreeNode): OverviewListItem[] {
  if (child.view === 'asset-detail' && child.detailKey) {
    const data = assetDetailData[child.detailKey as keyof typeof assetDetailData];
    if (!data) return [];
    if ('items' in data && data.items) {
      return (data.items as OverviewListItem[]).slice(0, 50);
    }
    if ('rows' in data && data.rows) {
      return data.rows.slice(0, 50).map((row: unknown[], i: number) => ({
        name: String(row[0] || `Row ${i + 1}`),
        icon: 'fa-table-cells',
        status: null,
      }));
    }
  }
  if (child.children) {
    return child.children
      .filter((c) => c.type !== 'tree-divider')
      .slice(0, 50)
      .map((c) => ({ name: c.name, icon: c.icon || 'fa-folder', status: null }));
  }
  return [];
}

export function overviewNodeItemCount(node: TreeNode): number {
  if (node.children) return node.children.filter((c) => c.type !== 'tree-divider').length;
  if (node.detailKey) {
    const data = assetDetailData[node.detailKey as keyof typeof assetDetailData];
    if (data && 'items' in data && data.items) return data.items.length;
    if (data && 'rows' in data && data.rows) return data.rows.length;
  }
  return 0;
}

export function assetStatusClass(status: string | null | undefined): string {
  return `asset-status-${String(status || 'pending').replace(/\s+/g, '-')}`;
}

export function assetStatusLabel(status: string | null | undefined): string {
  return String(status || 'pending').replace(/-/g, ' ');
}
