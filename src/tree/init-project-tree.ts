import {
  installProjectTreeGlobals,
  primePersistedProjectTreeUi,
  refreshProjectTree,
} from '@/tree/project-tree-service';

export function initProjectTree(): void {
  installProjectTreeGlobals();
  refreshProjectTree();
  primePersistedProjectTreeUi();
}
