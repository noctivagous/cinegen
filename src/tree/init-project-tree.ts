import { applyHierarchySectionCssVars } from '@/tree/hierarchy-section-theme';
import {
  installProjectTreeGlobals,
  primePersistedProjectTreeUi,
  refreshProjectTree,
} from '@/tree/project-tree-service';

export function initProjectTree(): void {
  applyHierarchySectionCssVars();
  installProjectTreeGlobals();
  refreshProjectTree();
  primePersistedProjectTreeUi();
}
