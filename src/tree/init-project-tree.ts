import {
  installProjectTreeGlobals,
  refreshProjectTree,
} from '@/tree/project-tree-service';

export function initProjectTree(): void {
  installProjectTreeGlobals();
  refreshProjectTree();
}
